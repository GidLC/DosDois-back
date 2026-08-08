SET @schema_name = DATABASE();

SET @add_column_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE cartoes ADD COLUMN padrao TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'cartoes'
    AND COLUMN_NAME = 'padrao'
);

PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

UPDATE cartoes c
JOIN (
  SELECT usuario, MIN(id_cartao) AS id_cartao
  FROM cartoes
  WHERE arquivo = 0
  GROUP BY usuario
) primeiro ON primeiro.id_cartao = c.id_cartao
SET c.padrao = 1
WHERE c.arquivo = 0
  AND NOT EXISTS (
    SELECT 1
    FROM cartoes existente
    WHERE existente.usuario = c.usuario
      AND existente.arquivo = 0
      AND existente.padrao = 1
  );
