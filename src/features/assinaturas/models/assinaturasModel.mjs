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

const isAuthorizedPaymentApproved = (authorizedPayment) =>
    authorizedPayment?.payment?.status === "approved";

const statusMpToDb = (status, { paymentApproved = false } = {}) => {
    const statusMap = {
        authorized: paymentApproved ? "ativa" : "pendente",
        paused: "pausada",
        canceled: "cancelada",
        cancelled: "cancelada",
        pending: "pendente",
    };

    return statusMap[status] || status;
};

const fetchMercadoPagoPreapproval = async (mpPreapprovalId) => {
    const response = await fetch(`https://api.mercadopago.com/preapproval/${mpPreapprovalId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw {
            code: "MERCADO_PAGO_GET_ERROR",
            status: response.status || 502,
            message: data?.message || "Nao foi possivel consultar a assinatura no Mercado Pago.",
            mercadoPago: data,
        };
    }

    return data;
};

const fetchLatestAuthorizedPaymentByPreapproval = async (mpPreapprovalId) => {
    const params = new URLSearchParams({
        preapproval_id: mpPreapprovalId,
        limit: "1",
        offset: "0",
    });

    const response = await fetch(`https://api.mercadopago.com/authorized_payments/search?${params.toString()}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) return null;

    return data?.results?.[0] || null;
};

const updateMercadoPagoPreapprovalStatus = async (mpPreapprovalId, status) => {
    const response = await fetch(`https://api.mercadopago.com/preapproval/${mpPreapprovalId}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
    });

    const data = await response.json().catch(() => ({}));

    return { response, data };
};

const isInvalidPreapprovalStatusParam = (data) =>
    String(data?.message || data?.error || "")
        .toLowerCase()
        .includes("invalid preapproval status param");

const getPeriodFromMpFrequency = (autoRecurring = {}) => {
    const frequency = Number(autoRecurring.frequency || 1);
    const safeFrequency = Number.isFinite(frequency) && frequency > 0 ? frequency : 1;
    const frequencyType = autoRecurring.frequency_type;

    if (frequencyType === "months") {
        return { unit: "months", amount: safeFrequency };
    }

    if (frequencyType === "years") {
        return { unit: "years", amount: safeFrequency };
    }

    if (frequencyType === "days") {
        return { unit: "days", amount: safeFrequency };
    }

    return { unit: "months", amount: 1 };
};

const getSubscriptionPeriod = async (assinatura = {}) => {
    if (assinatura.preapproval_plan_id) {
        const [oferta] = await queryAsync(`
            SELECT periodicidade
            FROM planos_ofertas
            WHERE mp_plan_id = ?
            ORDER BY ativo DESC, prioridade DESC, id DESC
            LIMIT 1
        `, [assinatura.preapproval_plan_id]);

        if (oferta?.periodicidade === "anual") {
            return { unit: "years", amount: 1 };
        }

        if (oferta?.periodicidade === "mensal") {
            return { unit: "months", amount: 1 };
        }
    }

    return getPeriodFromMpFrequency(assinatura.auto_recurring);
};

const addSubscriptionPeriod = (date, period) => {
    const nextDate = new Date(date);

    if (period.unit === "years") {
        nextDate.setFullYear(nextDate.getFullYear() + period.amount);
        return nextDate;
    }

    if (period.unit === "days") {
        nextDate.setDate(nextDate.getDate() + period.amount);
        return nextDate;
    }

    nextDate.setMonth(nextDate.getMonth() + period.amount);
    return nextDate;
};

const getPlanPeriodLabel = (periodicidade) =>
    periodicidade === "anual" ? "anual" : "mensal";

const buildMercadoPagoItems = (plan) => {
    const periodLabel = getPlanPeriodLabel(plan.periodicidade);
    const title = plan.nome || `DosDois Premium ${periodLabel}`;

    return [
        {
            title,
            description: `Assinatura ${periodLabel} do plano Premium do app DosDois para gestao financeira de casais.`,
            quantity: 1,
            unit_price: Number(plan.valor),
            currency_id: "BRL",
        },
    ];
};

const safeDeviceSessionId = (deviceSessionId) => {
    if (!deviceSessionId) return null;

    const normalized = String(deviceSessionId).trim();
    return normalized.length <= 255 ? normalized : null;
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
    if (String(assinatura.plano_codigo || assinatura.codigo || '').toLowerCase() === 'free') return false;
    if (["ativa", "pendente"].includes(assinatura.status)) return true;
    if (assinatura.status !== "criando") return false;

    const updatedAt = assinatura.updated_at ? new Date(assinatura.updated_at).getTime() : 0;
    const reservaExpiraEm = 20 * 60 * 1000;

    return updatedAt && Date.now() - updatedAt < reservaExpiraEm;
};

const agrupaBeneficiosPorPlano = (beneficios = []) => {
    return beneficios.reduce((acc, beneficio) => {
        const planoId = beneficio.plano_id;

        if (!acc[planoId]) {
            acc[planoId] = [];
        }

        acc[planoId].push({
            id: beneficio.id,
            codigo: beneficio.codigo,
            modulo_id: beneficio.modulo_id,
            titulo: beneficio.titulo_contexto || beneficio.titulo,
            titulo_base: beneficio.titulo,
            descricao: beneficio.descricao_contexto || beneficio.descricao_curta,
            descricao_curta: beneficio.descricao_curta,
            descricao_longa: beneficio.descricao_longa,
            icone: beneficio.icone,
            categoria: beneficio.categoria,
            destaque: Boolean(beneficio.destaque),
            valor_texto: beneficio.valor_texto,
            ordem: beneficio.ordem_contexto ?? beneficio.ordem_plano ?? beneficio.ordem,
        });

        return acc;
    }, {});
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
            SELECT a.*, p.codigo AS plano_codigo
            FROM assinaturas AS a
            JOIN planos AS p ON p.id = a.plano_id
            WHERE a.casal = ?
              AND LOWER(p.codigo) <> 'free'
              AND (
                a.status IN ('ativa', 'pendente')
                OR (a.status = 'criando' AND a.updated_at >= DATE_SUB(NOW(), INTERVAL 20 MINUTE))
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

    static getAssinaturaCancelavel = async (casal) => {
        const [assinatura] = await queryAsync(`
            SELECT a.*, p.codigo AS plano_codigo
            FROM assinaturas AS a
            JOIN planos AS p ON p.id = a.plano_id
            WHERE a.casal = ?
              AND LOWER(p.codigo) <> 'free'
              AND a.status IN ('ativa', 'pendente', 'criando')
            ORDER BY FIELD(a.status, 'ativa', 'pendente', 'criando'), a.id DESC
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
                    SELECT a.*, p.codigo AS plano_codigo
                    FROM assinaturas AS a
                    LEFT JOIN planos AS p ON p.id = a.plano_id
                    WHERE a.casal = ?
                    ORDER BY a.id DESC
                    LIMIT 1
                    FOR UPDATE
                `,
                [casal],
            );

            if (isAssinaturaCorrente(assinatura)) {
                throw ASSINATURA_DUPLICADA;
            }

            let assinaturaId = assinatura?.id;

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
                const insertResult = await connectionQuery(
                    connection,
                    `
                        INSERT INTO assinaturas
                            (casal, plano_id, status, mp_status, mp_preapproval_id, created_at, updated_at)
                        VALUES (?, ?, 'criando', NULL, NULL, NOW(), NOW())
                    `,
                    [casal, planId],
                );

                assinaturaId = insertResult.insertId;
            }

            await commit(connection);
            return assinaturaId;
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

    static createAssinatura = async (planKey, casal, email, token, optionsOrCallback, maybeCallback) => {
        const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback || {};
        const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;

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
                nome: oferta?.nome_publico || planFallback?.nome,
                valor: oferta?.valor || planFallback?.valor,
                periodicidade: oferta?.periodicidade,
            };

            if (!plan.id || !plan.mpPlanId) {
                return callback("INVALID_PLAN", null);
            }

            const assinaturaId = await this.reservaAssinatura(casal, plan.id);
            const externalReference = `assinatura:${assinaturaId}`;
            const items = buildMercadoPagoItems(plan);
            const deviceSessionId = safeDeviceSessionId(options.deviceSessionId);

            const response = await fetch("https://api.mercadopago.com/preapproval", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                    ...(deviceSessionId ? { "X-meli-session-id": deviceSessionId } : {}),
                },
                body: JSON.stringify({
                    reason: "Assinatura DosDois",
                    external_reference: externalReference,
                    items,
                    payer_email: email,
                    preapproval_plan_id: plan.mpPlanId,
                    card_token_id: token,
                    status: "authorized"
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Erro Mercado Pago:", data);
                await this.marcaFalhaCriacao(casal);
                return callback(data, null);
            }

            const authorizedPayment = data?.id
                ? await fetchLatestAuthorizedPaymentByPreapproval(data.id)
                : null;
            const paymentApproved = isAuthorizedPaymentApproved(authorizedPayment);
            const localStatus = statusMpToDb(data.status, { paymentApproved });

            await queryAsync(`
                UPDATE assinaturas
                SET plano_id = ?,
                    status = ?,
                    mp_status = ?,
                    mp_preapproval_id = ?,
                    created_at = ?,
                    updated_at = ?
                WHERE casal = ?`,
                [plan.id, localStatus, data.status, data.id, data.date_created, data.last_modified, casal])

            await this.atualizarStatusAssinatura(data.id, data.status, data, authorizedPayment);

            return callback(null, {
                ...data,
                assinatura_id: assinaturaId,
                external_reference: externalReference,
            });
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

    static atualizarStatusAssinatura = async (mpId, status, assinatura, authorizedPayment = null) => {
        const payment = authorizedPayment || await fetchLatestAuthorizedPaymentByPreapproval(mpId);
        const statusDB = statusMpToDb(status, {
            paymentApproved: isAuthorizedPaymentApproved(payment),
        })

        if (status == "authorized" && assinatura?.date_created) {
            const dataAssinatura = formataDataBr(assinatura.date_created)
            const period = await getSubscriptionPeriod(assinatura)
            const fimAssinatura = addSubscriptionPeriod(dataAssinatura, period)

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

    static atualizarPagamentoAutorizado = async (authorizedPayment) => {
        if (!authorizedPayment?.preapproval_id) return null;

        const assinatura = await this.buscarAssinaturaPorMPId(authorizedPayment.preapproval_id);
        if (!assinatura) return null;

        const preapproval = await fetchMercadoPagoPreapproval(authorizedPayment.preapproval_id);
        await this.atualizarStatusAssinatura(
            authorizedPayment.preapproval_id,
            preapproval.status,
            preapproval,
            authorizedPayment,
        );

        return {
            assinatura,
            preapproval,
            paymentApproved: isAuthorizedPaymentApproved(authorizedPayment),
        };
    }

    static cancelarAssinatura = async (casal) => {
        if (!MP_ACCESS_TOKEN) {
            throw {
                code: "MP_ACCESS_TOKEN_NOT_CONFIGURED",
                status: 503,
                message: "Mercado Pago nao configurado.",
            };
        }

        const assinatura = await this.getAssinaturaCancelavel(casal);

        if (!assinatura) {
            throw {
                code: "ASSINATURA_CANCELAVEL_NAO_ENCONTRADA",
                status: 404,
                message: "Nenhuma assinatura paga em aberto encontrada.",
            };
        }

        if (!assinatura.mp_preapproval_id) {
            await queryAsync(`
                UPDATE assinaturas
                SET status = 'erro',
                    mp_status = 'cancel_local_sem_mp',
                    updated_at = NOW()
                WHERE id = ?
            `, [assinatura.id]);

            return {
                id: assinatura.id,
                status: "erro",
                mp_status: "cancel_local_sem_mp",
            };
        }

        const assinaturaMP = await fetchMercadoPagoPreapproval(assinatura.mp_preapproval_id);
        const statusAtualMP = assinaturaMP.status;

        if (["canceled", "cancelled"].includes(statusAtualMP)) {
            await this.atualizarStatusAssinatura(assinatura.mp_preapproval_id, statusAtualMP, assinaturaMP);

            return {
                id: assinatura.id,
                status: statusMpToDb(statusAtualMP),
                mp_status: statusAtualMP,
            };
        }

        const cancelStatuses = ["cancelled", "canceled"];
        let response;
        let data;

        for (const cancelStatus of cancelStatuses) {
            const result = await updateMercadoPagoPreapprovalStatus(assinatura.mp_preapproval_id, cancelStatus);
            response = result.response;
            data = result.data;

            if (response.ok || !isInvalidPreapprovalStatusParam(data)) break;
        }

        if (!response.ok) {
            console.error("Erro ao cancelar assinatura no Mercado Pago:", data);

            if (statusAtualMP === "pending") {
                await queryAsync(`
                    UPDATE assinaturas
                    SET status = 'erro',
                        mp_status = ?,
                        updated_at = NOW()
                    WHERE id = ?
                `, [statusAtualMP, assinatura.id]);

                return {
                    id: assinatura.id,
                    status: "erro",
                    mp_status: statusAtualMP,
                    warning: "preapproval_pending_not_canceled",
                };
            }

            throw {
                code: "MERCADO_PAGO_CANCEL_ERROR",
                status: response.status || 502,
                message: data?.message || data?.error || "Nao foi possivel cancelar a assinatura no Mercado Pago.",
                mercadoPago: data,
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

    static getBeneficiosPorPlano = async (planoIds = [], contexto = 'site_pricing') => {
        if (!planoIds.length) return {};

        const placeholders = planoIds.map(() => '?').join(',');

        const beneficios = await queryAsync(`
            SELECT
                pb.plano_id,
                pb.destaque,
                pb.valor_texto,
                pb.ordem AS ordem_plano,
                b.id,
                b.codigo,
                b.modulo_id,
                b.titulo,
                b.descricao_curta,
                b.descricao_longa,
                b.icone,
                b.categoria,
                b.ordem,
                bc.titulo_override AS titulo_contexto,
                bc.descricao_override AS descricao_contexto,
                bc.ordem AS ordem_contexto
            FROM planos_beneficios AS pb
            JOIN beneficios AS b ON b.id = pb.beneficio_id
            LEFT JOIN beneficios_contextos AS bc
                ON bc.beneficio_id = b.id
               AND bc.contexto = ?
               AND bc.ativo = 1
            WHERE pb.plano_id IN (${placeholders})
              AND pb.incluido = 1
              AND pb.ativo = 1
              AND b.ativo = 1
            ORDER BY
                pb.plano_id,
                pb.destaque DESC,
                COALESCE(bc.ordem, pb.ordem, b.ordem),
                b.titulo
        `, [contexto, ...planoIds]);

        return agrupaBeneficiosPorPlano(beneficios);
    }

    static getOfertas = async (callback, contexto = 'site_pricing') => {
        try {
            const queryOfertas = `
                SELECT *
                FROM planos_ofertas
                WHERE ativo = 1
                ORDER BY prioridade DESC, valor ASC
            `

            const ofertas = await queryAsync(queryOfertas)
            const planoIds = [...new Set(ofertas.map(oferta => oferta.plano_id).filter(Boolean))];
            const beneficiosPorPlano = await this.getBeneficiosPorPlano(planoIds, contexto);
            const ofertasComBeneficios = ofertas.map(oferta => ({
                ...oferta,
                beneficios: beneficiosPorPlano[oferta.plano_id] || [],
            }));

            return callback(null, ofertasComBeneficios)
        } catch (error) {
            return callback(error, null)
        }
    }
}

export default AssinaturaModel;
