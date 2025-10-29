import { pool } from "../../config/config.mjs";

class CategoriaTrModel {
    static addCategoriaTr = (nome, tipo, cor, icone, casal, callback) => {
        const query = 'INSERT INTO categoria_tr (nome, tipo, cor, icone, casal, cat_sistema) VALUES (?,?,?,?,?,0)';
        pool.query(query, [nome, tipo, cor, icone, casal], (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }

    static loadCategoriaTr = (auth, tipo, callback) => {
        const query = `SELECT cat.id, cat.nome, cat.cat_sistema, cat.padrao, c.codigo AS cod_cor, ic.ion_nome AS icone FROM categoria_tr AS cat 
                        INNER JOIN cor AS c ON cat.cor = c.id 
                        INNER JOIN icones AS ic ON cat.icone = ic.id
                            WHERE casal = ? AND tipo = ? AND cat_sistema != 1
                                ORDER BY cat.nome ASC`
        pool.query(query, [auth, tipo], (err, results) => {
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
        const query = 'SELECT id, nome, tipo, cor, icone FROM categoria_tr where casal = ? AND id = ?';
        pool.query(query, [auth, id], (err, results) => {
            if (err) {
                return callback(err, null)
            } else if (results.length == 0) {
                return callback("Nenhum registro foi encontrado", null)
            }

            return callback(null, results[0])
        })
    }

    static editCategoriaTr = (auth, id, nome, icone, cor, callback) => {
        console.log(auth, id, nome, icone, cor)
        const query = 'UPDATE categoria_tr SET nome = ?, cor = ?, icone = ? WHERE casal = ? AND id = ?'
        pool.query(query, [nome, cor, icone, auth, id], (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }

    //Só se utiliza esse delete caso a categoria não tenha movimentações atribuidas a ela
    static deleteCategoriaTr = (auth, id, callback) => {
        const query = 'DELETE FROM categoria_tr WHERE id = ? AND casal = ?';
        pool.query(query, [id, auth], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            //console.log(results)

            return callback(null, results)
        })
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