-- Guarda uma recorrência uma vez e cria somente uma ocorrência por mês.
USE dosdois;

CREATE TABLE dosdois.despesas_fixas_modelos (
    id_fixo VARCHAR(36) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    tipo TINYINT NOT NULL DEFAULT 0,
    dia TINYINT NOT NULL,
    inicio DATE NOT NULL,
    fim DATE NULL,
    casal VARCHAR(64) NOT NULL,
    usuario INT NULL,
    banco INT NULL,
    categoria INT NULL,
    tag INT NULL,
    obs TEXT NULL,
    ativa TINYINT NOT NULL DEFAULT 1,
    PRIMARY KEY (id_fixo),
    KEY idx_despesas_fixas_modelos_casal_ativa (casal, ativa)
);

ALTER TABLE dosdois.despesas_fixas
    ADD COLUMN cancelada TINYINT NOT NULL DEFAULT 0;

-- Converte as séries já pré-geradas em um único modelo por recorrência.
INSERT INTO dosdois.despesas_fixas_modelos
    (id_fixo, descricao, valor, tipo, dia, inicio, casal, usuario, banco, categoria, tag, obs, ativa)
SELECT
    id_fixo,
    MAX(descricao),
    MAX(valor),
    MAX(tipo),
    MAX(dia),
    MIN(STR_TO_DATE(CONCAT(ano, '-', LPAD(mes + 1, 2, '0'), '-', LPAD(LEAST(dia, DAY(LAST_DAY(CONCAT(ano, '-', LPAD(mes + 1, 2, '0'), '-01')))), 2, '0')), '%Y-%m-%d')),
    casal,
    MAX(usuario),
    MAX(banco),
    MAX(categoria),
    MAX(tag),
    MAX(obs),
    1
FROM dosdois.despesas_fixas
GROUP BY id_fixo, casal;

-- Descarta duplicatas preservando uma ocorrência paga e, em empate, o menor ID.
DELETE repetida
FROM dosdois.despesas_fixas AS repetida
JOIN dosdois.despesas_fixas AS preservada
    ON preservada.id_fixo = repetida.id_fixo
    AND preservada.casal = repetida.casal
    AND preservada.ano = repetida.ano
    AND preservada.mes = repetida.mes
    AND (
        (preservada.status = 1 AND repetida.status = 0)
        OR (preservada.status = repetida.status AND preservada.id < repetida.id)
    )
WHERE repetida.id > 0;

-- Remove apenas lançamentos futuros ainda pendentes; histórico e pagos são mantidos.
DELETE FROM dosdois.despesas_fixas
WHERE id > 0
    AND status = 0
    AND (ano > YEAR(CURDATE()) OR (ano = YEAR(CURDATE()) AND mes > MONTH(CURDATE()) - 1));

ALTER TABLE dosdois.despesas_fixas
    ADD UNIQUE KEY uq_despesas_fixas_recorrencia_mes (id_fixo, casal, ano, mes),
    ADD KEY idx_despesas_fixas_casal_periodo (casal, ano, mes, cancelada);
