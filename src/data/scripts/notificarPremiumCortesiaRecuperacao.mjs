import { pool } from "../../config/config.mjs";
import PremiumCortesiaRecuperacao from "../emails/Campanhas/PremiumCortesiaRecuperacao.mjs";
import enviaEmailModel from "../../models/mail/enviaEmailModel.mjs";

const args = process.argv.slice(2);

const getArg = (nome, padrao = null) => {
    const prefixo = `${nome}=`;
    const arg = args.find((item) => item.startsWith(prefixo));
    return arg ? arg.slice(prefixo.length) : padrao;
};

const execute = args.includes("--execute");
const ativarPremium = args.includes("--ativar-premium");
const campanhaCodigo = getArg("--campanha", "PREMIUM_CORTESIA_CADASTRO_2026_08");
const dias = Number(getArg("--dias", "14"));
const inicio = getArg("--inicio");
const fim = getArg("--fim");
const meses = Number(getArg("--meses", "3"));
const limit = Number(getArg("--limit", "0"));
const url = getArg("--url", "https://web.dosdoisapp.com.br/conta?promo=premium-cortesia");
const hasPeriodoFixo = Boolean(inicio || fim);

const queryAsync = (sql, params = []) => pool.promise().query(sql, params).then(([rows]) => rows);

const enviarEmail = (destinatario, assunto, conteudo) => new Promise((resolve, reject) => {
    enviaEmailModel.enviaEmail(destinatario, assunto, conteudo, (err, result) => {
        if (err) return reject(err);
        return resolve(result);
    });
});

