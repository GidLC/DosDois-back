import { formataDataBr } from "../../../data/formataDataBR/formataDataBR.mjs";
import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs";
import separaData from "../../../data/SeparaData/SeparaData.mjs";
import { ACESS_TOKEN_TEST } from "../mpToken.mjs";
import { MP_PLANS } from "../utils/MP_PLANS.mjs";

class AssinaturaModel {
    static createAssinatura = async (planKey, casal, email, token, callback) => {
        try {
            const plan = MP_PLANS[planKey];

            if (!plan) {
                return callback("INVALID_PLAN", null);
            }

            const response = await fetch("https://api.mercadopago.com/preapproval", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${ACESS_TOKEN_TEST}`,
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

            await queryAsync(`
                UPDATE assinaturas SET plano_id = ? status = ?, mp_status = ?, mp_preapproval_id = ?, created_at = ?, updated_at = ? WHERE casal = ?`,
                [plan.id, "pendente", data.status, data.id, data.date_created, data.last_modified, data.external_reference])

            if (!response.ok) {
                console.error("Erro Mercado Pago:", data);
                return callback(data, null);
            }

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
        let statusDB
        const dataAssinatura = formataDataBr(assinatura.date_created)

        if (status == "authorized") {
            statusDB = "ativa"
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

        if (status == "paused") {
            statusDB = "pausada"
        }

        if (status == "cancelled") {
            statusDB = "cancelada"
        }

        if (status == "pending") {
            statusDB = "pendente"
        }

        await queryAsync(`
    UPDATE assinaturas
    SET status = ?, updated_at = NOW()
    WHERE mp_preapproval_id = ?
    `, [statusDB, mpId]
        )
    };
}

export default AssinaturaModel;