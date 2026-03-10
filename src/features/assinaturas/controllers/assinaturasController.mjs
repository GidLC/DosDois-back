import AssinaturaModel from "../models/assinaturasModel.mjs";
import { ACESS_TOKEN_TEST } from "../mpToken.mjs";

const createAssinatura = (req, res) => {
    const { casal, email, planKey, token } = req.body

    AssinaturaModel.createAssinatura(planKey, casal, email, token, (err, results) => {
        if (err) {
            console.error('Erro ao registrar assinatura', err);
            return res.status(500).json({ error: 'Erro ao registrar assinatura' });
        }

        res.status(200).json({ message: 'Assinatura registrada com sucesso', results, init_point: results.init_point });
    })
}

const getAssinaturaMP = async (id) => {
    const response = await fetch(
        `https://api.mercadopago.com/preapproval/${id}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${ACESS_TOKEN_TEST}`,
                "Content-Type": "application/json"
            }
        }
    );

    if (!response.ok) {
        throw new Error("Erro ao consultar assinatura no Mercado Pago");
    }

    return await response.json();
};

const mpWebHook = async (req, res) => {
    try {

        const { type, data } = req.body;

        console.log("Webhook recebido:", req.body);

        if (type !== "subscription_preapproval") {
            return res.sendStatus(200);
        }

        const preapprovalId = data.id;

        // consulta assinatura no MP
        const assinaturaMP = await getAssinaturaMP(preapprovalId);

        //Identifica status atual da assinatura no MP
        const status = assinaturaMP.status;

        console.log("Status MP:", status);

        //Busca a assinatura no banco de dados pelo código da assinatura MP
        const assinatura = await AssinaturaModel.buscarAssinaturaPorMPId(preapprovalId);
        console.log(assinatura)

        if (!assinatura) {
            console.warn("Assinatura não encontrada:", preapprovalId);
            return res.sendStatus(200);
        }

        await AssinaturaModel.atualizarStatusAssinatura(preapprovalId, status, assinaturaMP);

        console.log("Assinatura atualizada:", preapprovalId);

        return res.sendStatus(200);

    } catch (error) {

        console.error("Erro webhook MP:", error);

        return res.sendStatus(500);
    }
};

export default { createAssinatura, mpWebHook }