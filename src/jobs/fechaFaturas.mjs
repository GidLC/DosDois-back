import separaData from "../data/SeparaData/SeparaData.mjs"
import { queryAsync } from "../data/queryAsync/queryAsync.mjs"
import { getOrCreateFatura } from "../features/cartoes/utils/getOrCreateFatura.mjs"
import DespesaModel from "../features/despesas/models/despesaModel.mjs"
import { ensureDespesasFixasMes } from "../features/despesas/utils/despesasFixasMes.mjs"

export const fechaFaturas = async () => {
    try {
        const data = new Date()
        const dataBR = await separaData(data)
        await ensureDespesasFixasMes(dataBR.mes, dataBR.ano)

        const queryCartoes = `SELECT id_cartao as id, fech FROM cartoes WHERE fech = ?`

        const cartoes = await queryAsync(queryCartoes, [dataBR.dia])

        for (const cartao of cartoes) {
            const queryFatura = `SELECT * FROM cartao_faturas 
                 WHERE cartao_id = ? AND status = 'aberta' AND mes = ?`

            const faturas = await queryAsync(queryFatura, [cartao.id, dataBR.mes])

            if (faturas.length === 0) continue

            const faturaAtual = faturas[0]

            const queryFech = `UPDATE cartao_faturas SET status = 'fechada' WHERE id = ?`

            await queryAsync(queryFech, faturaAtual.id)

            let mesNovo = faturaAtual.mes + 1;
            let anoNovo = faturaAtual.ano;

            if (mesNovo > 11) {
                mesNovo = '00';
                anoNovo++;
            }

            //Cria a próxima fatura caso não exista
            const newFatura = await getOrCreateFatura(cartao.id, mesNovo, anoNovo)

            //Verifica se há despesas fixas ativas nesse cartão
            const queryFixas = `SELECT * FROM desp_fixas_cartao WHERE cartao = ?`
            const despFixas = await queryAsync(queryFixas, [cartao.id])

            for (const despesa of despFixas) {
                const mesCompra = Number(mesNovo) + 1
                const ultimoDiaMes = new Date(Number(anoNovo), mesCompra, 0).getDate()
                const diaCompra = Math.min(Number(despesa.dia_compra || dataBR.dia), ultimoDiaMes)
                DespesaModel.addDespesa(
                    despesa.descricao,
                    despesa.valor,
                    despesa.usuario,
                    despesa.casal,
                    despesa.categoria,
                    0,
                    `${anoNovo}-${mesCompra.toString().padStart(2, '0')}-${String(diaCompra).padStart(2, '0')}T12:00:00.000Z`,
                    null,
                    despesa.tipo,
                    0,
                    despesa.tag,
                    despesa.obs,
                    1,
                    1,
                    despesa.cartao, (err, results) => {
                        if (err) {
                            console.error(`Erro ao criar despesa fixa na fatura: ${err}`)
                        }
                    }
                )
            }
        }
    } catch (error) {
        console.error('Erro no fechamento automático de faturas:', error);
    }

}
