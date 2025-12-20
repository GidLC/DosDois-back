import { pool } from "../../../config/config.mjs";

export const getOrCreateFatura = async (cartao_id, mes, ano) => {
    return new Promise((resolve, reject) => {
        const querySel = `
            SELECT id, total 
            FROM cartao_faturas 
            WHERE cartao_id = ? AND mes = ? AND ano = ? AND status = 'aberta'
        `;

        pool.query(querySel, [cartao_id, mes, ano], (err, result) => {
            if (err) return reject(err);

            //Se encontrou a fatura retorna-a
            if (result.length > 0) {
                return resolve(result[0]);
            }

            // Criar fatura
            const queryInsert = `
                INSERT INTO cartao_faturas (cartao_id, mes, ano, total, status)
                VALUES (?, ?, ?, 0, 'aberta')
            `;

            //Verificar se há despesas fixas para esse cartão e inclui-las na nova fatura

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
