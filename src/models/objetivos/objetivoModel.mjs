import { pool } from "../../config.mjs";
import separaData from "../../data/SeparaData/SeparaData.mjs";

class ObjetivoModel {
    static addObjetivo = (descricao, valor_final, valor_inicial, status, prazo, casal, cor, icone, callback) => {
        const query = 'INSERT INTO objetivo (descricao, valor_final, valor_inicial, status, prazo, casal, cor, icone) VALUES (?,?,?,?,?,?,?,?)'

        pool.query(query, [descricao, valor_final, valor_inicial, status, prazo, casal, cor, icone], (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }

    static readObjetivos = async (casal, status, callback) => {
        try {
            const queryObjs = `SELECT obj.id, obj.descricao, obj.valor_final, obj.valor_inicial, obj.status, obj.prazo, c.codigo AS cod_cor, ic.ion_nome AS icone FROM objetivo AS obj
            INNER JOIN cor AS c ON obj.cor = c.id 
            INNER JOIN icones AS ic ON obj.icone = ic.id
                WHERE casal = ? AND status = ?`;

            const objs = await new Promise((resolve, reject) => {
                pool.query(queryObjs, [casal, status], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            const objetivos = await Promise.all(objs.map(async (objetivo) => {
                const valorAportes = await new Promise((resolve, reject) => {
                    const queryAportes = 'SELECT SUM(valor) as valor FROM aporte_objetivo WHERE objetivo = ?'
                    pool.query(queryAportes, [objetivo.id], (err, results) => {
                        if (err) {
                            reject(err)
                        }
                        resolve(results)
                    })
                })

                const valorAtual = valorAportes[0].valor + objetivo.valor_inicial
                return { ...objetivo, valorAtual }
            }))

            callback(null, objetivos)
        } catch (error) {
            callback(error, null)
        }
    }

    static readObjetivoId = async (id, casal, callback) => {
        try {
            const queryObj = `SELECT obj.id, obj.descricao, obj.valor_final, obj.valor_inicial, obj.status, obj.prazo, c.id AS cor, ic.id AS icone FROM objetivo AS obj
            INNER JOIN cor AS c ON obj.cor = c.id 
            INNER JOIN icones AS ic ON obj.icone = ic.id
                WHERE obj.casal = ? AND obj.id = ?`;

            const obj = await new Promise((resolve, reject) => {
                pool.query(queryObj, [casal, id], (err, results) => {
                    if (err) {
                        return reject(err)
                    }
                    if (!results || results.length === 0) {
                        return reject(new Error('Objetivo não encontrado'))
                    }
                    resolve(results[0])
                })
            })


            const valorAportes = await new Promise((resolve, reject) => {
                const queryAportes = 'SELECT SUM(valor) as valor FROM aporte_objetivo WHERE objetivo = ?'
                pool.query(queryAportes, [id], (err, results) => {
                    if (err) {
                        return reject(err)
                    }
                    resolve(results[0]?.valor ?? 0)
                })
            })

            const valorInicial = obj.valor_inicial ?? 0
            const valorAtual = valorAportes + valorInicial


            const objetivo = { ...obj, valorAtual }
            return callback(null, objetivo)
        } catch (error) {
            return callback(error, null)
        }
    }

    static deleteObjetivo = (id, casal, callback) => {
        const query = 'DELETE FROM objetivo WHERE id = ? AND casal = ?';

        pool.query(query, [id, casal], (err, results) => {
            if (err) {
                return callback(err, null)
            }

            return callback(null, results)
        })
    }

    static aporteValor = (objetivoId, valor, casal, callback) => {
        const query = 'INSERT INTO aporte_objetivo (valor, objetivo, casal, data) VALUES (?,?,?, NOW())'

        pool.query(query, [valor, objetivoId, casal], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            return callback(null, results)
        })
    }

    static readAportes = (objetivoId, casal, callback) => {
        const query = 'SELECT id, valor, data FROM aporte_objetivo WHERE objetivo = ? AND casal = ?'

        pool.query(query, [objetivoId, casal], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            return callback(null, results)
        })
    }

    static mudaStatusObjetivo = (objetivoId, casal, status, callback) => {
        const query = 'UPDATE objetivo SET status = ? WHERE id = ? AND casal = ?'

        pool.query(query, [status, objetivoId, casal], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            return callback(null, results)
        })
    }

    static editObjetivo = async (casal, id, descricao, valor_final, prazo, cor, icone, callback) => {
        const objData = await separaData(prazo)
        const query = 'UPDATE objetivo SET descricao = ?, valor_final = ?, prazo = ?, cor = ?, icone = ? WHERE id = ? AND casal = ?'

        pool.query(query, [descricao, valor_final, `${objData.ano}-${objData.mes}-${objData.dia}`, cor, icone, id, casal], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            return callback(null, results)
        })
    }

    static deleteAporte = (aporteId, casal, callback) => {
        const query = 'DELETE FROM aporte_objetivo WHERE id = ? AND casal= ?'

        pool.query(query, [aporteId, casal], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            return callback(null, results)
        })
    }
}

export default ObjetivoModel