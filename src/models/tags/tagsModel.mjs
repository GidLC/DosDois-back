import { pool } from "../../config.mjs"

class TagsModel {
    static addTag = async (nome, casal, callback) => {
        try {
            const query = 'INSERT INTO tags (nome, casal) VALUES (?,?)'

            pool.query(query, [nome, casal], (err, results) => {
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

    static editTag = async (idTag, casal, nome, callback) => {
        try {
            const query = `UPDATE tags SET nome = ? WHERE id = ? AND casal = ?`

            pool.query(query, [nome, idTag, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })
        } catch (error) {
            throw error
        }
    }

    static deleteTag = async (idTag, casal, callback) => {
        try {
            console.log(idTag, casal)
            const query = `DELETE FROM tags WHERE id = ? AND casal = ?`

            pool.query(query, [idTag, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })
        } catch (error) {
            throw error
        }
    }

    static readTagsByTermo = async (termo, casal, callback) => {
        try {
            const query = 'SELECT id, nome FROM tags WHERE nome LIKE ? AND casal = ?'
            
            const searchTerm = `%${termo}%`
            pool.query(query, [searchTerm, casal], (err, results) => {
                if (err) {
                    return callback(err, null)
                }

                return callback(null, results)
            })

        } catch (error) {
            return callback(error, null)
        }
    }
}

export default TagsModel