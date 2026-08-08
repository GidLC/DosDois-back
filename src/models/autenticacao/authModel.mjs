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
import { JWT_EXPIRES } from "../../data/apiConfig.mjs";
import { incrementaUso } from "../../features/assinaturas/utils/IncrementaUso.mjs";
import { loadPlanFunction } from "../../middlewares/assinatura.mjs";
import { hashPassword, verifyPassword } from "../../data/security/passwordHash.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_PROFILE_IMAGE_BYTES = Number(process.env.MAX_PROFILE_IMAGE_BYTES ?? 2 * 1024 * 1024);
const ALLOWED_PROFILE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const APP_URL = 'https://dosdoisapp.com.br';

const hasExpectedImageSignature = (buffer, ext) => {
  if (['jpg', 'jpeg'].includes(ext)) {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (ext === 'png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (ext === 'webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  return false;
};

const getActiveInviteLink = async (codCasal) => {
  if (!codCasal) return null;

  const [vinculo] = await new Promise((resolve, reject) => {
    pool.query(
      'SELECT uuid FROM vinculos WHERE casal = ? AND ativo = 1 LIMIT 1',
      [codCasal],
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });

  return vinculo?.uuid
    ? `${APP_URL}/atribuicao/${codCasal}/${vinculo.uuid}`
    : null;
};

const getUserData = async (usuario, remember) => {
  //Verifica casal
  const [casal] = await new Promise((resolve, reject) => {
    const query = 'SELECT * FROM casal WHERE usuario_princ = ? OR usuario_sec = ?';
    pool.query(query, [usuario.id, usuario.id], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

  const plano = await loadPlanFunction(casal.cod_casal)
  console.log(plano)

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

  const linkVinculo = casal?.usuario_sec === null
    ? await getActiveInviteLink(casal.cod_casal)
    : null;

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
      link_vinculo: linkVinculo,
      plano,
      whatsPend,
      whats_verificado: usuario.whats_verificado,
      onboarding_concluido: usuario.onboarding_concluido,
    };

    const token = remember ? createToken(userData) : createToken(userData, JWT_EXPIRES)
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
    plano,
    whatsPend,
    whats_verificado: usuario.whats_verificado,
    onboarding_concluido: usuario.onboarding_concluido,
  };

  const token = remember ? createToken(userData) : createToken(userData, JWT_EXPIRES)
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
    ? await hashPassword(senha)
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
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal, padrao) VALUES("Despesas Diversas", 0, 10, 36, ?, 1);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal, cat_sistema) VALUES("*Ajuste*",0, 2, 36, ?, 1);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Salário", 1, 11, 38, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Rendimentos", 1, 12, 37, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal) VALUES("Presentes", 1, 13, 26, ?);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal, padrao) VALUES("Receitas Diversas", 1, 14, 31, ?, 1);
  INSERT INTO categoria_tr (nome, tipo, cor, icone, casal, cat_sistema) VALUES("*Ajuste*",1, 3, 37, ?, 1);
  `;

  await incrementaUso(codigoCasal, "categorias", 15)

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

  await incrementaUso(codigoCasal, "bancos")

  // Cria vínculo e envia notificações
  const uuid = crypto.randomUUID();
  const url = `${APP_URL}/atribuicao/${codigoCasal}/${uuid}`;

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
      await criarUsuarioBase({ nome, email, senha, fone, sexo, foto: null });
      return callback(null, "Usuário cadastrado com sucesso");
    } catch (error) {
      return callback({ message: `Erro ao cadastrar usuário. ${error}` }, null);
    }
  };


  //Realizar uma validação de vinculação mais segura, como solicitar o email do parceiro principal
  static vincCadastro = async (nome, email, senha, cod_casal, fone, sexo, uuid, callback) => {
    try {
      const senhaHash = await hashPassword(senha);

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

  static loginUsuario = async (email, senha, remember, callback) => {
    try {
      const [usuario] = await new Promise((resolve, reject) => {
        const query = 'SELECT * FROM usuario WHERE email = ?';
        pool.query(query, [email], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      if (!usuario) return callback('Usuário não encontrado', null);

      const senhaValidada = await verifyPassword(senha, usuario.senha);
      if (!senhaValidada.valid) return callback('Usuário não encontrado', null);

      if (senhaValidada.needsRehash) {
        const novoHash = await hashPassword(senha);
        await new Promise((resolve, reject) => {
          pool.query('UPDATE usuario SET senha = ? WHERE id = ?', [novoHash, usuario.id], (err, results) => {
            if (err) return reject(err);
            resolve(results);
          });
        });
      }

      await updateLastAccess(usuario.id);
      const result = await getUserData(usuario, remember);

      return callback(null, result);
    } catch (error) {
      console.error(`Erro no login: ${error}`);
      return callback(error, null);
    }
  }

  //Usado para trocar a senha no APP
  static gerarToken = async ({ fone, tipo }, callback) => {
    try {
      if (!['login', 'senha'].includes(tipo)) {
        return callback("Tipo de token inválido", null);
      }

      const token = tipo === "senha"
        ? crypto.randomBytes(32).toString('hex')
        : crypto.randomInt(100000, 1000000).toString();
      const uuid = tipo === "senha" ? crypto.randomUUID() : null; //Só cria UUID no caso de trocar a senha

      const data = new Date()
      const validade = new Date(data.getTime() + 30 * 60 * 1000).toISOString();
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
    console.log({fone, token, uuid, tipo})
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

      const idUsuario = temp[0].id_usuario

      await new Promise((resolve, reject) => {
        pool.query('UPDATE usuario SET whats_verificado = 1 WHERE id = ?', [idUsuario], (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });

      await new Promise((resolve, reject) => {
        pool.query('UPDATE senha_temp SET validade = NOW() WHERE id_usuario = ? AND token = ? AND tipo = ?', [idUsuario, token, tipo], (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });

      const [usuarioAtualizado] = await new Promise((resolve, reject) => {
        pool.query('SELECT * FROM usuario WHERE id = ?', [idUsuario], (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });

      const result = await getUserData(usuarioAtualizado, null)
      return callback(null, result)
    }
  };


  static mudaSenha = async (id, novaSenha, token, callback) => {
    const connection = await pool.promise().getConnection();
    try {
      await connection.beginTransaction();

      const [tokens] = await connection.query(
        `SELECT id_usuario
         FROM senha_temp
         WHERE id_usuario = ?
           AND token = ?
           AND tipo = 'senha'
           AND validade > NOW()
         ORDER BY validade DESC
         LIMIT 1
         FOR UPDATE`,
        [id, token],
      );

      if (!tokens.length) {
        await connection.rollback();
        return callback("Token inválido ou expirado", null);
      }

      const senhaHash = await hashPassword(novaSenha);

      await connection.query('UPDATE usuario SET senha = ? WHERE id = ?', [senhaHash, id]);
      await connection.query(
        `UPDATE senha_temp SET validade = NOW() WHERE id_usuario = ? AND token = ? AND tipo = 'senha'`,
        [id, token],
      );

      await connection.commit();

      return callback(null, "OK")
    } catch (error) {
      await connection.rollback();
      return callback(error, null)
    } finally {
      connection.release();
    }
  }

  static editUser = async (nome, email, fone, id, foto, senha, sexo, callback) => {
    const google = (senha && sexo) ? true : false
    const senhaHash = google && await hashPassword(senha);

    let caminhoFoto = null;

    if (foto) {
      const matches = foto.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        return callback(`Formato de imagem inválido`, null)
      }

      const ext = matches[1].toLowerCase();
      const buffer = Buffer.from(matches[2], "base64");

      if (!ALLOWED_PROFILE_IMAGE_EXTENSIONS.has(ext)) {
        return callback(`Formato de imagem não permitido`, null)
      }

      if (buffer.length > MAX_PROFILE_IMAGE_BYTES) {
        return callback(`Imagem maior que o limite permitido`, null)
      }

      if (!hasExpectedImageSignature(buffer, ext)) {
        return callback(`Conteúdo da imagem inválido`, null)
      }

      const nomeArquivo = `perfil_${id}_${Date.now()}.${ext}`;
      const uploadDir = path.join(__dirname, "../..", "uploads/perfis");
      fs.mkdirSync(uploadDir, { recursive: true });
      const caminho = path.join(uploadDir, nomeArquivo);

      fs.writeFileSync(caminho, buffer);
      caminhoFoto = `uploads/perfis/${nomeArquivo}`;
    }

    const fotoClause = caminhoFoto ? `, perfil_url = ?` : ``
    const query = `UPDATE usuario SET nome = ?, fone = ?${fotoClause}${google ? `, senha = ?, sexo = ?` : ` `}WHERE id = ?`

    let params = [nome, fone]

    if (caminhoFoto) params.push(String(caminhoFoto))
    if (google) params.push(senhaHash, sexo)
    params.push(id)

    pool.query(query, params, (err, results) => {
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

      const perfilUrl = String(results[0].perfil_url).replace(/^[/\\]+/, '');
      const caminho = path.join(__dirname, "../..", perfilUrl);
      return callback(null, caminho);
    });
  };

  //Função para verificar se o WhatsApp do usuário está verificado
  //A variavel origem indica se a origem da requisição foi o APP ou o WhatsApp
  static async verificaWhats(fone, origem, idUser, plano, callback) {
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

      const result = await getUserData(usuario, null, plano);
      return callback(null, result);
    } catch (error) {
      console.error(`Erro na verificação de WhatsApp: ${error}`);
      return callback(error, null);
    }
  }

  static async atualizaUsuario(idUser, plano, callback) {
    try {
      const [usuario] = await new Promise((resolve, reject) => {
        pool.query('SELECT * FROM usuario WHERE id = ?', [idUser], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      if (!usuario) return callback('Usuário não encontrado', null);

      const result = await getUserData(usuario, null, plano);
      return callback(null, result);

    } catch (error) {
      console.error(`Erro ao atualizar usuário: ${error}`);
      return callback(error, null);
    }
  }

  static async concluiOnboarding(idUser, callback) {
    try {
      await new Promise((resolve, reject) => {
        pool.query('UPDATE usuario SET onboarding_concluido = 1 WHERE id = ?', [idUser], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      const [usuario] = await new Promise((resolve, reject) => {
        pool.query('SELECT * FROM usuario WHERE id = ?', [idUser], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      if (!usuario) return callback('Usuário não encontrado', null);

      const result = await getUserData(usuario, null);
      return callback(null, result);
    } catch (error) {
      console.error(`Erro ao concluir onboarding: ${error}`);
      return callback(error, null);
    }
  }

  static async loginGoogle(email, nome, foto, plano, callback) {
    try {
      const queryBusca = "SELECT * FROM usuario WHERE email = ?";
      const [rows] = await pool.promise().query(queryBusca, [email]);

      if (rows.length > 0) {
        const user = rows[0];
        const { token, userData } = await getUserData(user, null, plano);
        return callback(null, { token, userData });
      }

      // Caso o usuário não exista, cria com base no fluxo padrão
      const novoUsuario = await criarUsuarioBase({ nome, email, fone: null, sexo: null, senha: null, foto });
      const { token, userData } = await getUserData(novoUsuario, null, plano);

      return callback(null, { token, userData });
    } catch (err) {
      return callback(err);
    }
  };

}

//Criar lógica para excluir dados do BD

export default AuthModel;
