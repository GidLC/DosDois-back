import { pool } from "../../../config/config.mjs";
import SeparaData from '../../../data/SeparaData/SeparaData.mjs';
import * as crypto from 'crypto';

class DespesaModel {
    //Adiciona despesas, tanto normais como fixas
    static addDespesa = async (descricao, valor, usuario, cod_casal, categoria, status, data, banco, tipo, fixa, tag, obs, repetir, callback) => {
        try {
            const objData = await SeparaData(data)
            const anoAtual = new Date().getFullYear();

            //Cadastro de despesa padrão
            if (fixa == 0 || !fixa) {
                const query = 'INSERT INTO despesa(descricao, valor, usuario, casal, categoria, status, dia, mes, ano, banco, tipo, tag, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
                const promisses = []

                //Lógica para cadastrar uma ou mais despesas
                let mesRep = objData.mes
                let anoRep = objData.ano
                for (let i = 0; i < repetir; i++) {
                    let descricaoRep = ""

                    //Repetir
                    if (repetir > 1) {
                        descricaoRep = `${descricao}(${i + 1}/${repetir})`
                        //Incrementa o mês a partir da segunda repetição
                        if (i > 0) {
                            mesRep += 1
                            if (mesRep == 12) {
                                anoRep += 1
                                mesRep = 0
                            }
                        }
                    }

                    promisses.push(
                        new Promise((resolve, reject) => {
                            pool.query(query, [(repetir > 1) ? descricaoRep : descricao, valor, usuario, cod_casal, categoria, status, objData.dia, mesRep, anoRep, banco, tipo, tag, obs], (err, results) => {
                                if (err) {
                                    reject(err)
                                }

                                resolve(results)
                            })
                        })
                    )
                }

                await Promise.all(promisses);
                return callback(null, { message: 'Despesa cadastrada com sucesso!' })

            } else if (fixa == 1) {
                //Cadastro de despesa fixa
                const id_uuid = crypto.randomUUID();
                const query = 'INSERT INTO despesas_fixas(id_fixo, descricao, valor, tipo, status, dia, mes, ano, data_criacao, casal, usuario, banco, categoria, tag, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
                const promisses = [];

                for (let ano = objData.ano; ano < objData.ano + 50; ano++) {
                    const mesInicial = (ano == anoAtual) ? objData.mes : 0;
                    //Cadastro da despesa nos meses do ano atual
                    for (let mes = mesInicial; mes < 12; mes++) {
                        promisses.push(
                            new Promise((resolve, reject) => {
                                pool.query(query, [id_uuid, descricao, valor, tipo, 0, objData.dia, mes, ano, `${objData.ano}-${objData.mes}-${objData.dia}`, cod_casal, usuario, banco, categoria, tag, obs], (err, results) => {
                                    if (err) {
                                        reject(err);
                                    }

                                    resolve(results);
                                });
                            })
                        )

                    }
                }

                await Promise.all(promisses);
                return callback(null, { message: 'Despesas fixas cadastradas com sucesso!' })

            } else {
                const err = 'O tipo de despesa específicado não é válido';
                return callback(err, null)
            }
        } catch (error) {
            return callback(error, null)
        }

    }

    //Busca todas as depesas de um determinado mês e ano(individuais ou coletivas, fixas ou não)
    // static readDespesa = async (usuario, casal, mes, ano, tipo, fixa, callback) => {
    //     try {
    //         const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
    //         const camposFixos = (fixa == 1) ? ', des.id_fixo, des.data_criacao' : '';
    //         const queryBase = `
    //             SELECT des.id, des.descricao, des.valor, des.dia, des.mes, des.ano, des.status, des.obs, des.usuario,
    //                    cat.nome AS nome_categoria, ic.ion_nome AS nome_icone, 
    //                    cor.codigo AS cod_cor, ba.nome AS nome_banco, cat.tipo AS tipo_categoria,
    //                    t.id AS id_tag, t.nome AS nome_tag${camposFixos}
    //             FROM ${tabela} AS des
    //             INNER JOIN categoria_tr AS cat ON cat.id = des.categoria
    //             INNER JOIN icones AS ic ON ic.id = cat.icone
    //             INNER JOIN cor ON cor.id = cat.cor
    //             INNER JOIN banco AS ba ON ba.id = des.banco
    //             LEFT JOIN tags AS t ON t.id = des.tag
    //             WHERE des.casal = ? AND des.mes = ? AND des.ano = ? AND des.tipo = ?`;

    //         // Adiciona condição extra para despesas individuais
    //         const query = (tipo == 0) ? `${queryBase} AND des.usuario = ?` : queryBase;

    //         // Define os parâmetros baseados no tipo
    //         const params = (tipo == 0)
    //             ? [casal, mes, ano, tipo, usuario]
    //             : [casal, mes, ano, tipo];

