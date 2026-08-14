-- Prepara o modulo de assinaturas para multiplos provedores de pagamento.
-- Execute em staging antes de producao e faca backup do banco.

SET @schema_name = 'dosdois';

SET @created_at_type = (
  SELECT DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'created_at'
);
SET @sql = IF(
  @created_at_type = 'date',
  'ALTER TABLE dosdois.assinaturas MODIFY created_at DATETIME NULL',
  'SELECT ''assinaturas.created_at ja esta como datetime ou equivalente'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @updated_at_type = (
  SELECT DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'updated_at'
);
SET @sql = IF(
  @updated_at_type = 'date',
  'ALTER TABLE dosdois.assinaturas MODIFY updated_at DATETIME NULL',
  'SELECT ''assinaturas.updated_at ja esta como datetime ou equivalente'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @status_type = (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'status'
);

SET @sql = IF(
  @status_type NOT LIKE '%criando%',
  'ALTER TABLE dosdois.assinaturas MODIFY status ENUM(''ativa'',''cancelada'',''expirada'',''pausada'',''pendente'',''criando'') NOT NULL',
  'SELECT ''assinaturas.status ja possui criando'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'billing_provider'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE dosdois.assinaturas ADD COLUMN billing_provider ENUM(''mercado_pago'',''asaas'') NOT NULL DEFAULT ''mercado_pago'' AFTER mp_preapproval_id',
  'SELECT ''assinaturas.billing_provider ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'provider_subscription_id'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE dosdois.assinaturas ADD COLUMN provider_subscription_id VARCHAR(120) NULL AFTER billing_provider',
  'SELECT ''assinaturas.provider_subscription_id ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'provider_checkout_id'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE dosdois.assinaturas ADD COLUMN provider_checkout_id VARCHAR(120) NULL AFTER provider_subscription_id',
  'SELECT ''assinaturas.provider_checkout_id ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'provider_external_reference'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE dosdois.assinaturas ADD COLUMN provider_external_reference VARCHAR(200) NULL AFTER provider_checkout_id',
  'SELECT ''assinaturas.provider_external_reference ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'provider_customer_id'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE dosdois.assinaturas ADD COLUMN provider_customer_id VARCHAR(120) NULL AFTER provider_subscription_id',
  'SELECT ''assinaturas.provider_customer_id ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'provider_payment_id'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE dosdois.assinaturas ADD COLUMN provider_payment_id VARCHAR(120) NULL AFTER provider_customer_id',
  'SELECT ''assinaturas.provider_payment_id ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'provider_status'
);
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE dosdois.assinaturas ADD COLUMN provider_status VARCHAR(80) NULL AFTER provider_payment_id',
  'SELECT ''assinaturas.provider_status ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND INDEX_NAME = 'idx_assinaturas_provider_subscription'
);
SET @sql = IF(
  @index_exists = 0,
  'CREATE INDEX idx_assinaturas_provider_subscription ON dosdois.assinaturas (billing_provider, provider_subscription_id)',
  'SELECT ''idx_assinaturas_provider_subscription ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND INDEX_NAME = 'idx_assinaturas_provider_reference'
);
SET @sql = IF(
  @index_exists = 0,
  'CREATE INDEX idx_assinaturas_provider_reference ON dosdois.assinaturas (billing_provider, provider_external_reference)',
  'SELECT ''idx_assinaturas_provider_reference ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND INDEX_NAME = 'idx_assinaturas_provider_customer'
);
SET @sql = IF(
  @index_exists = 0,
  'CREATE INDEX idx_assinaturas_provider_customer ON dosdois.assinaturas (billing_provider, provider_customer_id)',
  'SELECT ''idx_assinaturas_provider_customer ja existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
