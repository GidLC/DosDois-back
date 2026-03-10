import { pool } from "../../config/config.mjs";
import { decrementaUso } from "../../features/assinaturas/utils/decrementaUso.mjs";
import { incrementaUso } from "../../features/assinaturas/utils/incrementaUso.mjs";

class CategoriaTrModel {
    static addCategoriaTr = async (nome, tipo, cor, icone, casal, callback) => {
        const query = 'INSERT INTO categoria_tr (nome, tipo, cor, icone, casal, cat_sistema) VALUES (?,?,?,?,?,0)';
        const categoria = await new Promise((resolve, reject) => {
            pool.query(query, [nome, tipo, cor, icone, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                resolve(results)
            })
        })

        await incrementaUso(casal, "categorias")

        return callback(null, categoria)
    }

    static loadCategoriaTr = (auth, tipo, callback) => {
        const query = `SELECT cat.id, cat.nome, cat.cat_sistema, cat.padrao, cat.tipo, c.codigo AS cod_cor, ic.ion_nome AS icone FROM categoria_tr AS cat 
                        INNER JOIN cor AS c ON cat.cor = c.id 
                        INNER JOIN icones AS ic ON cat.icone = ic.id
                            WHERE casal = ? ${tipo ? `AND tipo = ?` : ``}  AND cat_sistema != 1
                                ORDER BY cat.nome ASC`
        pool.query(query, [auth, tipo && tipo], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            return callback(null, results)
        })
    }

    static loadCategoriasSistema = (auth, callback) => {
        const query = 'SELECT id, nome FROM categoria_tr WHERE casal = ? AND cat_sistema = 1 ORDER BY tipo'
        pool.query(query, [auth], (err, results) => {
            if (err) {
                return callback(err, results)
            }
            return callback(null, results)
        })
    }

    static loadCategoriaTrID = (auth, id, callback) => {
        const query = 'SELECT id, nome, tipo, cor, icone, padrao FROM categoria_tr where casal = ? AND id = ?';
        pool.query(query, [auth, id], (err, results) => {
            if (err) {
                return callback(err, null)
            } else if (results.length == 0) {
                return callback("Nenhum registro foi encontrado", null)
            }

            return callback(null, results[0])
        })
    }

    static editCategoriaTr = async (auth, id, nome, icone, cor, padrao, tipo, callback) => {
        try {
            // Se a categoria for padrão zera todas as outras de serem padrão
            if (padrao) {
                await new Promise((resolve, reject) => {
                    const query = 'UPDATE categoria_tr SET padrao = 0 WHERE casal = ? AND tipo = ?'
                    pool.query(query, [auth, tipo], (err, results) => {
                        if (err) {
                            reject(err)
                        }

                        resolve(results)
                    })
                })
            }

            const edit = await new Promise((resolve, reject) => {
                const query = 'UPDATE categoria_tr SET nome = ?, cor = ?, icone = ?, padrao = ? WHERE casal = ? AND id = ?'
                pool.query(query, [nome, cor, icone, padrao, auth, id], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })

            return callback(null, edit)
        } catch (error) {
            return callback(error, null)
        }
    }

    //Só se utiliza esse delete caso a categoria não tenha movimentações atribuidas a ela
    static deleteCategoriaTr = async (auth, id, callback) => {
        const query = 'DELETE FROM categoria_tr WHERE id = ? AND casal = ?';
        const categoria = await new Promisse((resolve, reject) => {
            pool.query(query, [id, auth], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                resolve(results)
            })
        })

        await decrementaUso(auth, "categorias")

        return callback(null, categoria)
    }


    //Mover movimentações para outra categoria
    static moveTransacoes = async (auth, catOrigem, catDestino, callback) => {
        try {
            //receitas
            const queryReceitas = 'UPDATE receita SET categoria = ? WHERE categoria = ? AND casal = ?'
            await new Promise((resolve, reject) => {
                pool.query(queryReceitas, [catDestino, catOrigem, auth], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            const queryDespesas = 'UPDATE despesa SET categoria = ? WHERE categoria = ? AND casal = ?'
            await new Promise((resolve, reject) => {
                pool.query(queryDespesas, [catDestino, catOrigem, auth], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            callback(null, "OK")
        } catch (error) {
            callback(`Não foi possível realizar a transação: ${error}`, null)
        }
    }
}

export default CategoriaTrModel