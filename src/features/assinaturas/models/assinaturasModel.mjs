import { formataDataBr } from "../../../data/formataDataBR/formataDataBR.mjs";
import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs";
import { pool } from "../../../config/config.mjs";
import separaData from "../../../data/SeparaData/SeparaData.mjs";
import { MP_ACCESS_TOKEN, MP_ENV, MP_WEBHOOK_URL, getMercadoPagoPlanIdOverride } from "../mpToken.mjs";
import { ASAAS_CHECKOUT_CANCEL_URL, ASAAS_CHECKOUT_EXPIRED_URL, ASAAS_CHECKOUT_SUCCESS_URL, ASAAS_ENV } from "../asaasConfig.mjs";
import { createAsaasCheckout, deleteAsaasSubscription, getAsaasSubscription } from "../asaasClient.mjs";
import { MP_PLANS } from "../utils/MP_PLANS.mjs";
import { randomUUID } from "crypto";

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

const buildPlanTitle = (plan) => {
    const periodLabel = getPlanPeriodLabel(plan.periodicidade);

    return plan.nome || `DosDois Premium ${periodLabel}`;
};

const buildPlanDescription = (plan) => {
    const periodLabel = getPlanPeriodLabel(plan.periodicidade);

    return `Assinatura ${periodLabel} do plano Premium do app DosDois para gestao financeira de casais.`;
};

const buildMercadoPagoItems = (plan) => {
    const title = buildPlanTitle(plan);

    return [
        {
            title,
            description: buildPlanDescription(plan),
            quantity: 1,
            unit_price: Number(plan.valor),
            currency_id: "BRL",
        },
    ];
};

const buildMercadoPagoPreferenceItems = (plan) =>
    buildMercadoPagoItems(plan).map((item) => ({
        ...item,
        id: String(plan.codigo || plan.id || item.title).slice(0, 256),
        description: item.description || buildPlanDescription(plan),
    }));

const periodicidadeToAsaasCycle = (periodicidade) =>
    periodicidade === "anual" ? "YEARLY" : "MONTHLY";

const toDateOnly = (date = new Date()) =>
    date.toISOString().slice(0, 10);

const statusAsaasPaymentToDb = (status) => {
    const statusMap = {
        RECEIVED: "ativa",
        CONFIRMED: "ativa",
        RECEIVED_IN_CASH: "ativa",
        PENDING: "pendente",
        OVERDUE: "pendente",
        REFUNDED: "cancelada",
        REFUND_REQUESTED: "pendente",
        CHARGEBACK_REQUESTED: "pendente",
        CHARGEBACK_DISPUTE: "pendente",
        AWAITING_CHARGEBACK_REVERSAL: "pendente",
        DUNNING_REQUESTED: "pendente",
        DUNNING_RECEIVED: "ativa",
        DELETED: "cancelada",
        CANCELLED: "cancelada",
    };

    return statusMap[String(status || "").toUpperCase()] || "pendente";
};

const statusAsaasSubscriptionToDb = (status) => {
    const statusMap = {
        ACTIVE: "pendente",
        INACTIVE: "pausada",
        DELETED: "cancelada",
        CANCELLED: "cancelada",
    };

    return statusMap[String(status || "").toUpperCase()] || "pendente";
};

const getPeriodFromAsaasCycle = (cycle) => {
    const normalizedCycle = String(cycle || "").toUpperCase();

    if (normalizedCycle === "YEARLY") {
        return { unit: "years", amount: 1 };
    }

    if (normalizedCycle === "SEMIANNUALLY") {
        return { unit: "months", amount: 6 };
    }

    if (normalizedCycle === "QUARTERLY") {
        return { unit: "months", amount: 3 };
    }

    if (normalizedCycle === "BIWEEKLY") {
        return { unit: "days", amount: 14 };
    }

    if (normalizedCycle === "WEEKLY") {
        return { unit: "days", amount: 7 };
    }

    return { unit: "months", amount: 1 };
};

const safeDeviceSessionId = (deviceSessionId) => {
    if (!deviceSessionId) return null;

    const normalized = String(deviceSessionId).trim();
    return normalized.length <= 255 ? normalized : null;
};

