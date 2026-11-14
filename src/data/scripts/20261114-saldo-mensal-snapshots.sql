CREATE TABLE IF NOT EXISTS saldo_mensal (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    casal VARCHAR(64) NOT NULL,
    banco_id BIGINT UNSIGNED NOT NULL,
    ano SMALLINT UNSIGNED NOT NULL,
    mes TINYINT UNSIGNED NOT NULL,
    saldo DECIMAL(15, 2) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_saldo_mensal_casal_banco_periodo (casal, banco_id, ano, mes),
    KEY idx_saldo_mensal_periodo (casal, ano, mes)
);
