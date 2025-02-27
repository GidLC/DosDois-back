import TransfModel from '../../models/transacoes/transferenciaModel.mjs'

const addTransferencia = (req, res) => {
    const casal = req.header('auth');
    const usuario = req.header('usuario');
    const { valor, data, bancoOrigem, bancoDestino, obs } = req.body;

    TransfModel.addTransferencia(casal, valor, usuario, data, bancoOrigem, bancoDestino, obs, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível realizar essa transferência' });
        }

        res.status(200).json({ message: 'Transferência realizada com sucesso', results });
    })
}

const readTransferencias = (req, res) => {
    const casal = req.header('auth');
    const usuario = req.header('usuario');
    const mes = req.header('mes');
    const ano = req.header('ano');

    TransfModel.readTransferencias(usuario, casal, mes, ano, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível listar as transferências' });
        }

        res.status(200).json({ message: 'Transferências listadas com sucesso', results });
    })
}

const deleteTransferencia = (req, res) => {
    const casal = req.header('auth');
    const id = req.header('id');

    TransfModel.deleteTransferencia(casal, id, (err, results) => {
        if (err) {
            console.error('Erro ao excluir Transferência', err);
            return res.status(500).json({ message: 'Não foi possível excluir a transferência' });
        }

        res.status(200).json({ message: 'Transferência excluida com sucesso', results });
    })
}

const readTransferenciaID = (req, res) => {
    const casal = req.header('auth');
    const id = req.header('id');

    TransfModel.readTransferenciaID(id, casal, (err, results) => {
        if (err) {
            console.error('Erro ao Encontrar a transferencia', err);
            return res.status(500).json({ error: 'Erro ao buscar a transferencia' });
        }

        res.status(200).json({ message: 'Transferencia encontrada', results })
    })
}

const editTransferencia = (req, res) => {
    const casal = req.header('auth');
    const id = req.header('id')
    const { valor, data, bancoOrigem, bancoDestino, idRelacao, obs } = req.body;

    TransfModel.editTransferencia(id, casal, idRelacao, valor, data, bancoOrigem, bancoDestino, obs, (err, results) => {
        if (err) {
            console.error('Erro ao editar transferencia', err);
            return res.status(500).json({ error: 'Erro ao editar a transferencia' });
        }

        res.status(200).json({ message: 'Transferencia editada com sucesso', results })
    })
}

export default { addTransferencia, readTransferencias, deleteTransferencia, readTransferenciaID, editTransferencia }