-- Corrige assinaturas anuais que foram ativadas com fim mensal.
-- Usa o evento de sucesso do checkout para evitar confundir ofertas mensais e anuais do mesmo plano.

SELECT
  a.id,
  a.casal,
  a.mp_preapproval_id,
  e.offer_id,
  a.inicio,
  a.fim AS fim_atual,
  DATE_ADD(a.inicio, INTERVAL 1 YEAR) AS fim_corrigido
FROM assinaturas a
JOIN assinatura_eventos_conversao e
  ON e.mp_preapproval_id = a.mp_preapproval_id
 AND e.evento = 'payment_success'
JOIN planos_ofertas o
  ON o.codigo = e.offer_id
 AND o.periodicidade = 'anual'
WHERE a.status = 'ativa'
  AND a.inicio IS NOT NULL
  AND (
    a.fim IS NULL
    OR a.fim < DATE_ADD(a.inicio, INTERVAL 300 DAY)
  );

UPDATE assinaturas a
JOIN assinatura_eventos_conversao e
  ON e.mp_preapproval_id = a.mp_preapproval_id
 AND e.evento = 'payment_success'
JOIN planos_ofertas o
  ON o.codigo = e.offer_id
 AND o.periodicidade = 'anual'
SET a.fim = DATE_ADD(a.inicio, INTERVAL 1 YEAR),
    a.updated_at = NOW()
WHERE a.status = 'ativa'
  AND a.inicio IS NOT NULL
  AND (
    a.fim IS NULL
    OR a.fim < DATE_ADD(a.inicio, INTERVAL 300 DAY)
  );
