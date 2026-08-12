START TRANSACTION;

INSERT INTO modulos (nome, tipo, descricao)
VALUES
  ('sem_anuncios', 'feature', 'Remove propagandas da experiencia do app.'),
  ('whatsapp', 'feature', 'Libera o assistente Dodo no WhatsApp.'),
  ('fechamento_mensal', 'feature', 'Libera a rotina de fechamento mensal do casal.'),
  ('graficos', 'feature', 'Libera analises e graficos completos.')
ON DUPLICATE KEY UPDATE
  tipo = VALUES(tipo),
  descricao = VALUES(descricao);

INSERT INTO beneficios
  (codigo, modulo_id, titulo, descricao_curta, descricao_longa, icone, categoria, ativo, ordem)
VALUES
  (
    'sem_anuncios',
    (SELECT id FROM modulos WHERE nome = 'sem_anuncios' LIMIT 1),
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
    (SELECT id FROM modulos WHERE nome = 'whatsapp' LIMIT 1),
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
    (SELECT id FROM modulos WHERE nome = 'fechamento_mensal' LIMIT 1),
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
    (SELECT id FROM modulos WHERE nome = 'graficos' LIMIT 1),
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

INSERT INTO planos_beneficios
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
FROM planos p
JOIN beneficios b
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

INSERT INTO beneficios_contextos
  (beneficio_id, contexto, titulo_override, descricao_override, ordem, ativo)
SELECT b.id, ctx.contexto, ctx.titulo_override, ctx.descricao_override, ctx.ordem, 1
FROM beneficios b
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
