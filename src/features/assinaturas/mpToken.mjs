import 'dotenv/config';

const normalizeMpEnv = (value) => {
    const normalized = String(value || "").trim().toLowerCase();

    if (["test", "teste", "sandbox", "homologacao", "homolog"].includes(normalized)) {
        return "test";
    }

    return "production";
};

export const MP_ENV = normalizeMpEnv(process.env.MP_ENV || process.env.MERCADO_PAGO_ENV);
export const IS_MP_TEST_ENV = MP_ENV === "test";

export const MP_ACCESS_TOKEN = IS_MP_TEST_ENV
    ? process.env.MP_ACCESS_TOKEN_TEST || process.env.MERCADO_PAGO_ACCESS_TOKEN_TEST
    : process.env.MP_ACCESS_TOKEN_PROD || process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD || process.env.MP_ACCESS_TOKEN;

export const getMercadoPagoPlanIdOverride = (offerCode) => {
    if (!offerCode) return null;

    const normalizedCode = String(offerCode).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");

    if (IS_MP_TEST_ENV) {
        return process.env[`MP_PLAN_ID_${normalizedCode}_TEST`]
            || process.env[`MP_PREAPPROVAL_PLAN_ID_${normalizedCode}_TEST`]
            || null;
    }

    return process.env[`MP_PLAN_ID_${normalizedCode}_PROD`]
        || process.env[`MP_PREAPPROVAL_PLAN_ID_${normalizedCode}_PROD`]
        || process.env[`MP_PLAN_ID_${normalizedCode}`]
        || null;
};

export const getMercadoPagoCredentialMode = () => ({
    env: MP_ENV,
    hasAccessToken: Boolean(MP_ACCESS_TOKEN),
});
