-- Migration: align production schema with development snapshot from 2026-08-12.
-- Source dumps compared:
--   - desenvolvimento agora.sql
--   - producao agora.sql
--
-- Safe order:
--   1. Backup production.
--   2. Run the preflight SELECTs below and inspect non-empty results.
--   3. Apply this script on production.
--   4. Run app smoke tests: signup/login, offers/subscription upgrade, transfers,
--      free-plan limits, and chart gating.

SET @schema_name = 'dosdois';

-- ---------------------------------------------------------------------------
-- Preflight checks for differences that narrow existing production data.
-- These are intentionally not applied automatically in this migration.
-- ---------------------------------------------------------------------------

SELECT 'cartoes.casal values longer than 45 chars' AS check_name, COUNT(*) AS total
FROM dosdois.cartoes
WHERE CHAR_LENGTH(casal) > 45;

SELECT 'usuario.fone NULL values' AS check_name, COUNT(*) AS total
FROM dosdois.usuario
WHERE fone IS NULL;

SELECT 'planos_limites.modulo without matching modulos.id' AS check_name, COUNT(*) AS total
FROM dosdois.planos_limites pl
LEFT JOIN dosdois.modulos m ON m.id = pl.modulo
WHERE m.id IS NULL;

-- Development has cartoes.casal as varchar(45), production has varchar(255).
-- Only run manually if the first preflight count is 0:
-- ALTER TABLE dosdois.cartoes MODIFY COLUMN casal varchar(45) NOT NULL;

-- Development has usuario.fone as NOT NULL using utf8mb4_general_ci, production
-- allows NULL. Do not force this before validating Google/signup flows and data.
-- Only run manually if the second preflight count is 0 and the app requires it:
-- ALTER TABLE dosdois.usuario
--   MODIFY COLUMN fone varchar(20)
--   CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;

-- Development has tinyint instead of tinyint(1). MySQL 8 treats display width as
-- deprecated metadata, so no production change is required for usuario.onboarding_concluido.

-- ---------------------------------------------------------------------------
-- New conversion-event table used by subscription/acquisition telemetry.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dosdois.assinatura_eventos_conversao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  evento VARCHAR(80) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'backend',
  contexto VARCHAR(80) NULL,
  offer_id VARCHAR(80) NULL,
  casal INT NULL,
  usuario INT NULL,
  assinatura_id BIGINT NULL,
  mp_preapproval_id VARCHAR(120) NULL,
  status VARCHAR(60) NULL,
  metadata_json TEXT NULL,
  user_agent VARCHAR(255) NULL,
  ip_hash CHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ass_conv_evento_created (evento, created_at),
  INDEX idx_ass_conv_casal_created (casal, created_at),
  INDEX idx_ass_conv_usuario_created (usuario, created_at),
  INDEX idx_ass_conv_offer_created (offer_id, created_at),
  INDEX idx_ass_conv_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Benefits tables used by app/site plan-offer presentation.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dosdois.beneficios (
  id int NOT NULL AUTO_INCREMENT,
  codigo varchar(80) NOT NULL,
  modulo_id int DEFAULT NULL,
  titulo varchar(120) NOT NULL,
  descricao_curta varchar(255) DEFAULT NULL,
  descricao_longa text,
  icone varchar(80) DEFAULT NULL,
  categoria varchar(60) DEFAULT NULL,
  ativo tinyint(1) NOT NULL DEFAULT '1',
  ordem int NOT NULL DEFAULT '0',
  criado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_beneficios_codigo (codigo),
  KEY idx_beneficios_modulo (modulo_id),
  CONSTRAINT fk_beneficios_modulo FOREIGN KEY (modulo_id) REFERENCES dosdois.modulos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dosdois.beneficios_contextos (
  id int NOT NULL AUTO_INCREMENT,
  beneficio_id int NOT NULL,
  contexto varchar(80) NOT NULL,
  titulo_override varchar(120) DEFAULT NULL,
  descricao_override varchar(255) DEFAULT NULL,
  ordem int NOT NULL DEFAULT '0',
  ativo tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (id),
  UNIQUE KEY uq_beneficio_contexto (beneficio_id, contexto),
  CONSTRAINT fk_beneficios_contextos_beneficio FOREIGN KEY (beneficio_id) REFERENCES dosdois.beneficios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dosdois.planos_beneficios (
  id int NOT NULL AUTO_INCREMENT,
  plano_id int NOT NULL,
  beneficio_id int NOT NULL,
  incluido tinyint(1) NOT NULL DEFAULT '1',
  destaque tinyint(1) NOT NULL DEFAULT '0',
  valor_texto varchar(80) DEFAULT NULL,
  ordem int NOT NULL DEFAULT '0',
  ativo tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (id),
  UNIQUE KEY uq_plano_beneficio (plano_id, beneficio_id),
  KEY fk_planos_beneficios_beneficio (beneficio_id),
  CONSTRAINT fk_planos_beneficios_beneficio FOREIGN KEY (beneficio_id) REFERENCES dosdois.beneficios (id),
  CONSTRAINT fk_planos_beneficios_plano FOREIGN KEY (plano_id) REFERENCES dosdois.planos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- transferencias.usuario_criador added by current transfer model.
-- ---------------------------------------------------------------------------

SET @add_transfer_usuario_criador_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE dosdois.transferencias ADD COLUMN usuario_criador int DEFAULT NULL AFTER usuario',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'transferencias'
    AND COLUMN_NAME = 'usuario_criador'
);

PREPARE add_transfer_usuario_criador_stmt FROM @add_transfer_usuario_criador_sql;
EXECUTE add_transfer_usuario_criador_stmt;
DEALLOCATE PREPARE add_transfer_usuario_criador_stmt;

-- ---------------------------------------------------------------------------
-- Fix planos_limites foreign key: production points fk_limite_modulos to id;
-- development points it to modulo, which matches the module-limit model.
-- ---------------------------------------------------------------------------

SET @drop_fk_limite_modulos_sql = (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE dosdois.planos_limites DROP FOREIGN KEY fk_limite_modulos',
    'SELECT 1'
  )
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'planos_limites'
    AND CONSTRAINT_NAME = 'fk_limite_modulos'
);

PREPARE drop_fk_limite_modulos_stmt FROM @drop_fk_limite_modulos_sql;
EXECUTE drop_fk_limite_modulos_stmt;
DEALLOCATE PREPARE drop_fk_limite_modulos_stmt;

SET @add_fk_limite_modulos_idx_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE dosdois.planos_limites ADD INDEX fk_limite_modulos_idx (modulo)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'planos_limites'
    AND INDEX_NAME = 'fk_limite_modulos_idx'
);

PREPARE add_fk_limite_modulos_idx_stmt FROM @add_fk_limite_modulos_idx_sql;
EXECUTE add_fk_limite_modulos_idx_stmt;
DEALLOCATE PREPARE add_fk_limite_modulos_idx_stmt;

SET @add_fk_limite_modulos_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE dosdois.planos_limites ADD CONSTRAINT fk_limite_modulos FOREIGN KEY (modulo) REFERENCES dosdois.modulos (id)',
    'SELECT 1'
  )
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND TABLE_NAME = 'planos_limites'
    AND CONSTRAINT_NAME = 'fk_limite_modulos'
);

PREPARE add_fk_limite_modulos_stmt FROM @add_fk_limite_modulos_sql;
EXECUTE add_fk_limite_modulos_stmt;
DEALLOCATE PREPARE add_fk_limite_modulos_stmt;

-- ---------------------------------------------------------------------------
-- Seed/update feature modules and plan benefits.
-- This intentionally uses business keys (nome/codigo), not dump IDs.
-- ---------------------------------------------------------------------------

START TRANSACTION;

INSERT INTO dosdois.modulos (nome, tipo, descricao)
VALUES
  ('sem_anuncios', 'feature', 'Remove propagandas da experiencia do app.'),
  ('whatsapp', 'feature', 'Libera o assistente Dodo no WhatsApp.'),
  ('fechamento_mensal', 'feature', 'Libera a rotina de fechamento mensal do casal.'),
  ('graficos', 'feature', 'Libera analises e graficos completos.')
ON DUPLICATE KEY UPDATE
  tipo = VALUES(tipo),
  descricao = VALUES(descricao);

INSERT INTO dosdois.beneficios
  (codigo, modulo_id, titulo, descricao_curta, descricao_longa, icone, categoria, ativo, ordem)
VALUES
  (
    'sem_anuncios',
    (SELECT id FROM dosdois.modulos WHERE nome = 'sem_anuncios' LIMIT 1),
    'Sem propagandas',
    'Use o DosDois com uma experiencia mais limpa e focada.',
    'Remove propagandas das principais telas para deixar a rotina financeira do casal mais fluida.',
    'ban',
    'experiencia',
    1,
    10
  ),
  (
    'dodo_whatsapp',
    (SELECT id FROM dosdois.modulos WHERE nome = 'whatsapp' LIMIT 1),
    'Dodo no WhatsApp',
    'Registre e consulte movimentacoes direto pelo WhatsApp.',
    'Libera o assistente Dodo para facilitar lancamentos, consultas e lembretes na rotina do casal.',
    'logo-whatsapp',
    'automacao',
    1,
    20
  ),
  (
    'limites_maiores',
    NULL,
    'Mais espaco para organizar tudo',
    'Mais bancos, categorias, tags, objetivos e cartoes para o casal.',
    'Amplia os limites do plano Free para organizar mais contas, metas e cartoes conforme a vida financeira cresce.',
    'layers',
    'limites',
    1,
    30
  ),
  (
    'fechamento_mensal',
    (SELECT id FROM dosdois.modulos WHERE nome = 'fechamento_mensal' LIMIT 1),
    'Fechamento mensal do casal',
    'Revise o mes, combine ajustes e acompanhe o progresso juntos.',
    'Libera uma rotina dedicada para revisar receitas, despesas, saldos e combinados do mes.',
    'calendar-check',
    'planejamento',
    1,
    40
  ),
  (
    'graficos_completos',
    (SELECT id FROM dosdois.modulos WHERE nome = 'graficos' LIMIT 1),
    'Todos os graficos do app',
    'Acompanhe a evolucao financeira com mais clareza.',
    'Libera visualizacoes e analises para entender melhor para onde o dinheiro do casal esta indo.',
    'bar-chart',
    'analise',
    1,
    50
  )
ON DUPLICATE KEY UPDATE
  modulo_id = VALUES(modulo_id),
  titulo = VALUES(titulo),
  descricao_curta = VALUES(descricao_curta),
  descricao_longa = VALUES(descricao_longa),
  icone = VALUES(icone),
  categoria = VALUES(categoria),
  ativo = VALUES(ativo),
  ordem = VALUES(ordem);

INSERT INTO dosdois.planos_beneficios
  (plano_id, beneficio_id, incluido, destaque, valor_texto, ordem, ativo)
SELECT
  p.id,
  b.id,
  1,
  CASE
    WHEN b.codigo IN ('dodo_whatsapp', 'limites_maiores', 'fechamento_mensal') THEN 1
    ELSE 0
  END,
  CASE
    WHEN b.codigo = 'limites_maiores' THEN 'Mais limites'
    ELSE NULL
  END,
  b.ordem,
  1
FROM dosdois.planos p
JOIN dosdois.beneficios b
WHERE LOWER(p.codigo) IN ('premium', 'advanced')
  AND b.codigo IN (
    'sem_anuncios',
    'dodo_whatsapp',
    'limites_maiores',
    'fechamento_mensal',
    'graficos_completos'
  )
ON DUPLICATE KEY UPDATE
  incluido = VALUES(incluido),
  destaque = VALUES(destaque),
  valor_texto = VALUES(valor_texto),
  ordem = VALUES(ordem),
  ativo = VALUES(ativo);

INSERT INTO dosdois.beneficios_contextos
  (beneficio_id, contexto, titulo_override, descricao_override, ordem, ativo)
SELECT b.id, ctx.contexto, ctx.titulo_override, ctx.descricao_override, ctx.ordem, 1
FROM dosdois.beneficios b
JOIN (
  SELECT 'dodo_whatsapp' codigo, 'upgrade_whatsapp' contexto, 'Dodo no WhatsApp' titulo_override, 'Lance gastos, consulte saldos e acompanhe a rotina sem abrir o app.' descricao_override, 10 ordem
  UNION ALL SELECT 'limites_maiores', 'upgrade_limites', 'Mais espaco para cadastrar', 'Cadastre mais bancos, categorias, tags, objetivos e cartoes conforme o casal evolui.', 10
  UNION ALL SELECT 'fechamento_mensal', 'upgrade_fechamento', 'Fechamento mensal do casal', 'Revise o mes com uma visao propria para assinantes.', 10
  UNION ALL SELECT 'sem_anuncios', 'checkout', 'Sem propagandas', 'Experiencia mais limpa para acompanhar as financas.', 10
  UNION ALL SELECT 'dodo_whatsapp', 'checkout', 'Dodo no WhatsApp', 'Automacao para facilitar registros e consultas.', 20
  UNION ALL SELECT 'limites_maiores', 'checkout', 'Mais limites no app', 'Mais bancos, categorias, tags, objetivos e cartoes.', 30
  UNION ALL SELECT 'fechamento_mensal', 'checkout', 'Fechamento mensal', 'Uma rotina para revisar o mes do casal.', 40
  UNION ALL SELECT 'graficos_completos', 'checkout', 'Graficos completos', 'Mais clareza para entender a vida financeira.', 50
  UNION ALL SELECT 'sem_anuncios', 'site_pricing', 'Sem propagandas', 'Mais foco para organizar a rotina financeira.', 10
  UNION ALL SELECT 'dodo_whatsapp', 'site_pricing', 'Dodo no WhatsApp', 'Registros e consultas direto pelo WhatsApp.', 20
  UNION ALL SELECT 'limites_maiores', 'site_pricing', 'Bancos, categorias, tags, objetivos e cartoes ampliados', 'Mais liberdade para organizar todos os detalhes do casal.', 30
  UNION ALL SELECT 'fechamento_mensal', 'site_pricing', 'Fechamento mensal do casal', 'Revisao mensal para alinhar combinados e proximos passos.', 40
  UNION ALL SELECT 'graficos_completos', 'site_pricing', 'Todos os graficos do app', 'Analises para enxergar melhor o dinheiro do casal.', 50
) ctx ON ctx.codigo = b.codigo
ON DUPLICATE KEY UPDATE
  titulo_override = VALUES(titulo_override),
  descricao_override = VALUES(descricao_override),
  ordem = VALUES(ordem),
  ativo = VALUES(ativo);

COMMIT;

-- Optional post-checks.
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME IN (
    'assinatura_eventos_conversao',
    'beneficios',
    'beneficios_contextos',
    'planos_beneficios'
  )
ORDER BY TABLE_NAME;

SELECT CONSTRAINT_NAME, TABLE_NAME
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = @schema_name
  AND TABLE_NAME = 'planos_limites'
  AND CONSTRAINT_NAME = 'fk_limite_modulos';
