import { pool } from "../../../config/config.mjs";
import SeparaData from '../../../data/SeparaData/SeparaData.mjs';
import * as crypto from 'crypto';
import { agruparPorFiltro, despesasQueryBuilder } from "../utils/despesasQueryBuilder.mjs";
import { getMesAnoFatura } from "../../cartoes/utils/getMesAnoFatura.mjs";
import { getOrCreateFatura } from "../../cartoes/utils/getOrCreateFatura.mjs";
import { despesasProcess } from "../utils/despesasProcess.mjs";
import { atualizaFatura } from "../../cartoes/utils/atualizaFatura.mjs";
import { calcLimiteDisp } from "../../cartoes/utils/calcLimiteDisp.mjs";

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
            const anoAtual = new Date().getFullYear();

            const valorReal = (Number(parcelado) == 1) ? Number(valor) : (Number(valor) / Number(parcelado))
            if (Number(parcelado) > 1) repetir = Number(parcelado)

            //Cria identificador para as parcelas
            const uuid_parcela = (repetir > 1) ? crypto.randomUUID() : null

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

                console.log({
                    limiteDisp,
                    despesa: (valorReal * repetir)
                })
                if (limiteDisp < (valorReal * repetir)) {
                    return callback("Sem limite disponível nesse cartão", null)
                }

                //Loop para repetição e parcelamento
                for (let i = 0; i < repetir; i++) {
                    let descParc = (repetir > 1) ? `${descricao} (${i + 1}/${repetir})` : descricao;

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
                            dia, mes, ano, banco, tipo, tag, obs, cartao, fatura, id_parcela
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    `;

                        pool.query(
                            query,
                            [
                                descParc, valorReal, usuario, cod_casal, categoria, status,
                                infoCartao.venc, mes, ano, null, tipo, tag, obs,
                                cartao, fatura.id, uuid_parcela
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

                await Promise.all(promisses);
                return callback(null, { message: "Despesa de cartão registrada com sucesso!" });
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
                            pool.query(query, [(repetir > 1) ? descricaoRep : descricao, valorReal, usuario, cod_casal, categoria, status, objData.dia, mesRep, anoRep, banco, tipo, tag, obs, uuid_parcela], (err, results) => {
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

    static readDespesa = async (filtros, callback) => {
        try {
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

    static readDespesaID = async (id, casal, fixa, callback) => {
        try {
            const tabela = (fixa == 0 || !fixa) ? 'despesa' : 'despesas_fixas';
            const camposFixos = (fixa == 1) ? ', des.id_fixo, des.data_criacao' : '';
            const query = `SELECT des.id, des.descricao, des.valor, des.tipo, des.dia, des.mes, des.ano, des.status, des.cartao, des.fatura, des.obs, des.usuario, cat.id AS id_categoria, cat.nome AS nome_categoria, 
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
                    pool.query(query, [descricao, categoria, valor, objData.dia, objData.mes, objData.ano, tipo, status, tag, obs, banco, cartao, objData.id, casal, id], (err, results) => {
                        if (err) {
                            reject(err)
                        }

                        resolve(results)
                    })
                })
            }


            //Se a despesa atual ou anterior não tiver cartão retorna para o front
            if (!cartao && !old.cartao) {
                const despesa = editDespesa(objData)
                return callback(null, despesa)
            }

            const newFatura = await atualizaFatura(
                old,
                oldValue,
                newValue,
                cartao,
                objData
            )

            editDespesa(newFatura)

            return callback(null, 'OK')
        } catch (error) {
            console.error(`Não foi possível editar a despesa. ${error}`)
            return callback(error, null)
        }
    }


    //Função para editar todas despesas fixas e pendentes
    static editDespesaFixa = async (casal, id_fixo, descricao, categoria, valor, data, tipo, pendentes, tag, obs, callback) => {
        const query = `UPDATE despesas_fixas SET descricao = ?, categoria = ?, valor = ?, dia = ?, tipo = ?, tag = ?, obs = ? WHERE casal = ? AND id_fixo = ? ${parseInt(pendentes) ? `AND status = 0` : ``}`;
        const objData = await SeparaData(data, true);

        pool.query(query, [descricao, categoria, valor, objData.dia, tipo, tag, obs, casal, id_fixo], (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results);
        })
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

        if (old.cartao) {
            atualizaFatura(
                old,
                old.valor,
                0,
                old.cartao
            )
        }

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