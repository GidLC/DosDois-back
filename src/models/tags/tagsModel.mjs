import { error } from "qrcode-terminal"
import { pool } from "../../config.mjs"

class TagsModel {
    static addTag = async (nome, casal, callback) => {
        try {
            const query = 'INSERT INTO tags (nome, casal) VALUES (?,?)'

            pool.query(query,[nome, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })
        } catch (error) {
         throw error   
        }
    }

    static readAllTags = async (casal, callback) => {
        try {
            const query = 'SELECT id, nome FROM tags WHERE casal = ?'

            pool.query(query, [casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })
        } catch (error) {
            throw error
        }
    }

    static readTagID = async (id, casal, callback) => {
        try {
            const query = 'SELECT id, nome FROM tags WHERE id = ? AND casal = ?'

            pool.query(query, [id, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            }
        )
        } catch (error) {
            throw error
        }
    }
}

export default TagsModel