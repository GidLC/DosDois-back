import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs";

export const calcLimiteDisp = async (cartao) => {
    /** -- 2.1. Despesas pendentes ------------------*/
    const qPend = `
                    SELECT SUM(valor) AS total
                    FROM despesa
                    WHERE status = 0 AND cartao = ?
                `;
    const [despPend] = await queryAsync(qPend, [cartao.id]);
    const pendentes = Number(despPend.total) || 0;


    /** -- 2.2. Despesas fixas -----------------------*/
    const qFixas = `
                    SELECT SUM(valor) AS total
                    FROM despesas_fixas
                    WHERE cartao = ?
                `;
    const [fixPend] = await queryAsync(qFixas, [cartao.id]);
    const fixas = Number(fixPend.total) || 0;


    /** -- 2.3. Limite disponível --------------------*/
    const limiteDisp = Number(cartao.limite) - (pendentes + fixas);

    return limiteDisp
}