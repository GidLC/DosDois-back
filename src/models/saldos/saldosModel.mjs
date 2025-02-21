import { pool } from "../../config.mjs";

class SaldosModel {
    //Função para cálculo de todos os saldos da aplicação - saldo estático
    static saldoGeral = async (casal, usuario, callback) => {
        try {
            //Saldos individuais
            //Seleciona todos os bancos(Bancos não arquivados)
            const queryBancoInd = 'SELECT * FROM banco WHERE casal = ? AND usuario = ? AND tipo = 0 AND arquivo = 0';
            const bancosBDInd = await new Promise((resolve, reject) => {
                pool.query(queryBancoInd, [casal, usuario], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                });
            });

            //Busca informações dos bancos
            const bancosComSaldoInd = await Promise.all(bancosBDInd.map(async (banco) => {
                //Saldo inicial
                const saldoInicialBD = await new Promise((resolve, reject) => {
                    const querysaldoInicial = 'SELECT saldo_inicial FROM banco WHERE id = ? AND casal = ? AND usuario = ?';
                    pool.query(querysaldoInicial, [banco.id, casal, usuario], (err, results) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(results);
                    });
                });

                const saldoInicial = saldoInicialBD[0].saldo_inicial;
                //receitas
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

                //Despesas
                const queryDespesas = 'SELECT SUM(valor) AS total_despesas FROM despesa WHERE banco = ? AND casal = ? AND usuario = ?AND status = 1';
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
                const queryTransfCred = 'SELECT SUM(valor) AS total_transf_cred FROM transferencias WHERE banco_origem = ? AND casal = ? AND usuario = ? AND tipo = 1';
                const transfCredBD = await new Promise((resolve, reject) => {
                    pool.query(queryTransfCred, [banco.id, casal, usuario], (err, results) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(results);
                    });
                });

                const transfCred = transfCredBD[0].total_transf_cred || 0

                const saldo = (saldoInicial + receitas + transfCred) - (despesas + transfDeb);


                return { ...banco, saldo };
            }));

            //Saldos conjuntos
            const queryBancoCol = 'SELECT * FROM banco WHERE casal = ? AND tipo = 1 AND arquivo = 0';
            const bancosBDCol = await new Promise((resolve, reject) => {
                pool.query(queryBancoCol, [casal], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                });
            });

            const bancosComSaldoCol = await Promise.all(bancosBDCol.map(async (banco) => {
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

                return { ...banco, saldo };
            }));


            const saldoIndividual = bancosComSaldoInd.reduce((acumulador, banco) => acumulador + banco.saldo, 0)
            const saldoColetivo = bancosComSaldoCol.reduce((acumulador, banco) => acumulador + banco.saldo, 0)

            return callback(null, { saldoIndividual, saldoColetivo });
        } catch (error) {
            console.error(`Não foi possível gerar o saldo ${error}`);
            return callback(error, null);
        }
    }

    static saldoPorPeriodo = async (casal, usuario, parceiro, ano, callback) => {
        try {
            //Função para buscar saldos
            const getSaldos = async (queryBanco, paramsBanco) => {
                //Busca bancos(coletivos e individuais)
                const bancosBD = await new Promise((resolve, reject) => {
                    pool.query(queryBanco, paramsBanco, (err, results) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(results);
                    });
                });

                const bancosComSaldo = await Promise.all(bancosBD.map(async (banco) => {
                    //Busco o saldo inicial
                    const saldoInicialBD = await new Promise((resolve, reject) => {
                        const querySaldoInicial = 'SELECT saldo_inicial FROM banco WHERE id = ? AND casal = ?';
                        pool.query(querySaldoInicial, [banco.id, casal], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });
                    //Define saldo inicial do banco
                    const bancoId = banco.id
                    const bancoNome = banco.nome
                    const bancoTipo = banco.tipo
                    const arquivo = banco.arquivo
                    const saldoInicial = saldoInicialBD[0].saldo_inicial;
                    //Cria um Array de 12 posições preenchidos com 0
                    const saldoMensal = Array(12).fill(0);

                    //Busca todas receitas dos bancos de um determinado ano agrupado por mês
                    const queryReceitas = 'SELECT SUM(valor) AS total, mes FROM receita WHERE banco = ? AND casal = ? AND ano = ? AND status = 1 GROUP BY mes ORDER BY mes';
                    const receitasBD = await new Promise((resolve, reject) => {
                        pool.query(queryReceitas, [banco.id, casal, ano], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    //Incrementa o saldo do banco mes a mes(adicionando as receitas)
                    receitasBD.forEach(({ total, mes }) => {
                        saldoMensal[mes] += total;
                    });

                    //Busca todas despesas dos bancos de um determinado ano agrupado por mês
                    const queryDespesas = 'SELECT SUM(valor) AS total, mes FROM despesa WHERE banco = ? AND casal = ? AND ano = ? AND status = 1 GROUP BY mes ORDER BY mes';
                    const despesasBD = await new Promise((resolve, reject) => {
                        pool.query(queryDespesas, [banco.id, casal, ano], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    //Incrementa o saldo do banco mes a mes(reduzindo o saldo com as despesas)
                    despesasBD.forEach(({ total, mes }) => {
                        saldoMensal[mes] -= total;
                    });

                    const queryTransfDeb = 'SELECT SUM(valor) AS total, mes FROM transferencias WHERE banco_origem = ? AND casal = ? AND ano = ? AND tipo = 0 GROUP BY mes ORDER BY mes';
                    const transfDebBD = await new Promise((resolve, reject) => {
                        pool.query(queryTransfDeb, [banco.id, casal, ano], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    transfDebBD.forEach(({ total, mes }) => {
                        saldoMensal[mes] -= total;
                    });

                    const queryTransfCred = 'SELECT SUM(valor) AS total, mes FROM transferencias WHERE banco_origem = ? AND casal = ? AND ano = ? AND tipo = 1 GROUP BY mes ORDER BY mes';
                    const transfCredBD = await new Promise((resolve, reject) => {
                        pool.query(queryTransfCred, [banco.id, casal, ano], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    transfCredBD.forEach(({ total, mes }) => {
                        saldoMensal[mes] += total;
                    });

                    //console.log({bancoId, saldoInicial, receitasBD, despesasBD, transfCredBD, transfDebBD})
                    return {bancoNome, bancoId, saldoInicial, bancoTipo, arquivo, receitasBD, despesasBD, transfCredBD, transfDebBD, saldoMensal}
                }));

                return bancosComSaldo;
            };

            const queryBancoInd = 'SELECT * FROM banco WHERE casal = ? AND usuario = ? AND tipo = 0 AND arquivo = 0';
            const saldosIndividuais = await getSaldos(queryBancoInd, [casal, usuario]);

            const queryBancoCol = 'SELECT * FROM banco WHERE casal = ? AND tipo = 1 AND arquivo = 0';
            const saldosColetivos = await getSaldos(queryBancoCol, [casal]);

            return callback(null, { saldosIndividuais, saldosColetivos });
        } catch (error) {
            console.error(`Não foi possível gerar o saldo ${error}`);
            return callback(error, null);
        }
    };

}

export default SaldosModel