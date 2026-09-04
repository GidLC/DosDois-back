-- Atualiza o CTA da campanha de recuperacao para usar a landing com fallback de Play Store.
-- Execute em staging/backup antes de producao.

UPDATE dosdois.comunicacao_campanhas
SET cta_label = 'Ativar Premium gratis',
    cta_url = 'https://dosdoisapp.com.br/promo/premium-cortesia?utm_source=email&utm_medium=campanha&utm_campaign=premium_cortesia_recuperacao',
    atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'PREMIUM_CORTESIA_CADASTRO_2026_08';
