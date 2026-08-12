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

            if (result.length > 0) {
                if (result[0].status === "paga") {
                    return reject("Fatura ja paga");
                }

                return resolve(result[0]);
            }

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
