import AssinaturaModel from "../models/assinaturasModel.mjs";
import AssinaturaEventosModel from "../models/assinaturaEventosModel.mjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../../data/apiConfig.mjs";
import { MP_ACCESS_TOKEN, MP_ENV } from "../mpToken.mjs";
import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs";
import { BILLING_PROVIDER, IS_ASAAS_BILLING_PROVIDER } from "../billingProviderConfig.mjs";
import { ASAAS_ENV, ASAAS_WEBHOOK_TOKEN } from "../asaasConfig.mjs";

const getCodCasalFromAuth = async (auth) => {
    if (auth?.cod_casal) return auth.cod_casal;
    if (!auth?.id) return null;

    const [usuario] = await queryAsync(
        "SELECT casal FROM usuario WHERE id = ? LIMIT 1",
        [auth.id],
    );

    return usuario?.casal || null;
}

const trackAssinaturaEvento = (payload) => {
    void AssinaturaEventosModel.registrar(payload);
}

const getAuthContextFromBearer = (req) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) return null;

    try {
        const usuario = jwt.verify(token, JWT_SECRET);

        return {
            id: usuario.id,
            cod_casal: usuario.cod_casal ?? usuario.casal ?? usuario.auth ?? null,
            id_parceiro: usuario.id_parceiro ?? null,
        };
    } catch {
        return null;
    }
}

const getCheckoutContext = (checkoutToken) => {
    if (!checkoutToken) return null;

    try {
        const checkout = jwt.verify(checkoutToken, JWT_SECRET);
        return checkout?.purpose === "checkout" ? checkout : null;
    } catch {
        return null;
    }
}

const getClientIp = (req) => {
    const forwardedFor = req?.headers?.["x-forwarded-for"];
    const rawIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || req?.ip || req?.socket?.remoteAddress || "");

    return rawIp.split(",")[0].trim();
}

const normalizaEmail = (email) =>
    String(email || "").trim().toLowerCase();

const isEmailValido = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getPreferenceInternalReference = (externalReference) => {
    const match = String(externalReference || "").match(/^DD_MPREF_([0-9A-Za-z_-]+)/);
    return match?.[1] || null;
}

const createCheckout = async (req, res) => {
    try {
        const { offerId, planKey } = req.body
        const codigoOferta = offerId || planKey
        const auth = req.authContext
        const codCasal = await getCodCasalFromAuth(auth)

        if (!codigoOferta) {
            trackAssinaturaEvento({
                evento: "checkout_failed",
                source: "app",
                status: "oferta_nao_informada",
                usuario: auth?.id,
                req,
            });

            return res.status(400).json({
                error: 'CHECKOUT_INVALIDO',
                message: 'Oferta nao informada para iniciar o checkout.',
            })
        }

        if (!codCasal) {
            trackAssinaturaEvento({
                evento: "checkout_failed",
                source: "app",
                status: "cadastro_incompleto",
                offerId: codigoOferta,
                usuario: auth?.id,
                req,
            });

            return res.status(400).json({
                error: 'CHECKOUT_SEM_CASAL',
                message: 'Finalize seu cadastro ou entre novamente antes de assinar.',
            })
        }

        const assinaturaAtual = await AssinaturaModel.getAssinaturaCorrente(codCasal)

        if (assinaturaAtual) {
            trackAssinaturaEvento({
                evento: "checkout_failed",
                source: "app",
                status: "assinatura_existente",
                contexto: req.body?.contexto,
                offerId: codigoOferta,
                casal: codCasal,
                usuario: auth?.id,
                assinaturaId: assinaturaAtual.id,
                req,
            });

            return res.status(409).json({
                error: 'ASSINATURA_JA_EXISTE',
                message: 'Ja existe uma assinatura ativa ou em processamento para este casal.',
            })
        }

        const oferta = await AssinaturaModel.getOfertaAtiva(codigoOferta)

        if (!oferta) {
            trackAssinaturaEvento({
                evento: "checkout_failed",
                source: "app",
                status: "oferta_indisponivel",
                contexto: req.body?.contexto,
                offerId: codigoOferta,
                casal: codCasal,
                usuario: auth?.id,
                req,
            });

            return res.status(404).json({
                error: 'OFERTA_INDISPONIVEL',
                message: 'Esta oferta nao esta disponivel agora.',
            })
        }

        const checkoutToken = jwt.sign(
            {
                purpose: 'checkout',
                cod_casal: codCasal,
                userId: auth.id,
                offerId: oferta.codigo,
            },
            JWT_SECRET,
            { expiresIn: '15m' },
        )

        trackAssinaturaEvento({
            evento: "checkout_created",
            source: "app",
            status: "success",
            contexto: req.body?.contexto,
            offerId: oferta.codigo,
            casal: codCasal,
            usuario: auth?.id,
            metadata: {
                periodicidade: oferta.periodicidade,
                promocional: Boolean(oferta.promocional),
                valor: oferta.valor,
            },
            req,
        });

        return res.status(200).json({
            message: 'Checkout criado com sucesso',
            checkoutToken,
        })
    } catch (error) {
        console.error('Erro ao criar checkout', error)
        return res.status(error.status || 500).json({
            error: error.code || 'ERRO_CRIAR_CHECKOUT',
            message: error.message || 'Nao foi possivel iniciar o checkout agora.',
        })
    }
}

