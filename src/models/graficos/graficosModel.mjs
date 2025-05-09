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

    static despesaPorCategoria = async (casal, usuario, mes, ano, tipo, callback) => {
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
            const saldoPorCategoriaBD = await new Promise((resolve, reject) => {
                const querySaldoPorCategoria = 'SELECT SUM(valor) AS total_despesas FROM despesa WHERE categoria = ? AND casal = ? AND usuario = ? AND mes = ? AND ano = ? AND tipo = ?';
                pool.query(querySaldoPorCategoria, [categoria.id, casal, usuario, mes, ano, tipo], (err, results) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(results);
                });
            });
            const saldoFixaPorCategoriaBD = await new Promise((resolve, reject) => {
                const querySaldoPorCategoria = 'SELECT SUM(valor) AS total_despesas FROM despesas_fixas WHERE categoria = ? AND casal = ? AND usuario = ? AND mes = ? AND ano = ? AND tipo = ?';
                pool.query(querySaldoPorCategoria, [categoria.id, casal, usuario, mes, ano, tipo], (err, results) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(results);
                });
            });

            const saldoPorCategoria = saldoPorCategoriaBD[0].total_despesas || 0
            const saldoFixaPorCategoria = saldoFixaPorCategoriaBD[0].total_despesas || 0


            return { ...categoria, saldoPorCategoria: saldoPorCategoria + saldoFixaPorCategoria}

        }));

        const categoriasComSaldo = saldos.filter(saldo => saldo.saldoPorCategoria > 0)

        return callback(null, categoriasComSaldo)
    }
}

export default graficosModel