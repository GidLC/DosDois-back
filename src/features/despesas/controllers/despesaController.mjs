import DespesaModel from "../models/despesaModel.mjs";

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
            status,
            valorMin,
            valorMax,
            descricao,
            groupBy,
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
            status: status !== undefined ? Number(status) : undefined,
            valorMin: valorMin ? parseFloat(valorMin) : undefined,
            valorMax: valorMax ? parseFloat(valorMax) : undefined,
            descricao: descricao || null,
            groupBy: groupBy || null
        };

        // Se veio fixa, faz só uma busca
        if (fixa != undefined && fixa != null && fixa != "") {
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
    const { id, descricao, categoria, valor, data, tipo, status, fixa, tag, obs, banco } = req.body

    DespesaModel.editDespesa(casal, id, descricao, categoria, valor, data, tipo, status, fixa, tag, obs, banco, (err, results) => {
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
    const { id, id_fixo, pend } = req.body
    console.log({ id, id_fixo, pend })

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


export default { addDespesa, readDespesa, deleteDespesa, readDespesaID, editDespesa, editDespesaFixa, efetivaDespesa }