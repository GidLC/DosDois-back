import { pool } from "../../../config/config.mjs";
import { getOrCreateFatura } from "../../despesas/utils/getOrCreateFatura.mjs";

export const atualizaFatura = async (old, oldValue, newValue, cartaoNovo, objData = undefined) => {
    console.log({ old, oldValue, newValue, cartaoNovo, objData })
    //Valida se é o mesmo cartão e a mesma data
    const sameCartao = old.cartao == cartaoNovo;
    const sameDate = (objData) ? (old.mes == objData.mes && old.ano == objData.ano) : true

    console.log({ sameCartao, sameDate })

    //Preciso identificar antes de editar a despesa para qual data ela será "enviada"
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

    const fatura = await getOrCreateFatura(cartaoNovo, objData.mes, objData.ano)

    // Adicionar valor na nova fatura
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

    //Retorna dados da data para edição da despesa

    const [dataFatura] = await new Promise((resolve, reject) => {
        pool.query(
            `SELECT car.venc AS dia, fat.mes, fat.ano, fat.id FROM cartao_faturas AS fat
                INNER JOIN cartoes AS car ON fat.cartao_id = car.id_cartao
                    WHERE fat.id = ?`, [fatura.id], (err, results) => {
            if (err) return reject(err);
            resolve(results);
        })
    })

    return dataFatura
}
