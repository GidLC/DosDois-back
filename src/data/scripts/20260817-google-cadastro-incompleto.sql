-- Migration: permite cadastro incompleto via Google sem quebrar WhatsApp.
-- Execute primeiro em staging/desenvolvimento e faca backup antes de producao.
--
-- Contexto:
-- - Cadastro comum continua enviando senha, fone e sexo.
-- - Cadastro Google nasce incompleto e pode nao ter senha, fone ou sexo.
-- - fone continua UNIQUE, mas passa a aceitar NULL. MySQL permite multiplos
--   NULL em indice UNIQUE, preservando unicidade para telefones preenchidos.

SET @schema_name = 'dosdois';

-- ---------------------------------------------------------------------------
-- Preflight: estes SELECTs nao alteram dados; use para inspecionar riscos.
-- ---------------------------------------------------------------------------

SELECT 'usuario.incompleto column exists' AS check_name, COUNT(*) AS total
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'usuario'
  AND COLUMN_NAME = 'incompleto';

SELECT 'usuario.fone empty strings' AS check_name, COUNT(*) AS total
FROM dosdois.usuario
WHERE fone = '';

SELECT 'usuario.fone duplicated non-null/non-empty values' AS check_name, COUNT(*) AS total
FROM (
  SELECT fone
  FROM dosdois.usuario
  WHERE fone IS NOT NULL AND fone <> ''
  GROUP BY fone
  HAVING COUNT(*) > 1
) duplicados;

-- ---------------------------------------------------------------------------
-- Schema alignment for incomplete Google users.
-- ---------------------------------------------------------------------------

SET @add_usuario_incompleto_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE dosdois.usuario ADD COLUMN incompleto tinyint NOT NULL DEFAULT 0 AFTER sexo',
    'SELECT ''usuario.incompleto ja existe'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'usuario'
    AND COLUMN_NAME = 'incompleto'
);

PREPARE add_usuario_incompleto_stmt FROM @add_usuario_incompleto_sql;
EXECUTE add_usuario_incompleto_stmt;
DEALLOCATE PREPARE add_usuario_incompleto_stmt;

SET @senha_nullable_sql = (
  SELECT IF(
    IS_NULLABLE = 'NO',
    'ALTER TABLE dosdois.usuario MODIFY COLUMN senha varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL',
    'SELECT ''usuario.senha ja aceita NULL'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'usuario'
    AND COLUMN_NAME = 'senha'
);

PREPARE senha_nullable_stmt FROM @senha_nullable_sql;
EXECUTE senha_nullable_stmt;
DEALLOCATE PREPARE senha_nullable_stmt;

SET @fone_nullable_sql = (
  SELECT IF(
    IS_NULLABLE = 'NO',
    'ALTER TABLE dosdois.usuario MODIFY COLUMN fone varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL',
    'SELECT ''usuario.fone ja aceita NULL'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'usuario'
    AND COLUMN_NAME = 'fone'
);

PREPARE fone_nullable_stmt FROM @fone_nullable_sql;
EXECUTE fone_nullable_stmt;
DEALLOCATE PREPARE fone_nullable_stmt;

SET @sexo_nullable_sql = (
  SELECT IF(
    IS_NULLABLE = 'NO',
    'ALTER TABLE dosdois.usuario MODIFY COLUMN sexo tinyint NULL',
    'SELECT ''usuario.sexo ja aceita NULL'' AS info'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'usuario'
    AND COLUMN_NAME = 'sexo'
);

PREPARE sexo_nullable_stmt FROM @sexo_nullable_sql;
EXECUTE sexo_nullable_stmt;
DEALLOCATE PREPARE sexo_nullable_stmt;
