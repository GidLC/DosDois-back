import ObjetivoModel from "../../models/objetivos/objetivoModel.mjs";

const addObjetivo = (req, res) => {
    const casal = req.header('auth')
    const { descricao, valor_final, valor_inicial, status, prazo, cor, icone } = req.body

    ObjetivoModel.addObjetivo(descricao, valor_final, valor_inicial, status, prazo, casal, cor, icone, (err, results) => {
        if (err) {
            console.error('Erro ao cadastrar objetivo', err);
            return res.status(500).json({ error: 'Erro ao cadastrar objetivo' });
        }

        res.status(200).json({ message: 'Objetivo cadastrado com sucesso', results });
    })
}

const readObjetivos = (req, res) => {
    const casal = req.header('auth')
    const status = req.header('status')

    ObjetivoModel.readObjetivos(casal, status, (err, results) => {
        if (err) {
            console.error('Erro ao obter objetivos', err)
            return res.status(500).json({ error: 'Não foi possível obter os objetivos' })
        }

        res.status(200).json({ message: 'OK', results })
    })
}

const readObjetivoId = (req, res) => {
    const casal = req.header('auth')
    const id = req.header('id')

    ObjetivoModel.readObjetivoId(id, casal, (err, results) => {
        if (err) {
            console.error('Erro ao obter objetivo', err)
            return res.status(500).json({ error: 'Não foi possível obter os objetivo' })
        }

        res.status(200).json({ message: 'OK', results })
    })
}

const deleteObjetivo = (req, res) => {
    const casal = req.header('auth')
    const id = req.header('id')

    ObjetivoModel.deleteObjetivo(id, casal, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível excluir esse objetivo' })
        }

        res.status(200).json({ message: 'Objetivo excluido com sucesso', results })
    })
}

const aporteObjetivo = (req, res) => {
    const casal = req.header('auth')
    const valor = req.header('valor')
    const objetivo = req.header('objetivo')

    ObjetivoModel.aporteValor(objetivo, valor, casal, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível registrar esse depósito' })
        }

        res.status(200).json({ message: 'Depósitio registrado com sucesso', results })
    })
}

const readAportes = (req, res) => {
    const objetivo = req.header('objetivo')
    const casal = req.header('auth')

    ObjetivoModel.readAportes(objetivo, casal, (err, results) => {
        if (err) {
            console.error('Erro ao encontrar depósitos', err);
            return res.status(500).json({ error: 'Não foi possível encontrar os depósitos' })
        }

        res.status(200).json({ message: 'OK', results })
    })
}

const mudaStatusObjetivo = (req, res) => {
    const objetivo = req.header('objetivo')
    const casal = req.header('auth')
    const status = req.header('status')

    ObjetivoModel.mudaStatusObjetivo(objetivo, casal, status, (err, results) => {
        if (err) {
            console.error('Erro ao mudar o status', err);
            return res.status(500).json({ error: 'Não foi possível realizar essa ação' })
        }

        if (status == 1) {
            res.status(200).json({ message: 'Objetivo concluido com sucesso', results })
        }
    })
}

const editObjetivo = (req, res) => {
    const casal = req.header('auth')
    const {id, descricao, valor_final, prazo, cor, icone } = req.body
    console.log(id, descricao, valor_final, prazo, cor, icone )

    ObjetivoModel.editObjetivo(casal, id, descricao, valor_final, prazo, cor, icone, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível editar esse objetivo', err })
        }

        res.status(200).json({ message: 'Objetivo editado com sucesso', results })
    })
}

export default { addObjetivo, readObjetivos, readObjetivoId, deleteObjetivo, aporteObjetivo, readAportes, mudaStatusObjetivo, editObjetivo }