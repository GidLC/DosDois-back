-- Base para campanhas de comunicacao e Premium de cortesia.
-- Execute primeiro em staging/backup. As tabelas sao genericas para o painel admin.

SET @schema_name = 'dosdois';

CREATE TABLE IF NOT EXISTS dosdois.comunicacao_campanhas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  objetivo VARCHAR(255) NULL,
  canal ENUM('email','whatsapp','in_app','multi') NOT NULL DEFAULT 'email',
  publico VARCHAR(255) NULL,
  status ENUM('rascunho','ativa','pausada','encerrada') NOT NULL DEFAULT 'rascunho',
  assunto VARCHAR(180) NULL,
  corpo_texto MEDIUMTEXT NULL,
  corpo_html MEDIUMTEXT NULL,
  cta_label VARCHAR(80) NULL,
  cta_url VARCHAR(500) NULL,
  oferta_codigo VARCHAR(80) NULL,
  meses_premium INT NULL,
  criado_por VARCHAR(120) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_comunicacao_campanhas_codigo (codigo),
  KEY idx_comunicacao_campanhas_status (status),
  KEY idx_comunicacao_campanhas_canal (canal)
);

CREATE TABLE IF NOT EXISTS dosdois.comunicacao_destinatarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campanha_id BIGINT UNSIGNED NOT NULL,
  usuario INT NOT NULL,
  casal VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  fone VARCHAR(30) NULL,
  segmento VARCHAR(120) NULL,
  status ENUM('pendente','enviado','erro','ignorado') NOT NULL DEFAULT 'pendente',
  detalhe TEXT NULL,
  enviado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_comunicacao_destinatario_campanha_usuario (campanha_id, usuario),
  KEY idx_comunicacao_destinatarios_status (status),
  KEY idx_comunicacao_destinatarios_usuario (usuario),
  KEY idx_comunicacao_destinatarios_casal (casal),
  CONSTRAINT fk_comunicacao_destinatarios_campanha
    FOREIGN KEY (campanha_id) REFERENCES dosdois.comunicacao_campanhas (id)
);

CREATE TABLE IF NOT EXISTS dosdois.premium_cortesia_concessoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campanha_id BIGINT UNSIGNED NOT NULL,
  usuario INT NOT NULL,
  casal VARCHAR(255) NOT NULL,
  assinatura_id INT NULL,
  plano_id INT NOT NULL,
  meses INT NOT NULL,
  inicio DATE NOT NULL,
  fim DATE NOT NULL,
  status ENUM('ativa','expirada','cancelada') NOT NULL DEFAULT 'ativa',
  origem VARCHAR(120) NOT NULL DEFAULT 'campanha_recuperacao',
  observacao VARCHAR(500) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_premium_cortesia_campanha_usuario (campanha_id, usuario),
  KEY idx_premium_cortesia_casal_status (casal, status),
  KEY idx_premium_cortesia_fim_status (fim, status),
  CONSTRAINT fk_premium_cortesia_campanha
    FOREIGN KEY (campanha_id) REFERENCES dosdois.comunicacao_campanhas (id)
);

SET @billing_provider_type = (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'assinaturas'
    AND COLUMN_NAME = 'billing_provider'
);

SET @sql = IF(
  @billing_provider_type IS NOT NULL AND @billing_provider_type NOT LIKE '%promocional%',
  'ALTER TABLE dosdois.assinaturas MODIFY billing_provider ENUM(''mercado_pago'',''asaas'',''promocional'') NOT NULL DEFAULT ''mercado_pago''',
  'SELECT ''assinaturas.billing_provider ja aceita promocional ou nao existe neste ambiente'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO dosdois.comunicacao_campanhas
  (codigo, nome, objetivo, canal, publico, status, assunto, corpo_texto, cta_label, cta_url, oferta_codigo, meses_premium, criado_por)
VALUES
  (
    'PREMIUM_CORTESIA_CADASTRO_2026_08',
    'Recuperacao de cadastros afetados - Premium cortesia',
    'Recuperar usuarios recentes impactados por falhas de cadastro e anuncios do plano Free.',
    'email',
    'Usuarios com cadastro recente, e-mail preenchido, sem assinatura paga ativa.',
    'rascunho',
    'Uma cortesia para voce voltar ao DosDois',
    'Pedido de desculpas pelas falhas recentes. Libere Premium gratis por alguns meses, sem cobranca e sem cartao. Ao final, seus dados continuam salvos e o Free volta para novos cadastros.',
    'Ativar Premium gratis',
    'https://dosdoisapp.com.br/promo/premium-cortesia?utm_source=email&utm_medium=campanha&utm_campaign=premium_cortesia_recuperacao',
    'PREMIUM_CORTESIA_RECUPERACAO',
    3,
    'codex'
  )
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  objetivo = VALUES(objetivo),
  publico = VALUES(publico),
  assunto = VALUES(assunto),
  corpo_texto = VALUES(corpo_texto),
  cta_label = VALUES(cta_label),
  cta_url = VALUES(cta_url),
  oferta_codigo = VALUES(oferta_codigo),
  meses_premium = VALUES(meses_premium),
  atualizado_em = CURRENT_TIMESTAMP;
