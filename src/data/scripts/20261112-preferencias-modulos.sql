CREATE TABLE IF NOT EXISTS dosdois.preferencias_modulos_casal (
  casal VARCHAR(64) NOT NULL,
  tipo_gestao ENUM('simplificada', 'completa', 'personalizada') NOT NULL DEFAULT 'simplificada',
  receitas_ativo TINYINT(1) NOT NULL DEFAULT 0,
  bancos_ativo TINYINT(1) NOT NULL DEFAULT 0,
  cartoes_ativo TINYINT(1) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (casal)
);
