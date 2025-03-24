import { pool } from "../../config.mjs";
import SeparaData from "../../data/SeparaData/SeparaData.mjs";

class TransfModel {
    static addTransferencia = async (casal, valor, usuario, data, bancoOrigem, bancoDestino, obs, callback) => {
        try {
            const objData = await SeparaData(data)
            //No banco de origem se cria uma despesa(débito 0)
            const debitoTr = await new Promise((resolve, reject) => {
                const queryDebito = 'INSERT INTO transferencias(descricao, valor, usuario, casal, dia, mes, ano, banco_origem, banco_destino, tipo, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
                pool.query(queryDebito, ['Transferência saída', valor, usuario, casal, objData.dia, objData.mes, objData.ano, bancoOrigem, bancoDestino, 0, obs], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            //No banco destino se cria uma receita(crédito 1)
            const creditoTr = await new Promise((resolve, reject) => {
                const queryCredito = 'INSERT INTO transferencias(descricao, valor, usuario, casal, dia, mes, ano, banco_origem, banco_destino, tipo, relacao, obs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)';
                pool.query(queryCredito, ['Transferência entrada', valor, usuario, casal, objData.dia, objData.mes, objData.ano, bancoDestino, bancoOrigem, 1, debitoTr.insertId, obs], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            await new Promise((resolve, reject) => {
                const queryRelacaoDebCred = 'UPDATE transferencias SET relacao = ? WHERE id = ?'
                pool.query(queryRelacaoDebCred, [creditoTr.insertId, debitoTr.insertId], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            callback(null, 'OK')
        } catch (error) {
            console.error(`Não foi possível realizar a transferência ${error}`);
            return callback(error, null);
        }
    }

    static readTransferencias = async (usuario, casal, mes, ano, callback) => {
        try {
            const query = `SELECT tr.id, tr.descricao, tr.valor, tr.tipo AS tipoTransf, tr.dia, tr.mes, tr.ano, tr.obs, origem.nome AS origem_nome, destino.nome AS destino_nome, tr.relacao FROM transferencias AS tr 
                                INNER JOIN banco origem ON tr.banco_origem = origem.id
                                INNER JOIN banco destino ON tr.banco_destino = destino.id
                                    WHERE tr.usuario = ? AND tr.casal = ? AND tr.mes = ? AND tr.ano = ?`
            pool.query(query, [usuario, casal, mes, ano], (err, results) => {
                if (err) {
                    return callback(err, null)
                }
                return callback(null, results)
            })
        } catch (error) {
            console.error(`Não foi possível listar as transferências ${error}`);
            return callback(error, null);
        }
    }

    static deleteTransferencia = async (casal, id, callback) => {
        try {
            const queryDeb = `DELETE FROM transferencias WHERE casal = ? AND id = ?`;
            await new Promise((resolve, reject) => {
                pool.query(queryDeb, [casal, id], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })

            const queryCred = `DELETE FROM transferencias WHERE casal = ? AND relacao = ?`;
            await new Promise((resolve, reject) => {
                pool.query(queryCred, [casal, id], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })

            return callback(null, 'OK')
        } catch (error) {
            return callback(error, null)
        }
    }


    static readTransferenciaID = async (id, casal, callback) => {
        try {
            const query = `SELECT tr.valor, tr.dia, tr.mes, tr.ano, tr.tipo AS tipoTransf, origem.id AS origem_id, destino.id AS destino_id, tr.relacao, tr.obs FROM transferencias AS tr
            INNER JOIN banco origem ON tr.banco_origem = origem.id
            INNER JOIN banco destino ON tr.banco_destino = destino.id
                WHERE tr.id = ? AND tr.casal = ?`
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

    static editTransferencia = async (id, casal, idRelacao, valor, data, bancoOrigem, bancoDestino, obs, callback) => {
        try {
            const objData = await SeparaData(data)
            await new Promise((resolve, reject) => {
                const query = 'UPDATE transferencias set valor = ?, dia = ?, mes = ?, ano = ?, banco_origem = ?, banco_destino = ?, obs = ? WHERE id = ? AND casal = ?'
                pool.query(query, [valor, objData.dia, objData.mes, objData.ano, bancoOrigem, bancoDestino, obs, id, casal], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })

            await new Promise((resolve, reject) => {
                const query = 'UPDATE transferencias SET valor = ?, dia = ?, mes = ?, ano = ?, banco_origem = ?, banco_destino = ?, obs = ? WHERE id = ? AND casal = ?'
                pool.query(query, [valor, objData.dia, objData.mes, objData.ano, bancoDestino, bancoOrigem, obs, idRelacao, casal], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })
            
            return callback(null, 'OK')
        } catch (error) {
            return callback(error, null)
        }
    }

}

export default TransfModel