const createPreferenceValidacao = async (req, res) => {
    let codigoOferta = null;
    let auth = null;
    let codCasal = null;
    let referenceEventId = null;

    try {
        const { offerId, planKey, email } = req.body || {};
        codigoOferta = offerId || planKey;
        auth = req.authContext;
        codCasal = await getCodCasalFromAuth(auth);

        if (!codigoOferta) {
            return res.status(400).json({
                error: "OFERTA_NAO_INFORMADA",
                message: "Oferta nao informada para criar a preferencia de validacao.",
            });
        }

        if (!codCasal) {
            return res.status(400).json({
                error: "CHECKOUT_SEM_CASAL",
                message: "Finalize seu cadastro ou entre novamente antes de criar a preferencia.",
            });
        }

        const oferta = await AssinaturaModel.getOfertaAtiva(codigoOferta);

        if (!oferta) {
            return res.status(404).json({
                error: "OFERTA_INDISPONIVEL",
                message: "Esta oferta nao esta disponivel agora.",
            });
        }

        referenceEventId = await AssinaturaEventosModel.registrar({
            evento: "mp_preference_validation_requested",
            source: "app",
            contexto: req.body?.contexto || "mercado_pago_validation",
            offerId: oferta.codigo,
            casal: codCasal,
            usuario: auth?.id,
            status: "processing",
            metadata: { mercadoPagoEnv: MP_ENV },
            req,
        });

        if (!referenceEventId) {
            return res.status(500).json({
                error: "REFERENCIA_INTERNA_NAO_REGISTRADA",
                message: "Nao foi possivel registrar o ID interno antes de criar a preferencia.",
            });
        }

        const preference = await AssinaturaModel.createCheckoutPreference(
            oferta.codigo,
            referenceEventId,
            { email },
        );

        await AssinaturaEventosModel.registrar({
            evento: "mp_preference_validation_created",
            source: "backend",
            contexto: req.body?.contexto || "mercado_pago_validation",
            offerId: oferta.codigo,
            casal: codCasal,
            usuario: auth?.id,
            status: "success",
            metadata: {
                mercadoPagoEnv: preference.mp_environment,
                preferenceId: preference.id,
                externalReference: preference.external_reference,
                referenceEventId,
                requestTraceId: preference.requestTraceId,
            },
            req,
        });

        return res.status(201).json({
            message: "Preferencia Mercado Pago criada para validacao.",
            preferenceId: preference.id,
            externalReference: preference.external_reference,
            initPoint: preference.init_point,
            sandboxInitPoint: preference.sandbox_init_point,
            checkoutUrl: preference.mp_environment === "test"
                ? preference.sandbox_init_point || preference.init_point
                : preference.init_point,
            mercadoPagoEnv: preference.mp_environment,
            requestTraceId: preference.requestTraceId,
        });
    } catch (error) {
        console.error("Erro ao criar preferencia de validacao Mercado Pago", error);

        await AssinaturaEventosModel.registrar({
            evento: "mp_preference_validation_failed",
            source: "backend",
            contexto: req.body?.contexto || "mercado_pago_validation",
            offerId: codigoOferta,
            casal: codCasal,
            usuario: auth?.id,
            status: error?.code || error?.error || "erro",
            metadata: {
                mercadoPagoEnv: error?.mercadoPagoEnv || MP_ENV,
                requestTraceId: error?.requestTraceId,
                referenceEventId,
                message: error?.message,
            },
            req,
        });

        return res.status(error.status || 500).json({
            error: error.code || error.error || "ERRO_CRIAR_PREFERENCIA_MP",
            message: error.message || "Nao foi possivel criar a preferencia no Mercado Pago.",
            mercadoPagoEnv: error?.mercadoPagoEnv || MP_ENV,
            requestTraceId: error?.requestTraceId,
        });
    }
}

