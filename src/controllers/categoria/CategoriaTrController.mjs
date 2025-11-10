import CategoriaTrModel from "../../models/categoria/categoriaTrModel.mjs";

const addCategoriaTr = (req, res) => {
    const { nome, tipo, cor, icone } = req.body;
    const cod_casal = req.header('auth');

    CategoriaTrModel.addCategoriaTr(nome, tipo, cor, icone, cod_casal, (err, results) => {
        if (err) {
            console.error('Erro ao cadastrar categoria', err);
            return res.status(500).json({ error: 'Erro ao cadastrar categoria' });
        }

        res.status(200).json({ message: 'Categoria Cadastrada com Sucesso', results })
    })
}

const loadCategoriaTr = (req, res) => {
    const auth = req.header('auth');
    const tipo = req.header('tipo')

    CategoriaTrModel.loadCategoriaTr(auth, tipo, (err, results) => {
        if (err) {
            console.error('Não foi possível encontrar as categorias', err);
            return res.status(500).json({ error: 'Não possível encontrar as categorias', results })
        }

        res.status(200).json({ message: 'Categoria Encontradas com Sucesso', results })
    })
}

const loadCategoriasSistema = (req, res) => {
    const auth = req.header('auth')

    CategoriaTrModel.loadCategoriasSistema(auth, (err, results) => {
        if (err) {
            console.error('Não foi possível encontrar as categorias', err);
            return res.status(500).json({ error: 'Não possível encontrar as categorias', results })
        }

        res.status(200).json({message: 'Categorias encontradas', results})
    })
}

const loadCategoriaTrID = (req, res) => {
    const auth = req.header('auth');
    const { id } = req.body;

    CategoriaTrModel.loadCategoriaTrID(auth, id, (err, results) => {
        if (err) {
            console.error('Não foi possível carregar a categoria em questão', err);
            return res.status(500).json({ error: 'Não foi possível carregar a categoria em questão', results })
        }

        res.status(200).json({ message: 'Categoria Encontrada com Sucesso', results })
    })
}

const editCategoriaTr = (req, res) => {
    const auth = req.header('auth');
    const {id, nome, icone, cor, padrao, tipo } = req.body;

    CategoriaTrModel.editCategoriaTr(auth, id, nome, icone, cor, padrao, tipo, (err, results) => {
        if (err) {
            console.error('Não foi possível editar essa Categoria', err);
            return res.status(500).json({ error: 'Não foi possível editar essa Categoria', results })
        }

        res.status(200).json({ message: 'Categoria Editada com Sucesso', results })
    })
}

const deleteCategoriaTr = (req, res) => {
    const auth = req.header('auth');
    const id = req.header('id');
    console.log(id)

    CategoriaTrModel.deleteCategoriaTr(auth, id, (err, results) => {
        if(err) {
            if(err.sqlState == 23000) {
                return res.status(501).json({error: 'Essa categoria já possui movimentações, não é possível exclui-la', status: 501})
            }
            console.error('Não foi possível excluir essa categoria', err);
            return res.status(500).json({error: 'Não foi possível excluir essa categoria', results})
        }

        res.status(200).json({ message: 'Categoria Excluida com Sucesso', results })
    })
}

const moveTransacoes = (req, res) => {
    const auth = req.header('auth')
    const {catOrigem, catDestino} = req.body
    CategoriaTrModel.moveTransacoes(auth, catOrigem, catDestino, (err, results) => {
        if (err) {
            return res.status(500).json({error: 'Não foi possível mover as transações'})
        }
        return res.status(200).json({message: 'Transações movidas com sucesso', results})
    })
}

export default { addCategoriaTr, loadCategoriaTr, loadCategoriasSistema, loadCategoriaTrID, editCategoriaTr, deleteCategoriaTr, moveTransacoes }