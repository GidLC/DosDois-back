import { pool } from "../../config/config.mjs";

export const queryAsync = (sql, params) =>
    new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });