-- Purchase dates let the expense calendar show when a card purchase happened,
-- independently of the invoice month and due date.
USE dosdois;
SET @schema_name = 'dosdois';

SET @add_data_compra_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE despesa ADD COLUMN data_compra DATE NULL AFTER fatura',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'despesa'
    AND COLUMN_NAME = 'data_compra'
);
PREPARE add_data_compra_stmt FROM @add_data_compra_sql;
EXECUTE add_data_compra_stmt;
DEALLOCATE PREPARE add_data_compra_stmt;

SET @add_valor_compra_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE despesa ADD COLUMN valor_compra DECIMAL(12,2) NULL AFTER data_compra',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'despesa'
    AND COLUMN_NAME = 'valor_compra'
);
PREPARE add_valor_compra_stmt FROM @add_valor_compra_sql;
EXECUTE add_valor_compra_stmt;
DEALLOCATE PREPARE add_valor_compra_stmt;

SET @add_id_compra_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE despesa ADD COLUMN id_compra CHAR(36) NULL AFTER valor_compra',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'despesa'
    AND COLUMN_NAME = 'id_compra'
);
PREPARE add_id_compra_stmt FROM @add_id_compra_sql;
EXECUTE add_id_compra_stmt;
DEALLOCATE PREPARE add_id_compra_stmt;

SET @add_data_compra_index_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX idx_despesa_data_compra ON despesa (data_compra)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'despesa'
    AND INDEX_NAME = 'idx_despesa_data_compra'
);
PREPARE add_data_compra_index_stmt FROM @add_data_compra_index_sql;
EXECUTE add_data_compra_index_stmt;
DEALLOCATE PREPARE add_data_compra_index_stmt;

SET @add_dia_compra_fixa_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE desp_fixas_cartao ADD COLUMN dia_compra TINYINT UNSIGNED NULL AFTER cartao',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'desp_fixas_cartao'
    AND COLUMN_NAME = 'dia_compra'
);
PREPARE add_dia_compra_fixa_stmt FROM @add_dia_compra_fixa_sql;
EXECUTE add_dia_compra_fixa_stmt;
DEALLOCATE PREPARE add_dia_compra_fixa_stmt;
