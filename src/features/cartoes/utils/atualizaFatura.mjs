import { pool } from "../../../config/config.mjs";
import { getOrCreateFatura } from "../../despesas/utils/getOrCreateFatura.mjs";

export const atualizaFatura = async (old, oldValue, newValue, cartaoNovo, objData) => {
    console.log({old, oldValue, newValue, cartaoNovo, objData})
    //Valida se é o mesmo cartão e a mesma data
    const sameCartao = old.cartao == cartaoNovo;
    const sameDate = old.mes == objData.mes && old.ano == objData.ano;

    // Caso despesa continue na mesma fatura
    if (sameCartao && sameDate) {
        const diff = newValue - oldValue;

        //Caso o valor altere mudar na fatura
        if (diff !== 0) {
            await new Promise((resolve, reject) => {
                pool.query(
                    `UPDATE cartao_faturas SET total = total + ? 
                 WHERE cartao_id = ? AND mes = ? AND ano = ?`,
                    [diff, old.cartao, old.mes, old.ano], (err, results) => {
                        if (err) return reject(err);
                        resolve(results);
                    }
                );
            })
        }
        return;
    }

    // Caso mude de fatura
    // Remover valor da fatura antiga
    if (old.cartao) {
        await new Promise((resolve, reject) => {
            pool.query(
                `UPDATE cartao_faturas SET total = total - ? 
             WHERE cartao_id = ? AND mes = ? AND ano = ?`,
                [oldValue, old.cartao, old.mes, old.ano], (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        })
    }

    const fatura = getOrCreateFatura(cartaoNovo, objData.mes, objData.ano)

    // 3. Adicionar valor na nova fatura
    await new Promise((resolve, reject) => {
        pool.query(
            `UPDATE cartao_faturas SET total = total + ? 
         WHERE cartao_id = ? AND id = ?`,
            [newValue, cartaoNovo, fatura.id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    })
}