    //         pool.query(query, params, (err, results) => {
    //             if (err) {
    //                 return callback(err, null);
    //             }
    //             return callback(null, results);
    //         });
    //     } catch (error) {
    //         console.error('Erro ao executar consulta:', error);
    //         return callback(error, null);
    //     }
    // }

    static readDespesa = async ({
        usuario,
        casal,
        mes,
        ano,
        dataInicio,
        dataFim,
        tipo,
        fixa,
        categoria,
        tag,
        banco,
        status,
        valorMin,
        valorMax,
        descricao,
        groupBy
    }, callback) => {
        try {
            const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
            const camposFixos = (fixa == 1) ? ', des.id_fixo, des.data_criacao' : '';

            let queryBase = `
            SELECT des.id, des.descricao, des.valor, des.dia, des.mes, des.ano, des.status, des.obs, des.usuario,
                   cat.nome AS nome_categoria, ic.ion_nome AS nome_icone, 
                   cor.codigo AS cod_cor, ba.nome AS nome_banco, cat.tipo AS tipo_categoria,
                   t.id AS id_tag, t.nome AS nome_tag${camposFixos}
            FROM ${tabela} AS des
            INNER JOIN categoria_tr AS cat ON cat.id = des.categoria
            INNER JOIN icones AS ic ON ic.id = cat.icone
            INNER JOIN cor ON cor.id = cat.cor
            INNER JOIN banco AS ba ON ba.id = des.banco
            LEFT JOIN tags AS t ON t.id = des.tag
            WHERE des.casal = ? `;

            const params = [casal];

            // Detecta tipo de busca e define range
            let inicio, fim;
            if (dataInicio && dataFim) {
                inicio = new Date(dataInicio);
                fim = new Date(dataFim);
                queryBase += `
              AND STR_TO_DATE(CONCAT(des.dia, '/', des.mes, '/', des.ano), '%d/%m/%Y') 
                  BETWEEN ? AND ?`;
                params.push(dataInicio, dataFim);

            } else if (ano && mes) {
                inicio = new Date(ano, mes - 1, 1);
                fim = new Date(ano, mes, 0);
                queryBase += ' AND des.ano = ? AND des.mes = ?';
                params.push(ano, mes);

            } else if (ano) {
                inicio = new Date(ano, 0, 1);
                fim = new Date(ano, 11, 31);
                queryBase += ' AND des.ano = ?';
                params.push(ano);
            }

            if (!inicio || !fim) {
                inicio = new Date(new Date().getFullYear(), 0, 1); // janeiro atual
                fim = new Date(new Date().getFullYear(), 11, 31);  // dezembro atual
            }


            // Filtro para despesas individuais
            if (tipo !== undefined) {
                if (tipo == 0) {
                    queryBase += ' AND des.tipo = ? AND des.usuario = ?';
                    params.push(tipo, usuario);
                } else {
                    queryBase += ' AND des.tipo = ?';
                    params.push(tipo);
                }
            }


            // --- Filtros opcionais ---
            if (categoria) {
                queryBase += ' AND des.categoria = ?';
                params.push(categoria);
            }
            if (tag) {
                queryBase += ' AND des.tag = ?';
                params.push(tag);
            }
            if (banco) {
                queryBase += ' AND des.banco = ?';
                params.push(banco);
            }
            if (status !== undefined) {
                queryBase += ' AND des.status = ?';
                params.push(status);
            }
            if (valorMin !== undefined) {
                queryBase += ' AND des.valor >= ?';
                params.push(valorMin);
            }
            if (valorMax !== undefined) {
                queryBase += ' AND des.valor <= ?';
                params.push(valorMax);
            }
            if (descricao) {
                queryBase += ' AND des.descricao LIKE ?';
                params.push(`%${descricao}%`);
            }

            // Ordenação
            queryBase += ' ORDER BY des.ano, des.mes, des.dia';

            pool.query(queryBase, params, (err, results) => {
                if (err) return callback(err, null);

                // Agrupa despesas e soma total por mês(saldo geral, pendente, efetivado)
                const despesasPorMes = {};
                const totaisGeralPorMes = {};
                const totaisEfetPorMes = {};
                const totaisPendPorMes = {};

                results.forEach(d => {
                    const chave = `${d.ano}-${String(d.mes).padStart(2, '0')}`;
                    //Adciona valor 0 a meses que não tiverem movimentações
                    if (!despesasPorMes[chave]) {
                        despesasPorMes[chave] = [];
                        totaisGeralPorMes[chave] = 0;
                        totaisEfetPorMes[chave] = 0;
                        totaisPendPorMes[chave] = 0;
                    }
                    despesasPorMes[chave].push(d);

                    //Incrementa despesas indepentende do status
                    totaisGeralPorMes[chave] += parseFloat(d.valor)

                    //Incrementa despesas pendentes
                    if (d.status == 0) {
                        totaisPendPorMes[chave] += parseFloat(d.valor);
                    }

                    //Incrementa despesas efetivadas
                    if (d.status == 1) {
                        totaisEfetPorMes[chave] += parseFloat(d.valor);
                    }

                });

                //Função para agrupar filtragem(categoria, banco, tag)
                // Se quiser também devolver o id do grupo, inclua em SELECT:
                //  cat.id AS id_categoria, ba.id AS id_banco, t.id AS id_tag
                const agruparPorFiltro = (transacoes = [], filtro) => {
                    // Mapeia o filtro para o nome de coluna correto
                    const nomeFieldMap = {
                        categoria: 'nome_categoria',
                        banco: 'nome_banco',
                        tag: 'nome_tag',
                        // permite passar direto o campo já no formato nome_<algo>
                        ['nome_categoria']: 'nome_categoria',
                        ['nome_banco']: 'nome_banco',
                        ['nome_tag']: 'nome_tag'
                    };
                    const idFieldMap = {
                        categoria: 'id_categoria',
                        banco: 'id_banco',
                        tag: 'id_tag'
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



                // Gera lista completa de meses do período
                const retorno = [];
                let current = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
                const end = new Date(fim.getFullYear(), fim.getMonth(), 1);

                while (current <= end) {
                    const chave = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
                    retorno.push({
                        mesAno: chave,
                        totalGeralMes: totaisGeralPorMes[chave] || 0,
                        totalEfetMes: totaisEfetPorMes[chave] || 0,
                        totalPendMes: totaisPendPorMes[chave] || 0,
                        transacoes: despesasPorMes[chave] || [],
                        group: groupBy ? agruparPorFiltro(despesasPorMes[chave] || [], groupBy) : []
                    });
                    current.setMonth(current.getMonth() + 1);
                }

                return callback(null, retorno);
            });
        } catch (error) {
            console.error('Erro ao executar consulta:', error);
            return callback(error, null);
        }
    }


    static readDespesaID = async (id, casal, fixa, callback) => {
        try {
            const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
            const camposFixos = (fixa == 1) ? ', des.id_fixo, des.data_criacao' : '';
            const query = `SELECT des.id, des.descricao, des.valor, des.tipo, des.dia, des.mes, des.ano, des.status, des.obs, cat.id AS id_categoria, cat.nome AS nome_categoria, 
                        ba.id AS id_banco, ba.nome AS nome_banco, t.id AS id_tag, t.nome AS nome_tag${camposFixos} FROM ${tabela} AS des
                            INNER JOIN categoria_tr AS cat ON cat.id = des.categoria
                            INNER JOIN banco AS ba ON ba.id = des.banco
                            LEFT JOIN tags AS t ON t.id = des.tag
                                WHERE des.id = ? AND des.casal = ?`;

            pool.query(query, [id, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results[0])
            })
        } catch (error) {
            return callback(error, null)
        }
    }

    //Através dessa edição só é possível editar uma despesa
    static editDespesa = async (casal, id, descricao, categoria, valor, data, tipo, status, fixa, tag, obs, banco, callback) => {
        const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
        const query = `UPDATE ${tabela} SET descricao = ?, categoria = ?, valor = ?, dia = ?, mes = ?, ano = ?, tipo = ?, status = ?, tag = ?, obs = ?, banco = ? WHERE casal = ? AND id = ?`
        const objData = await SeparaData(data)
        pool.query(query, [descricao, categoria, valor, objData.dia, objData.mes, objData.ano, tipo, status, tag, obs, banco, casal, id], (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }


    //Função para editar todas despesas fixas e pendentes
    static editDespesaFixa = async (casal, id_fixo, descricao, categoria, valor, data, tipo, pendentes, tag, obs, callback) => {
        const query = `UPDATE despesas_fixas SET descricao = ?, categoria = ?, valor = ?, dia = ?, tipo = ?, tag = ?, obs = ? WHERE casal = ? AND id_fixo = ? ${parseInt(pendentes) ? `AND status = 0` : ``}`;
        const objData = await SeparaData(data);

        pool.query(query, [descricao, categoria, valor, objData.dia, tipo, tag, obs, casal, id_fixo], (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results);
        })
    }

    static deleteDespesa = async (casal, id, id_fixo, pend, callback) => {
        const tabela = (!id_fixo || id_fixo == 'undefined') ? 'despesa' : 'despesas_fixas';
        const params = (pend == 1) ? [id_fixo, casal] : [id, casal]
        const query = `DELETE FROM ${tabela} WHERE ${pend == 1 ? `id_fixo = ? AND status = 0` : `id = ?`} AND casal = ?`;

        pool.query(query, params, (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }

    static efetivaDespesa = async (casal, despesaId, fixa, callback) => {
        const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
        const query = `UPDATE ${tabela} SET status = 1 WHERE casal = ? AND id = ?`;

        pool.query(query, [casal, despesaId], (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }
}

export default DespesaModel