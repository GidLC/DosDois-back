import { pool } from "../../config/config.mjs";

class BancoModel {
    static addBanco = (saldo_inicial, casal, nome, tipo, usuario, callback) => {
        if (tipo == 0) {
            const query = 'INSERT INTO banco (nome, tipo, saldo_inicial, casal, usuario, arquivo) VALUES (?,?,?,?,?,0)';
            pool.query(query, [nome, tipo, saldo_inicial, casal, usuario], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })
        } else {
            const query = 'INSERT INTO banco (nome, tipo, saldo_inicial, casal, arquivo) VALUES (?,?,?,?,0)';
            pool.query(query, [nome, tipo, saldo_inicial, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })
        }

    }

    static readBanco = async (cod_casal, usuario, arquivo, callback) => {
        try {
            //bancos individuais
            const queryBancoInd = 'SELECT id, nome, tipo, saldo_inicial, arquivo, padrao FROM banco where casal = ? AND usuario = ? AND tipo = 0 AND arquivo = ? ORDER BY nome ASC';
            const bancosInd = await new Promise((resolve, reject) => {
                pool.query(queryBancoInd, [cod_casal, usuario, arquivo], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                });
            });

            //bancos coletivos
            const queryBancoCol = 'SELECT id, nome, tipo, saldo_inicial, arquivo, padrao FROM banco where casal = ? AND tipo = 1 AND arquivo = ? ORDER BY nome ASC';
            const bancosCol = await new Promise((resolve, reject) => {
                pool.query(queryBancoCol, [cod_casal, arquivo], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                });
            });

            callback(null, [...bancosInd, ...bancosCol])
        } catch (error) {
            console.error("Houve um erro na busca dos bancos", error)
        }

    }

    static readBancoID = (cod_casal, id, callback) => {
        const query = `SELECT id, nome, tipo, saldo_inicial, arquivo, padrao FROM banco WHERE casal = ? AND id = ?`;
        pool.query(query, [cod_casal, id], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            return callback(null, results[0])
        });
    }

    static saldoBanco = async (casal, usuario, tipo, arquivo, callback) => {
        //Incluir transferências na soma dos saldos
        try {
            //Saldos individuais
            if (tipo == 0) {
                //Seleciona todos os bancos individuais
                const queryBancoInd = 'SELECT * FROM banco WHERE casal = ? AND usuario = ? AND tipo = 0 AND arquivo = ?';
                const bancosBDInd = await new Promise((resolve, reject) => {
                    pool.query(queryBancoInd, [casal, usuario, arquivo], (err, results) => {
                        if (err) {
                            reject(err)
                        }
                        resolve(results)
                    });
                });

                //Realiza o cálculo dos saldos individuais
                const bancosComSaldoInd = await Promise.all(bancosBDInd.map(async (banco) => {

                    //Saldo Inicial
                    const saldoInicialBD = await new Promise((resolve, reject) => {
                        const querysaldoInicial = 'SELECT saldo_inicial FROM banco WHERE id = ? AND casal = ? AND usuario = ? AND tipo = 0';
                        pool.query(querysaldoInicial, [banco.id, casal, usuario], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const saldoInicial = saldoInicialBD[0].saldo_inicial;

                    //Receitas
                    const queryreceitas = 'SELECT SUM(valor) AS total_receitas FROM receita WHERE banco = ? AND casal = ? AND usuario = ? AND status = 1';
                    const receitasBD = await new Promise((resolve, reject) => {
                        pool.query(queryreceitas, [banco.id, casal, usuario], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const receitas = receitasBD[0].total_receitas || 0;

                    //Depesas
                    const queryDespesas = 'SELECT SUM(valor) AS total_despesas FROM despesa WHERE banco = ? AND casal = ? AND usuario = ? AND status = 1';
                    const despesasBD = await new Promise((resolve, reject) => {
                        pool.query(queryDespesas, [banco.id, casal, usuario], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const despesas = despesasBD[0].total_despesas || 0;

                    //Transferências de saída
                    const queryTransfDeb = 'SELECT SUM(valor) AS total_transf_deb FROM transferencias WHERE banco_origem = ? AND casal = ? AND usuario = ? AND tipo = 0';
                    const transfDebBD = await new Promise((resolve, reject) => {
                        pool.query(queryTransfDeb, [banco.id, casal, usuario], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const transfDeb = transfDebBD[0].total_transf_deb || 0

                    //Transferências de entrada
                    const queryTransfCred = 'SELECT SUM(valor) AS total_transf_deb FROM transferencias WHERE banco_origem = ? AND casal = ? AND usuario = ? AND tipo = 1';
                    const transfCredBD = await new Promise((resolve, reject) => {
                        pool.query(queryTransfCred, [banco.id, casal, usuario], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const transfCred = transfCredBD[0].total_transf_deb || 0

                    const saldo = (saldoInicial + receitas + transfCred) - (despesas + transfDeb);

                    return { ...banco, saldo, saldoInicial };
                }));

                return callback(null, bancosComSaldoInd);
                //Saldos conjuntos
            } else if (tipo == 1) {

                const queryBanco = 'SELECT * FROM banco WHERE casal = ? AND tipo = 1 AND arquivo = ?';
                const bancosBD = await new Promise((resolve, reject) => {
                    pool.query(queryBanco, [casal, arquivo], (err, results) => {
                        if (err) {
                            reject(err)
                        }
                        resolve(results)
                    });
                });

                const bancosComSaldo = await Promise.all(bancosBD.map(async (banco) => {
                    //Saldo inicial
                    const saldoInicialBD = await new Promise((resolve, reject) => {
                        const querysaldoInicial = 'SELECT saldo_inicial FROM banco WHERE id = ? AND casal = ? AND tipo = 1';
                        pool.query(querysaldoInicial, [banco.id, casal], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const saldoInicial = saldoInicialBD[0].saldo_inicial;

                    //Receitas
                    const queryreceitas = 'SELECT SUM(valor) AS total_receitas FROM receita WHERE banco = ? AND casal = ? AND status = 1';
                    const receitasBD = await new Promise((resolve, reject) => {
                        pool.query(queryreceitas, [banco.id, casal], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const receitas = receitasBD[0].total_receitas || 0;

                    const queryDespesas = 'SELECT SUM(valor) AS total_despesas FROM despesa WHERE banco = ? AND casal = ? AND status = 1';
                    const despesasBD = await new Promise((resolve, reject) => {
                        pool.query(queryDespesas, [banco.id, casal], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const despesas = despesasBD[0].total_despesas || 0;

                    //Transferências de saída
                    const queryTransfDeb = 'SELECT SUM(valor) AS total_transf_deb FROM transferencias WHERE banco_origem = ? AND casal = ? AND tipo = 0';
                    const transfDebBD = await new Promise((resolve, reject) => {
                        pool.query(queryTransfDeb, [banco.id, casal], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const transfDeb = transfDebBD[0].total_transf_deb || 0

                    //Transferências de entrada
                    const queryTransfCred = 'SELECT SUM(valor) AS total_transf_cred FROM transferencias WHERE banco_origem = ? AND casal = ? AND tipo = 1';
                    const transfCredBD = await new Promise((resolve, reject) => {
                        pool.query(queryTransfCred, [banco.id, casal], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    const transfCred = transfCredBD[0].total_transf_cred || 0

                    const saldo = (saldoInicial + receitas + transfCred) - (despesas + transfDeb);

                    return { ...banco, saldo, saldoInicial };
                }));

                return callback(null, bancosComSaldo);
            }

        } catch (error) {
            console.error(`Não foi possível gerar o saldo ${error}`);
            return callback(error, null);
        }
    }

    static alteraSaldoincial = async (id, casal, novoSaldo, callback) => {
        try {
            const query = 'UPDATE banco SET saldo_inicial = ? WHERE id = ? AND casal = ?'
            pool.query(query, [novoSaldo, id, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }
                return callback(null, results)
            })
        } catch (error) {
            console.error(`Não foi possível alterar o saldo inicial: ${error}`);
            return callback(error, null);
        }
    }

    static arqDesBanco = async (id, casal, arquivo, callback) => {
        try {
            const query = 'UPDATE banco SET arquivo = ? WHERE id = ? AND casal = ?'
            pool.query(query, [arquivo, id, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })
        } catch (error) {
            console.error(`Não foi possível realizar essa alteração: ${error}`);
            return callback(error, null);
        }
    }

    //Criar função para editar banco
    static editBanco = async (id, casal, nome, tipo, usuario, padrao, callback) => {
        try {
            if (padrao) {
                await new Promise((resolve, reject) => {
                    const query = 'UPDATE banco SET padrao = 0 WHERE casal = ? AND tipo = ?'
                    pool.query(query, [casal, tipo], (err, results) => {
                        if (err) {
                            reject(err)
                        }

                        resolve(results)
                    })
                })
            }

            const results = await new Promise((resolve, reject) => {
                const query = 'UPDATE banco SET nome = ?, tipo = ?, usuario = ?, padrao = ? WHERE id = ? AND casal = ?';
                pool.query(query, [nome, tipo, usuario, padrao, id, casal], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })

            return callback(null, results)
        } catch (error) {
            console.error(`Não foi possível realizar essa alteração: ${error}`);
            return callback(error, null);
        }
    }
}

export default BancoModel