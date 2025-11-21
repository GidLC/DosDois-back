import { pool } from "../../../config/config.mjs"

class CartoesModel {
    static addCartao = async (nome, usuario, bandeira, limite, fech, venc, cor, disp, callback) => {
        try {
            const query = 'INSERT INTO cartoes (nome, usuario, bandeira, limite, fech, venc, cor, disp) VALUES(?,?,?,?,?,?,?,?)'

            pool.query(query, [nome, usuario, bandeira, limite, fech, venc, cor, disp], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })
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
        }
    }
}

export default CartoesModel