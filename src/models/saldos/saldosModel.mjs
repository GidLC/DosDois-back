import { pool } from "../../config/config.mjs";
import {queryAsync} from "../../data/queryAsync/queryAsync.mjs"

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
            const ANO_INICIAL = 2024;

            const getSaldos = async (queryBanco, paramsBanco) => {
                //Busca os bancos de acordo com a query e parâmetros enviados
                const bancosBD = await queryAsync(queryBanco, paramsBanco);

                return Promise.all(
                    //Para cada banco encontrado cria um objeto
                    bancosBD.map(async (banco) => {
                        const bancoId = banco.id;
                        const bancoNome = banco.nome;
                        const bancoTipo = banco.tipo;
                        const arquivo = banco.arquivo;
                        const padrao = banco.padrao;

                        const qtdAnos = ano - ANO_INICIAL + 1;
                        const saldoAnual = Array(qtdAnos).fill(0);
                        const saldoMensal = Array(12).fill(0);

                        // saldo inicial
                        const [{ saldo_inicial = 0 }] = await queryAsync(
                            'SELECT saldo_inicial FROM banco WHERE id = ? AND casal = ?',
                            [bancoId, casal]
                        );

                        let saldoAcumulado = Number(saldo_inicial);

                        // ======================================================
                        // Para cada ano
                        // ======================================================
                        for (let idxAno = 0; idxAno < qtdAnos; idxAno++) {
                            const anoAtual = ANO_INICIAL + idxAno;
                            //O saldo mensal para o ano solicitado
                            const movimentosMes = Array(12).fill(0);

                            const params = [bancoId, casal, anoAtual];

                            //Querys de consulta das transações ao banco(receitas, despesas e transações do banco do loop)
                            const consultas = [
                                {
                                    sql: 'SELECT mes, SUM(valor) total FROM receita WHERE banco = ? AND casal = ? AND ano = ? AND status = 1 GROUP BY mes',
                                    sinal: +1,
                                },
                                {
                                    sql: 'SELECT mes, SUM(valor) total FROM receitas_fixas WHERE banco = ? AND casal = ? AND ano = ? AND status = 1 GROUP BY mes',
                                    sinal: +1,
                                },
                                {
                                    sql: 'SELECT mes, SUM(valor) total FROM despesa WHERE banco = ? AND casal = ? AND ano = ? AND status = 1 GROUP BY mes',
                                    sinal: -1,
                                },
                                {
                                    sql: 'SELECT mes, SUM(valor) total FROM despesas_fixas WHERE banco = ? AND casal = ? AND ano = ? AND status = 1 GROUP BY mes',
                                    sinal: -1,
                                },
                                {
                                    sql: 'SELECT mes, SUM(valor) total FROM transferencias WHERE banco_origem = ? AND casal = ? AND ano = ? AND tipo = 0 GROUP BY mes',
                                    sinal: -1,
                                },
                                {
                                    sql: 'SELECT mes, SUM(valor) total FROM transferencias WHERE banco_origem = ? AND casal = ? AND ano = ? AND tipo = 1 GROUP BY mes',
                                    sinal: +1,
                                },
                            ];

                            // aplica query de movimentações no mês correto
                            for (const { sql, sinal } of consultas) {
                                const rows = await queryAsync(sql, params);

                                //Incrementa os valores de cada receita
                                rows.forEach(({ mes, total }) => {
                                    movimentosMes[mes - 1] += sinal * Number(total);
                                });
                            }

                            // acumula mês a mês
                            for (let m = 0; m < 12; m++) {
                                saldoAcumulado += movimentosMes[m];

                                // grava o saldo mensal apenas do ano solicitado
                                if (anoAtual === Number(ano)) {
                                    saldoMensal[m] = saldoAcumulado;
                                }
                            }

                            // dezembro fecha o ano
                            saldoAnual[idxAno] = saldoAcumulado;
                        }

                        return {
                            bancoNome,
                            bancoId,
                            saldoInicial: saldo_inicial,
                            bancoTipo,
                            arquivo,
                            saldoAnual,
                            saldoMensal,
                            padrao,
                        };
                    })
                );
            };

            // ================================
            // CONSULTAS POR TIPO DE BANCO
            // ================================
            const queryBancoInd =
                'SELECT * FROM banco WHERE casal = ? AND usuario = ? AND tipo = 0 AND arquivo = 0';

            const queryBancoCol =
                'SELECT * FROM banco WHERE casal = ? AND tipo = 1 AND arquivo = 0';

            const saldosIndividuais = await getSaldos(queryBancoInd, [casal, usuario]);
            const saldosParceiro = await getSaldos(queryBancoInd, [casal, parceiro]);
            const saldosColetivos = await getSaldos(queryBancoCol, [casal]);

            return callback(null, {
                saldosIndividuais,
                saldosParceiro,
                saldosColetivos,
            });
        } catch (error) {
            console.error('Erro ao gerar saldo:', error);
            return callback(error, null);
        }
    };


}

export default SaldosModel