import { pool } from "../../config/config.mjs";
import SeparaData from "../../data/SeparaData/SeparaData.mjs";

class TransfModel {
    static resolveUsuarioBanco = async (casal, bancoId, usuarioFallback) => {
        const banco = await new Promise((resolve, reject) => {
            const query = 'SELECT usuario, tipo FROM banco WHERE id = ? AND casal = ? LIMIT 1';
            pool.query(query, [bancoId, casal], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(results?.[0]);
            });
        });

        if (Number(banco?.tipo) === 0 && banco?.usuario) {
            return banco.usuario;
        }

        return usuarioFallback;
    }

    static addTransferencia = async (casal, valor, usuario, data, bancoOrigem, bancoDestino, obs, callback) => {
        try {
            const objData = await SeparaData(data)
            const usuarioCriador = usuario
            const usuarioCriadorSeguro = Number(usuarioCriador) || 0
            const usuarioDebito = await TransfModel.resolveUsuarioBanco(casal, bancoOrigem, usuarioCriador)
            const usuarioCredito = await TransfModel.resolveUsuarioBanco(casal, bancoDestino, usuarioCriador)
            usuario = usuarioDebito
            //No banco de origem se cria uma despesa(débito 0)
            const debitoTr = await new Promise((resolve, reject) => {
                const queryDebito = `INSERT INTO transferencias(descricao, valor, usuario, usuario_criador, casal, dia, mes, ano, banco_origem, banco_destino, tipo, obs) VALUES (?,?,?,${usuarioCriadorSeguro},?,?,?,?,?,?,?,?)`;
                pool.query(queryDebito, ['Transferência saída', valor, usuario, casal, objData.dia, objData.mes, objData.ano, bancoOrigem, bancoDestino, 0, obs], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            //No banco destino se cria uma receita(crédito 1)
            usuario = usuarioCredito
            const creditoTr = await new Promise((resolve, reject) => {
                const queryCredito = `INSERT INTO transferencias(descricao, valor, usuario, usuario_criador, casal, dia, mes, ano, banco_origem, banco_destino, tipo, relacao, obs) VALUES (?,?,?,${usuarioCriadorSeguro},?,?,?,?,?,?,?,?,?)`;
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

    static readTransferencias = async (usuario, casal, mes, ano, filtrosOrCallback, maybeCallback) => {
        try {
            const filtros = typeof filtrosOrCallback === 'function' ? {} : filtrosOrCallback || {};
            const callback = typeof filtrosOrCallback === 'function' ? filtrosOrCallback : maybeCallback;
            const query = `SELECT tr.id, tr.descricao, tr.valor, COALESCE(tr.usuario_criador, tr.usuario) AS usuario, tr.tipo AS tipoTransf, tr.dia, tr.mes, tr.ano, tr.obs, origem.nome AS origem_nome, destino.nome AS destino_nome, tr.relacao FROM transferencias AS tr 
                                INNER JOIN banco origem ON tr.banco_origem = origem.id
                                INNER JOIN banco destino ON tr.banco_destino = destino.id
                                    WHERE tr.casal = ? AND tr.mes = ? AND tr.ano = ?
                                      AND (
                                        (tr.usuario_criador = ? AND tr.tipo = 0)
                                        OR ((tr.usuario_criador IS NULL OR tr.usuario_criador <> ?) AND tr.usuario = ?)
                                      )`
            let queryFinal = query;
            const params = [casal, mes, ano, usuario, usuario, usuario];

            if (filtros.dataInicio && filtros.dataFim) {
                queryFinal = `SELECT tr.id, tr.descricao, tr.valor, COALESCE(tr.usuario_criador, tr.usuario) AS usuario, tr.tipo AS tipoTransf, tr.dia, tr.mes, tr.ano, tr.obs, origem.nome AS origem_nome, destino.nome AS destino_nome, tr.relacao FROM transferencias AS tr 
                                INNER JOIN banco origem ON tr.banco_origem = origem.id
                                INNER JOIN banco destino ON tr.banco_destino = destino.id
                                    WHERE tr.casal = ?
                                      AND STR_TO_DATE(CONCAT(tr.dia, '/', tr.mes, '/', tr.ano), '%d/%m/%Y') BETWEEN ? AND ?
                                      AND (
                                        (tr.usuario_criador = ? AND tr.tipo = 0)
                                        OR ((tr.usuario_criador IS NULL OR tr.usuario_criador <> ?) AND tr.usuario = ?)
                                      )`;
                params.splice(1, 2, filtros.dataInicio, filtros.dataFim);
            }

            pool.query(queryFinal, params, (err, results) => {
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

    static editTransferencia = async (id, casal, idRelacao, valor, data, bancoOrigem, bancoDestino, obs, usuario, callback) => {
        try {
            const objData = await SeparaData(data)
            const usuarioCriador = usuario
            const usuarioCriadorSeguro = Number(usuarioCriador) || 0
            const usuarioDebito = await TransfModel.resolveUsuarioBanco(casal, bancoOrigem, usuarioCriador)
            const usuarioCredito = await TransfModel.resolveUsuarioBanco(casal, bancoDestino, usuarioCriador)
            await new Promise((resolve, reject) => {
                const query = `UPDATE transferencias set valor = ?, usuario = ?, usuario_criador = ${usuarioCriadorSeguro}, dia = ?, mes = ?, ano = ?, banco_origem = ?, banco_destino = ?, obs = ? WHERE id = ? AND casal = ?`
                pool.query(query, [valor, usuarioDebito, objData.dia, objData.mes, objData.ano, bancoOrigem, bancoDestino, obs, id, casal], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })

            await new Promise((resolve, reject) => {
                const query = `UPDATE transferencias SET valor = ?, usuario = ?, usuario_criador = ${usuarioCriadorSeguro}, dia = ?, mes = ?, ano = ?, banco_origem = ?, banco_destino = ?, obs = ? WHERE id = ? AND casal = ?`
                pool.query(query, [valor, usuarioCredito, objData.dia, objData.mes, objData.ano, bancoDestino, bancoOrigem, obs, idRelacao, casal], (err, results) => {
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
