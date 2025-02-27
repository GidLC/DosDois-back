import DespesaModel from "../../models/transacoes/despesaModel.mjs";

const addDespesa = (req, res) => {
    const { descricao, valor, categoria, status, data, banco, tipo, fixa, tag, obs, repetir } = req.body;
    const cod_casal = req.header('auth');
    const usuario = req.header('usuario')

    DespesaModel.addDespesa(descricao, valor, usuario, cod_casal, categoria, status, data, banco, tipo, fixa, tag, obs, repetir, (err, resultado) => {
        if (err) {
            console.error('Erro ao cadastrar despesa:', err);
            return res.status(500).json({ error: `Erro ao cadastrar despesa. ${err}` })
        }
        res.status(200).json({ message: 'Despesa cadastrada com sucesso', resultado })
    });
};

const readDespesa = (req, res) => {
    const casal = req.header('auth');
    const usuario = req.header('usuario');
    const mes = req.header('mes');
    const ano = req.header('ano');
    const tipo = req.header('tipo');
    const fixa = req.header('fixa');

    DespesaModel.readDespesa(usuario, casal, mes, ano, parseInt(tipo), parseInt(fixa), (err, results) => {
        if (err) {
            console.error('Erro ao encontrar despesas:', err);
            return res.status(500).json({ error: 'Erro ao encontrar despesas' });
        }
        res.status(200).json({ message: 'Despesas encontradas com sucesso', results })
    })
}

const readDespesaID = (req, res) => {
    const id = req.header('id');
    const casal = req.header('auth');
    const fixa = req.header('fixa');

    DespesaModel.readDespesaID(id, casal, fixa, (err, results) => {
        if (err) {
            console.error('Erro ao encontrar despesa:', err);
            return res.status(500).json({ error: 'Erro ao encontrar despesa' });
        }
        res.status(200).json({ message: 'Despesa encontrada com sucesso', results })
    })
}

const editDespesa = (req, res) => {
    const casal = req.header('auth');
    const { id, descricao, categoria, valor, data, tipo, status, fixa, tag, obs } = req.body

    DespesaModel.editDespesa(casal, id, descricao, categoria, valor, data, tipo, status, fixa, tag, obs, (err, results) => {
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
    const { id_fixo, descricao, categoria, valor, data, tipo, status, tag, obs } = req.body

    DespesaModel.editDespesaFixa(casal, id_fixo, descricao, categoria, valor, data, tipo, status, pendentes, tag, obs, (err, results) => {
        if (err) {
            console.error('Erro ao editar a despesa', err);
            return res.status(500).json({ error: 'Erro ao editar a despesa' });
        }

        res.status(200).json({ message: 'Despesas editadas com sucesso', results })
    })

}

const deleteDespesa = (req, res) => {
    const casal = req.header('auth');
    const id = req.header('id');
    const fixa = req.header('fixa');

    DespesaModel.deleteDespesa(casal, id, fixa, (err, results) => {
        if (err) {
            console.error('Erro ao excluir despesa:', err);
            return res.status(500).json({ error: 'Erro ao excluir despesa' });
        }
        res.status(200).json({ message: 'Despesa excluida com sucesso', results })
    })
}

const deleteDespesaPend = (req, res) => {
    const casal = req.header('auth');
    const id_fixo = req.header('id_fixo');

    DespesaModel.deleteDespesaPend(casal, id_fixo, (err, results) => {
        if (err) {
            return res.status(500).json({error: "Erro ao excluir as receitas"})
        }

        res.status(200).json({message: 'Despesas excluidas com sucesso', results});
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


export default { addDespesa, readDespesa, deleteDespesa, readDespesaID, editDespesa, editDespesaFixa, efetivaDespesa, deleteDespesaPend}