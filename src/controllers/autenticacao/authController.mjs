import AuthModel from "../../models/autenticacao/authModel.mjs";
import path from "path";
import fs from "fs";

//Sem autenticação
const loginUsuario = (req, res) => {
  const { email, senha } = req.body;
  AuthModel.loginUsuario(email, senha, (err, resultado) => {
    if (err) {
      console.error('Erro ao encontrar  usuário:', err);
      return res.status(500).json({ message: `Erro ao realizar login: ${err}` });
    }
    res.status(200).json({ message: 'Usuário encontrado com sucesso', resultado });
  });
};


//Sem autenticação
const cadastroUsuario = (req, res) => {
  const { nome, email, senha, fone, dt_criacao, sexo } = req.body;

  // Chame o método salvarUsuario do modelo
  AuthModel.cadastroUsuario(nome, email, senha, fone, dt_criacao, sexo, (err, resultado) => {
    /*if (err.cod == 1062) {
      return res.status(400).json({ error: 'Esse e-mail ou celular já está cadastrado' });
    } else*/ if (err) {
      console.error('Erro ao salvar o usuário:', err);
      return res.status(500).json({ error: 'Erro ao salvar o usuário' });
    }

    res.status(200).json({ message: 'Usuário cadastrado com sucesso', resultado });
  });
};


/*const buscaCadastro = (req, res) => {
  const { codigo } = req.body;
  AuthModel.buscaCadastro(codigo, (err, results) => {
    if (err) {
      console.error('Erro ao encontrar cadastro:', err);
      return res.status(500).json({ error: 'Erro ao encontrar cadastro' });
    } else if (results == 0) {
      return res.status(200).json({ message: 'Não há usuário no aplicativo com esse código', results });
    } else if (results == 1) {
      console.log(`PARCEIRO`)
      return res.status(200).json({ message: 'Esse usuário já possui um parceiro', results });
    }
    res.status(200).json(results);
  });
};*/

//Sem autenticação
const vincCadastro = (req, res) => {
  const { nome, email, senha, cod_casal, fone, sexo, uuid } = req.body;

  AuthModel.vincCadastro(nome, email, senha, cod_casal, fone, sexo, uuid, (err, resultado) => {
    if (err) {
      console.error('Erro ao vincular usuário :', err);
      return res.status(500).json({ error: err });
    }
    res.status(200).json({ message: 'Usuário vinculado com sucesso', resultado });
  });
};

//Sem autenticação
const gerarToken = (req, res) => {
  const fone = req.header('fone');
  const tipo = req.header('tipo') //login ou senha
  console.log({fone, tipo})

  AuthModel.gerarToken({ fone, tipo }, (err, results) => {
    if (err) {
      console.error('Erro ao encontrar cadastro', err);
      return res.status(500).json({ error: 'Erro ao encontrar cadastro' });
    } else if (!results) {
      return ({ message: 'Não foi possível encontrar o usuário' })
    }
    return res.status(200).json({ message: 'Usuário encontrado', results })
  })
}

//Sem autenticação
const validaToken = (req, res) => {
  const token = req.header('token');
  const uuid = req.header('uuid');
  const tipo = req.header('tipo') // login ou senha
  const fone = req.header('fone') //Para caso a validação seja para o acesso pelo WhatsApp

  AuthModel.validaToken({ fone, token, uuid, tipo }, (err, results) => {
    if (err || results == null) {
      return res.status(500).json({ error: 'Token inválido' });
    }
    return res.status(200).json({ message: 'Token validado', results })
  });
};

//Sem autenticação
const mudaSenha = (req, res) => {
  const { id, novaSenha, token } = req.body;

  AuthModel.mudaSenha(id, novaSenha, token, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao mudar a senha' });
    }

    return res.status(200).json({ message: 'Senha alterada com sucesso', results })
  })
}

//Autenticação JWT
const editUser = (req, res) => {
  const { nome, email, fone, id, foto } = req.body

  AuthModel.editUser(nome, email, fone, id, foto, (err, results) => {
    if (err) {
      return res.status(500).json({ error: `Erro ao realizar a alteração. ${err}` })
    }

    return res.status(200).json({ message: "Alteração realizada com sucesso", results })
  })
}

//Sem autenticação
const validaVinculo = (req, res) => {
  const casal = req.header("casal")
  const uuid = req.header("uuid")

  AuthModel.validaVinculo(casal, uuid, (err, results) => {
    if (err) {
      return res.status(500).json({ message: `Não foi possível validar as informações. ${err}` })
    }

    return res.status(200).json({ message: 'OK', results })
  })
}

//Autenticação JWT

const getPerfil = (req, res) => {
  const idUser = req.header("idUser");

  if (!idUser) {
    return res.status(400).json({ error: "ID do usuário não fornecido no header." });
  }

  AuthModel.getPerfil(idUser, (err, caminhoCompleto) => {
    if (err) {
      return res.status(500).json({ error: `Não foi possível buscar a imagem de perfil. ${err}` });
    }

    if (!fs.existsSync(caminhoCompleto)) {
      return res.status(404).send("Imagem não encontrada");
    }

    console.log(caminhoCompleto)
    return res.sendFile(caminhoCompleto);
  });
};

const verificaWhats = (req, res) => {
  const { fone } = req.query

  AuthModel.verificaWhats(fone, (err, results) => {
    if (err) {
      return res.status(500).json({ message: `Não foi possível validar seu whatsapp.`, err })
    }

    return res.status(200).json({ message: 'Validado com sucesso', results })
  })
}

export default { cadastroUsuario, loginUsuario, vincCadastro, gerarToken, validaToken, mudaSenha, editUser, validaVinculo, getPerfil, verificaWhats }

