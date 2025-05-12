import BancoModel from "../../models/banco/bancoModel.mjs";

const addBanco = (req, res) => {

    const { saldo_inicial, nome, tipo} = req.body;
    const casal = req.header('auth');
    const usuario = req.header('usuario')
    BancoModel.addBanco(saldo_inicial, casal, nome, tipo, usuario, (err, results) => {
        if (err) {
            console.error('Erro ao cadastrar banco', err);
            return res.status(500).json({ error: 'Erro ao cadastrar banco' });
        }

        res.status(200).json({ message: 'Banco cadastrado com sucesso', results });
    });
};

const readBanco = (req, res) => {
    const cod_casal = req.header('auth')
    const usuario = req.header('usuario')
    const arquivo = req.header('arquivo')

    BancoModel.readBanco(cod_casal, usuario, arquivo, (err, results) => {
        if(err) {
            return res.status(500).json({error: `Erro ao encontrar bancos. ${err}`});
        } else if(results.length == 0) {
            return res.status(500).json({error: 'Não há bancos para serem listados'});
        }

        res.status(200).json({message: 'Bancos encontrados', results});
    });
};

const readBancoID = (req, res) => {
    const cod_casal = req.header('auth');
    const id = req.header("id");

    BancoModel.readBancoID(cod_casal, id, (err, results) => {
        if(err) {
            return res.status(500).json({error: 'Erro ao encontrar banco'});
        } else if(results.lenght == 0) {
            return res.status(500).json({error: 'Erro ao encontrar banco'});
        }

        res.status(200).json({message: 'Banco encontrado', results});
    });
};

const saldoBanco = (req, res) => {
    const casal = req.header('auth')
    const usuario = req.header('usuario')
    const tipo = req.header('tipo')
    const arquivo = req.header('arquivo')

    BancoModel.saldoBanco(casal, usuario, tipo, arquivo, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao encontrar o saldo do banco' });
        }

        res.status(200).json({ message: 'Saldo encontrado', results });
    })
}

const alteraSaldoInicial = (req, res) => {
    const casal = req.header('auth');
    const id = req.header('id')
    const novoSaldo = req.header('novoSaldo')

    BancoModel.alteraSaldoincial(id, casal, novoSaldo, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível ajustar saldo inicial' });
        }

        res.status(200).json({ message: 'Saldo ajustado com sucesso', results });
    })
}

const arqDesBanco = (req, res) => {
    const casal = req.header('auth')
    const id = req.header('id')
    const arquivo = req.header('arquivo')

    BancoModel.arqDesBanco(id, casal, arquivo, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível realizar essa alteração' });
        }

        res.status(200).json({ message: 'Alteração realizada com sucesso', results });
    })
}

const editBanco = (req, res) => {
    const casal = req.header('auth');
    const id = req.header('id');
    const nome = req.header('nome');
    const tipo = req.header('tipo');
    const usuario = req.header('usuario');

    BancoModel.editBanco(id, casal, nome, tipo, usuario, (err, results) => {
        if (err) {
            return res.status(500).json({error: 'Não foi possível realizar essa edição'});
        }

        res.status(200).json({ message: 'Edição realizada com sucesso', results});
    });
}

export default { addBanco, readBanco, readBancoID, saldoBanco, alteraSaldoInicial, arqDesBanco, editBanco}