const formatDateBR = (date) => {
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const assertValidArgs = () => {
    if (hasPeriodoFixo && (!inicio || !fim)) {
        throw new Error("Informe --inicio e --fim juntos no formato YYYY-MM-DD.");
    }

    if (hasPeriodoFixo) {
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        const inicioDate = new Date(`${inicio}T00:00:00`);
        const fimDate = new Date(`${fim}T00:00:00`);

        if (!datePattern.test(inicio) || !datePattern.test(fim) || Number.isNaN(inicioDate.getTime()) || Number.isNaN(fimDate.getTime())) {
            throw new Error("Use --inicio e --fim no formato YYYY-MM-DD.");
        }

        if (inicioDate > fimDate) {
            throw new Error("--inicio nao pode ser maior que --fim.");
        }
    }

    if (!hasPeriodoFixo && (!Number.isInteger(dias) || dias <= 0)) {
        throw new Error("Informe --dias com um numero inteiro positivo.");
    }

    if (!Number.isInteger(meses) || meses <= 0) {
        throw new Error("Informe --meses com um numero inteiro positivo.");
    }

    if (!url || !/^https?:\/\//.test(url)) {
        throw new Error("Informe --url com uma URL absoluta.");
    }
};

const loadCampanha = async () => {
    const [campanha] = await queryAsync(
        `SELECT *
         FROM dosdois.comunicacao_campanhas
         WHERE codigo = ?
         LIMIT 1`,
        [campanhaCodigo]
    );

    if (!campanha) {
        throw new Error(`Campanha ${campanhaCodigo} nao encontrada. Execute a migracao 20260829-comunicacoes-promocionais.sql primeiro.`);
    }

    return campanha;
};

const loadPremiumPlan = async () => {
    const [plano] = await queryAsync(
        `SELECT id, codigo, nome
         FROM dosdois.planos
         WHERE LOWER(codigo) = 'premium'
         LIMIT 1`
    );

    if (!plano) {
        throw new Error("Plano premium nao encontrado.");
    }

    return plano;
};

const loadUsuariosElegiveis = async (campanhaId) => {
    const limiteSql = Number.isInteger(limit) && limit > 0 ? " LIMIT ?" : "";
    const dataSql = hasPeriodoFixo
        ? "u.dt_criacao >= ? AND u.dt_criacao < DATE_ADD(?, INTERVAL 1 DAY)"
        : "u.dt_criacao >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
    const params = Number.isInteger(limit) && limit > 0
        ? [...(hasPeriodoFixo ? [inicio, fim] : [dias]), campanhaId, limit]
        : [...(hasPeriodoFixo ? [inicio, fim] : [dias]), campanhaId];

    return queryAsync(
        `SELECT DISTINCT
            u.id,
            u.nome,
            u.email,
            u.fone,
            u.casal,
            u.dt_criacao,
            u.ultimo_acesso,
            u.incompleto
         FROM dosdois.usuario AS u
         WHERE u.email IS NOT NULL
           AND TRIM(u.email) <> ''
           AND ${dataSql}
           AND NOT EXISTS (
                SELECT 1
                FROM dosdois.assinaturas AS ap
                JOIN dosdois.planos AS pp ON pp.id = ap.plano_id
                WHERE ap.casal COLLATE utf8mb4_general_ci = u.casal COLLATE utf8mb4_general_ci
                  AND ap.status = 'ativa'
                  AND LOWER(pp.codigo) <> 'free'
                  AND (ap.fim IS NULL OR ap.fim >= CURDATE())
           )
           AND NOT EXISTS (
                SELECT 1
                FROM dosdois.comunicacao_destinatarios AS cd
                WHERE cd.campanha_id = ?
                  AND cd.usuario = u.id
                  AND cd.status = 'enviado'
           )
         ORDER BY u.dt_criacao DESC, u.id DESC${limiteSql}`,
        params
    );
};

const registraDestinatario = async ({ campanhaId, usuario, status, detalhe }) => {
    await queryAsync(
        `INSERT INTO dosdois.comunicacao_destinatarios
            (campanha_id, usuario, casal, email, fone, segmento, status, detalhe, enviado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'enviado', NOW(), NULL))
         ON DUPLICATE KEY UPDATE
            casal = VALUES(casal),
            email = VALUES(email),
            fone = VALUES(fone),
            segmento = VALUES(segmento),
            status = VALUES(status),
            detalhe = VALUES(detalhe),
            enviado_em = IF(VALUES(status) = 'enviado', NOW(), enviado_em),
            atualizado_em = CURRENT_TIMESTAMP`,
        [
            campanhaId,
            usuario.id,
            usuario.casal,
            String(usuario.email || "").trim().toLowerCase(),
            usuario.fone || null,
            usuario.incompleto ? "cadastro_incompleto_recente" : "cadastro_recente_free",
            status,
            detalhe,
            status,
        ]
    );
};

const ativaPremiumCortesia = async ({ campanhaId, usuario, planoPremium }) => {
    const [assinaturaAtual] = await queryAsync(
        `SELECT id
         FROM dosdois.assinaturas
         WHERE casal = ?
         ORDER BY id DESC
         LIMIT 1`,
        [usuario.casal]
    );

    const [periodo] = await queryAsync(
        `SELECT CURDATE() AS inicio, DATE_ADD(CURDATE(), INTERVAL ? MONTH) AS fim`,
        [meses]
    );

    let assinaturaId = assinaturaAtual?.id;

    if (assinaturaAtual) {
        await queryAsync(
            `UPDATE dosdois.assinaturas
             SET plano_id = ?,
                 status = 'ativa',
                 inicio = ?,
                 fim = ?,
                 billing_provider = 'promocional',
                 provider_subscription_id = NULL,
                 provider_checkout_id = NULL,
                 provider_external_reference = ?,
                 provider_payment_id = NULL,
                 provider_status = 'premium_cortesia',
                 updated_at = NOW()
             WHERE id = ?`,
            [
                planoPremium.id,
                periodo.inicio,
                periodo.fim,
                `${campanhaCodigo}:${usuario.id}`,
                assinaturaAtual.id,
            ]
        );
    } else {
        const result = await pool.promise().query(
            `INSERT INTO dosdois.assinaturas
                (casal, plano_id, status, inicio, fim, billing_provider, provider_external_reference, provider_status, created_at, updated_at)
             VALUES (?, ?, 'ativa', ?, ?, 'promocional', ?, 'premium_cortesia', NOW(), NOW())`,
            [
                usuario.casal,
                planoPremium.id,
                periodo.inicio,
                periodo.fim,
                `${campanhaCodigo}:${usuario.id}`,
            ]
        );

        assinaturaId = result[0].insertId;
    }

    await queryAsync(
        `INSERT INTO dosdois.premium_cortesia_concessoes
            (campanha_id, usuario, casal, assinatura_id, plano_id, meses, inicio, fim, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            assinatura_id = VALUES(assinatura_id),
            plano_id = VALUES(plano_id),
            meses = VALUES(meses),
            inicio = VALUES(inicio),
            fim = VALUES(fim),
            status = 'ativa',
            observacao = VALUES(observacao),
            atualizado_em = CURRENT_TIMESTAMP`,
        [
            campanhaId,
            usuario.id,
            usuario.casal,
            assinaturaId,
            planoPremium.id,
            meses,
            periodo.inicio,
            periodo.fim,
            "Cortesia por falhas recentes de cadastro e anuncios Free.",
        ]
    );

    return { assinaturaId, fim: periodo.fim };
};

const main = async () => {
    assertValidArgs();

    const campanha = await loadCampanha();
    const planoPremium = await loadPremiumPlan();
    const usuarios = await loadUsuariosElegiveis(campanha.id);
    const periodoTexto = hasPeriodoFixo
        ? `periodo: ${inicio} ate ${fim}`
        : `janela: ${dias} dia(s)`;

    console.log(`${execute ? "EXECUTE" : "DRY-RUN"}: ${usuarios.length} usuario(s) elegivel(is) para ${campanhaCodigo}.`);
    console.log(`${ativarPremium ? "Ativacao Premium habilitada" : "Somente comunicacao"}; cortesia: ${meses} mes(es); ${periodoTexto}.`);

    for (const usuario of usuarios) {
        const email = String(usuario.email || "").trim().toLowerCase();
        console.log(`${execute ? "Processando" : "Pendente"}: #${usuario.id} ${email} casal=${usuario.casal}`);

        if (!execute) continue;

        try {
            let concessao = null;

            if (ativarPremium) {
                concessao = await ativaPremiumCortesia({ campanhaId: campanha.id, usuario, planoPremium });
            }

            const html = PremiumCortesiaRecuperacao({
                nome: usuario.nome,
                meses,
                url,
                dataFim: concessao?.fim ? formatDateBR(concessao.fim) : null,
            });

            await enviarEmail(email, campanha.assunto || "Uma cortesia para voce voltar ao DosDois", html);
            await registraDestinatario({ campanhaId: campanha.id, usuario, status: "enviado", detalhe: null });
        } catch (error) {
            await registraDestinatario({
                campanhaId: campanha.id,
                usuario,
                status: "erro",
                detalhe: String(error).slice(0, 1000),
            });
            console.error(`Erro ao processar #${usuario.id} ${email}:`, error);
        }
    }

    console.log(execute ? "Processamento concluido." : "Dry-run concluido. Use --execute para enviar e --ativar-premium para conceder a cortesia.");
};

main()
    .catch((error) => {
        console.error("Erro na campanha Premium cortesia:", error);
        process.exitCode = 1;
    })
    .finally(() => {
        pool.end();
    });
