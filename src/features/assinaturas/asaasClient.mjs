import { randomUUID } from "crypto";
import { ASAAS_API_BASE_URL, ASAAS_API_KEY, ASAAS_ENV } from "./asaasConfig.mjs";

const parseAsaasErrorMessage = (data) => {
    if (Array.isArray(data?.errors) && data.errors.length) {
        return data.errors
            .map((error) => error?.description || error?.message)
            .filter(Boolean)
            .join(" | ");
    }

    return data?.message || data?.error || "Nao foi possivel concluir a requisicao no Asaas.";
};

export const asaasRequest = async (path, { method = "GET", body, requestTraceId = randomUUID() } = {}) => {
    if (!ASAAS_API_KEY) {
        throw {
            code: "ASAAS_API_KEY_NOT_CONFIGURED",
            status: 503,
            message: "Configure ASAAS_API_KEY_SANDBOX ou ASAAS_API_KEY_PROD para usar o Asaas.",
            asaasEnv: ASAAS_ENV,
            requestTraceId,
        };
    }

    const response = await fetch(`${ASAAS_API_BASE_URL}${path}`, {
        method,
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            access_token: ASAAS_API_KEY,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(60000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw {
            code: "ASAAS_REQUEST_ERROR",
            status: response.status || 502,
            message: parseAsaasErrorMessage(data),
            asaas: data,
            asaasEnv: ASAAS_ENV,
            requestTraceId,
        };
    }

    return data;
};

export const createAsaasCustomer = (payload, requestTraceId) =>
    asaasRequest("/customers", {
        method: "POST",
        body: payload,
        requestTraceId,
    });

export const findAsaasCustomerByExternalReference = async (externalReference, requestTraceId) => {
    const params = new URLSearchParams({
        externalReference,
        limit: "1",
    });

    const data = await asaasRequest(`/customers?${params.toString()}`, {
        requestTraceId,
    });

    return data?.data?.[0] || null;
};

export const createAsaasSubscription = (payload, requestTraceId) =>
    asaasRequest("/subscriptions", {
        method: "POST",
        body: payload,
        requestTraceId,
    });

export const createAsaasCheckout = (payload, requestTraceId) =>
    asaasRequest("/checkouts", {
        method: "POST",
        body: payload,
        requestTraceId,
    });

export const getAsaasSubscription = (id, requestTraceId) =>
    asaasRequest(`/subscriptions/${encodeURIComponent(id)}`, {
        requestTraceId,
    });

export const deleteAsaasSubscription = (id, requestTraceId) =>
    asaasRequest(`/subscriptions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        requestTraceId,
    });
