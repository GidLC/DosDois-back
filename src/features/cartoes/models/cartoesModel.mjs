import { pool } from "../../../config/config.mjs"
import separaData from "../../../data/SeparaData/SeparaData.mjs"
import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs"
import DespesaModel from "../../despesas/models/despesaModel.mjs"
import { despesasQueryBuilder } from "../../despesas/utils/despesasQueryBuilder.mjs"
import { calcLimiteDisp } from "../utils/calcLimiteDisp.mjs"

const data = new Date()
const dataBR = await separaData(data)

class CartoesModel {
    static addCartao = async (nome, usuario, bandeira, limite, fech, venc, cor, disp, banco, callback) => {
        try {

            const queryCartao = 'INSERT INTO cartoes (nome, usuario, bandeira, limite, fech, venc, cor, disp, banco) VALUES(?,?,?,?,?,?,?,?,?)'

            const cartao = await new Promise((resolve, reject) => {
                pool.query(queryCartao, [nome, usuario, bandeira, limite, fech, venc, cor, disp, banco], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })

            let mes = (dataBR.dia < fech) ? dataBR.mes : dataBR.mes + 1
            if (mes == 12) mes = 0
            let ano = (mes == 0 && dataBR.mes == 11) ? dataBR.ano + 1 : dataBR.ano

            const queryFatura = 'INSERT INTO cartao_faturas (cartao_id, mes, ano) VALUES(?,?,?)'
            await new Promise((resolve, reject) => {
                pool.query(queryFatura, [cartao.insertId, mes, ano], (err, results) => {
                    if (err) {
                        reject(err)
                    }

                    resolve(results)
                })
            })

            return callback(null, cartao)
        } catch (error) {
            console.error(`Erro ao cadastrar banco: ${error}`)
            return callback(error, null)
        }
    }

    static buscaBandeiras = async (callback) => {
        try {
            const query = 'SELECT * FROM bandeiras_cartao'

            pool.query(query, (err, results) => {
                if (err) {
                    return callback(err, null);
                }
                callback(null, results)
            });
        } catch (error) {
            console.error(`Erro ao buscar bandeiras: ${error}`)
            return callback(error, null)
        }
    }

    static getAllCartoes = async (idUser, arquivo, parceiro, callback) => {
        try {

            /** --------------------------------------------------
             * 1. Buscar cartões do usuário
             * --------------------------------------------------*/
            const queryCartoes = `
            SELECT car.id_cartao AS id, car.nome, car.fech, car.venc, car.limite, car.banco, car.disp, car.bandeira as idBandeira,
                   cor.codigo AS codCor, cor.id AS idCor, band.nome AS nomeBandeira
            FROM cartoes AS car
            INNER JOIN cor ON car.cor = cor.id
            INNER JOIN bandeiras_cartao AS band ON band.id = car.bandeira
            WHERE usuario = ? AND arquivo = ?
        `;

            const cartoes = await new Promise((resolve, reject) => {
                pool.query(queryCartoes, [idUser, arquivo], (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                });
            });

            if (cartoes.length === 0) return callback(null, []);


            /** --------------------------------------------------
             * Função auxiliar para consultas com Promise
             * --------------------------------------------------*/


            /** --------------------------------------------------
             * 2. Processar cada cartão
             * --------------------------------------------------*/
            const processados = await Promise.all(
                cartoes.map(async cartao => {
                    /** -- 2.3. Limite disponível --------------------*/
                    const limiteDisp = await calcLimiteDisp(cartao)


                    /** -- 2.4. Fatura aberta e anterior -------------*/
                    const hoje = new Date();
                    let mesAtual = hoje.getMonth();       // 0–11
                    let anoAtual = hoje.getFullYear();

                    // se ainda não fechou
                    if (hoje.getDate() < cartao.fech) {
                        mesAtual = mesAtual;
                    } else {
                        mesAtual++;
                        if (mesAtual === 12) {
                            mesAtual = 0;
                            anoAtual++;
                        }
                    }

                    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
                    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;


                    const qFatura = `
                    SELECT total, id, status 
                    FROM cartao_faturas 
                    WHERE cartao_id = ? AND mes = ? AND ano = ? AND status IN (?,?)
                `;

                    const [faturaAtual] = await queryAsync(qFatura, [cartao.id, mesAtual, anoAtual, "aberta", "aberta"]);
                    const [faturaFechada] = await queryAsync(qFatura, [cartao.id, mesAnterior, anoAnterior, "fechada", "paga"]);


                    /** -- 2.5. Retorno do cartão --------------------*/
                    return {
                        id: cartao.id,
                        nome: cartao.nome,
                        bandeira: cartao.nomeBandeira,
                        idBandeira: cartao.idBandeira,
                        limite: Number(cartao.limite),
                        limiteDisp,
                        fech: cartao.fech,
                        venc: cartao.venc,
                        cor: cartao.codCor,
                        idCor: cartao.idCor,
                        banco: cartao.banco,
                        disp: cartao.disp,
                        faturaAtual: faturaAtual?.total || 0,
                        faturaFechada: faturaFechada?.total || 0,
                        idFaturaAtual: faturaAtual?.id || null,
                        idFaturaFechada: faturaFechada?.id || null,
                        statusFatFechada: faturaFechada?.status || null
                    };
                })
            );

            return callback(null, processados);

        } catch (error) {
            console.error("Erro ao buscar cartões:", error);
            return callback(error, null);
        }
    };

    static pagarFatura = async (idFatura, callback) => {
        try {
            const data = new Date()

            const queryDespesas = `SELECT * FROM despesa WHERE fatura = ?`
            const despesas = await queryAsync(queryDespesas, [idFatura])

            //Efetiva as despesas
            for (const despesa of despesas) {
                DespesaModel.efetivaDespesa(
                    despesa.casal,
                    despesa.id,
                    0, (err, results) => {
                        if (err) {
                            console.error(`Não foi possível efetivar a despesa ${despesa.descricao}. ${err}`)
                        }
                    }
                )
            }

            //Busca dados da fatura
            const queryFatura = `SELECT * FROM cartao_faturas WHERE id = ?`
            const [fatura] = await queryAsync(queryFatura, [idFatura])

            //Busca dados do cartão
            const queryCartao = `SELECT * FROM cartoes WHERE id_cartao = ?`
            const [cartao] = await queryAsync(queryCartao, [fatura.cartao_id])

            //Busca categoria de ajuste
            const queryCategoria = `SELECT * FROM categoria_tr WHERE casal = ? AND tipo = 0 AND cat_sistema = 1`
            const [categoria] = await queryAsync(queryCategoria, [despesas[0].casal])

            //Caso o cartão esteja disponível para o parceiro a despesa será coletiva, caso contrário será individual
            const tipo = (cartao.disp == 1) ? 0 : 1

            //Registrar despesa e "contra despesa" do pagamento da fatura
            for (let i = 0; i < 2; i++) {
                DespesaModel.addDespesa(
                    `Pagamento da fatura ${cartao.nome}`,
                    (i == 0) ? fatura.total : fatura.total * -1,
                    cartao.usuario,
                    despesas[0].casal,
                    categoria.id,
                    1,
                    data,
                    cartao.banco,
                    tipo,
                    0,
                    null,
                    `Despesa criada automaticamente para registrar pagamento da fatura`,
                    1,
                    1,
                    null, (err, results) => {
                        if (err) {
                            console.error(`Não foi possível registrar a despesa de pagamento da fatura`)
                        }
                    }
                )
            }

            //Definir fatura como paga
            const queryPag = `UPDATE cartao_faturas SET status = 'paga' WHERE id = ?`
            await queryAsync(queryPag, [fatura.id])

            return callback(null, 'PAGA')
        } catch (error) {
            console.error(`Não foi possível pagar a fatura. ${error}`)
            return callback(error, null)
        }
    }

    static editCartao = async (id, nome, banco, bandeira, limite, fech, venc, cor, callback) => {
        try {
            //O valor do limite não pode ser menor que o valor das faturas abertas
            const queryEdit = `UPDATE cartoes SET nome = ?, banco = ?, bandeira = ?, limite = ?, fech = ?, venc = ?, cor = ? WHERE id_cartao = ?`;
            await queryAsync(queryEdit, [nome, banco, bandeira, limite, fech, venc, cor, id])

            return callback(null, 'EDITADA')
        } catch (error) {
            console.error(`Não foi possível editar esse cartão. ${error}`)
            return callback(error, null)
        }
    }

}

export default CartoesModel