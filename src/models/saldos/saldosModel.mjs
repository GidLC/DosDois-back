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

    static saldoPorPeriodo = async (casal, usuario, ano, parceiro, callback) => {
        try {
            //Função para buscar saldos em um determinado periodo
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
                    const bancoId = banco.id
                    const bancoNome = banco.nome
                    const bancoTipo = banco.tipo
                    const arquivo = banco.arquivo

                    //Definir os saldos dos anos anteriores ao ano da requisição
                    const qtdAnos = ano - 2024

                    //Cria um Array para inserir os saldos anuais (a qtd de posições é definida pelo ano da requisição - o ano 2024"inicio da aplicação")
                    const saldoAnual = Array(qtdAnos).fill(0)

                    //Cria um Array de 12 posições preenchidos com 0 (representando cada um um mês)
                    const saldoMensal = Array(12).fill(0)

                    //Busco o saldo inicial do banco
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
                    const saldoInicial = saldoInicialBD[0].saldo_inicial;
                    saldoAnual[0] += saldoInicial

                    const calculaSaldo = async (periodo /**ano ou mes */) => {
                        const paramsMes = [banco.id, casal, ano]
                        const paramsAno = [banco.id, casal]

                        //Busca todas receitas dos bancos de um determinado ano ou mês
                        const queryReceitas = `SELECT SUM(valor) AS total, ${periodo} FROM receita WHERE banco = ? AND casal = ? ${periodo == `mes` ? `AND ano = ?` : ``} AND status = 1 GROUP BY ${periodo} ORDER BY ${periodo}`
                        const receitasBD = await new Promise((resolve, reject) => {
                            pool.query(queryReceitas, periodo == `mes` ? paramsMes : paramsAno, (err, results) => {
                                if (err) {
                                    reject(err);
                                }
                                resolve(results);
                            });
                        });

                        //Incrementa o saldo do banco adicionando as receitas
                        if (periodo == `mes`) {
                            receitasBD.forEach(({ total, mes }) => {
                                saldoMensal[mes] += total;
                            });
                        } else {
                            receitasBD.forEach(({ total, ano }) => {
                                saldoAnual[ano - 2024] += total
                            });
                        }

                        //Busca todas receitas fixas do bancos de um determinado ano agrupado por mês
                        const queryReceitasFixas = `SELECT SUM(valor) AS total, ${periodo} FROM receitas_fixas WHERE banco = ? AND casal = ? ${periodo == `mes` ? `AND ano = ?` : ``} AND status = 1 GROUP BY ${periodo} ORDER BY ${periodo}`
                        const receitasFixasBD = await new Promise((resolve, reject) => {
                            pool.query(queryReceitasFixas, periodo == `mes` ? paramsMes : paramsAno, (err, results) => {
                                if (err) {
                                    reject(err);
                                }
                                resolve(results);
                            });
                        });

                        //Incrementa o saldo do banco adicionando as receitas fixas
                        if (periodo == `mes`) {
                            receitasFixasBD.forEach(({ total, mes }) => {
                                saldoMensal[mes] += total;
                            });
                        } else {
                            receitasFixasBD.forEach(({ total, ano }) => {
                                saldoAnual[ano - 2024] += total
                            });
                        }


                        //Busca todas despesas dos bancos de um determinado ano agrupado por mês
                        const queryDespesas = `SELECT SUM(valor) AS total, ${periodo} FROM despesa WHERE banco = ? AND casal = ? ${periodo == `mes` ? `AND ano = ?` : ``} AND status = 1 GROUP BY ${periodo} ORDER BY ${periodo}`
                        const despesasBD = await new Promise((resolve, reject) => {
                            pool.query(queryDespesas, periodo == `mes` ? paramsMes : paramsAno, (err, results) => {
                                if (err) {
                                    reject(err);
                                }
                                resolve(results);
                            });
                        });

                        //Incrementa o saldo do banco mes a mes(reduzindo o saldo com as despesas)
                        if (periodo == `mes`) {
                            despesasBD.forEach(({ total, mes }) => {
                                saldoMensal[mes] -= total;
                            });
                        } else {
                            despesasBD.forEach(({ total, ano }) => {
                                saldoAnual[ano - 2024] -= total
                            });
                        }

                        //Busca todas despesas fixas do bancos de um determinado ano agrupado por mês
                        const queryDespesasFixas = `SELECT SUM(valor) AS total, ${periodo} FROM despesas_fixas WHERE banco = ? AND casal = ? ${periodo == `mes` ? `AND ano = ?` : ``} AND status = 1 GROUP BY ${periodo} ORDER BY ${periodo}`
                        const despesasFixasBD = await new Promise((resolve, reject) => {
                            pool.query(queryDespesasFixas, periodo == `mes` ? paramsMes : paramsAno, (err, results) => {
                                if (err) {
                                    reject(err);
                                }
                                resolve(results);
                            });
                        });

                        if (periodo == `mes`) {
                            despesasFixasBD.forEach(({ total, mes }) => {
                                saldoMensal[mes] -= total;
                            });
                        } else {
                            despesasFixasBD.forEach(({ total, ano }) => {
                                saldoAnual[ano - 2024] -= total
                            });
                        }

                        const queryTransfDeb = `SELECT SUM(valor) AS total, ${periodo} FROM transferencias WHERE banco_origem = ? AND casal = ? ${periodo == `mes` ? `AND ano = ?` : ``} AND tipo = 0 GROUP BY ${periodo} ORDER BY ${periodo}`
                        const transfDebBD = await new Promise((resolve, reject) => {
                            pool.query(queryTransfDeb, periodo == `mes` ? paramsMes : paramsAno, (err, results) => {
                                if (err) {
                                    reject(err);
                                }
                                resolve(results);
                            });
                        });

                        if (periodo == `mes`) {
                            transfDebBD.forEach(({ total, mes }) => {
                                saldoMensal[mes] -= total;
                            });
                        } else {
                            transfDebBD.forEach(({ total, ano }) => {
                                saldoAnual[ano - 2024] -= total
                            });
                        }

                        const queryTransfCred = `SELECT SUM(valor) AS total, ${periodo} FROM transferencias WHERE banco_origem = ? AND casal = ? ${periodo == `mes` ? `AND ano = ?` : ``} AND tipo = 1 GROUP BY ${periodo} ORDER BY ${periodo}`
                        const transfCredBD = await new Promise((resolve, reject) => {
                            pool.query(queryTransfCred, periodo == `mes` ? paramsMes : paramsAno, (err, results) => {
                                if (err) {
                                    reject(err);
                                }
                                resolve(results);
                            });
                        });

                        if (periodo == `mes`) {
                            transfCredBD.forEach(({ total, mes }) => {
                                saldoMensal[mes] += total;
                            });
                        } else {
                            transfCredBD.forEach(({ total, ano }) => {
                                saldoAnual[ano - 2024] += total
                            });
                        }

                        return { receitasBD, despesasBD, transfCredBD, transfDebBD }
                    }

                    await calculaSaldo(`mes`);
                    await calculaSaldo(`ano`);

                    //Incrementa os saldos mensais conforme mês anterior
                    for (let i = 0; i < 12; i++) {
                        if (i == 0) {
                            saldoMensal[i] = saldoAnual[qtdAnos - 1]
                        } else if (saldoMensal[i] === 0) {
                            saldoMensal[i] = saldoMensal[i - 1] //Se o saldo estiver zerado recebe o saldo do mês anterior
                        } else {
                            saldoMensal[i] += saldoMensal[i - 1] //Se não recebe o saldo do mês vigente + mês anterior
                        }
                    }

                    for (let i = 1; i < saldoAnual.length; i++) {
                        if (saldoAnual[i] === 0) {
                            saldoAnual[i] = saldoAnual[i - 1];
                        } else {
                            saldoAnual[i] += saldoAnual[i - 1];
                        }
                    }



                    //console.log({bancoId, saldoInicial, receitasBD, despesasBD, transfCredBD, transfDebBD})
                    return { bancoNome, bancoId, saldoInicial, bancoTipo, arquivo, saldoAnual, saldoMensal }
                }));

                return bancosComSaldo;
            };

            const queryBancoInd = 'SELECT * FROM banco WHERE casal = ? AND usuario = ? AND tipo = 0 AND arquivo = 0';
            const saldosIndividuais = await getSaldos(queryBancoInd, [casal, usuario]);
            const saldosParceiro = await getSaldos(queryBancoInd, [casal, parceiro])

            const queryBancoCol = 'SELECT * FROM banco WHERE casal = ? AND tipo = 1 AND arquivo = 0';
            const saldosColetivos = await getSaldos(queryBancoCol, [casal]);

            return callback(null, { saldosIndividuais, saldosColetivos, saldosParceiro });
        } catch (error) {
            console.error(`Não foi possível gerar o saldo ${error}`);
            return callback(error, null);
        }
    };

}

export default SaldosModel