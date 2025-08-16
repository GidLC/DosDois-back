import { pool } from "../../config/config.mjs";

class frontModel {
    static buscaCores = async (callback) => {
        try {
            const query = 'SELECT id, nome, codigo AS cor FROM cor';

            pool.query(query, (err, results) => {
                if (err) {
                    return callback(err, null);
                }
                callback(null, results)
            });
        } catch (error) {
            console.error(`Deu erro: ${error}`)
        }
    };

    static buscaCorID = (id, callback) => {
        const query = 'SELECT id, nome, codigo AS cor FROM cor WHERE id = ?';
        pool.query(query, [id], (err, results) => {
            if (err) {
                return callback(err, null);
            }
            callback(null, results[0])
        })
    }

    static buscaIcones = (callback) => {
        const query = 'SELECT * FROM icones';
        pool.query(query, (err, results) => {
            if (err) {
                return callback(err, null)
            }
            callback(null, results)
        })
    }

    static buscaIconeID = (id, callback) => {
        const query = 'SELECT * FROM icones WHERE id = ?';
        pool.query(query, [id], (err, results) => {
            if (err) {
                return callback(err, null)
            }
            callback(null, results[0])
        })
    }
}

export default frontModel;