const normalizaEmail = (email) =>
    String(email || "").trim().toLowerCase();

const isEmailValido = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isMercadoPagoTemplateMissing = (data) =>
    data?.status === 404
    && String(data?.message || "")
        .toLowerCase()
        .includes("template with id");

const isPayerCollectorModeMismatch = (data) =>
    String(data?.message || "")
        .toLowerCase()
        .includes("both payer and collector must be real or test users");

const isCardTokenServiceNotFound = (data) =>
    String(data?.message || "")
        .toLowerCase()
        .includes("card token service not found");

const isMercadoPagoInternalError = (data, status) =>
    Number(status || data?.status) >= 500
    || String(data?.message || "")
        .toLowerCase()
        .includes("internal server error");

const getMercadoPagoPlanEnvName = (offerCode) =>
    `MP_PLAN_ID_${String(offerCode || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_TEST`;

const buildExternalReference = (referenceId, prefix = "DD_ASSINATURA") => {
    const safePrefix = String(prefix || "DD_REF").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 40) || "DD_REF";
    const safeReferenceId = String(referenceId || randomUUID()).replace(/[^0-9A-Za-z_-]/g, "");

    return `${safePrefix}_${safeReferenceId}`.slice(0, 150);
};

const maskEmail = (email) => {
    const [name = "", domain = ""] = String(email || "").split("@");
    const visibleName = name.slice(0, 2);

    return domain ? `${visibleName}***@${domain}` : "";
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

    static reservaAssinatura = async (casal, planId, billingProvider = "mercado_pago") => {
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
                            billing_provider = ?,
                            provider_subscription_id = NULL,
                            provider_checkout_id = NULL,
                            provider_external_reference = NULL,
                            provider_customer_id = NULL,
                            provider_payment_id = NULL,
                            provider_status = NULL,
                            updated_at = NOW()
                        WHERE id = ?
                    `,
                    [planId, billingProvider, assinatura.id],
                );
            } else {
                const insertResult = await connectionQuery(
                    connection,
                    `
                        INSERT INTO assinaturas
                            (casal, plano_id, status, mp_status, mp_preapproval_id, billing_provider, created_at, updated_at)
                        VALUES (?, ?, 'criando', NULL, NULL, ?, NOW(), NOW())
                    `,
                    [casal, planId, billingProvider],
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
            SET status = 'cancelada',
                mp_status = 'creation_failed',
                provider_status = COALESCE(provider_status, 'creation_failed'),
                updated_at = NOW()
            WHERE casal = ?
              AND status = 'criando'
        `, [casal])
    }

    static createCheckoutPreference = async (planKey, internalReferenceId, options = {}) => {
        if (!MP_ACCESS_TOKEN) {
            throw {
                code: "MP_ACCESS_TOKEN_NOT_CONFIGURED",
                status: 500,
                message: "Configure MP_ACCESS_TOKEN para criar preferencias no Mercado Pago.",
                mercadoPagoEnv: MP_ENV,
            };
        }

        const payerEmail = normalizaEmail(options.email);

        if (payerEmail && !isEmailValido(payerEmail)) {
            throw {
                code: "EMAIL_PAGADOR_INVALIDO",
                status: 400,
                message: "Informe um e-mail valido para criar a preferencia.",
            };
        }

        const oferta = await this.getOfertaAtiva(planKey);
        const planFallback = MP_PLANS[planKey];
        const planCode = oferta?.codigo || planKey || planFallback?.codigo;
        const plan = {
            id: oferta?.plano_id || planFallback?.id,
            codigo: planCode,
            nome: oferta?.nome_publico || planFallback?.nome,
            valor: oferta?.valor || planFallback?.valor,
            periodicidade: oferta?.periodicidade || planFallback?.periodicidade,
        };

        if (!plan.id || !plan.valor) {
            throw {
                code: "INVALID_PLAN",
                status: 400,
                message: "Oferta invalida para criar a preferencia Mercado Pago.",
                offerCode: plan.codigo,
            };
        }

        const externalReference = buildExternalReference(internalReferenceId, "DD_MPREF");
        const requestTraceId = randomUUID();
        const preferencePayload = {
            items: buildMercadoPagoPreferenceItems(plan),
            external_reference: externalReference,
            statement_descriptor: "DOSDOIS",
            ...(payerEmail ? { payer: { email: payerEmail } } : {}),
            ...(MP_WEBHOOK_URL ? { notification_url: MP_WEBHOOK_URL } : {}),
        };

        console.info("Criando preferencia Mercado Pago para validacao", {
            requestTraceId,
            mercadoPagoEnv: MP_ENV,
            offerCode: plan.codigo,
            externalReference,
            payerEmail: payerEmail ? maskEmail(payerEmail) : null,
            hasNotificationUrl: Boolean(MP_WEBHOOK_URL),
        });

        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(preferencePayload),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error("Erro Mercado Pago ao criar preferencia:", {
                requestTraceId,
                httpStatus: response.status,
                mercadoPagoEnv: MP_ENV,
                mercadoPago: data,
            });

            throw {
                code: "MP_PREFERENCE_CREATE_ERROR",
                status: response.status || 502,
                message: data?.message || "Nao foi possivel criar a preferencia no Mercado Pago.",
                mercadoPago: data,
                mercadoPagoEnv: MP_ENV,
                requestTraceId,
            };
        }

        return {
            id: data?.id,
            external_reference: externalReference,
            init_point: data?.init_point,
            sandbox_init_point: data?.sandbox_init_point,
            mp_environment: MP_ENV,
            requestTraceId,
        };
    }

    static createAssinatura = async (planKey, casal, email, token, optionsOrCallback, maybeCallback) => {
        const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback || {};
        const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;

        try {
            if (!MP_ACCESS_TOKEN) {
                return callback("MP_ACCESS_TOKEN_NOT_CONFIGURED", null);
            }

            if (!MP_WEBHOOK_URL) {
                return callback({
                    code: "MP_WEBHOOK_URL_NOT_CONFIGURED",
                    status: 500,
                    message: "Configure MP_WEBHOOK_URL para criar assinaturas com notificacoes Webhook do Mercado Pago.",
                    mercadoPagoEnv: MP_ENV,
                }, null);
            }

            const payerEmail = normalizaEmail(email);

            if (!isEmailValido(payerEmail)) {
                return callback({
                    code: "EMAIL_PAGADOR_INVALIDO",
                    status: 400,
                    message: "Informe um e-mail valido para concluir a assinatura.",
                }, null);
            }

            const oferta = await this.getOfertaAtiva(planKey);
            const planFallback = MP_PLANS[planKey];
            const planCode = oferta?.codigo || planKey || planFallback?.codigo;
            const mpPlanOverride = getMercadoPagoPlanIdOverride(planCode);

            if (MP_ENV === "test" && !mpPlanOverride) {
                const envName = getMercadoPagoPlanEnvName(planCode);

                return callback({
                    code: "MP_TEST_PLAN_ID_NOT_CONFIGURED",
                    status: 400,
                    message: `Configure ${envName} com o ID do plano de assinatura criado no Mercado Pago de teste.`,
                    mercadoPagoEnv: MP_ENV,
                }, null);
            }

            const plan = {
                id: oferta?.plano_id || planFallback?.id,
                mpPlanId: mpPlanOverride || oferta?.mp_plan_id || oferta?.mpPlanId || planFallback?.mpPlanId,
                codigo: planCode,
                nome: oferta?.nome_publico || planFallback?.nome,
                valor: oferta?.valor || planFallback?.valor,
                periodicidade: oferta?.periodicidade || planFallback?.periodicidade,
            };

            if (!plan.id || !plan.mpPlanId) {
                return callback("INVALID_PLAN", null);
            }

            if (MP_ENV === "test" && oferta?.mp_plan_id && plan.mpPlanId === oferta.mp_plan_id) {
                return callback({
                    code: "MP_TEST_PLAN_ID_MATCHES_PRODUCTION",
                    status: 400,
                    message: "O ID de plano configurado para teste esta igual ao mp_plan_id produtivo salvo no banco. Configure MP_PLAN_ID_*_TEST com um preapproval_plan criado no Mercado Pago de teste.",
                    mercadoPagoEnv: MP_ENV,
                    mpPlanId: plan.mpPlanId,
                    offerCode: plan.codigo,
                }, null);
            }

            const assinaturaId = await this.reservaAssinatura(casal, plan.id, "mercado_pago");
            const externalReference = buildExternalReference(assinaturaId);
            const items = buildMercadoPagoItems(plan);
            const reason = buildPlanTitle(plan);
            const description = buildPlanDescription(plan);
            const deviceSessionId = safeDeviceSessionId(options.deviceSessionId);
            const requestTraceId = randomUUID();
            const requestSummary = {
                requestTraceId,
                mercadoPagoEnv: MP_ENV,
                offerCode: plan.codigo,
                mpPlanId: plan.mpPlanId,
                externalReference,
                itemTitle: reason,
                hasItemDescription: Boolean(description),
                payerEmail: maskEmail(payerEmail),
                hasCardToken: Boolean(token),
                hasDeviceSessionId: Boolean(deviceSessionId),
                hasNotificationUrl: Boolean(MP_WEBHOOK_URL),
            };

            console.info("Criando assinatura Mercado Pago", requestSummary);

            const response = await fetch("https://api.mercadopago.com/preapproval", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                    ...(deviceSessionId ? { "X-meli-session-id": deviceSessionId } : {}),
                },
                body: JSON.stringify({
                    reason,
                    external_reference: externalReference,
                    items,
                    payer_email: payerEmail,
                    preapproval_plan_id: plan.mpPlanId,
                    card_token_id: token,
                    notification_url: MP_WEBHOOK_URL,
                    status: "authorized"
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Erro Mercado Pago:", {
                    ...requestSummary,
                    httpStatus: response.status,
                    mercadoPago: data,
                });
                await this.marcaFalhaCriacao(casal);

                if (isMercadoPagoTemplateMissing(data)) {
                    return callback({
                        code: "MP_PREAPPROVAL_PLAN_NOT_FOUND",
                        status: 400,
                        message: "O plano de assinatura configurado nao existe no ambiente de teste do Mercado Pago. Verifique o MP_PLAN_ID_*_TEST e use um preapproval_plan criado com o mesmo vendedor das credenciais de teste.",
                        mercadoPago: data,
                        mercadoPagoEnv: MP_ENV,
                        mpPlanId: plan.mpPlanId,
                        offerCode: plan.codigo,
                    }, null);
                }

                if (isPayerCollectorModeMismatch(data)) {
                    return callback({
                        code: "MP_PAYER_COLLECTOR_MODE_MISMATCH",
                        status: 400,
                        message: "No ambiente de teste do Mercado Pago, comprador e vendedor precisam ser ambos usuarios de teste. Confira se a Public Key do site, o Access Token do backend, o plano de assinatura e o e-mail/cartao do pagador pertencem ao mesmo ambiente de teste.",
                        mercadoPago: data,
                        mercadoPagoEnv: MP_ENV,
                        mpPlanId: plan.mpPlanId,
                        offerCode: plan.codigo,
                    }, null);
                }

                if (isCardTokenServiceNotFound(data)) {
                    return callback({
                        code: "MP_CARD_TOKEN_ENV_MISMATCH",
                        status: 400,
                        message: "O token do cartao nao foi reconhecido pelo ambiente do Mercado Pago. Em teste, gere o card_token com a VITE_MP_PUBLIC_KEY de teste correspondente ao mesmo aplicativo/vendedor do MP_ACCESS_TOKEN_TEST e refaca o token antes de enviar a assinatura.",
                        mercadoPago: data,
                        mercadoPagoEnv: MP_ENV,
                        mpPlanId: plan.mpPlanId,
                        offerCode: plan.codigo,
                    }, null);
                }

                if (isMercadoPagoInternalError(data, response.status)) {
                    return callback({
                        code: "MP_INTERNAL_ERROR",
                        status: 502,
                        message: "O Mercado Pago retornou erro interno ao criar a assinatura. A tentativa local foi liberada para nova tentativa; gere um novo token de cartao e tente novamente. Se persistir, use o requestTraceId dos logs para acionar o suporte do Mercado Pago.",
                        mercadoPago: data,
                        mercadoPagoEnv: MP_ENV,
                        mpPlanId: plan.mpPlanId,
                        offerCode: plan.codigo,
                        requestTraceId,
                    }, null);
                }

                return callback({
                    ...data,
                    items: {
                        description: 'Assinatura do APP DosDois'
                    },
                    mercadoPagoEnv: MP_ENV,
                    mpPlanId: plan.mpPlanId,
                    offerCode: plan.codigo,
                    requestTraceId,
                }, null);
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
                    billing_provider = 'mercado_pago',
                    provider_subscription_id = ?,
                    provider_checkout_id = NULL,
                    provider_external_reference = ?,
                    provider_customer_id = NULL,
                    provider_payment_id = ?,
                    provider_status = ?,
                    created_at = ?,
                    updated_at = ?
                WHERE casal = ?`,
                [plan.id, localStatus, data.status, data.id, data.id, externalReference, authorizedPayment?.payment?.id || null, data.status, data.date_created, data.last_modified, casal])

            await this.atualizarStatusAssinatura(data.id, data.status, data, authorizedPayment);

            return callback(null, {
                ...data,
                assinatura_id: assinaturaId,
                external_reference: externalReference,
                mp_environment: MP_ENV,
            });
        } catch (error) {
            console.error("Erro ao registrar assinatura:", error);
            return callback(error, null);
        }
    };

    static createAssinaturaAsaas = async (planKey, casal, email, _paymentData = {}, optionsOrCallback, maybeCallback) => {
        const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;

        try {
            const payerEmail = normalizaEmail(email);

            if (!isEmailValido(payerEmail)) {
                return callback({
                    code: "EMAIL_PAGADOR_INVALIDO",
                    status: 400,
                    message: "Informe um e-mail valido para concluir a assinatura.",
                }, null);
            }

            const oferta = await this.getOfertaAtiva(planKey);
            const planFallback = MP_PLANS[planKey];
            const planCode = oferta?.codigo || planKey || planFallback?.codigo;
            const plan = {
                id: oferta?.plano_id || planFallback?.id,
                codigo: planCode,
                nome: oferta?.nome_publico || planFallback?.nome,
                valor: oferta?.valor || planFallback?.valor,
                periodicidade: oferta?.periodicidade || planFallback?.periodicidade,
            };

            if (!plan.id || !plan.valor) {
                return callback({
                    code: "INVALID_PLAN",
                    status: 400,
                    message: "Oferta invalida para criar assinatura no Asaas.",
                    offerCode: plan.codigo,
                }, null);
            }

            const assinaturaId = await this.reservaAssinatura(casal, plan.id, "asaas");
            const externalReference = buildExternalReference(assinaturaId, "DD_ASAAS_ASSINATURA");
            const requestTraceId = randomUUID();

            console.info("Criando checkout recorrente Asaas", {
                requestTraceId,
                asaasEnv: ASAAS_ENV,
                offerCode: plan.codigo,
                externalReference,
                payerEmail: maskEmail(payerEmail),
            });

            const checkout = await createAsaasCheckout({
                billingTypes: ["CREDIT_CARD"],
                chargeTypes: ["RECURRENT"],
                minutesToExpire: 60,
                externalReference,
                callback: {
                    successUrl: ASAAS_CHECKOUT_SUCCESS_URL,
                    cancelUrl: ASAAS_CHECKOUT_CANCEL_URL,
                    expiredUrl: ASAAS_CHECKOUT_EXPIRED_URL,
                },
                items: [
                    {
                        name: buildPlanTitle(plan),
                        description: buildPlanDescription(plan),
                        quantity: 1,
                        value: Number(plan.valor),
                    },
                ],
                subscription: {
                    cycle: periodicidadeToAsaasCycle(plan.periodicidade),
                    nextDueDate: toDateOnly(),
                },
            }, requestTraceId);
            const checkoutUrl = checkout?.link || checkout?.url || checkout?.checkoutUrl;

            if (!checkoutUrl) {
                throw {
                    code: "ASAAS_CHECKOUT_URL_MISSING",
                    status: 502,
                    message: "O Asaas criou o checkout, mas nao retornou o link de pagamento.",
                    asaas: checkout,
                    asaasEnv: ASAAS_ENV,
                    requestTraceId,
                };
            }

            await queryAsync(`
                UPDATE assinaturas
                SET plano_id = ?,
                    status = 'pendente',
                    mp_status = NULL,
                    mp_preapproval_id = NULL,
                    billing_provider = 'asaas',
                    provider_subscription_id = NULL,
                    provider_checkout_id = ?,
                    provider_external_reference = ?,
                    provider_customer_id = NULL,
                    provider_payment_id = NULL,
                    provider_status = ?,
                    created_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
            `, [
                plan.id,
                checkout.id,
                externalReference,
                checkout.status || "checkout_created",
                assinaturaId,
            ]);

            return callback(null, {
                ...checkout,
                assinatura_id: assinaturaId,
                external_reference: externalReference,
                billing_provider: "asaas",
                asaas_environment: ASAAS_ENV,
                checkout_url: checkoutUrl,
                requestTraceId,
            });
        } catch (error) {
            console.error("Erro ao registrar assinatura Asaas:", {
                code: error?.code,
                status: error?.status,
                message: error?.message,
                asaasEnv: error?.asaasEnv || ASAAS_ENV,
                requestTraceId: error?.requestTraceId,
                asaas: error?.asaas,
            });
            await this.marcaFalhaCriacao(casal);
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

    static buscarAssinaturaPorProviderSubscriptionId = async (billingProvider, subscriptionId) => {
        const [assinatura] = await queryAsync(`
            SELECT *
            FROM assinaturas
            WHERE billing_provider = ?
              AND provider_subscription_id = ?
            LIMIT 1
        `, [billingProvider, subscriptionId]);

        return assinatura;
    };

    static buscarAssinaturaPorProviderExternalReference = async (billingProvider, externalReference) => {
        if (!externalReference) return null;

        const [assinatura] = await queryAsync(`
            SELECT *
            FROM assinaturas
            WHERE billing_provider = ?
              AND provider_external_reference = ?
            LIMIT 1
        `, [billingProvider, externalReference]);

        return assinatura;
    };

    static buscarUnicaAssinaturaAsaasPendenteSemSubscription = async () => {
        const assinaturas = await queryAsync(`
            SELECT *
            FROM assinaturas
            WHERE billing_provider = 'asaas'
              AND status IN ('pendente', 'criando')
              AND provider_subscription_id IS NULL
              AND updated_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
            ORDER BY id DESC
            LIMIT 2
        `);

        return assinaturas.length === 1 ? assinaturas[0] : null;
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

    static atualizarAssinaturaAsaas = async (subscription) => {
        if (!subscription?.id) return null;

        const subscriptionCompleta = await getAsaasSubscription(subscription.id).catch(() => null);
        const subscriptionAtual = {
            ...subscriptionCompleta,
            ...subscription,
        };
        const externalReference = subscriptionAtual.externalReference || subscriptionAtual.external_reference;
        const assinatura = await this.buscarAssinaturaPorProviderSubscriptionId("asaas", subscription.id)
            || await this.buscarAssinaturaPorProviderExternalReference("asaas", externalReference)
            || await this.buscarUnicaAssinaturaAsaasPendenteSemSubscription();
        if (!assinatura) return null;

        const statusDB = statusAsaasSubscriptionToDb(subscriptionAtual.status);

        await queryAsync(`
            UPDATE assinaturas
            SET status = ?,
                billing_provider = 'asaas',
                provider_subscription_id = ?,
                provider_external_reference = COALESCE(provider_external_reference, ?),
                provider_status = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [statusDB, subscriptionAtual.id, externalReference || null, subscriptionAtual.status, assinatura.id]);

        return {
            assinatura,
            subscription: subscriptionAtual,
            statusDB,
        };
    };

    static atualizarPagamentoAsaas = async (payment) => {
        const subscriptionId = payment?.subscription;
        const subscription = subscriptionId
            ? await getAsaasSubscription(subscriptionId).catch(() => null)
            : null;
        const externalReference = payment?.externalReference
            || payment?.external_reference
            || subscription?.externalReference
            || subscription?.external_reference;
        if (!subscriptionId && !externalReference) return null;

        const assinatura = (
            subscriptionId
                ? await this.buscarAssinaturaPorProviderSubscriptionId("asaas", subscriptionId)
                : null
        ) || await this.buscarAssinaturaPorProviderExternalReference("asaas", externalReference)
            || await this.buscarUnicaAssinaturaAsaasPendenteSemSubscription();
        if (!assinatura) return null;

        const statusDB = statusAsaasPaymentToDb(payment.status);
        const shouldActivate = statusDB === "ativa";

        if (shouldActivate) {
            const inicio = new Date();
            const fim = addSubscriptionPeriod(inicio, getPeriodFromAsaasCycle(subscription?.cycle));

            await queryAsync(`
                UPDATE assinaturas
                SET status = 'ativa',
                    billing_provider = 'asaas',
                    provider_subscription_id = COALESCE(?, provider_subscription_id),
                    provider_external_reference = COALESCE(provider_external_reference, ?),
                    provider_payment_id = ?,
                    provider_status = ?,
                    inicio = ?,
                    fim = ?,
                    updated_at = NOW()
                WHERE id = ?
            `, [
                subscriptionId || null,
                externalReference || null,
                payment.id,
                payment.status,
                toDateOnly(inicio),
                toDateOnly(fim),
                assinatura.id,
            ]);
        } else {
            await queryAsync(`
                UPDATE assinaturas
                SET status = ?,
                    billing_provider = 'asaas',
                    provider_subscription_id = COALESCE(?, provider_subscription_id),
                    provider_external_reference = COALESCE(provider_external_reference, ?),
                    provider_payment_id = ?,
                    provider_status = ?,
                    updated_at = NOW()
                WHERE id = ?
            `, [statusDB, subscriptionId || null, externalReference || null, payment.id, payment.status, assinatura.id]);
        }

        return {
            assinatura,
            subscription,
            statusDB,
        };
    };

    static cancelarAssinatura = async (casal) => {
        const assinatura = await this.getAssinaturaCancelavel(casal);

        if (!assinatura) {
            throw {
                code: "ASSINATURA_CANCELAVEL_NAO_ENCONTRADA",
                status: 404,
                message: "Nenhuma assinatura paga em aberto encontrada.",
            };
        }

        if (assinatura.billing_provider === "asaas") {
            if (!assinatura.provider_subscription_id) {
                await queryAsync(`
                    UPDATE assinaturas
                    SET status = 'cancelada',
                        provider_status = 'cancel_local_sem_asaas',
                        updated_at = NOW()
                    WHERE id = ?
                `, [assinatura.id]);

                return {
                    id: assinatura.id,
                    status: "cancelada",
                    provider_status: "cancel_local_sem_asaas",
                    billing_provider: "asaas",
                };
            }

            const requestTraceId = randomUUID();
            const data = await deleteAsaasSubscription(assinatura.provider_subscription_id, requestTraceId);

            await queryAsync(`
                UPDATE assinaturas
                SET status = 'cancelada',
                    provider_status = ?,
                    updated_at = NOW()
                WHERE id = ?
            `, [data?.status || "deleted", assinatura.id]);

            return {
                id: assinatura.id,
                status: "cancelada",
                provider_status: data?.status || "deleted",
                billing_provider: "asaas",
                requestTraceId,
            };
        }

        if (!MP_ACCESS_TOKEN) {
            throw {
                code: "MP_ACCESS_TOKEN_NOT_CONFIGURED",
                status: 503,
                message: "Mercado Pago nao configurado.",
            };
        }

        if (!assinatura.mp_preapproval_id) {
            await queryAsync(`
                UPDATE assinaturas
                SET status = 'cancelada',
                    mp_status = 'cancel_local_sem_mp',
                    updated_at = NOW()
                WHERE id = ?
            `, [assinatura.id]);

            return {
                id: assinatura.id,
                status: "cancelada",
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
                    SET status = 'pendente',
                        mp_status = ?,
                        updated_at = NOW()
                    WHERE id = ?
                `, [statusAtualMP, assinatura.id]);

                return {
                    id: assinatura.id,
                    status: "pendente",
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
