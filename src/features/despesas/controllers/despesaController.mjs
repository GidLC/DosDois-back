import DespesaModel from "../models/despesaModel.mjs";

import { queryAsync } from '../../../data/queryAsync/queryAsync.mjs';
import EventoProdutoModel from '../../telemetria/models/eventoProdutoModel.mjs';

const addDespesa = (req, res) => {
    const { descricao, valor, categoria, status, data, banco, tipo, fixa, tag, obs, repetir, parcelado, cartao } = req.body;
    const cod_casal = req.header('auth');
    const usuario = req.header('usuario')

    const saveExpense = (isFirstExpense) => {
        DespesaModel.addDespesa(descricao, valor, usuario, cod_casal, categoria, status, data, banco, tipo, fixa, tag, obs, repetir, parcelado, cartao, (err, resultado) => {
            if (err) {
                console.error('Erro ao cadastrar despesa:', err);
                return res.status(500).json({ error: `Erro ao cadastrar despesa. ${err}` })
            }
            if (isFirstExpense) {
                void EventoProdutoModel.registrar({ evento: 'first_expense_saved', casal: cod_casal, usuario, dedupeKey: `first-expense:${cod_casal}` });
            }
            res.status(200).json({ message: 'Despesa cadastrada com sucesso', resultado })
        });
    };

    queryAsync('SELECT 1 FROM despesa WHERE casal = ? LIMIT 1', [cod_casal])
        .then(([existingExpense]) => saveExpense(!existingExpense))
        .catch(error => {
            console.error('Erro ao verificar primeira despesa:', error);
            saveExpense(false);
        });
};