const createAssinatura = (req, res) => {
    const { email, token, checkoutToken, deviceSessionId } = req.body
    const payerEmail = normalizaEmail(email);

    let checkout

    try {
        checkout = jwt.verify(checkoutToken, JWT_SECRET)
    } catch {
        trackAssinaturaEvento({
            evento: "payment_failed",
            source: "checkout",
            status: "checkout_expirado_ou_invalido",
            req,
        });

        return res.status(401).json({ error: 'CHECKOUT_EXPIRADO_OU_INVALIDO' })
    }

    if (checkout.purpose !== 'checkout' || !checkout.cod_casal || !checkout.offerId) {
        trackAssinaturaEvento({
            evento: "payment_failed",
            source: "checkout",
            status: "checkout_invalido",
            offerId: checkout?.offerId,
            casal: checkout?.cod_casal,
            usuario: checkout?.userId,
            req,
        });

        return res.status(401).json({ error: 'CHECKOUT_INVALIDO' })
    }

    if (!isEmailValido(payerEmail)) {
        trackAssinaturaEvento({
            evento: "payment_failed",
            source: "checkout",
            status: "email_pagador_invalido",
            offerId: checkout.offerId,
            casal: checkout.cod_casal,
            usuario: checkout.userId,
            metadata: { emailInformado: Boolean(email) },
            req,
        });

        return res.status(400).json({
            error: 'EMAIL_PAGADOR_INVALIDO',
            message: 'Informe um e-mail valido para concluir a assinatura.',
        })
    }

    trackAssinaturaEvento({
        evento: "payment_submit",
        source: "checkout",
        status: "processing",
        offerId: checkout.offerId,
        casal: checkout.cod_casal,
        usuario: checkout.userId,
        metadata: { emailInformado: true },
        req,
    });

    if (IS_ASAAS_BILLING_PROVIDER) {
        const remoteIp = getClientIp(req);
        const paymentData = {
            remoteIp,
        };

        AssinaturaModel.createAssinaturaAsaas(checkout.offerId, checkout.cod_casal, payerEmail, paymentData, { remoteIp }, (err, results) => {
            if (err) {
                console.error('Erro ao registrar assinatura Asaas', {
                    code: err?.code,
                    status: err?.status,
                    message: err?.message,
                    asaasEnv: err?.asaasEnv || ASAAS_ENV,
                    requestTraceId: err?.requestTraceId,
                    asaas: err?.asaas,
                });

                const status = Number.isInteger(err?.status) ? err.status : 500;
                const errorCode = typeof err === 'string'
                    ? err
                    : err?.code || err?.error || 'ERRO_REGISTRAR_ASSINATURA_ASAAS';
                const message = typeof err === 'string'
                    ? 'Nao foi possivel registrar a assinatura agora.'
                    : err?.message || 'Nao foi possivel registrar a assinatura agora.';

                trackAssinaturaEvento({
                    evento: "payment_failed",
                    source: "checkout",
                    status: errorCode,
                    offerId: checkout.offerId,
                    casal: checkout.cod_casal,
                    usuario: checkout.userId,
                    metadata: {
                        billingProvider: BILLING_PROVIDER,
                        httpStatus: status,
                        asaasEnv: err?.asaasEnv || ASAAS_ENV,
                        requestTraceId: err?.requestTraceId,
                    },
                    req,
                });

                return res.status(status).json({
                    error: errorCode,
                    message,
                    billingProvider: BILLING_PROVIDER,
                    asaasEnv: err?.asaasEnv || ASAAS_ENV,
                    requestTraceId: err?.requestTraceId,
                });
            }

            trackAssinaturaEvento({
                evento: "payment_success",
                source: "checkout",
                status: results?.status || "submitted",
                offerId: checkout.offerId,
                casal: checkout.cod_casal,
                usuario: checkout.userId,
                assinaturaId: results?.assinatura_id,
                metadata: {
                    billingProvider: BILLING_PROVIDER,
                    externalReference: results?.external_reference,
                    asaasEnv: results?.asaas_environment || ASAAS_ENV,
                    providerCheckoutId: results?.id,
                },
                req,
            });

            return res.status(200).json({
                message: 'Assinatura registrada com sucesso',
                results,
                status: results?.status,
                assinaturaId: results?.assinatura_id,
                providerCheckoutId: results?.id,
                checkoutUrl: results?.checkout_url || results?.link,
                billingProvider: BILLING_PROVIDER,
                asaasEnv: results?.asaas_environment || ASAAS_ENV,
            });
        });

        return;
    }

    AssinaturaModel.createAssinatura(checkout.offerId, checkout.cod_casal, payerEmail, token, { deviceSessionId }, (err, results) => {
        if (err) {
            console.error('Erro ao registrar assinatura', err);

            const status = Number.isInteger(err?.status) ? err.status : 500;
            const mercadoPagoCause = Array.isArray(err?.cause) ? err.cause[0]?.description : null;
            const errorCode = typeof err === 'string'
                ? err
                : err?.code || err?.error || 'ERRO_REGISTRAR_ASSINATURA';
            const message = typeof err === 'string'
                ? 'Nao foi possivel registrar a assinatura agora.'
                : err?.message || mercadoPagoCause || 'Nao foi possivel registrar a assinatura agora.';

            trackAssinaturaEvento({
                evento: "payment_failed",
                source: "checkout",
                status: errorCode,
                offerId: checkout.offerId,
                casal: checkout.cod_casal,
                usuario: checkout.userId,
                metadata: {
                    mercadoPagoCause,
                    httpStatus: status,
                    mercadoPagoEnv: err?.mercadoPagoEnv,
                    mpPlanId: err?.mpPlanId,
                    offerCode: err?.offerCode,
                    requestTraceId: err?.requestTraceId,
                },
                req,
            });

            return res.status(status).json({
                error: errorCode,
                message,
                mercadoPagoEnv: err?.mercadoPagoEnv,
                requestTraceId: err?.requestTraceId,
            });
        }

        trackAssinaturaEvento({
            evento: "payment_success",
            source: "checkout",
            status: results?.status || "submitted",
            offerId: checkout.offerId,
            casal: checkout.cod_casal,
            usuario: checkout.userId,
            mpPreapprovalId: results?.id,
            assinaturaId: results?.assinatura_id,
            metadata: {
                initPoint: Boolean(results?.init_point),
                externalReference: results?.external_reference,
                mercadoPagoEnv: results?.mp_environment || MP_ENV,
            },
            req,
        });

        res.status(200).json({
            message: 'Assinatura registrada com sucesso',
            results,
            status: results?.status,
            assinaturaId: results?.assinatura_id,
            mpPreapprovalId: results?.id,
            mercadoPagoEnv: results?.mp_environment || MP_ENV,
            init_point: results?.init_point,
        });
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw {
            code: "MP_PREAPPROVAL_FETCH_ERROR",
            status: response.status || 502,
            message: data?.message || "Erro ao consultar assinatura no Mercado Pago",
            mercadoPago: data,
            mercadoPagoEnv: MP_ENV,
            mpResourceId: id,
        };
    }

    return data;
};

const getPagamentoAutorizadoMP = async (id) => {
    if (!MP_ACCESS_TOKEN) {
        throw new Error("MP_ACCESS_TOKEN nao configurado");
    }

    const response = await fetch(
        `https://api.mercadopago.com/authorized_payments/${id}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw {
            code: "MP_AUTHORIZED_PAYMENT_FETCH_ERROR",
            status: response.status || 502,
            message: data?.message || "Erro ao consultar fatura da assinatura no Mercado Pago",
            mercadoPago: data,
            mercadoPagoEnv: MP_ENV,
            mpResourceId: id,
        };
    }

    return data;
};

const getPagamentoMP = async (id) => {
    if (!MP_ACCESS_TOKEN) {
        throw new Error("MP_ACCESS_TOKEN nao configurado");
    }

    const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${id}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw {
            code: "MP_PAYMENT_FETCH_ERROR",
            status: response.status || 502,
            message: data?.message || "Erro ao consultar pagamento no Mercado Pago",
            mercadoPago: data,
            mercadoPagoEnv: MP_ENV,
            mpResourceId: id,
        };
    }

    return data;
};

const mpWebHookHealth = (req, res) => {
    return res.status(200).json({
        ok: true,
        message: "Webhook Mercado Pago ativo",
        mercadoPagoEnv: MP_ENV,
    });
};

const mpWebHook = async (req, res) => {
    try {

        const { type, data } = req.body;

        console.log("Webhook Mercado Pago recebido", { type, id: data?.id });

        trackAssinaturaEvento({
            evento: "webhook_received",
            source: "mercado_pago",
            status: type,
            mpPreapprovalId: data?.id,
            metadata: { type },
            req,
        });

        if (type === "subscription_authorized_payment") {
            const authorizedPayment = await getPagamentoAutorizadoMP(data.id);
            const resultado = await AssinaturaModel.atualizarPagamentoAutorizado(authorizedPayment);

            trackAssinaturaEvento({
                evento: authorizedPayment?.payment?.status === "approved"
                    ? "subscription_payment_approved"
                    : "subscription_payment_not_approved",
                source: "mercado_pago",
                status: authorizedPayment?.payment?.status || authorizedPayment?.status,
                casal: resultado?.assinatura?.casal,
                assinaturaId: resultado?.assinatura?.id,
                mpPreapprovalId: authorizedPayment?.preapproval_id,
                metadata: {
                    authorizedPaymentId: authorizedPayment?.id,
                    authorizedPaymentStatus: authorizedPayment?.status,
                    paymentId: authorizedPayment?.payment?.id,
                    paymentExternalReference: authorizedPayment?.payment?.external_reference,
                    preapprovalExternalReference: resultado?.preapproval?.external_reference,
                    summarized: authorizedPayment?.summarized,
                    paymentStatus: authorizedPayment?.payment?.status,
                    paymentStatusDetail: authorizedPayment?.payment?.status_detail,
                    retryAttempt: authorizedPayment?.retry_attempt,
                },
                req,
            });

            return res.sendStatus(200);
        }

        if (type === "payment") {
            const pagamento = await getPagamentoMP(data.id);
            const externalReference = pagamento?.external_reference;
            const items = Array.isArray(pagamento?.additional_info?.items)
                ? pagamento.additional_info.items
                : [];

            trackAssinaturaEvento({
                evento: pagamento?.status === "approved"
                    ? "preference_payment_approved"
                    : "preference_payment_received",
                source: "mercado_pago",
                status: pagamento?.status,
                metadata: {
                    paymentId: pagamento?.id,
                    paymentStatusDetail: pagamento?.status_detail,
                    paymentMethodId: pagamento?.payment_method_id,
                    preferenceId: pagamento?.preference_id,
                    externalReference,
                    hasExternalReference: Boolean(externalReference),
                    hasItemDescription: items.some((item) => Boolean(item?.description)),
                    preferenceInternalReference: getPreferenceInternalReference(externalReference),
                    transactionAmount: pagamento?.transaction_amount,
                },
                req,
            });

            return res.sendStatus(200);
        }

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
            trackAssinaturaEvento({
                evento: "webhook_subscription_missing",
                source: "mercado_pago",
                status,
                mpPreapprovalId: preapprovalId,
                req,
            });
            console.warn("Assinatura não encontrada:", preapprovalId);
            return res.sendStatus(200);
        }

        await AssinaturaModel.atualizarStatusAssinatura(preapprovalId, status, assinaturaMP);

        trackAssinaturaEvento({
            evento: status === "authorized" ? "subscription_activated" : "subscription_status_updated",
            source: "mercado_pago",
            status,
            casal: assinatura.casal,
            assinaturaId: assinatura.id,
            mpPreapprovalId: preapprovalId,
            metadata: {
                mpStatus: status,
                frequencyType: assinaturaMP?.auto_recurring?.frequency_type,
            },
            req,
        });

        console.log("Assinatura atualizada:", preapprovalId);

        return res.sendStatus(200);

    } catch (error) {

        console.error("Erro webhook MP:", {
            code: error?.code,
            status: error?.status,
            message: error?.message,
            mercadoPagoEnv: error?.mercadoPagoEnv || MP_ENV,
            mpResourceId: error?.mpResourceId,
            mercadoPago: error?.mercadoPago,
        });

        trackAssinaturaEvento({
            evento: error?.code?.startsWith?.("MP_") ? "webhook_fetch_failed" : "webhook_failed",
            source: "mercado_pago",
            status: error?.code || "erro",
            metadata: {
                message: error?.message,
                httpStatus: error?.status,
                mercadoPagoEnv: error?.mercadoPagoEnv || MP_ENV,
                mpResourceId: error?.mpResourceId,
                mercadoPago: error?.mercadoPago,
            },
            req,
        });

        if (error?.code?.startsWith?.("MP_")) {
            return res.sendStatus(200);
        }

        return res.sendStatus(500);
    }
};

const asaasWebHookHealth = (req, res) => {
    return res.status(200).json({
        ok: true,
        message: "Webhook Asaas ativo",
        asaasEnv: ASAAS_ENV,
    });
};

const asaasWebHook = async (req, res) => {
    const event = req.body?.event;
    const payment = req.body?.payment;
    const subscription = req.body?.subscription;
    const eventId = req.body?.id;

    try {
        const receivedToken = String(req.headers?.["asaas-access-token"] || "").trim();

        if (ASAAS_WEBHOOK_TOKEN && receivedToken !== ASAAS_WEBHOOK_TOKEN) {
            console.warn("Webhook Asaas com token invalido", {
                event,
                eventId,
                asaasEnv: ASAAS_ENV,
            });

            return res.sendStatus(401);
        }

        console.log("Webhook Asaas recebido", {
            event,
            eventId,
            paymentId: payment?.id,
            subscriptionId: subscription?.id || payment?.subscription,
        });

        trackAssinaturaEvento({
            evento: "webhook_received",
            source: "asaas",
            status: event,
            metadata: {
                eventId,
                paymentId: payment?.id,
                paymentStatus: payment?.status,
                subscriptionId: subscription?.id || payment?.subscription,
                asaasEnv: ASAAS_ENV,
            },
            req,
        });

        if (event?.startsWith?.("PAYMENT_") && payment?.id) {
            const resultado = await AssinaturaModel.atualizarPagamentoAsaas(payment);

            trackAssinaturaEvento({
                evento: ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event)
                    ? "subscription_payment_approved"
                    : "subscription_payment_status_updated",
                source: "asaas",
                status: payment.status || event,
                casal: resultado?.assinatura?.casal,
                assinaturaId: resultado?.assinatura?.id,
                metadata: {
                    eventId,
                    paymentId: payment.id,
                    subscriptionId: payment.subscription,
                    paymentStatus: payment.status,
                    localStatus: resultado?.statusDB,
                    asaasEnv: ASAAS_ENV,
                },
                req,
            });

            return res.sendStatus(200);
        }

        if (event?.startsWith?.("SUBSCRIPTION_") && subscription?.id) {
            const resultado = await AssinaturaModel.atualizarAssinaturaAsaas(subscription);

            trackAssinaturaEvento({
                evento: "subscription_status_updated",
                source: "asaas",
                status: subscription.status || event,
                casal: resultado?.assinatura?.casal,
                assinaturaId: resultado?.assinatura?.id,
                metadata: {
                    eventId,
                    subscriptionId: subscription.id,
                    subscriptionStatus: subscription.status,
                    localStatus: resultado?.statusDB,
                    asaasEnv: ASAAS_ENV,
                },
                req,
            });

            return res.sendStatus(200);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error("Erro webhook Asaas:", {
            code: error?.code,
            status: error?.status,
            message: error?.message,
            asaasEnv: error?.asaasEnv || ASAAS_ENV,
            asaas: error?.asaas,
        });

        trackAssinaturaEvento({
            evento: "webhook_failed",
            source: "asaas",
            status: error?.code || "erro",
            metadata: {
                event,
                eventId,
                message: error?.message,
                httpStatus: error?.status,
                asaasEnv: error?.asaasEnv || ASAAS_ENV,
                asaas: error?.asaas,
            },
            req,
        });

        if (error?.code?.startsWith?.("ASAAS_")) {
            return res.sendStatus(200);
        }

        return res.sendStatus(500);
    }
};

const getOfertas = async (req, res) => {
    const contexto = req.query?.contexto || 'site_pricing';

    AssinaturaModel.getOfertas((err, results) => {
        if (err) {
            console.error('Erro ao  buscar ofertas', err);
            return res.status(500).json({ error: 'Erro ao buscar ofertas' });
        }

        res.status(200).json({ message: 'Ofertas encontradas com sucesso', results});
    }, contexto)
}

const cancelarAssinatura = async (req, res) => {
    try {
        const auth = req.authContext

        if (!auth?.cod_casal) {
            trackAssinaturaEvento({
                evento: "subscription_cancel_failed",
                source: "app",
                status: "casal_nao_identificado",
                usuario: auth?.id,
                req,
            });

            return res.status(400).json({ error: 'ASSINATURA_INVALIDA' })
        }

        trackAssinaturaEvento({
            evento: "subscription_cancel_requested",
            source: "app",
            status: "requested",
            casal: auth.cod_casal,
            usuario: auth.id,
            req,
        });

        const results = await AssinaturaModel.cancelarAssinatura(auth.cod_casal)

        trackAssinaturaEvento({
            evento: "subscription_cancel_success",
            source: "app",
            status: results?.status,
            casal: auth.cod_casal,
            usuario: auth.id,
            assinaturaId: results?.id,
            req,
        });

        return res.status(200).json({
            message: 'Assinatura cancelada com sucesso',
            results,
        })
    } catch (error) {
        console.error('Erro ao cancelar assinatura', error)
        trackAssinaturaEvento({
            evento: "subscription_cancel_failed",
            source: "app",
            status: error?.code || "erro",
            casal: req.authContext?.cod_casal,
            usuario: req.authContext?.id,
            metadata: { message: error?.message },
            req,
        });

        return res.status(error.status || 500).json({
            error: error.code || 'ERRO_CANCELAR_ASSINATURA',
            message: error.message || 'Nao foi possivel cancelar a assinatura.',
        })
    }
}

const registrarEventoConversao = async (req, res) => {
    const {
        event,
        evento,
        source,
        contexto,
        offerId,
        checkoutToken,
        status,
        metadata,
    } = req.body || {};

    const nomeEvento = evento || event;

    if (!nomeEvento) {
        return res.status(400).json({
            error: "EVENTO_INVALIDO",
            message: "Evento de conversao nao informado.",
        });
    }

    const auth = getAuthContextFromBearer(req);
    const checkout = getCheckoutContext(checkoutToken);

    const eventId = await AssinaturaEventosModel.registrar({
        evento: nomeEvento,
        source: source || "client",
        contexto,
        offerId: offerId || checkout?.offerId,
        casal: auth?.cod_casal || checkout?.cod_casal,
        usuario: auth?.id || checkout?.userId,
        status,
        metadata,
        req,
    });

    return res.status(202).json({
        message: "Evento recebido",
        eventId,
    });
}

export default { createCheckout, createPreferenceValidacao, createAssinatura, mpWebHook, mpWebHookHealth, asaasWebHook, asaasWebHookHealth, getOfertas, cancelarAssinatura, registrarEventoConversao }
