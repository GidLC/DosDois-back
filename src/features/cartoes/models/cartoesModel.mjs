import { pool } from "../../../config/config.mjs"
import separaData from "../../../data/SeparaData/SeparaData.mjs"
import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs"
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
            SELECT car.id_cartao AS id, car.nome, car.fech, car.venc, car.limite,
                   cor.codigo AS codCor, band.nome AS nomeBandeira
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
                    SELECT total 
                    FROM cartao_faturas 
                    WHERE cartao_id = ? AND mes = ? AND ano = ? AND status = ?
                `;

                    const [faturaAtual] = await queryAsync(qFatura, [cartao.id, mesAtual, anoAtual, "aberta"]);
                    const [faturaFechada] = await queryAsync(qFatura, [cartao.id, mesAnterior, anoAnterior, "fechada"]);


                    /** -- 2.5. Retorno do cartão --------------------*/
                    return {
                        id: cartao.id,
                        nome: cartao.nome,
                        bandeira: cartao.nomeBandeira,
                        limite: Number(cartao.limite),
                        limiteDisp,
                        fech: cartao.fech,
                        venc: cartao.venc,
                        cor: cartao.codCor,
                        faturaAtual: faturaAtual?.total || 0,
                        faturaFechada: faturaFechada?.total || 0
                    };
                })
            );

            return callback(null, processados);

        } catch (error) {
            console.error("Erro ao buscar cartões:", error);
            return callback(error, null);
        }
    };


}

export default CartoesModel