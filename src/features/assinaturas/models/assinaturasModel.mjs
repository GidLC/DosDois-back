import { formataDataBr } from "../../../data/formataDataBR/formataDataBR.mjs";
import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs";
import { pool } from "../../../config/config.mjs";
import separaData from "../../../data/SeparaData/SeparaData.mjs";
import { MP_ACCESS_TOKEN } from "../mpToken.mjs";
import { MP_PLANS } from "../utils/MP_PLANS.mjs";

const ASSINATURA_DUPLICADA = {
    code: "ASSINATURA_JA_EXISTE",
    status: 409,
    message: "Este casal ja possui uma assinatura ativa ou em processamento.",
};

const statusMpToDb = (status) => {
    const statusMap = {
        authorized: "ativa",
        paused: "pausada",
        canceled: "cancelada",
        cancelled: "cancelada",
        pending: "pendente",
    };

    return statusMap[status] || status;
};

const connectionQuery = (connection, sql, params = []) =>
    new Promise((resolve, reject) => {
        connection.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });

const getConnection = () =>
    new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) return reject(err);
            resolve(connection);
        });
    });

const beginTransaction = (connection) =>
    new Promise((resolve, reject) => {
        connection.beginTransaction((err) => {
            if (err) return reject(err);
            resolve();
        });
    });

const commit = (connection) =>
    new Promise((resolve, reject) => {
        connection.commit((err) => {
            if (err) return reject(err);
            resolve();
        });
    });

const rollback = (connection) =>
    new Promise((resolve) => {
        connection.rollback(() => resolve());
    });

const isAssinaturaCorrente = (assinatura) => {
    if (!assinatura) return false;
    if (["ativa", "pendente"].includes(assinatura.status)) return true;
    if (assinatura.status !== "criando") return false;

    const updatedAt = assinatura.updated_at ? new Date(assinatura.updated_at).getTime() : 0;
    const reservaExpiraEm = 20 * 60 * 1000;

    return updatedAt && Date.now() - updatedAt < reservaExpiraEm;
};

class AssinaturaModel {
    static getOfertaAtiva = async (codigo) => {
        const [oferta] = await queryAsync(`
            SELECT *
            FROM planos_ofertas
            WHERE codigo = ?
              AND ativo = 1
              AND (inicio_vigencia IS NULL OR inicio_vigencia <= NOW())
              AND (fim_vigencia IS NULL OR fim_vigencia >= NOW())
            ORDER BY prioridade DESC
            LIMIT 1
        `, [codigo])

        return oferta
    }

    static getAssinaturaCorrente = async (casal) => {
        const [assinatura] = await queryAsync(`
            SELECT *
            FROM assinaturas
            WHERE casal = ?
              AND (
                status IN ('ativa', 'pendente')
                OR (status = 'criando' AND updated_at >= DATE_SUB(NOW(), INTERVAL 20 MINUTE))
              )
            LIMIT 1
        `, [casal])

        return assinatura
    }

    static getAssinaturaAtiva = async (casal) => {
        const [assinatura] = await queryAsync(`
            SELECT *
            FROM assinaturas
            WHERE casal = ?
              AND status = 'ativa'
            ORDER BY id DESC
            LIMIT 1
        `, [casal])

        return assinatura
    }

    static reservaAssinatura = async (casal, planId) => {
        const connection = await getConnection();

        try {
            await beginTransaction(connection);

            const [lock] = await connectionQuery(
                connection,
                "SELECT GET_LOCK(?, 10) AS locked",
                [`assinatura:${casal}`],
            );

            if (!lock?.locked) {
                throw {
                    code: "ASSINATURA_EM_PROCESSAMENTO",
                    status: 409,
                    message: "Ja existe uma tentativa de assinatura em processamento.",
                };
            }

            const [assinatura] = await connectionQuery(
                connection,
                `
                    SELECT *
                    FROM assinaturas
                    WHERE casal = ?
                    ORDER BY id DESC
                    LIMIT 1
                    FOR UPDATE
                `,
                [casal],
            );

            if (isAssinaturaCorrente(assinatura)) {
                throw ASSINATURA_DUPLICADA;
            }

            if (assinatura) {
                await connectionQuery(
                    connection,
                    `
                        UPDATE assinaturas
                        SET plano_id = ?,
                            status = 'criando',
                            mp_status = NULL,
                            mp_preapproval_id = NULL,
                            updated_at = NOW()
                        WHERE id = ?
                    `,
                    [planId, assinatura.id],
                );
            } else {
                await connectionQuery(
                    connection,
                    `
                        INSERT INTO assinaturas
                            (casal, plano_id, status, mp_status, mp_preapproval_id, created_at, updated_at)
                        VALUES (?, ?, 'criando', NULL, NULL, NOW(), NOW())
                    `,
                    [casal, planId],
                );
            }

            await commit(connection);
        } catch (error) {
            await rollback(connection);
            throw error;
        } finally {
            try {
                await connectionQuery(connection, "SELECT RELEASE_LOCK(?)", [`assinatura:${casal}`]);
            } finally {
                connection.release();
            }
        }
    }

