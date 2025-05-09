import { pool } from "../../config.mjs";
import SeparaData from "../../data/SeparaData/SeparaData.mjs";
import * as crypto from 'crypto'

class ReceitaModel {

    static addReceita = async (descricao, valor, usuario, cod_casal, categoria, status, data, banco, tipo, tag, fixa, obs, repetir, callback) => {
        try {
            console.log({ descricao, valor, usuario, cod_casal, categoria, status, data, banco, tipo, tag, fixa, obs, repetir })
            const objData = await SeparaData(data)
            const anoAtual = new Date().getFullYear();

            //Cadastro de receita padrão
            if (fixa == 0 || !fixa) {
                const query = 'INSERT INTO receita (descricao, valor, usuario, casal, categoria, status, dia, mes, ano, banco, tipo, tag, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';
                const promisses = []

                let mesRep = objData.mes
                let anoRep = objData.ano

                for (let i = 0; i < repetir; i++) {
                    let descricaoRep = ""

                    //Caso a receita se repita
                    if (repetir > 1) {
                        descricaoRep = `${descricao}(${i + 1}/${repetir})`
                        //Incrementa o mês a partir da segunda repetição e o ano a partir do próximo janeiro existente no período
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
                return callback(null, { message: 'Receita cadastrada com sucesso!' })

            } else if (fixa == 1) {
                //Cadastro de receita fixa
                const id_uuid = crypto.randomUUID()
                const query = 'INSERT INTO receitas_fixas(id_fixo, descricao, valor, tipo, status, dia, mes, ano, data_criacao, casal, usuario, banco, categoria, tag, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
                const promisses = []

                //Cria um o loop de 50 execução (50 anos)
                for (let ano = objData.ano; ano < objData.ano + 50; ano++) {
                    const mesInicial = (ano == anoAtual) ? objData.mes : 0

                    for (let mes = mesInicial; mes < 12; mes++) {
                        promisses.push(
                            new Promise((resolve, reject) => {
                                pool.query(query, [id_uuid, descricao, valor, tipo, status, objData.dia, mes, ano, `${objData.ano}-${objData.mes}-${objData.dia}`, cod_casal, usuario, banco, categoria, tag, obs], (err, results) => {
                                    if (err) {
                                        reject(err)
                                    }

                                    resolve(results)
                                })
                            })
                        )
                    }
                }

                await Promise.all(promisses)
                return callback(null, 'OK')

            } else {
                const err = 'O tipo de despesa específicado não é válido';
                return callback(err, null)
            }

        } catch (error) {
            return callback(error, null)
        }
    }

    static readReceita = async (usuario, casal, mes, ano, fixa, ajuste, callback) => {
        try {
            const tabela = (fixa == 0 || !fixa) ? 'receita' : 'receitas_fixas';
            const camposFixos = (fixa == 1) ? ', rec.id_fixo, rec.data_criacao' : '';
            const queryBase = `
                SELECT rec.id, rec.descricao, rec.valor, rec.dia, rec.mes, rec.ano, rec.status, rec.obs,
                       cat.nome AS nome_categoria, ic.ion_nome AS nome_icone, 
                       cor.codigo AS cod_cor, ba.nome AS nome_banco, cat.tipo AS tipo_categoria,
                       tags.id AS id_tag, tags.nome AS nome_tag${camposFixos}
                FROM ${tabela} AS rec
                INNER JOIN categoria_tr AS cat ON cat.id = rec.categoria
                INNER JOIN icones AS ic ON ic.id = cat.icone
                INNER JOIN cor ON cor.id = cat.cor
                INNER JOIN banco AS ba ON ba.id = rec.banco
                LEFT JOIN tags ON tags.id = rec.tag
                WHERE rec.usuario = ? AND rec.casal = ? AND rec.mes = ? AND rec.ano = ? AND rec.tipo = 0`;

            const receitasInd = await new Promise((resolve, reject) => {
                pool.query(queryBase, [usuario, casal, mes, ano], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            const queryCol = `SELECT rec.id, rec.descricao, rec.valor, rec.dia, rec.mes, rec.ano, rec.status, cat.nome AS nome_categoria, 
            ic.ion_nome AS nome_icone, cor.codigo AS cod_cor, ba.nome AS nome_banco, cat.tipo AS tipo_categoria FROM receita as rec
                INNER JOIN categoria_tr AS cat ON cat.id = rec.categoria
                INNER JOIN icones AS ic ON ic.id = cat.icone
                INNER JOIN cor ON cor.id = cat.cor
                INNER JOIN banco AS ba ON ba.id = rec.banco
                    WHERE rec.casal = ? AND rec.mes = ? AND rec.ano = ? AND rec.tipo = 1`
            //Entende-se receitas coletivas como os ajustes de saldo dos bancos coletivos
            const receitasCol = await new Promise((resolve, reject) => {
                pool.query(queryCol, [casal, mes, ano], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })


            const receitas = (ajuste == 1 || ajuste != 0) ? [...receitasInd, ...receitasCol] : receitasInd
            return callback(null, receitas)
        } catch (error) {
            console.error('Erro ao executar consulta:', error);
            return callback(error, null);
        }
    }

    static readReceitaID = async (id, usuario, casal, fixa, callback) => {
        try {
            const tabela = (fixa == 0 || !fixa) ? 'receita' : 'receitas_fixas';
            const camposFixos = (fixa == 1) ? ', rec.id_fixo, rec.data_criacao' : '';
            const query = `SELECT rec.id, rec.descricao, rec.valor, rec.tipo, rec.dia, rec.mes, rec.ano, rec.status, rec.obs, cat.id AS id_categoria, cat.nome AS nome_categoria, 
                        ba.id AS id_banco, ba.nome AS nome_banco${camposFixos} FROM ${tabela} AS rec
                            INNER JOIN categoria_tr AS cat ON cat.id = rec.categoria
                            INNER JOIN banco AS ba ON ba.id = rec.banco
                                WHERE rec.id = ? AND rec.usuario = ? AND rec.casal = ?`;

            pool.query(query, [id, usuario, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results[0])
            })
        } catch (error) {
            return callback(error, null)
        }
    }

    //Edita uma receita específica
    static editReceita = async (casal, tipo, id, descricao, categoria, valor, data, status, tag, obs, fixa, banco, callback) => {
        const tabela = (fixa == 0 || !fixa) ? 'receita' : 'receitas_fixas';
        const query = `UPDATE ${tabela} SET descricao = ?, categoria = ?, valor = ?, dia = ?, mes = ?, ano = ?, tipo = ?, status = ?, tag = ?, obs = ?, banco = ? WHERE casal = ? AND id = ?`
        const objData = await SeparaData(data)
        pool.query(query, [descricao, categoria, valor, objData.dia, objData.mes, objData.ano, tipo, status, tag, obs, banco, casal, id], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            return callback(null, results)
        })
    }

    //Função para editar todas receitas fixas ou pendentes
    static editReceitaFixa = async (casal, id_fixo, descricao, categoria, valor, data, tipo, pendentes, tag, obs, callback) => {
        const query = `UPDATE receitas_fixas SET descricao = ?, categoria = ?, valor = ?, dia = ?, tipo = ?, tag = ?, obs = ? WHERE casal = ? AND id_fixo = ? ${parseInt(pendentes) == 1 ? `AND status = 0` : ``}`;
        const objData = await SeparaData(data);

        pool.query(query, [descricao, categoria, valor, objData.dia, tipo, tag, obs, casal, id_fixo], (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results);
        })
    }

    static deleteReceita = async (id, usuario, casal, pend, id_fixo, callback) => {
        let tabela
        let params
        let query
        //Excluir todas as receitas fixas
        if (id_fixo != 'undefined' && pend != 1) {
            query = `DELETE FROM receitas_fixas WHERE id_fixo = ? AND casal = ?`
            params = [id_fixo, casal]
        } else {
            tabela = (!id_fixo || id_fixo == 'undefined') ? 'receita' : 'receitas_fixas'
            //Exclui apenas as pendentes
            params = (pend == 1) ? [id_fixo, usuario, casal] : [id, usuario, casal]
            query = `DELETE FROM ${tabela} WHERE ${pend == 1 ? `id_fixo = ? AND status = 0` : `id = ?`} AND usuario = ? AND casal = ?`
        }

        pool.query(query, params, (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }

    static efetivaReceita = async (casal, receitaId, fixa, callback) => {
        const table = (fixa == 0 || !fixa ? "receita" : "receitas_fixas");

        const query = `UPDATE ${table} SET status = 1 WHERE casal = ? AND id = ?`;

        pool.query(query, [casal, receitaId], (err, results) => {
            if (err) {
                return callback(err, null);
            }

            return callback(null, results);
        })
    }

}

export default ReceitaModel