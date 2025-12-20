import separaData from "../data/SeparaData/SeparaData.mjs"
import { queryAsync } from "../data/queryAsync/queryAsync.mjs"
import { getOrCreateFatura } from "../features/cartoes/utils/getOrCreateFatura.mjs"

export const fechaFaturas = async () => {
    try {
        const data = new Date()
        const dataBR = await separaData(data)

        const queryCartoes = `SELECT id_cartao as id, fech FROM cartoes WHERE fech = ?`

        const [cartoes] = await queryAsync(queryCartoes, [dataBR.dia])

        for (const cartao of cartoes) {
            const queryFatura = `SELECT * FROM cartao_faturas 
                 WHERE cartao_id = ? AND status = 'aberta'
                 ORDER BY ano DESC, mes DESC LIMIT 1`

            const [faturas] = await queryAsync(queryFatura, [cartao.id])

            if (faturas.length === 0) continue

            const faturaAtual = faturas[0]

            const queryFech = `UPDATE cartao_faturas SET status = 'fechada' WHERE id = ?`

            await queryAsync(queryFech, faturaAtual.id)

            let mesNovo = faturaAtual.mes + 1;
            let anoNovo = faturaAtual.ano;

            if (mesNovo > 11) {
                mesNovo = 0;
                anoNovo++;
            }

            await getOrCreateFatura(cartao.id, mesNovo, anoNovo)
        }
    } catch (error) {
        console.error('Erro no fechamento automático de faturas:', err);
    }

}