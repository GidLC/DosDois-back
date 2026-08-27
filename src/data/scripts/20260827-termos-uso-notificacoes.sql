CREATE TABLE IF NOT EXISTS dosdois.termos_uso_notificacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  versao VARCHAR(40) NOT NULL,
  usuario INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  status ENUM('enviado', 'erro') NOT NULL,
  detalhe TEXT NULL,
  enviado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_termos_notificacao_versao_usuario (versao, usuario),
  KEY idx_termos_notificacao_status (status)
);
