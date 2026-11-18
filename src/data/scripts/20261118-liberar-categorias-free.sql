USE dosdois;

START TRANSACTION;

-- Custom categories are part of the FREE plan. Keep the existing server-side
-- quota check, but mark this module as unlimited for FREE subscriptions.
UPDATE planos_limites AS pl
JOIN planos AS p ON p.id = pl.plano_id
JOIN modulos AS m ON m.id = pl.modulo
SET pl.limite = -1,
    pl.ativo = 1,
    pl.por_casal = 0
WHERE LOWER(p.codigo) = 'free'
  AND m.nome = 'categorias';

-- Remove categories from the paid benefit copy because category creation is
-- now available in FREE.
UPDATE beneficios
SET descricao_curta = REPLACE(descricao_curta, 'categorias, ', ''),
    descricao_longa = REPLACE(descricao_longa, 'categorias, ', '')
WHERE codigo = 'limites_maiores';

UPDATE beneficios_contextos AS bc
JOIN beneficios AS b ON b.id = bc.beneficio_id
SET bc.titulo_override = REPLACE(bc.titulo_override, 'categorias, ', ''),
    bc.descricao_override = REPLACE(bc.descricao_override, 'categorias, ', '')
WHERE b.codigo = 'limites_maiores';

COMMIT;

-- Verify that the FREE plan has unlimited category creation.
SELECT p.codigo, m.nome AS modulo, pl.limite, pl.ativo, pl.por_casal
FROM planos_limites AS pl
JOIN planos AS p ON p.id = pl.plano_id
JOIN modulos AS m ON m.id = pl.modulo
WHERE LOWER(p.codigo) = 'free'
  AND m.nome = 'categorias';
