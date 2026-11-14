import { queryAsync } from '../../../data/queryAsync/queryAsync.mjs';

const allowedEvents = new Set([
    'app_session_started',
    'first_expense_saved',
    'module_preferences_saved',
    'module_activated',
    'module_deactivated',
    'management_profile_changed',
]);

const safeMetadata = (metadata) => {
    try {
        const serialized = JSON.stringify(metadata);
        return serialized.length <= 4000 ? serialized : null;
    } catch {
        return null;
    }
};

class EventoProdutoModel {
    static async registrar({
        evento,
        casal,
        usuario,
        modulo = null,
        perfilAnterior = null,
        perfilNovo = null,
        valorAnterior = null,
        valorNovo = null,
        metadata = null,
        dedupeKey = null,
    }) {
        if (!allowedEvents.has(evento) || !casal || !usuario) return;

        try {
            await queryAsync(
                `INSERT INTO eventos_produto
                    (evento, casal, usuario, modulo, perfil_anterior, perfil_novo,
                     valor_anterior, valor_novo, metadata_json, dedupe_key, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
                [
                    evento,
                    String(casal),
                    Number(usuario),
                    modulo,
                    perfilAnterior,
                    perfilNovo,
                    valorAnterior === null ? null : Number(valorAnterior),
                    valorNovo === null ? null : Number(valorNovo),
                    metadata === null ? null : safeMetadata(metadata),
                    dedupeKey,
                ]
            );
        } catch (error) {
            // Telemetry must never prevent users from saving their preferences.
            console.error('Nao foi possivel registrar evento de produto', {
                evento,
                modulo,
                code: error?.code,
                message: error?.message,
            });
        }
    }
}

export default EventoProdutoModel;
