import crypto from "crypto";
import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs";

const MAX_METADATA_LENGTH = 8000;

const getClientIp = (req) => {
    const forwardedFor = req?.headers?.["x-forwarded-for"];
    const rawIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || req?.ip || req?.socket?.remoteAddress || "");

    return rawIp.split(",")[0].trim();
};

const hashValue = (value) => {
    if (!value) return null;
    return crypto.createHash("sha256").update(String(value)).digest("hex");
};

const safeString = (value, maxLength = 120) => {
    if (value === undefined || value === null) return null;
    return String(value).trim().slice(0, maxLength) || null;
};

const safeNumber = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
};

const safeMetadata = (metadata) => {
    if (!metadata || typeof metadata !== "object") return null;

    try {
        const serialized = JSON.stringify(metadata);
        return serialized.length > MAX_METADATA_LENGTH
            ? serialized.slice(0, MAX_METADATA_LENGTH)
            : serialized;
    } catch {
        return null;
    }
};

class AssinaturaEventosModel {
    static registrar = async ({
        evento,
        source,
        contexto,
        offerId,
        casal,
        usuario,
        assinaturaId,
        mpPreapprovalId,
        status,
        metadata,
        req,
    }) => {
        const eventoSeguro = safeString(evento, 80);

        if (!eventoSeguro) return null;

        const payload = {
            evento: eventoSeguro,
            source: safeString(source, 40) || "backend",
            contexto: safeString(contexto, 80),
            offerId: safeString(offerId, 80),
            casal: safeNumber(casal),
            usuario: safeNumber(usuario),
            assinaturaId: safeNumber(assinaturaId),
            mpPreapprovalId: safeString(mpPreapprovalId, 120),
            status: safeString(status, 60),
            metadata: safeMetadata(metadata),
            userAgent: safeString(req?.headers?.["user-agent"], 255),
            ipHash: hashValue(getClientIp(req)),
        };

        try {
            const result = await queryAsync(
                `
                    INSERT INTO assinatura_eventos_conversao
                        (
                            evento,
                            source,
                            contexto,
                            offer_id,
                            casal,
                            usuario,
                            assinatura_id,
                            mp_preapproval_id,
                            status,
                            metadata_json,
                            user_agent,
                            ip_hash,
                            created_at
                        )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `,
                [
                    payload.evento,
                    payload.source,
                    payload.contexto,
                    payload.offerId,
                    payload.casal,
                    payload.usuario,
                    payload.assinaturaId,
                    payload.mpPreapprovalId,
                    payload.status,
                    payload.metadata,
                    payload.userAgent,
                    payload.ipHash,
                ],
            );

            return result?.insertId || null;
        } catch (error) {
            console.error("Erro ao registrar evento de conversao de assinatura", {
                evento: payload.evento,
                code: error?.code,
                message: error?.message,
            });

            return null;
        }
    };
}

export default AssinaturaEventosModel;
