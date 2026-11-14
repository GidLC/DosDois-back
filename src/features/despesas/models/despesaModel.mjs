import { pool } from "../../../config/config.mjs";
import SeparaData from '../../../data/SeparaData/SeparaData.mjs';
import * as crypto from 'crypto';
import { agruparPorFiltro, despesasQueryBuilder } from "../utils/despesasQueryBuilder.mjs";
import { getMesAnoFatura } from "../../cartoes/utils/getMesAnoFatura.mjs";
import { getOrCreateFatura } from "../../cartoes/utils/getOrCreateFatura.mjs";
import { despesasProcess } from "../utils/despesasProcess.mjs";
import { atualizaFatura } from "../../cartoes/utils/atualizaFatura.mjs";
import { calcLimiteDisp } from "../../cartoes/utils/calcLimiteDisp.mjs";
import { ensureDespesasFixasMes, ensureDespesasFixasPeriodo } from "../utils/despesasFixasMes.mjs";

class DespesaModel {
    //Adiciona despesas, tanto normais como fixas
    static addDespesa = async (
        descricao,
        valor,
        usuario,
        cod_casal,
        categoria,
        status,
        data,
        banco,
        tipo,
        fixa,
        tag,
        obs,
        repetir,
        parcelado,
        cartao,
        callback) => {
        try {
            const objData = await SeparaData(data)
            const valorReal = (Number(parcelado) == 1) ? Number(valor) : (Number(valor) / Number(parcelado))
            if (Number(parcelado) > 1) repetir = Number(parcelado)

            //Cria identificador para as parcelas
            const uuid_parcela = (repetir > 1) ? crypto.randomUUID() : null
            const uuid_compra = (cartao != null && Number(cartao) > 0 && Number(parcelado) > 1)
                ? crypto.randomUUID()
                : null

            // Se for despesa em cartão
            // -----------------------------------------------------------------
            if (cartao != null && Number(cartao) > 0) {
                // Puxa dados do cartão (id, fechamento, vencimento e limite)
                const infoCartao = await new Promise((resolve, reject) => {
                    const q = `
                    SELECT id_cartao AS id, fech, venc, limite 
                    FROM cartoes 
                    WHERE id_cartao = ?
                `;
                    pool.query(q, [cartao], (err, res) => {
                        if (err) reject(err);
                        resolve(res[0]);
                    });
                });


                const promisses = [];
                let mesRep = objData.mes;
                let anoRep = objData.ano;

                const limiteDisp = await calcLimiteDisp(infoCartao)

                //Verifica se há limite no cartão para inclusão da despesa
                if (limiteDisp < (valorReal * repetir)) {
                    return callback("Sem limite disponível nesse cartão", null)
                }

                //Se for uma despesa fixa no cartão registra na tabela pra inclusão mensal(a cada fechamento da fatura)
                if (fixa == 1) {
                    const queryFixCart = `
                        INSERT INTO desp_fixas_cartao(
                            descricao, valor, usuario, casal, categoria,
                            tipo, tag, obs, cartao, dia_compra
                        ) VALUES (?,?,?,?,?,?,?,?,?,?)
                    `
                    await new Promise((resolve, reject) => {
                        pool.query(queryFixCart, [descricao, valorReal, usuario, cod_casal, categoria, tipo, tag, obs, cartao, objData.dia], (err, results) => {
                            if (err) {
                                reject(err)
                            }

                            resolve(results)
                        })
                    })
                }

                //Loop para repetição e parcelamento
                for (let i = 0; i < repetir; i++) {
                    let descParc = (repetir > 1) ? `${descricao} (${i + 1}/${repetir})` : descricao;
                    const mesCompra = uuid_compra ? objData.mes : mesRep;
                    const anoCompra = uuid_compra ? objData.ano : anoRep;
                    const dataCompra = `${anoCompra}-${String(mesCompra + 1).padStart(2, '0')}-${String(objData.dia).padStart(2, '0')}`;

                    // Cada repetição pode cair em MES/ANO de fatura diferente
                    const { mes, ano } = await getMesAnoFatura(
                        objData.dia,
                        mesRep,
                        anoRep,
                        infoCartao.fech
                    );

                    // Buscar ou criar a fatura
                    const fatura = await getOrCreateFatura(infoCartao.id, mes, ano);

                    promisses.push(new Promise((resolve, reject) => {
                        const query = `
                        INSERT INTO despesa(
                            descricao, valor, usuario, casal, categoria, status,
                            dia, mes, ano, banco, tipo, tag, obs, cartao, fatura, id_parcela,
                            data_compra, valor_compra, id_compra
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    `;

                        pool.query(
                            query,
                            [
                                descParc, valorReal, usuario, cod_casal, categoria, status,
                                infoCartao.venc, mes, ano, null, tipo, tag, obs,
                                cartao, fatura.id, uuid_parcela, dataCompra, Number(valor), uuid_compra
                            ],
                            async (err, result) => {
                                if (err) return reject(err);

                                // Atualizar total da fatura
                                const qUp = `
                                UPDATE cartao_faturas
                                SET total = total + ?
                                WHERE id = ?
                            `;
                                pool.query(qUp, [valorReal, fatura.id]);
                                resolve(result);
                            }
                        );
                    }));

                    // Incrementa mês da parcela seguinte
                    mesRep++;
                    if (mesRep === 12) {
                        mesRep = 0;
                        anoRep++;
                    }
                }

                const resultados = await Promise.all(promisses);
                return callback(null, {
                    message: "Despesa no cartão registrada com sucesso!",
                    ids: resultados.map((resultado) => resultado.insertId).filter(Boolean)
                });
            }

            //Cadastro de despesa padrão
            if (fixa == 0 || !fixa) {
                const query = 'INSERT INTO despesa(descricao, valor, usuario, casal, categoria, status, dia, mes, ano, banco, tipo, tag, obs, id_parcela) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
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
                            pool.query(query, [(repetir > 1) ? descricaoRep : descricao, valorReal, usuario, cod_casal, categoria, status, objData.dia, mesRep, anoRep, banco, tipo, tag, obs, uuid_parcela], async (err, results) => {
                                if (err) return reject(err)

                                resolve(results)
                            })
                        })
                    )
                }

                const resultados = await Promise.all(promisses);
                return callback(null, {
                    message: 'Despesa cadastrada com sucesso!',
                    ids: resultados.map((resultado) => resultado.insertId).filter(Boolean)
                })

            } else if (fixa == 1) {
                // Salva uma definição recorrente e materializa apenas a primeira ocorrência.
                const id_uuid = crypto.randomUUID();
                const inicio = `${objData.ano}-${String(objData.mes + 1).padStart(2, '0')}-${String(objData.dia).padStart(2, '0')}`;
                await new Promise((resolve, reject) => pool.query(
                    `INSERT INTO despesas_fixas_modelos
                        (id_fixo, descricao, valor, tipo, dia, inicio, casal, usuario, banco, categoria, tag, obs, ativa)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
                    [id_uuid, descricao, valor, tipo, objData.dia, inicio, cod_casal, usuario, banco, categoria, tag, obs],
                    (err, result) => err ? reject(err) : resolve(result)
                ));
                await ensureDespesasFixasMes(objData.mes, objData.ano, cod_casal, id_uuid);
                return callback(null, { message: 'Despesa fixa cadastrada com sucesso!' })

            } else {
                const err = 'O tipo de despesa específicado não é válido';
                return callback(err, null)
            }
        } catch (error) {
            return callback(error, null)
        }

    }

    static readDespesa = async (filtros, callback) => {
        try {
            if (filtros.fixa == 1) {
                if (filtros.dataInicio && filtros.dataFim) {
                    await ensureDespesasFixasPeriodo(filtros.dataInicio, filtros.dataFim, filtros.casal);
                } else if (filtros.ano && filtros.mes !== null && filtros.mes !== undefined) {
                    await ensureDespesasFixasMes(filtros.mes, filtros.ano, filtros.casal);
                }
            }
            let { query, params } = despesasQueryBuilder(filtros);
            pool.query(query, params, async (err, results) => {
                if (err) return callback(err, null);

                const { groupBy, dataInicio, dataFim, ano, mes } = filtros;

                // Detecta tipo de busca e define range
                let inicio, fim;

                // Por período
                if (dataInicio && dataFim) {
                    inicio = new Date(dataInicio);
                    fim = new Date(dataFim);
                    query += `
              AND STR_TO_DATE(CONCAT(des.dia, '/', des.mes, '/', des.ano), '%d/%m/%Y') 
                  BETWEEN ? AND ?`;
                    params.push(dataInicio, dataFim);

                    //Um mês específico
                } else if (ano && mes !== null) {
                    inicio = new Date(ano, mes, 1);
                    fim = new Date(ano, mes + 1, 0);
                    query += ' AND des.ano = ? AND des.mes = ?';
                    params.push(ano, mes);

                    // Um ano específico
                } else if (ano) {
                    inicio = new Date(ano, 0, 1);
                    fim = new Date(ano, 11, 31);
                    query += ' AND des.ano = ?';
                    params.push(ano);
                } else {

                }

                //Caso o inicio e o fim não sejam definidos é retornado o ano atual
                if (!inicio || !fim) {
                    inicio = new Date(new Date().getFullYear(), 0, 1); // janeiro atual
                    fim = new Date(new Date().getFullYear(), 11, 31);  // dezembro atual
                }

                if (filtros.cartao == null) {
                    const retorno = despesasProcess(
                        results,
                        inicio,
                        fim,
                        groupBy,
                        agruparPorFiltro
                    );

                    return callback(null, retorno);
                }


                if (filtros.cartao) {
                    const [retorno] = despesasProcess(
                        results,
                        inicio,
                        fim,
                        groupBy,
                        agruparPorFiltro
                    );

                    const query = `SELECT status 
                    FROM cartao_faturas 
                    WHERE cartao_id = ? AND mes = ? AND ano = ?`

                    const [status] = await new Promise((resolve, reject) => {
                        pool.query(query, [filtros.cartao, mes, ano], (err, results) => {
                            if (err) {
                                reject(err);
                            }

                            resolve(results);
                        })
                    })

                    return callback(null, [{ ...retorno, ...status }])
                }
            });
        } catch (error) {
            return callback(error, null);
        }
    };

    static readCalendarioGastos = async (casal, mes, ano) => {
        await ensureDespesasFixasMes(mes, ano, casal);
        const inicio = `${ano}-${String(Number(mes) + 1).padStart(2, '0')}-01`;
        const fim = new Date(Number(ano), Number(mes) + 1, 0).getDate();
        const fimMes = `${ano}-${String(Number(mes) + 1).padStart(2, '0')}-${String(fim).padStart(2, '0')}`;

        const rows = await new Promise((resolve, reject) => {
            const query = `
                SELECT des.id, des.id_compra, des.descricao, des.valor, des.valor_compra,
                    CASE
                        WHEN des.cartao IS NOT NULL THEN DATE_FORMAT(des.data_compra, '%Y-%m-%d')
                        ELSE DATE_FORMAT(STR_TO_DATE(CONCAT(des.ano, '-', LPAD(des.mes + 1, 2, '0'), '-', LPAD(des.dia, 2, '0')), '%Y-%m-%d'), '%Y-%m-%d')
                    END AS data_gasto,
                    cat.nome AS categoria,
                    car.nome AS cartao
                FROM despesa AS des
                LEFT JOIN categoria_tr AS cat ON cat.id = des.categoria
                LEFT JOIN cartoes AS car ON car.id_cartao = des.cartao
                WHERE des.casal = ?
                    AND (
                        (des.cartao IS NOT NULL AND des.data_compra BETWEEN ? AND ?)
                        OR (des.cartao IS NULL AND des.ano = ? AND des.mes = ?)
                    )
                    AND LOWER(des.descricao) NOT LIKE 'pagamento da fatura%'
                    AND LOWER(des.descricao) NOT LIKE 'adiantamento de fatura%'
                    AND LOWER(COALESCE(des.obs, '')) NOT LIKE '%pagamento da fatura%'
                ORDER BY data_gasto, des.id
            `;
            pool.query(query, [casal, inicio, fimMes, Number(ano), Number(mes)], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        const legacyMissingDateRows = await new Promise((resolve, reject) => {
            const query = `
                SELECT COUNT(*) AS total
                FROM despesa
                WHERE casal = ? AND cartao IS NOT NULL AND data_compra IS NULL
                    AND LOWER(descricao) NOT LIKE 'pagamento da fatura%'
                    AND LOWER(descricao) NOT LIKE 'adiantamento de fatura%'
                    AND LOWER(COALESCE(obs, '')) NOT LIKE '%pagamento da fatura%'
            `;
            pool.query(query, [casal], (err, results) => {
                if (err) return reject(err);
                resolve(Number(results?.[0]?.total ?? 0));
            });
        });

        const fixedRows = await new Promise((resolve, reject) => {
            pool.query(
                `SELECT des.id, des.id_fixo, des.descricao, des.valor, des.dia, des.mes, des.ano,
                    cat.nome AS categoria
                 FROM despesas_fixas AS des
                 LEFT JOIN categoria_tr AS cat ON cat.id = des.categoria
                 WHERE des.casal = ? AND des.ano = ? AND des.mes = ? AND des.cancelada = 0
                 ORDER BY des.dia, des.id`,
                [casal, Number(ano), Number(mes)],
                (err, results) => err ? reject(err) : resolve(results)
            );
        });

        const purchases = new Map();
        rows.forEach((row) => {
            if (!row.data_gasto) return;
            const key = row.id_compra ? `purchase:${row.id_compra}` : `expense:${row.id}`;
            const description = String(row.descricao || 'Despesa').replace(/\s*\(\d+\/\d+\)\s*$/, '');
            const current = purchases.get(key);
            if (current) {
                return;
            }

            purchases.set(key, {
                id: key,
                data: row.data_gasto,
                descricao: description,
                categoria: row.categoria || 'Sem categoria',
                valor: Number(row.valor_compra ?? row.valor ?? 0),
                forma: row.cartao ? `Crédito · ${row.cartao}` : 'Conta ou dinheiro'
            });
        });

        fixedRows.forEach((row) => {
            const day = Math.min(Number(row.dia), new Date(Number(ano), Number(mes) + 1, 0).getDate());
            const key = `fixed:${row.id}`;
            purchases.set(key, {
                id: key,
                data: `${ano}-${String(Number(mes) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                descricao: row.descricao || 'Despesa',
                categoria: row.categoria || 'Sem categoria',
                valor: Number(row.valor ?? 0),
                forma: 'Despesa fixa'
            });
        });

        return {
            compras: Array.from(purchases.values()),
            lancamentosCartaoSemData: legacyMissingDateRows
        };
    };

    static readDespesaID = async (id, casal, fixa, callback) => {
        try {
            const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
            const camposFixos = (fixa == 1) ? ', des.id_fixo, des.data_criacao' : '';
            const camposCompra = tabela === 'despesa' ? ', des.data_compra, des.id_compra' : '';
            const query = `SELECT des.id, des.descricao, des.valor, des.tipo, des.dia, des.mes, des.ano, des.status, des.cartao, des.fatura${camposCompra}, des.obs, des.usuario, cat.id AS id_categoria, cat.nome AS nome_categoria, 
                        ba.id AS id_banco, ba.nome AS nome_banco, t.id AS id_tag, t.nome AS nome_tag${camposFixos} FROM ${tabela} AS des
                            INNER JOIN categoria_tr AS cat ON cat.id = des.categoria
                            LEFT JOIN banco AS ba ON ba.id = des.banco
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
    static editDespesa = async (
        casal,
        id,
        descricao,
        categoria,
        valor,
        data,
        tipo,
        status,
        fixa,
        tag,
        obs,
        banco,
        cartao,
        callback) => {

        try {
            const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
            const objData = await SeparaData(data, true)

            //Busca a despesa conforme ela está atualmente no BD
            const [old] = await new Promise((resolve, reject) => {
                pool.query(`SELECT * FROM ${tabela} WHERE id = ? AND casal = ?`, [id, casal], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                });
            })

            //Identifica se houve mudanças nos valores
            const oldValue = Number(old.valor);
            const newValue = Number(valor);

            const query = `UPDATE ${tabela} SET descricao = ?, categoria = ?, valor = ?, dia = ?, mes = ?, ano = ?, tipo = ?, status = ?, tag = ?, obs = ?, banco = ?, cartao = ?, fatura = ? WHERE casal = ? AND id = ?`

            const editDespesa = async (objData) => {
                return await new Promise((resolve, reject) => {
                    pool.query(query, [descricao, categoria, valor, objData.dia, objData.mes, objData.ano, tipo, status, tag, obs, banco, cartao, objData.id, casal, id], async (err, results) => {
                        if (err) return reject(err)

                        resolve(results)
                    })
                })
            }


            //Se a despesa atual ou anterior não tiver cartão retorna para o front
            if (!cartao && !old.cartao) {
                const despesa = await editDespesa(objData)
                return callback(null, despesa)
            }

            const newFatura = await atualizaFatura(
                old,
                oldValue,
                newValue,
                cartao,
                objData
            )

            await editDespesa(newFatura)

            return callback(null, 'OK')
        } catch (error) {
            console.error(`Não foi possível editar a despesa. ${error}`)
            return callback(error, null)
        }
    }


    //Função para editar todas despesas fixas e pendentes
    static editDespesaFixa = async (casal, id_fixo, descricao, categoria, valor, data, tipo, pendentes, tag, obs, callback) => {
        try {
            const objData = await SeparaData(data, true);
            const modelo = await new Promise((resolve, reject) => pool.query(
                `UPDATE despesas_fixas_modelos SET descricao = ?, categoria = ?, valor = ?, dia = ?, tipo = ?, tag = ?, obs = ?
                 WHERE casal = ? AND id_fixo = ? AND ativa = 1`,
                [descricao, categoria, valor, objData.dia, tipo, tag, obs, casal, id_fixo],
                (err, result) => err ? reject(err) : resolve(result)
            ));
            const query = `UPDATE despesas_fixas SET descricao = ?, categoria = ?, valor = ?, dia = ?, tipo = ?, tag = ?, obs = ?
                WHERE casal = ? AND id_fixo = ? AND cancelada = 0 ${parseInt(pendentes) ? `AND status = 0` : ``}`;
            const ocurrencias = await new Promise((resolve, reject) => pool.query(
                query, [descricao, categoria, valor, objData.dia, tipo, tag, obs, casal, id_fixo],
                (err, result) => err ? reject(err) : resolve(result)
            ));
            return callback(null, { ...modelo, ocorrencias });
        } catch (error) {
            return callback(error, null);
        }
    }

    static deleteDespesa = async (casal, id, id_fixo, pend, callback) => {
        if (id_fixo == 'undefined') id_fixo = undefined

        const tabela = (!id_fixo || id_fixo == undefined) ? 'despesa' : 'despesas_fixas';

        const [old] = await new Promise((resolve, reject) => {
            pool.query(`SELECT * FROM ${tabela} WHERE id = ?`, [id], (err, results) => {
                if (err) {
                    reject(err)
                }

                resolve(results)
            });
        })

        if (old && old.cartao) {
            atualizaFatura(
                old,
                old.valor,
                0,
                old.cartao
            )
        }

        if (tabela === 'despesas_fixas') {
            // Ambas as opções encerram a recorrência; pend=1 preserva as ocorrências pagas.
            const filtroStatus = pend == 1 ? ' AND status = 0' : '';
            pool.query(
                `UPDATE despesas_fixas_modelos SET ativa = 0 WHERE casal = ? AND id_fixo = ?`,
                [casal, id_fixo],
                (err) => {
                    if (err) return callback(err, null);
                    pool.query(
                        `UPDATE despesas_fixas SET cancelada = 1 WHERE casal = ? AND id_fixo = ?${filtroStatus}`,
                        [casal, id_fixo],
                        (cancelErr, cancelResults) => cancelErr ? callback(cancelErr, null) : callback(null, cancelResults)
                    );
                }
            );
            return;
        }

        const params = [id, casal];
        pool.query(`DELETE FROM ${tabela} WHERE id = ? AND casal = ?`, params, (err, results) => {
            if (err) return callback(err, null);
            return callback(null, results);
        });
    }

    static efetivaDespesa = async (casal, despesaId, fixa, callback) => {
        const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
        const filtroCancelada = tabela === 'despesas_fixas' ? ' AND cancelada = 0' : '';
        const query = `UPDATE ${tabela} SET status = 1 WHERE casal = ? AND id = ?${filtroCancelada}`;

        pool.query(query, [casal, despesaId], (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }
}

export default DespesaModel
