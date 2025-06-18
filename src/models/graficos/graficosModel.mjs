import { pool } from "../../config.mjs";

class graficosModel {
    static receitaPorCategoria = async (casal, usuario, mes, ano, callback) => {
        const queryCategoria = `SELECT cat.id, cat.nome, cat.cat_sistema, c.codigo AS cod_cor, ic.ion_nome AS icone FROM categoria_tr AS cat 
                                    INNER JOIN cor AS c ON cat.cor = c.id 
                                    INNER JOIN icones AS ic ON cat.icone = ic.id
                                        WHERE casal = ? AND tipo = 1 AND cat_sistema != 1`
        const categoriasBD = await new Promise((resolve, reject) => {
            pool.query(queryCategoria, [casal], (err, results) => {
                if (err) {
                    reject(err)
                }
                resolve(results)
            });
        });

        const saldos = await Promise.all(categoriasBD.map(async (categoria) => {
            const saldoPorCategoriaBD = await new Promise((resolve, reject) => {
                const querySaldoPorCategoria = 'SELECT SUM(valor) AS total_receitas FROM receita WHERE categoria = ? AND casal = ? AND usuario = ? AND mes = ? AND ano = ?';
                pool.query(querySaldoPorCategoria, [categoria.id, casal, usuario, mes, ano], (err, results) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(results);
                });
            });

            const saldoPorCategoria = saldoPorCategoriaBD[0].total_receitas || 0

            return { ...categoria, saldoPorCategoria }

        }));

        const categoriasComSaldo = saldos.filter(saldo => saldo.saldoPorCategoria > 0)

        return callback(null, categoriasComSaldo)
    }

    static despesaPorCategoria = async (casal, usuario, mes, ano, parceiro, tipo, callback) => {
        const queryCategoria = `SELECT cat.id, cat.nome, cat.cat_sistema, c.codigo AS cod_cor, ic.ion_nome AS icone FROM categoria_tr AS cat 
                                    INNER JOIN cor AS c ON cat.cor = c.id 
                                    INNER JOIN icones AS ic ON cat.icone = ic.id
                                        WHERE casal = ? AND tipo = 0 AND cat_sistema != 1`
        const categoriasBD = await new Promise((resolve, reject) => {
            pool.query(queryCategoria, [casal], (err, results) => {
                if (err) {
                    reject(err)
                }
                resolve(results)
            });
        });

        const saldos = await Promise.all(categoriasBD.map(async (categoria) => {
            //saldo de despesas normais

            const calculaSaldo = async (fixa, cadParceiro) => {
                const table = (fixa == 1) ? "despesas_fixas" : "despesa"
                const idUsuario = (cadParceiro == 1) ? parceiro : usuario

                const saldoPorCategoriaBD = await new Promise((resolve, reject) => {
                    const querySaldoPorCategoria = `SELECT SUM(valor) AS total_despesas FROM ${table} WHERE categoria = ? AND casal = ? AND usuario = ? AND mes = ? AND ano = ? AND tipo = ?`
                    pool.query(querySaldoPorCategoria, [categoria.id, casal, idUsuario, mes, ano, tipo], (err, results) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(results);
                    });
                });

                return saldoPorCategoriaBD[0].total_despesas || 0
            }

            if (tipo == 0) {
                const saldoPCatUserNormal = await calculaSaldo(0, 0)
                const saldoPCatUserFixa = await calculaSaldo(1, 0)

                return { ...categoria, saldoPorCategoria: saldoPCatUserNormal + saldoPCatUserFixa }
            } else if (tipo = 1) {
                const saldoPCatUserNormal = await calculaSaldo(0, 0)
                const saldoPCatUserFixa = await calculaSaldo(1, 0)
                const saldoPCatParcNormal = await calculaSaldo(0, 1)
                const saldoPCatParcFixa = await calculaSaldo(1, 1)

                return { ...categoria, saldoPorCategoria: saldoPCatUserNormal + saldoPCatUserFixa + saldoPCatParcNormal + saldoPCatParcFixa }
            }
        }));

        const categoriasComSaldo = saldos.filter(saldo => saldo.saldoPorCategoria > 0)
        const categoriasDecres = categoriasComSaldo.sort((a, b) => b.saldoPorCategoria - a.saldoPorCategoria)

        return callback(null, categoriasDecres)
    }

    static despesaPorTag = async (casal, usuario, mes, ano, parceiro, callback) => {
        try {
            //Selecionar todas as tags 
            const queryTags = `SELECT id, nome FROM tags WHERE casal = ?`

            const tagsBD = await new Promise((resolve, reject) => {
                pool.query(queryTags, [casal], (err, results) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(results)
                })
            })

            //Calcular o saldo de cada uma das tags
            const saldos = await Promise.all(tagsBD.map(async (tag) => {
                //saldo de despesas normais

                const calculaSaldo = async (fixa, cadParceiro) => {
                    const table = (fixa == 1) ? "despesas_fixas" : "despesa"
                    const idUsuario = (cadParceiro == 1) ? parceiro : usuario

                    const saldoPorTagBD = await new Promise((resolve, reject) => {
                        const querySaldoPorTag = `SELECT SUM(valor) AS total_despesas FROM ${table} WHERE tag = ? AND casal = ? AND usuario = ? AND mes = ? AND ano = ?`
                        pool.query(querySaldoPorTag, [tag.id, casal, idUsuario, mes, ano], (err, results) => {
                            if (err) {
                                reject(err);
                            }
                            resolve(results);
                        });
                    });

                    return saldoPorTagBD[0].total_despesas || 0
                }

                const saldoPCatUserNormal = await calculaSaldo(0, 0)
                const saldoPCatUserFixa = await calculaSaldo(1, 0)
                const saldoPCatParcNormal = await calculaSaldo(0, 1)
                const saldoPCatParcFixa = await calculaSaldo(1, 1)

                return { ...tag, saldoPorTag: saldoPCatUserNormal + saldoPCatUserFixa + saldoPCatParcNormal + saldoPCatParcFixa }
            }));

            const tagsComSaldo = saldos.filter(saldo => saldo.saldoPorTag > 0)
            const tagsDecres = tagsComSaldo.sort((a, b) => b.saldoPorTag - a.saldoPorTag)

            return callback(null, tagsDecres)
        } catch (error) {
            console.log(err)
            return callback(error, null)
        }
    }
}

export default graficosModel