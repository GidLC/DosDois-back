import { queryAsync } from '../queryAsync/queryAsync.mjs';

const log = (msg) => console.log(`[MIGRATION] ${msg}`);

async function run() {
  log('Iniciando migração de planos FREE...');

  const [planFree] = await queryAsync(
    `SELECT id FROM planos WHERE codigo = 'free'`
  );

  if (!planFree) {
    throw new Error('Plano FREE não encontrado');
  }

  const casais = await queryAsync(
    `SELECT * FROM casal`
  );


  for (const casal of casais) {
    const casalId = casal.cod_casal;

    // 1️⃣ Verifica assinatura
    const [assinatura] = await queryAsync(
      `SELECT id FROM assinaturas WHERE casal = ?`,
      [casalId]
    );

    if (!assinatura) {
      await queryAsync(
        `INSERT INTO assinaturas (casal, plano_id, status, inicio)
         VALUES (?, ?, 'ativa', CURDATE())`,
        [casalId, planFree.id]
      );

      log(`Assinatura FREE criada para casal ${casalId}`);
    }

    // 2️⃣ Contadores de uso
    await migrateUsage(casalId);
  }

  log('Migração concluída com sucesso.');
  process.exit(0);
}

async function migrateUsage(casal) {
  const modulos = [
    { name: 'bancos', table: 'banco' },
    { name: 'categorias', table: 'categoria_tr' },
    { name: 'cartoes', table: 'cartoes' },
    { name: 'tags', table: 'tags' },
    { name: 'objetivos', table: 'objetivo'}
  ];

  for (const m of modulos) {
    const [modulo] = await queryAsync(
        `SELECT id FROM modulos WHERE nome = ?`,
        [m.name]
    )

    let queryMod = `SELECT COUNT(*) AS total FROM ${m.table} WHERE casal = ?`

    //Só conta os bancos que estiverem ativos desconsiderando os arquivados
    if (m.name == "bancos") {
      queryMod = queryMod += `AND arquivo = 0`
    }

    //Conta apenas os obejtivos que estiverem em andamento
    if (m.name == "objetivos") {
      queryMod = queryMod += `AND status = 0`
    }

    const [row] = await queryAsync(
      queryMod,
      [casal]
    );

    await queryAsync(
      `INSERT INTO contador_uso (casal, modulo, uso)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE uso = VALUES(uso)`,
      [casal, modulo.id, row.total]
    );

    log(`Casal ${casal} → ${m.nome}: ${row.total}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
