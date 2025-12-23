import { pool } from "../../../config/config.mjs";

export const getOrCreateFatura = async (cartao_id, mes, ano) => {
    return new Promise((resolve, reject) => {
        const querySel = `
            SELECT id, total, status 
            FROM cartao_faturas 
            WHERE cartao_id = ? AND mes = ? AND ano = ?
        `;

        pool.query(querySel, [cartao_id, mes, ano], (err, result) => {
            if (err) return reject(err);

            //Se encontrou a fatura
            if (result.length > 0) {
                //Se a fatura não estiver aberta
                if (result[0].status != "aberta") {
                    return reject(`Fatura já fechada`)
                }
                return resolve(result[0]);
            }

            // Criar fatura caso não exista
            const queryInsert = `
                INSERT INTO cartao_faturas (cartao_id, mes, ano, total, status)
                VALUES (?, ?, ?, 0, 'aberta')
            `;

            pool.query(queryInsert, [cartao_id, mes, ano], (err, insertRes) => {
                if (err) return reject(err);

                resolve({
                    id: insertRes.insertId,
                    total: 0
                });
            });
        });
    });
}
