#!/usr/bin/env node
import "dotenv/config";
import mysql from "mysql2/promise";
import { host, user, password, database, port } from "../../config/dbConfig.mjs";

const args = process.argv.slice(2);

const usage = `
Uso:
  node src/data/scripts/excluirUsuario.mjs --email pessoa@email.com
  node src/data/scripts/excluirUsuario.mjs --id 123
  node src/data/scripts/excluirUsuario.mjs --casal abc123

Por seguranca, o script roda em dry-run por padrao.
Para excluir de verdade:
  node src/data/scripts/excluirUsuario.mjs --email pessoa@email.com --execute

Opcoes:
  --email <email>     Localiza o usuario pelo email.
  --id <id>           Localiza o usuario pelo id.
  --casal <codigo>    Exclui diretamente o casal informado.
  --execute           Executa os DELETEs. Sem isso, apenas mostra contagens.
  --yes               Confirma sem prompt interativo.
  --help              Mostra esta ajuda.
`;

const getArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : "";
};

const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const target = {
  email: getArg("--email"),
  id: getArg("--id"),
  casal: getArg("--casal"),
};
const execute = flags.has("--execute");
const assumeYes = flags.has("--yes");

if (flags.has("--help")) {
  console.log(usage.trim());
  process.exit(0);
}

const targetsCount = Object.values(target).filter(Boolean).length;
if (targetsCount !== 1) {
  console.error("Informe exatamente um alvo: --email, --id ou --casal.");
  console.error(usage.trim());
  process.exit(1);
}

const qi = (identifier) => {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Identificador invalido: ${identifier}`);
  }
  return `\`${identifier}\``;
};

const tableName = (table) => `${qi(database)}.${qi(table)}`;

const hasTable = async (connection, table) => {
  const [rows] = await connection.query(
    `
      SELECT 1 AS found
      FROM information_schema.tables
      WHERE table_schema = ? AND table_name = ?
      LIMIT 1
    `,
    [database, table],
  );
  return rows.length > 0;
};

const findCasalByTarget = async (connection) => {
  if (target.casal) {
    const [rows] = await connection.query(
      `SELECT cod_casal FROM ${tableName("casal")} WHERE cod_casal = ? LIMIT 1`,
      [target.casal],
    );
    if (!rows.length) throw new Error(`Casal nao encontrado: ${target.casal}`);
    return rows[0].cod_casal;
  }

  const where = target.email ? "email = ?" : "id = ?";
  const param = target.email ? target.email.trim().toLowerCase() : Number(target.id);
  if (!target.email && !Number.isInteger(param)) {
    throw new Error("--id precisa ser um numero inteiro.");
  }

  const [users] = await connection.query(
    `SELECT id, email, casal FROM ${tableName("usuario")} WHERE ${where} LIMIT 1`,
    [param],
  );
  if (!users.length) throw new Error("Usuario nao encontrado.");

  const userRow = users[0];
  const [couples] = await connection.query(
    `
      SELECT cod_casal
      FROM ${tableName("casal")}
      WHERE usuario_princ = ? OR usuario_sec = ? OR cod_casal = ?
      LIMIT 1
    `,
    [userRow.id, userRow.id, userRow.casal],
  );

  return couples[0]?.cod_casal || userRow.casal;
};

const getUsersFromCasal = async (connection, casal) => {
  const [rows] = await connection.query(
    `
      SELECT DISTINCT u.id, u.nome, u.email, u.fone
      FROM ${tableName("usuario")} u
      LEFT JOIN ${tableName("casal")} c
        ON c.cod_casal = u.casal
        OR c.usuario_princ = u.id
        OR c.usuario_sec = u.id
      WHERE u.casal = ? OR c.cod_casal = ?
      ORDER BY u.id
    `,
    [casal, casal],
  );
  return rows;
};

const hasRowsBySql = async (connection, sql, params) => {
  const [rows] = await connection.query(sql, params);
  return Number(rows[0]?.total || 0);
};

