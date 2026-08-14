import "dotenv/config";

const normalizeAsaasEnv = (value) => {
    const normalized = String(value || "").trim().toLowerCase();

    if (["prod", "production", "producao"].includes(normalized)) {
        return "production";
    }

    return "sandbox";
};

export const ASAAS_ENV = normalizeAsaasEnv(process.env.ASAAS_ENV);
export const IS_ASAAS_SANDBOX = ASAAS_ENV === "sandbox";
export const ASAAS_API_KEY = IS_ASAAS_SANDBOX
    ? process.env.ASAAS_API_KEY_SANDBOX || process.env.ASAAS_API_KEY
    : process.env.ASAAS_API_KEY_PROD || process.env.ASAAS_API_KEY;

export const ASAAS_API_BASE_URL = IS_ASAAS_SANDBOX
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";

export const ASAAS_WEBHOOK_TOKEN = String(process.env.ASAAS_WEBHOOK_TOKEN || "").trim();
export const ASAAS_WEBHOOK_URL = String(process.env.ASAAS_WEBHOOK_URL || "").trim();
export const ASAAS_CHECKOUT_SUCCESS_URL = String(
    process.env.ASAAS_CHECKOUT_SUCCESS_URL || "https://web.dosdoisapp.com.br/conta?assinatura=sucesso",
).trim();
export const ASAAS_CHECKOUT_CANCEL_URL = String(
    process.env.ASAAS_CHECKOUT_CANCEL_URL || "https://web.dosdoisapp.com.br/conta?assinatura=cancelada",
).trim();
export const ASAAS_CHECKOUT_EXPIRED_URL = String(
    process.env.ASAAS_CHECKOUT_EXPIRED_URL || "https://web.dosdoisapp.com.br/conta?assinatura=expirada",
).trim();