    static marcaFalhaCriacao = async (casal) => {
        await queryAsync(`
            UPDATE assinaturas
            SET status = 'erro',
                mp_status = 'erro',
                updated_at = NOW()
            WHERE casal = ?
              AND status = 'criando'
        `, [casal])
    }

    static createAssinatura = async (planKey, casal, email, token, callback) => {
        try {
            if (!MP_ACCESS_TOKEN) {
                return callback("MP_ACCESS_TOKEN_NOT_CONFIGURED", null);
            }

            const oferta = await this.getOfertaAtiva(planKey);
            const planFallback = MP_PLANS[planKey];
            const plan = {
                id: oferta?.plano_id || planFallback?.id,
                mpPlanId: oferta?.mp_plan_id || oferta?.mpPlanId || planFallback?.mpPlanId,
                codigo: oferta?.codigo || planFallback?.codigo,
                valor: oferta?.valor || planFallback?.valor,
                periodicidade: oferta?.periodicidade,
            };

            if (!plan.id || !plan.mpPlanId) {
                return callback("INVALID_PLAN", null);
            }

            await this.reservaAssinatura(casal, plan.id);

            const response = await fetch("https://api.mercadopago.com/preapproval", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    reason: "Assinatura DosDois",
                    external_reference: casal,
                    payer_email: email,
                    preapproval_plan_id: plan.mpPlanId,
                    card_token_id: token
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Erro Mercado Pago:", data);
                await this.marcaFalhaCriacao(casal);
                return callback(data, null);
            }

            await queryAsync(`
                UPDATE assinaturas
                SET plano_id = ?,
                    status = ?,
                    mp_status = ?,
                    mp_preapproval_id = ?,
                    created_at = ?,
                    updated_at = ?
                WHERE casal = ?`,
                [plan.id, "pendente", data.status, data.id, data.date_created, data.last_modified, casal])

            return callback(null, data);
        } catch (error) {
            console.error("Erro ao registrar assinatura:", error);
            return callback(error, null);
        }
    };

    static buscarAssinaturaPorMPId = async (mpId) => {

        const [rows] = await queryAsync(
            `SELECT * FROM assinaturas WHERE mp_preapproval_id = ?`,
            [mpId]
        )

        return rows;
    };

    static atualizarStatusAssinatura = async (mpId, status, assinatura) => {
        const statusDB = statusMpToDb(status)

        if (status == "authorized") {
            const dataAssinatura = formataDataBr(assinatura.date_created)
            let fimAssinatura = new Date(dataAssinatura)

            if (assinatura.auto_recurring.frequency_type == "months") {
                fimAssinatura.setMonth(fimAssinatura.getMonth() + 1)
            } else {
                fimAssinatura.setFullYear(fimAssinatura.getFullYear() + 1)
            }

            const inicioSeparado = await separaData(dataAssinatura)
            const fimSeparado = await separaData(fimAssinatura.toISOString())

            await queryAsync(`
                UPDATE assinaturas SET inicio = ?, fim = ? WHERE mp_preapproval_id = ?`,
                [`${inicioSeparado.ano}-${inicioSeparado.mes + 1}-${inicioSeparado.dia}`,
                `${fimSeparado.ano}-${fimSeparado.mes + 1}-${fimSeparado.dia}`,
                    mpId,
                ])
        }

        await queryAsync(`
    UPDATE assinaturas
    SET status = ?, mp_status = ?, updated_at = NOW()
    WHERE mp_preapproval_id = ?
    `, [statusDB, status, mpId]
        )
    };

    static cancelarAssinatura = async (casal) => {
        if (!MP_ACCESS_TOKEN) {
            throw {
                code: "MP_ACCESS_TOKEN_NOT_CONFIGURED",
                status: 503,
                message: "Mercado Pago nao configurado.",
            };
        }

        const assinatura = await this.getAssinaturaAtiva(casal);

        if (!assinatura) {
            throw {
                code: "ASSINATURA_ATIVA_NAO_ENCONTRADA",
                status: 404,
                message: "Nenhuma assinatura ativa encontrada.",
            };
        }

        if (!assinatura.mp_preapproval_id) {
            throw {
                code: "ASSINATURA_SEM_MERCADO_PAGO",
                status: 409,
                message: "Esta assinatura nao possui identificador do Mercado Pago.",
            };
        }

        const response = await fetch(`https://api.mercadopago.com/preapproval/${assinatura.mp_preapproval_id}`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: "canceled" })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Erro ao cancelar assinatura no Mercado Pago:", data);
            throw {
                code: "MERCADO_PAGO_CANCEL_ERROR",
                status: response.status || 502,
                message: "Nao foi possivel cancelar a assinatura no Mercado Pago.",
            };
        }

        const nextStatus = data.status || "canceled";
        await this.atualizarStatusAssinatura(assinatura.mp_preapproval_id, nextStatus, data);

        return {
            id: assinatura.id,
            status: statusMpToDb(nextStatus),
            mp_status: nextStatus,
        };
    }

    static getOfertas = async (callback) => {
        try {
            const queryOfertas = `SELECT * FROM planos_ofertas WHERE ativo = 1`

            const ofertas = await queryAsync(queryOfertas)

            return callback(null, ofertas)
        } catch (error) {
            return callback(error, null)
        }
    }
}

export default AssinaturaModel;