const buildDeletePlan = (casal, userIds) => {
  const userParams = userIds.length ? userIds : [-1];
  const userPlaceholders = userParams.map(() => "?").join(", ");

  return [
    {
      table: "cartao_faturas",
      where: `cartao_id IN (SELECT id_cartao FROM ${tableName("cartoes")} WHERE casal = ? OR usuario IN (${userPlaceholders}))`,
      params: [casal, ...userParams],
    },
    { table: "desp_fixas_cartao", where: `casal = ? OR usuario IN (${userPlaceholders})`, params: [casal, ...userParams] },
    { table: "despesa", where: `casal = ? OR usuario IN (${userPlaceholders})`, params: [casal, ...userParams] },
    { table: "despesas_fixas", where: `casal = ? OR usuario IN (${userPlaceholders})`, params: [casal, ...userParams] },
    { table: "receita", where: `casal = ? OR usuario IN (${userPlaceholders})`, params: [casal, ...userParams] },
    { table: "receitas_fixas", where: `casal = ? OR usuario IN (${userPlaceholders})`, params: [casal, ...userParams] },
    { table: "transferencias", where: `casal = ? OR usuario IN (${userPlaceholders}) OR usuario_criador IN (${userPlaceholders})`, params: [casal, ...userParams, ...userParams] },
    { table: "log", where: `usuario IN (${userPlaceholders})`, params: userParams },
    { table: "senha_temp", where: `id_usuario IN (${userPlaceholders})`, params: userParams },
    { table: "config_casal", where: "casal = ?", params: [casal] },
    { table: "aporte_objetivo", where: "casal = ?", params: [casal] },
    { table: "objetivo", where: "casal = ?", params: [casal] },
    {
      table: "assinatura_eventos_conversao",
      where: `usuario IN (${userPlaceholders}) OR assinatura_id IN (SELECT id FROM ${tableName("assinaturas")} WHERE casal = ?)`,
      params: [...userParams, casal],
    },
    { table: "assinaturas", where: "casal = ?", params: [casal] },
    { table: "contador_uso", where: "casal = ?", params: [casal] },
    { table: "tags", where: "casal = ?", params: [casal] },
    { table: "cartoes", where: `casal = ? OR usuario IN (${userPlaceholders})`, params: [casal, ...userParams] },
    { table: "banco", where: `casal = ? OR usuario IN (${userPlaceholders})`, params: [casal, ...userParams] },
    { table: "categoria_tr", where: "casal = ?", params: [casal] },
    { table: "vinculos", where: "casal = ?", params: [casal] },
    { table: "casal", where: "cod_casal = ?", params: [casal] },
    { table: "usuario", where: `id IN (${userPlaceholders}) OR casal = ?`, params: [...userParams, casal] },
  ];
};

const confirmExecution = async (casal) => {
  if (!execute || assumeYes) return;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Ambiente nao interativo. Use --yes junto com --execute se tiver certeza.");
  }

  process.stdout.write(`Digite EXCLUIR ${casal} para confirmar: `);
  const answer = await new Promise((resolve) => {
    process.stdin.once("data", (data) => resolve(String(data).trim()));
  });

  if (answer !== `EXCLUIR ${casal}`) {
    throw new Error("Confirmacao invalida. Nenhum dado foi excluido.");
  }
};

const main = async () => {
  const connection = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    multipleStatements: false,
  });

  try {
    const casal = await findCasalByTarget(connection);
    const users = await getUsersFromCasal(connection, casal);
    const userIds = users.map((row) => Number(row.id)).filter(Number.isInteger);

    if (!userIds.length) {
      throw new Error(`Nenhum usuario encontrado para o casal ${casal}.`);
    }

    console.log(`${execute ? "EXECUCAO REAL" : "DRY-RUN"} - exclusao do casal ${casal}`);
    console.table(users);

    const plan = buildDeletePlan(casal, userIds);
    const preview = [];

    for (const item of plan) {
      if (!(await hasTable(connection, item.table))) {
        preview.push({ tabela: item.table, linhas: "tabela ausente" });
        continue;
      }

      const total = await hasRowsBySql(
        connection,
        `SELECT COUNT(*) AS total FROM ${tableName(item.table)} WHERE ${item.where}`,
        item.params,
      );
      preview.push({ tabela: item.table, linhas: total });
    }

    console.table(preview);

    if (!execute) {
      console.log("Dry-run concluido. Rode novamente com --execute para excluir.");
      return;
    }

    await confirmExecution(casal);
    await connection.beginTransaction();

    const deleted = [];
    try {
      for (const item of plan) {
        if (!(await hasTable(connection, item.table))) continue;

        const [result] = await connection.query(
          `DELETE FROM ${tableName(item.table)} WHERE ${item.where}`,
          item.params,
        );
        deleted.push({ tabela: item.table, linhas: result.affectedRows });
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    console.table(deleted);
    console.log(`Exclusao concluida para o casal ${casal}.`);
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
