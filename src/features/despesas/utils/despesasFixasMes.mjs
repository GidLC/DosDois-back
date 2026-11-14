import { queryAsync } from '../../../data/queryAsync/queryAsync.mjs';

const formatDate = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const ensureDespesasFixasMes = async (mes, ano, casal = null, idFixo = null) => {
    const month = Number(mes);
    const year = Number(ano);
    if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isInteger(year)) return;

    const inicioMes = formatDate(year, month, 1);
    const fimMesDate = new Date(year, month + 1, 0);
    const fimMes = formatDate(year, month, fimMesDate.getDate());
    const modelos = await queryAsync(
        `SELECT id_fixo, descricao, valor, tipo, dia, DATE_FORMAT(inicio, '%Y-%m-%d') AS inicio,
            DATE_FORMAT(fim, '%Y-%m-%d') AS fim, casal, usuario, banco, categoria, tag, obs
         FROM despesas_fixas_modelos
         WHERE ativa = 1
            AND inicio <= ?
            AND (fim IS NULL OR fim >= ?)
            AND (? IS NULL OR casal = ?)
            AND (? IS NULL OR id_fixo = ?)`,
        [fimMes, inicioMes, casal, casal, idFixo, idFixo]
    );

    for (const modelo of modelos) {
        const dia = Math.min(Number(modelo.dia), fimMesDate.getDate());
        const dataVencimento = formatDate(year, month, dia);
        if (modelo.inicio > dataVencimento || (modelo.fim && modelo.fim < dataVencimento)) continue;

        const [existente] = await queryAsync(
            'SELECT id FROM despesas_fixas WHERE id_fixo = ? AND casal = ? AND ano = ? AND mes = ? LIMIT 1',
            [modelo.id_fixo, modelo.casal, year, month]
        );
        if (existente) continue;

        try {
            await queryAsync(
                `INSERT IGNORE INTO despesas_fixas(
                    id_fixo, descricao, valor, tipo, status, dia, mes, ano, data_criacao,
                    casal, usuario, banco, categoria, tag, obs, cancelada
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
                [
                    modelo.id_fixo,
                    modelo.descricao,
                    modelo.valor,
                    modelo.tipo,
                    0,
                    dia,
                    month,
                    year,
                    dataVencimento,
                    modelo.casal,
                    modelo.usuario,
                    modelo.banco,
                    modelo.categoria,
                    modelo.tag,
                    modelo.obs
                ]
            );
        } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY') throw error;
        }
    }
};

export const ensureDespesasFixasPeriodo = async (dataInicio, dataFim, casal = null) => {
    const inicio = new Date(`${dataInicio}T00:00:00`);
    const fim = new Date(`${dataFim}T00:00:00`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) return;

    const mes = inicio.getMonth();
    const ano = inicio.getFullYear();
    const mesFim = fim.getMonth();
    const anoFim = fim.getFullYear();

    for (let year = ano, month = mes; year < anoFim || (year === anoFim && month <= mesFim);) {
        await ensureDespesasFixasMes(month, year, casal);
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }
    }
};
