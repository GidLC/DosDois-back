CREATE TABLE IF NOT EXISTS dosdois.whatsapp_envios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario INT NOT NULL,
  senha_temp INT NULL,
  finalidade ENUM('cadastro_validacao', 'login_validacao', 'recuperacao_senha', 'outro') NOT NULL DEFAULT 'outro',
  fone VARCHAR(30) NOT NULL,
  mensagem TEXT NOT NULL,
  status ENUM('pendente', 'enviado', 'erro') NOT NULL DEFAULT 'pendente',
  provider_message_id VARCHAR(255) NULL,
  resposta_json JSON NULL,
  erro TEXT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_whatsapp_envios_usuario (usuario),
  KEY idx_whatsapp_envios_status (status),
  KEY idx_whatsapp_envios_finalidade (finalidade),
  KEY idx_whatsapp_envios_senha_temp (senha_temp)
);
