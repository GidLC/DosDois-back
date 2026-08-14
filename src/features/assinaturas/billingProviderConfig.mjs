import "dotenv/config";

const normalizeBillingProvider = (value) => {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized === "asaas") {
        return "asaas";
    }

    return "mercado_pago";
};

export const BILLING_PROVIDER = normalizeBillingProvider(process.env.BILLING_PROVIDER);
export const IS_MERCADO_PAGO_BILLING_PROVIDER = BILLING_PROVIDER === "mercado_pago";
export const IS_ASAAS_BILLING_PROVIDER = BILLING_PROVIDER === "asaas";
