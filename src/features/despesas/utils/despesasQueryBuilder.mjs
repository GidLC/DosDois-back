export const despesasQueryBuilder = ({
    fixa,
    casal,
    usuario,
    mes,
    ano,
    dataInicio,
    dataFim,
    tipo,
    categoria,
    tag,
    banco,
    cartao,
    fatura,
    status,
    valorMin,
    valorMax,
    descricao
}) => {

    const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
    const camposFixos = (fixa == 1) ? ', des.id_fixo, des.data_criacao' : '';

    let query = `
        SELECT 
            des.id, des.descricao, des.valor, des.dia, des.mes, des.ano,
            des.status, des.obs, des.usuario, des.fatura,
            cat.nome AS nome_categoria,
            ic.ion_nome AS nome_icone,
            cor.codigo AS cod_cor,
            ba.nome AS nome_banco,
            cat.tipo AS tipo_categoria,
            t.id AS id_tag,
            t.nome AS nome_tag,
            car.id_cartao,
            car.nome AS nome_cartao,
            fat.id AS id_fatura,
            CONCAT(fat.mes,'-', fat.ano) AS fatura
            ${camposFixos}
        FROM ${tabela} AS des
        LEFT JOIN categoria_tr AS cat ON cat.id = des.categoria
        LEFT JOIN icones AS ic ON ic.id = cat.icone
        LEFT JOIN cor ON cor.id = cat.cor
        LEFT JOIN banco AS ba ON ba.id = des.banco
        LEFT JOIN tags AS t ON t.id = des.tag
        LEFT JOIN cartoes AS car ON car.id_cartao = des.cartao
        LEFT JOIN cartao_faturas AS fat ON fat.id = des.fatura
        WHERE des.casal = ?
    `;

    const params = [casal];

    // ------ FILTROS ------
    //Período entre mês-ano tal e mês-ano tal
    if (dataInicio && dataFim) {
        query += `
            AND STR_TO_DATE(CONCAT(des.dia, '/', des.mes, '/', des.ano), '%d/%m/%Y')
            BETWEEN ? AND ?`;
        params.push(dataInicio, dataFim);
    } else if (ano && mes !== null) {
        query += ` AND des.ano = ? AND des.mes = ?`;
        params.push(ano, mes);
    } else if (ano) {
        query += ` AND des.ano = ?`;
        params.push(ano);
    }

    if (tipo !== null) {
        if (tipo == 0) {
            query += ` AND des.tipo = ? AND des.usuario = ?`;
            params.push(tipo, usuario);
        } else {
            query += ` AND des.tipo = ?`;
            params.push(tipo);
        }
    }

    if (categoria) { query += ` AND des.categoria = ?`; params.push(categoria); }
    if (tag) { query += ` AND des.tag = ?`; params.push(tag); }
    if (banco) { query += ` AND des.banco = ?`; params.push(banco); }
    if (cartao) { query += ` AND des.cartao = ?`; params.push(cartao); }
    if (fatura) { query += ` AND des.fatura = ?`; params.push(fatura); }
    if (status || status == 0) { query += ` AND des.status = ?`; params.push(status); }
    if (valorMin) { query += ` AND des.valor >= ?`; params.push(valorMin); }
    if (valorMax) { query += ` AND des.valor <= ?`; params.push(valorMax); }
    if (descricao) { query += ` AND des.descricao LIKE ?`; params.push(`%${descricao}%`); }

    query += ` ORDER BY des.ano, des.mes, des.dia`;

    return { query, params };
};

export const agruparPorFiltro = (transacoes = [], filtro) => {
    // Mapeia o filtro para o nome de coluna correto
    const nomeFieldMap = {
        categoria: 'nome_categoria',
        banco: 'nome_banco',
        tag: 'nome_tag',
        cartao: 'nome_cartao',
        // permite passar direto o campo já no formato nome_<algo>
        ['nome_categoria']: 'nome_categoria',
        ['nome_banco']: 'nome_banco',
        ['nome_tag']: 'nome_tag',
        ['nome_cartao']: 'nome_cartao'
    };
    const idFieldMap = {
        categoria: 'id_categoria',
        banco: 'id_banco',
        tag: 'id_tag',
        cartao: 'id_cartao'
    };

    const nomeField = nomeFieldMap[filtro] || filtro;   // fallback: usa o próprio filtro
    const idField = idFieldMap[filtro];               // pode ser undefined (sem id)

    const mapa = {};

    for (const t of transacoes) {
        const chave = (t?.[nomeField] ?? 'Não definido') || 'Não definido';
        const idVal = idField ? (t?.[idField] ?? null) : null;

        if (!mapa[chave]) {
            mapa[chave] = {
                groupName: chave,
                ...(idField ? { id: idVal } : {}),
                totalGeral: 0,
                totalEfet: 0,
                totalPend: 0
            };
        }

        const valor = Number(t?.valor) || 0;
        mapa[chave].totalGeral += valor;
        if (Number(t?.status) === 1) {
            mapa[chave].totalEfet += valor;
        } else {
            mapa[chave].totalPend += valor;
        }
    }

    // Ordena desc por total geral (opcional)
    return Object.values(mapa).sort((a, b) => b.totalGeral - a.totalGeral);
};