const readDespesa = (req, res) => {
    try {
        // Autenticação
        const casal = req.header('auth');
        const usuario = req.header('usuario');

        // Pegando filtros
        const {
            mes,
            ano,
            dataInicio,
            dataFim,
            tipo,
            fixa,
            categoria,
            tag,
            banco,
            cartao,
            fatura,
            status,
            valorMin,
            valorMax,
            descricao,
            groupBy,
            incluirAbatimentos,
        } = req.query;

        // Monta filtros básicos
        const filtrosBase = {
            usuario: Number(usuario) || null,
            casal: casal || null,
            mes: mes ? Number(mes) : null,
            ano: ano ? Number(ano) : null,
            dataInicio: dataInicio || null,
            dataFim: dataFim || null,
            tipo: tipo !== undefined ? Number(tipo) : null,
            fixa: fixa !== undefined ? Number(fixa) : null,
            categoria: categoria ? Number(categoria) : null,
            tag: tag ? Number(tag) : null,
            banco: banco ? Number(banco) : null,
            cartao: cartao ? Number(cartao) : null,
            fatura: fatura ? Number(fatura) : null,
            status: status !== undefined ? Number(status) : null,
            valorMin: valorMin ? parseFloat(valorMin) : null,
            valorMax: valorMax ? parseFloat(valorMax) : null,
            descricao: descricao || null,
            groupBy: groupBy || null,
            incluirAbatimentos: incluirAbatimentos === '1' || incluirAbatimentos === 'true'
        };

        // Se veio fixa, faz só uma busca
        if (filtrosBase.fixa != null && filtrosBase.fixa == 1) {
            const filtros = { ...filtrosBase, fixa: Number(fixa) };

            DespesaModel.readDespesa(filtros, (err, results) => {
                if (err) {
                    console.error('Erro ao encontrar despesas:', err);
                    return res.status(500).json({ error: 'Erro ao encontrar despesas' });
                }
                res.status(200).json({
                    message: 'Despesas encontradas com sucesso',
                    results
                });
            });
        } else {
            // Busca nas duas tabelas e junta
            const filtrosFixa = { ...filtrosBase, fixa: 1 };
            const filtrosNaoFixa = { ...filtrosBase, fixa: 0 };

            DespesaModel.readDespesa(filtrosFixa, (err, fixas) => {
                if (err) {
                    console.error('Erro ao encontrar despesas fixas:', err);
                    return res.status(500).json({ error: 'Erro ao encontrar despesas fixas' });
                }
                DespesaModel.readDespesa(filtrosNaoFixa, (err2, naoFixas) => {
                    if (err2) {
                        console.error('Erro ao encontrar despesas não fixas:', err2);
                        return res.status(500).json({ error: 'Erro ao encontrar despesas não fixas' });
                    }
                    const results = [...fixas, ...naoFixas];

                    res.status(200).json({
                        message: 'Despesas encontradas com sucesso',
                        results
                    });
                });
            });
        }
    } catch (error) {
        console.error('Erro inesperado:', error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
};

const readCalendarioGastos = async (req, res) => {
    const casal = req.header('auth');
    const mes = Number(req.query.mes);
    const ano = Number(req.query.ano);

    if (!casal || !Number.isInteger(mes) || mes < 0 || mes > 11 || !Number.isInteger(ano)) {
        return res.status(400).json({ error: 'Período inválido para o calendário de gastos' });
    }

    try {
        const resultados = await DespesaModel.readCalendarioGastos(casal, mes, ano);
        return res.status(200).json({ message: 'Gastos do calendário encontrados', results: resultados });
    } catch (error) {
        console.error('Erro ao carregar calendário de gastos:', error);
        return res.status(500).json({ error: 'Erro ao carregar calendário de gastos' });
    }
};



const readDespesaID = (req, res) => {
    const id = req.header('id');
    const casal = req.header('auth');
    const fixa = req.header('fixa');

    DespesaModel.readDespesaID(id, casal, Number(fixa), (err, results) => {
        if (err) {
            console.error('Erro ao encontrar despesa:', err);
            return res.status(500).json({ error: 'Erro ao encontrar despesa' });
        }

        if (results == undefined) {
            console.error(`Nenhuma despesa encontrada. Há algum erro na requisição`)
            return res.status(400).json({ message: `Nenhuma despesa encontrada. Há algum erro na requisição` })
        }
        
        res.status(200).json({ message: 'Despesa encontrada com sucesso', results })
    })
}

const editDespesa = (req, res) => {
    const casal = req.header('auth');
    const { id, descricao, categoria, valor, data, tipo, status, fixa, tag, obs, banco, cartao } = req.body

    DespesaModel.editDespesa(casal, id, descricao, categoria, valor, data, tipo, status, fixa, tag, obs, banco, cartao, (err, results) => {
        if (err) {
            console.error('Erro ao editar a despesa', err);
            return res.status(500).json({ error: 'Erro ao editar a despesa' });
        }

        res.status(200).json({ message: 'Despesa editada com sucesso', results })
    })
}

const editDespesaFixa = (req, res) => {
    const casal = req.header('auth');
    const pendentes = req.header('pend');
    const { id_fixo, descricao, categoria, valor, data, tipo, tag, obs } = req.body

    DespesaModel.editDespesaFixa(casal, id_fixo, descricao, categoria, valor, data, tipo, pendentes, tag, obs, (err, results) => {
        if (err) {
            console.error('Erro ao editar a despesa', err);
            return res.status(500).json({ error: 'Erro ao editar a despesa' });
        }

        res.status(200).json({ message: 'Despesas editadas com sucesso', results })
    })

}

const deleteDespesa = (req, res) => {
    const casal = req.header('auth')
    const id = req.header('id')
    const id_fixo = req.header('idFixo')
    const pend = req.header('pend')

    DespesaModel.deleteDespesa(casal, id, id_fixo, pend, (err, results) => {
        if (err) {
            console.error('Erro ao excluir despesa:', err)
            return res.status(500).json({ error: 'Erro ao excluir despesa' })
        }
        res.status(200).json({ message: 'Despesa excluida com sucesso', results })
    })
}

const efetivaDespesa = (req, res) => {
    const casal = req.header('auth');
    const despesaId = req.header('id');
    const fixa = req.header('fixa');

    DespesaModel.efetivaDespesa(casal, despesaId, fixa, (err, results) => {
        if (err) {
            console.error(`Erro ao efetivar despesa: ${err}`);
            return res.status(500).json({ error: 'Erro ao efetivar despesa' });
        }
        res.status(200).json({ message: 'Despesa efetivada com sucesso', results });
    });
}


export default { addDespesa, readDespesa, readCalendarioGastos, deleteDespesa, readDespesaID, editDespesa, editDespesaFixa, efetivaDespesa }
