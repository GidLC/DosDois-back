export const despesasProcess = (results, inicio, fim, groupBy, agruparPorFiltro) => {
    const despesasPorMes = {};
    const totaisGeralPorMes = {};
    const totaisEfetPorMes = {};
    const totaisPendPorMes = {};

    results.forEach(d => {
        const chave = `${d.ano}-${String(d.mes).padStart(2, '0')}`;

        if (!despesasPorMes[chave]) {
            despesasPorMes[chave] = [];
            totaisGeralPorMes[chave] = 0;
            totaisEfetPorMes[chave] = 0;
            totaisPendPorMes[chave] = 0;
        }

        despesasPorMes[chave].push(d);

        const valor = Number(d.valor);
        totaisGeralPorMes[chave] += valor;

        if (d.status == 1) {
            totaisEfetPorMes[chave] += valor;
        } else {
            totaisPendPorMes[chave] += valor;
        }
    });

    const retorno = [];
    let current = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const end = new Date(fim.getFullYear(), fim.getMonth(), 1);

    while (current <= end) {
        const chave = `${current.getFullYear()}-${String(current.getMonth()).padStart(2, '0')}`;

        retorno.push({
            mesAno: chave,
            totalGeralMes: totaisGeralPorMes[chave] || 0,
            totalEfetMes: totaisEfetPorMes[chave] || 0,
            totalPendMes: totaisPendPorMes[chave] || 0,
            transacoes: despesasPorMes[chave] || [],
            group: groupBy
                ? agruparPorFiltro(despesasPorMes[chave] || [], groupBy)
                : []
        });

        current.setMonth(current.getMonth() + 1);
    }

    return retorno;
};
