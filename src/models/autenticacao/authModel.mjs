import { pool } from "../../config/config.mjs";
import * as crypto from 'crypto'
import enviaEmail from "../../data/enviaEmail/enviaEmail.mjs";
import EmailParceiro from "../../data/emails/Cadastro/EmailParceiro.mjs";
import EmailCadastro from "../../data/emails/Cadastro/EmailCadastro.mjs";
import enviaWhats from '../../data/enviaWhats/enviaWhats.mjs';
import separaData from '../../data/SeparaData/SeparaData.mjs';
import { createToken } from '../../middlewares/auth.mjs';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { formataDataBr } from "../../data/formataDataBR/formataDataBR.mjs";
import { formataFone } from "../../data/formataFone/formataFone.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const getUserData = async (usuario) => {
  //Verifica casal
  const [casal] = await new Promise((resolve, reject) => {
    const query = 'SELECT * FROM casal WHERE usuario_princ = ? OR usuario_sec = ?';
    pool.query(query, [usuario.id, usuario.id], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

  //Verifica pendência de WhatsApp
  let whatsPend = false;
  const queryWhats = 'SELECT * FROM senha_temp WHERE id_usuario = ? AND tipo = ? AND validade > NOW()';
  const whats = await new Promise((resolve, reject) => {
    pool.query(queryWhats, [usuario.id, 'login'], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

  if (whats.length > 0 && usuario.whats_verificado == 0) {
    whatsPend = true;
  }

  // Caso o usuário ainda não tenha casal
  if (!casal || casal.usuario_sec === null) {
    const userData = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      fone: usuario.fone,
      sexo: usuario.sexo,
      incompleto: usuario.incompleto,
      cod_casal: casal?.cod_casal || null,
      casal_formado: 0,
      whatsPend,
    };
    const token = createToken(userData);
    return { token, userData };
  }

  // Identifica parceiro
  const idParceiro = usuario.id == casal.usuario_princ ? casal.usuario_sec : casal.usuario_princ;
  const [parceiro] = await new Promise((resolve, reject) => {
    pool.query('SELECT * FROM usuario WHERE id = ?', [idParceiro], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

  const userData = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    fone: usuario.fone,
    sexo: usuario.sexo,
    incompleto: usuario.incompleto,
    cod_casal: casal.cod_casal,
    id_parceiro: idParceiro,
    nome_parceiro: parceiro?.nome,
    email_parceiro: parceiro?.email,
    fone_parceiro: parceiro?.fone,
    casal_formado: 1,
    whatsPend,
  };

  const token = createToken(userData);
  return { token, userData };
}

const updateLastAccess = async (idUsuario) => {
  const query = 'UPDATE usuario SET ultimo_acesso = NOW() WHERE id = ?';
  await new Promise((resolve, reject) => {
    pool.query(query, [idUsuario], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

const criarUsuarioBase = async ({ nome, email, senha, fone, sexo, foto }) => {
  // Cria código exclusivo do casal
  const codigoCasal = crypto.randomBytes(3).toString("hex");
  const senhaHash = senha
    ? crypto.createHash("sha256").update(senha).digest("hex")
    : null;

  // Cria usuário
  const queryUsuario = `
    INSERT INTO usuario (nome, email, ${senha ? "senha," : ""} casal, dt_criacao, fone, sexo, foto)
    VALUES (?, ?, ${senha ? "?," : ""} ?, NOW(), ?, ?, ?)
  `;

  const usuario = await new Promise((resolve, reject) => {
    pool.query(
      queryUsuario,
      senha
        ? [nome, email, senhaHash, codigoCasal, fone, sexo, foto]
        : [nome, email, codigoCasal, fone, sexo, foto],
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });

  const userId = usuario.insertId;

  // Cria casal
  await new Promise((resolve, reject) => {
    pool.query(
      "INSERT INTO casal (cod_casal, usuario_princ) VALUES (?, ?)",
      [codigoCasal, userId],
      (err, results) => (err ? reject(err) : resolve(results))
    );
  });

  // Insere categorias padrões
  const queryCategoria = `
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Alimentação", 0, 2, 21, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Moradia", 0, 3, 27, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Transporte", 0, 4, 16, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Saúde", 0, 5, 29, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Educação", 0, 6, 11, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Lazer", 0, 7, 28, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Roupas e Acessórios", 0, 8, 33, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Água/Luz/Internet", 0, 9, 39, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Despesas Diversas", 0, 10, 36, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal, cat_sistema) VALUES("*Ajuste*",0, 2, 36, ?, 1);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Salário", 1, 11, 38, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Rendimentos", 1, 12, 37, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Presentes", 1, 13, 26, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Receitas Diversas", 1, 14, 31, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal, cat_sistema) VALUES("*Ajuste*",1, 3, 37, ?, 1);
  `;

  const queries = queryCategoria.split(";").filter((q) => q.trim() !== "");
  await Promise.all(
    queries.map(
      (query) =>
        new Promise((resolve, reject) => {
          pool.query(query, [codigoCasal], (err, results) =>
            err ? reject(err) : resolve(results)
          );
        })
    )
  );

  // Cria conta Carteira
  await new Promise((resolve, reject) => {
    pool.query(
      "INSERT INTO banco (nome, tipo, saldo_inicial, casal, usuario) VALUES ('Carteira', 0, 0, ?, ?)",
      [codigoCasal, userId],
      (err, results) => (err ? reject(err) : resolve(results))
    );
  });

  // Cria vínculo e envia notificações
  const uuid = crypto.randomUUID();
  const url = `https://dosdoisapp.com.br/atribuicao/${codigoCasal}/${uuid}`;
  await new Promise((resolve, reject) => {
    pool.query(
      "INSERT INTO vinculos (casal, uuid) VALUES (?, ?)",
      [codigoCasal, uuid],
      (err, results) => (err ? reject(err) : resolve(results))
    );
  });

  if (email) {
    await enviaEmail(email, "Cadastro no DosDois", EmailCadastro(nome, codigoCasal, url));
  }
  if (fone) {
    await enviaWhats(
      fone,
      `Bem-vindo ao app *DosDois*! Para que seu parceiro se vincule a você, acesse: ${url}`
    );
  }

  return { id: userId, nome, email, casal: codigoCasal };
}

class AuthModel {
  static cadastroUsuario = async (nome, email, senha, fone, dt_criacao, sexo, callback) => {
    try {
      const user = await criarUsuarioBase({ nome, email, senha, fone, sexo, foto: null });
      return callback(null, "Usuário cadastrado com sucesso");
    } catch (error) {
      return callback({ message: `Erro ao cadastrar usuário. ${error}` }, null);
    }
  };


  //Realizar uma validação de vinculação mais segura, como solicitar o email do parceiro principal
  static vincCadastro = async (nome, email, senha, cod_casal, fone, sexo, uuid, callback) => {
    try {
      const senhaHash = crypto.createHash('sha256').update(senha).digest('hex');

      //Insere usuário na tabela
      const queryUsuario = `INSERT INTO usuario (nome, email, senha, casal, dt_criacao, fone, sexo) 
                            VALUES (?, ?, ?, ?, NOW(), ?, ?)`;
      const usuarioResult = await new Promise((resolve, reject) => {
        pool.query(queryUsuario, [nome, email, senhaHash, cod_casal, fone, sexo], (err, results) => {
          if (err) {
            reject(err);
          }
          resolve(results);
        });
      });

      const userId = usuarioResult.insertId;

      //Cria linha na tabela de casal
      const queryCasal = 'UPDATE casal SET usuario_sec = ? WHERE cod_casal = ?';
      const casalResult = await new Promise((resolve, reject) => {
        pool.query(queryCasal, [userId, cod_casal], (err, results) => {
          if (err) {
            reject(err);
          }
          resolve(results);
        });
      });

      const queryParceiro = `SELECT nome FROM usuario 
                              WHERE casal = ?`
      const parceiro = await new Promise((resolve, reject) => {
        pool.query(queryParceiro, [cod_casal], (err, results) => {
          if (err) {
            reject(err)
          }
          resolve(results[0])
        })
      })

      const queryVinculo = `UPDATE vinculos SET ativo = 0 WHERE casal = ? AND uuid = ?`

      await new Promise((resolve, reject) => {
        pool.query(queryVinculo, [cod_casal, uuid], (err, results) => {
          if (err) {
            reject(err)
          }
          resolve(results)
        })
      })

      const queryBancos = `INSERT INTO banco (nome, tipo, saldo_inicial, casal, usuario) VALUES ("Carteira", 0, 0, ?, ?);`

      const queries = queryBancos.split(';').filter(query => query.trim() !== '');
      await Promise.all(queries.map((query) => {
        return new Promise((resolve, reject) => {
          pool.query(query, [cod_casal, userId], (err, results) => {
            if (err) {
              reject(err);
            }
            resolve(results);
          });
        });
      }));

      enviaWhats(fone, `Você acaba de se vincular como parceira(o) de ${parceiro.nome} no aplicativo *DosDois*. Aproveitem a aplicação e sucesso`)
      return callback(null, casalResult);
    } catch (error) {
      console.error(`Não foi possível vincular o cadastro. ${error}`)
      return callback(error, null)
    }
  }

  static loginUsuario = async (email, senha, callback) => {
    try {
      const senhaHash = crypto.createHash('sha256').update(senha).digest('hex');

      const [usuario] = await new Promise((resolve, reject) => {
        const query = 'SELECT * FROM usuario WHERE email = ? AND senha = ?';
        pool.query(query, [email, senhaHash], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      if (!usuario) return callback('Usuário não encontrado', null);

      await updateLastAccess(usuario.id);
      const result = await getUserData(usuario);
      return callback(null, result);
    } catch (error) {
      console.error(`Erro no login: ${error}`);
      return callback(error, null);
    }
  }

  //Usado para trocar a senha no APP
  static gerarToken = async ({ fone, tipo }, callback) => {
    try {
      const token = crypto.randomBytes(2).toString('hex');
      const uuid = tipo === "senha" ? crypto.randomUUID() : null; //Só cria UUID no caso de trocar a senha

      const data = new Date()
      const validade = new Date(data.getTime() + 2 * 60 * 60 * 1000).toISOString();
      const v = await separaData(validade)
      const momento = `${v.ano}-${v.mes + 1}-${v.dia} ${v.hora}:${v.minuto}:${v.segundo}`

      const queryUsuario = `SELECT * FROM usuario WHERE fone = ?`;
      const buscaUsuario = await new Promise((resolve, reject) => {
        pool.query(queryUsuario, [fone], (err, results) => {
          if (err) {
            reject(err);
          }
          resolve(results)
        });
      });

      if (!buscaUsuario[0]) {
        return callback("Usuário não encontrado", null);
      }

      const userId = buscaUsuario[0].id

      // Salva token na tabela
      const queryToken = "INSERT INTO senha_temp (id_usuario, token, validade, uuid, tipo) VALUES (?,?,?,?,?)";
      await new Promise((resolve, reject) => {
        pool.query(queryToken, [userId, token, momento, uuid, tipo], (err, results) => {
          if (err) {
            reject(err);
          }

          resolve(results);
        });
      });

      if (tipo === "senha") {
        const url = `https://dosdoisapp.com.br/esq-senha/${token}/${uuid}`;
        enviaWhats(
          buscaUsuario[0].fone,
          `Você solicitou a *mudança de senha* no app DosDois. Acesse: ${url}`
        );
      } else if (tipo === "login") {
        enviaWhats(
          buscaUsuario[0].fone,
          `Seu código de autenticação no app *DosDois* é: *${token}*, faça LOGIN no APP e verifique suas pendências.`
        );
      }

      return callback(null, "Token Gerado")
    } catch (error) {
      console.error(`Erro ao gerar token: ${error}`);
      return callback(error, null);
    }
  };

  static validaToken = async ({ fone, token, uuid, tipo }, callback) => {
    console.log({ fone, token, uuid, tipo })
    const data = new Date();
    const v = await separaData(data);
    const momento = `${v.ano}-${v.mes}-${v.dia} ${v.hora}:${v.minuto}:${v.segundo}`;

    let query, params;
    if (tipo === "senha") {
      query = "SELECT * FROM senha_temp WHERE token = ? AND uuid = ? AND tipo = ?";
      params = [token, uuid, tipo];
    } else {
      query = `
      SELECT * FROM senha_temp AS st
      JOIN usuario u ON u.id = st.id_usuario
      WHERE u.fone = ? AND st.token = ? AND st.tipo = ?
    `;
      params = [formataFone(fone), token, tipo];
    }

    const temp = await new Promise((resolve, reject) => {
      pool.query(query, params, (err, results) => {
        if (err) {
          reject("Token expirado");
        } else {
          resolve(results);
        }
      });
    });

    if (tipo == "senha") {
      if (temp.length == 0) {
        return callback("Token inválido ou não encontrado", null)
      }
      if (temp[0].validade < momento) {
        return callback("Token expirado", null)
      }
      return callback(null, temp)
    }

    if (tipo == "login") {
      if (temp.length == 0) {
        return callback("Token inválido ou não encontrado", null)
      }
      if (temp[0].validade < momento) {
        return callback("Token expirado", null)
      }

      const queryUser = `UPDATE usuario SET whats_verificado = 1 WHERE id = ${temp[0].id_usuario}`

      const user = await new Promise((resolve, reject) => {
        pool.query(queryUser, (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });

      if (user) {
        return callback(null, user)
      }
    }
  };


  static mudaSenha = async (id, novaSenha, token, callback) => {
    try {
      const senhaHash = crypto.createHash('sha256').update(novaSenha).digest('hex');

      const querySenha = 'UPDATE usuario SET senha = ? WHERE id = ?';
      await new Promise((resolve, reject) => {
        pool.query(querySenha, [senhaHash, id], (err, results) => {
          if (err) {
            reject(err);
          }

          resolve(results)
        })
      })

      const queryTemp = `UPDATE senha_temp SET validade = NOW() WHERE token = ? `
      await new Promise((resolve, reject) => {
        pool.query(queryTemp, [token], (err, results) => {
          if (err) {
            reject(err);
          }

          resolve(results)
        })
      })

      return callback(null, "OK")
    } catch (error) {
      return callback(error, null)
    }
  }

  static editUser = (nome, email, fone, id, foto, callback) => {

    let caminhoFoto = null;

    if (foto) {
      const matches = foto.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        return callback(`Formato de imagem inválido`, null)
      }

      const ext = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const nomeArquivo = `perfil_${id}_${Date.now()}.${ext}`;
      const caminho = path.join(__dirname, "../..", "uploads/perfis", nomeArquivo);

      fs.writeFileSync(caminho, buffer);
      caminhoFoto = `/uploads/perfis/${nomeArquivo}`;
    }

    const query = 'UPDATE usuario SET nome = ?, fone = ?, perfil_url = ? WHERE id = ?'
    pool.query(query, [nome, fone, String(caminhoFoto), id], (err, results) => {
      if (err) {
        console.error(err)
        return callback(err, null)
      }

      return callback(null, results)
    })
  }

  static validaVinculo = async (casal, uuid, callback) => {
    try {
      const queryValida = `SELECT v.ativo FROM vinculos AS v
                              WHERE v.casal = ? AND v.uuid = ? AND v.ativo = 1`

      const valido = await new Promise((resolve, reject) => {
        pool.query(queryValida, [casal, uuid], (err, results) => {
          if (err) {
            reject(err);
          }
          resolve(results);
        })
      })

      if (valido.length != 0) {
        const queryParceiro = `SELECT nome FROM usuario 
                              WHERE casal = ? `
        const parceiro = await new Promise((resolve, reject) => {
          pool.query(queryParceiro, [casal], (err, results) => {
            if (err) {
              reject(err)
            }
            resolve(results[0])
          })
        })

        return callback(null, {
          ativo: true,
          parceiro: parceiro.nome
        })
      } else {
        return callback(null, {
          ativo: false,
          parceiro: null
        })
      }


    } catch (error) {
      console.error(`Não foi possível validar as informações.${error} `)
      return callback(error, null)
    }
  }

  static getPerfil = (idUser, callback) => {
    const query = `SELECT perfil_url FROM usuario WHERE id = ?`;

    pool.query(query, [idUser], (err, results) => {
      if (err) {
        return callback(err, null);
      }

      if (!results.length || !results[0].perfil_url) {
        return callback("Foto não encontrada", null);
      }

      const caminho = path.join(__dirname, "../..", results[0].perfil_url);
      return callback(null, caminho);
    });
  };

  //Função para verificar se o WhatsApp do usuário está verificado
  //A variavel origem indica se a origem da requisição foi o APP ou o WhatsApp
  static async verificaWhats(fone, origem, idUser, callback) {
    try {
      const query = `SELECT * FROM usuario WHERE ${origem !== 'app' ? 'fone = ?' : 'id = ?'}`;
      const [usuario] = await new Promise((resolve, reject) => {
        pool.query(query, [origem === 'app' ? idUser : `+${fone}`], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      if (!usuario) return callback('nao_encontrado', null);
      if (usuario.whats_verificado == 0) return callback('nao_verificado', null);

      const result = await getUserData(usuario);
      return callback(null, result);
    } catch (error) {
      console.error(`Erro na verificação de WhatsApp: ${error}`);
      return callback(error, null);
    }
  }

  static async atualizaUsuario(idUser, callback) {
    try {
      const [usuario] = await new Promise((resolve, reject) => {
        pool.query('SELECT * FROM usuario WHERE id = ?', [idUser], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      if (!usuario) return callback('Usuário não encontrado', null);
      const result = await getUserData(usuario);
      return callback(null, result);
    } catch (error) {
      console.error(`Erro ao atualizar usuário: ${error}`);
      return callback(error, null);
    }
  }

  static async loginGoogle (email, nome, foto, callback) {
    try {
      const queryBusca = "SELECT * FROM usuario WHERE email = ?";
      const [rows] = await pool.promise().query(queryBusca, [email]);

      if (rows.length > 0) {
        const user = rows[0];
        const { token, userData } = await getUserData(user);
        return callback(null, { token, userData });
      }

      // Caso o usuário não exista, cria com base no fluxo padrão
      const novoUsuario = await criarUsuarioBase({ nome, email, fone: null, sexo: null, senha: null, foto });
      const { token, userData } = await getUserData(novoUsuario);

      return callback(null, { token, userData });
    } catch (err) {
      return callback(err);
    }
  };

}

//Criar lógica para excluir dados do BD

export default AuthModel;