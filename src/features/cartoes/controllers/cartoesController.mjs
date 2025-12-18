import CartoesModel from "../models/cartoesModel.mjs";

const addCartao = (req, res) => {
    const { nome, usuario, bandeira, limite, fech, venc, cor, disp, banco } = req.body

    CartoesModel.addCartao(nome, usuario, bandeira, limite, fech, venc, cor, disp, banco, (err, results) => {
        if (err) {
            console.error('Erro ao cadastrar cartão', err);
            return res.status(500).json({ error: 'Erro ao cadastrar cartão' });
        }

        res.status(200).json({ message: 'Cartão cadastrado com sucesso', results });
    })
}

const buscaBandeiras = (req, res) => {
    CartoesModel.buscaBandeiras((err, results) => {
        if (err) {
            console.error('Não foi possível encontrar as bandeiras', err);
            return res.status(500).json({ error: 'Não foi possível encontrar as bandeiras' });
        }
        res.status(200).json({ message: 'Bandeiras encontradas com sucesso', results })
    })
}

const getAllCartoes = (req, res) => {
    const { idUser, arquivo, parceiro } = req.query

    CartoesModel.getAllCartoes(idUser, arquivo, parceiro, (err, results) => {
        if (err) {
            console.error('Não foi possível encontrar os cartões', err);
            return res.status(500).json({ error: 'Não foi possível encontrar os cartões' });
        }
        res.status(200).json({ message: 'Cartões encontrados com sucesso', results })
    })
}

export default { addCartao, buscaBandeiras, getAllCartoes }