import { queryAsync } from '../../../data/queryAsync/queryAsync.mjs';

const normalizeSettings = (row) => ({
    tipoGestao: row.tipo_gestao,
    receitasAtivo: Boolean(Number(row.receitas_ativo)),
    bancosAtivo: Boolean(Number(row.bancos_ativo)),
    cartoesAtivo: Boolean(Number(row.cartoes_ativo)),
});

const inferLegacySettings = async (casal) => {
    const [receitas] = await queryAsync(
        'SELECT COUNT(*) AS total FROM receita WHERE casal = ?',
        [casal]
    );
    const [bancos] = await queryAsync(
        "SELECT COUNT(*) AS total FROM banco WHERE casal = ? AND LOWER(nome) <> 'carteira' AND arquivo = 0",
        [casal]
    );
    const [cartoes] = await queryAsync(
        'SELECT COUNT(*) AS total FROM cartoes WHERE casal = ?',
        [casal]
    );

    const preferences = {
        receitasAtivo: Number(receitas?.total || 0) > 0,
        bancosAtivo: Number(bancos?.total || 0) > 0,
        cartoesAtivo: Number(cartoes?.total || 0) > 0,
    };
    const anyModuleActive = Object.values(preferences).some(Boolean);

    return {
        tipoGestao: anyModuleActive ? 'personalizada' : 'simplificada',
        ...preferences,
    };
};

class PreferenciasModulosModel {
    static async getByCouple(casal) {
        const [row] = await queryAsync(
            `SELECT tipo_gestao, receitas_ativo, bancos_ativo, cartoes_ativo
             FROM preferencias_modulos_casal
             WHERE casal = ?
             LIMIT 1`,
            [casal]
        );

        return row ? normalizeSettings(row) : inferLegacySettings(casal);
    }

    static async saveForCouple(casal, settings) {
        await queryAsync(
            `INSERT INTO preferencias_modulos_casal
                (casal, tipo_gestao, receitas_ativo, bancos_ativo, cartoes_ativo)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                tipo_gestao = VALUES(tipo_gestao),
                receitas_ativo = VALUES(receitas_ativo),
                bancos_ativo = VALUES(bancos_ativo),
                cartoes_ativo = VALUES(cartoes_ativo)`,
            [
                casal,
                settings.tipoGestao,
                Number(settings.receitasAtivo),
                Number(settings.bancosAtivo),
                Number(settings.cartoesAtivo),
            ]
        );

        return this.getByCouple(casal);
    }
}

export default PreferenciasModulosModel;
