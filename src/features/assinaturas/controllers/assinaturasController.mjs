import AssinaturaModel from "../models/assinaturasModel.mjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../../data/apiConfig.mjs";
import { MP_ACCESS_TOKEN } from "../mpToken.mjs";

const createCheckout = async (req, res) => {
    try {
        const { offerId, planKey } = req.body
        const codigoOferta = offerId || planKey
        const auth = req.authContext

        if (!auth?.cod_casal || !codigoOferta) {
            return res.status(400).json({ error: 'CHECKOUT_INVALIDO' })
        }

        const assinaturaAtual = await AssinaturaModel.getAssinaturaCorrente(auth.cod_casal)

        if (assinaturaAtual) {
            return res.status(409).json({ error: 'ASSINATURA_JA_EXISTE' })
        }

        const oferta = await AssinaturaModel.getOfertaAtiva(codigoOferta)

        if (!oferta) {
            return res.status(404).json({ error: 'OFERTA_INDISPONIVEL' })
        }

        const checkoutToken = jwt.sign(
            {
                purpose: 'checkout',
                cod_casal: auth.cod_casal,
                userId: auth.id,
                offerId: oferta.codigo,
            },
            JWT_SECRET,
            { expiresIn: '15m' },
        )

        return res.status(200).json({
            message: 'Checkout criado com sucesso',
            checkoutToken,
        })
    } catch (error) {
        console.error('Erro ao criar checkout', error)
        return res.status(500).json({ error: 'Erro ao criar checkout' })
    }
}

const createAssinatura = (req, res) => {
    const { email, token, checkoutToken } = req.body

    let checkout

    try {
        checkout = jwt.verify(checkoutToken, JWT_SECRET)
    } catch {
        return res.status(401).json({ error: 'CHECKOUT_EXPIRADO_OU_INVALIDO' })
    }

    if (checkout.purpose !== 'checkout' || !checkout.cod_casal || !checkout.offerId) {
        return res.status(401).json({ error: 'CHECKOUT_INVALIDO' })
    }

    AssinaturaModel.createAssinatura(checkout.offerId, checkout.cod_casal, email, token, (err, results) => {
        if (err) {
            console.error('Erro ao registrar assinatura', err);
            return res.status(err.status || 500).json({
                error: err.code || 'Erro ao registrar assinatura',
                message: err.message,
            });
        }

        res.status(200).json({ message: 'Assinatura registrada com sucesso', results, init_point: results.init_point });
    })
}

const getAssinaturaMP = async (id) => {
    if (!MP_ACCESS_TOKEN) {
        throw new Error("MP_ACCESS_TOKEN não configurado");
    }

    const response = await fetch(
        `https://api.mercadopago.com/preapproval/${id}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
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

        console.log("Webhook Mercado Pago recebido", { type, id: data?.id });

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

const getOfertas = async (req, res) => {
    AssinaturaModel.getOfertas((err, results) => {
        if (err) {
            console.error('Erro ao  buscar ofertas', err);
            return res.status(500).json({ error: 'Erro ao buscar ofertas' });
        }

        res.status(200).json({ message: 'Ofertas encontradas com sucesso', results});
    })
}

const cancelarAssinatura = async (req, res) => {
    try {
        const auth = req.authContext

        if (!auth?.cod_casal) {
            return res.status(400).json({ error: 'ASSINATURA_INVALIDA' })
        }

        const results = await AssinaturaModel.cancelarAssinatura(auth.cod_casal)

        return res.status(200).json({
            message: 'Assinatura cancelada com sucesso',
            results,
        })
    } catch (error) {
        console.error('Erro ao cancelar assinatura', error)
        return res.status(error.status || 500).json({
            error: error.code || 'ERRO_CANCELAR_ASSINATURA',
            message: error.message || 'Nao foi possivel cancelar a assinatura.',
        })
    }
}

export default { createCheckout, createAssinatura, mpWebHook, getOfertas, cancelarAssinatura }
