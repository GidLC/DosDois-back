import { pool } from "../../config/config.mjs";
import AtualizacaoTermosUso from "../emails/TermosUso/AtualizacaoTermosUso.mjs";
import enviaEmailModel from "../../models/mail/enviaEmailModel.mjs";

const args = process.argv.slice(2);

const getArg = (nome, padrao = null) => {
    const prefixo = `${nome}=`;
    const arg = args.find((item) => item.startsWith(prefixo));
    return arg ? arg.slice(prefixo.length) : padrao;
};

const execute = args.includes("--execute");
const versao = getArg("--versao");
const url = getArg("--url");
const limit = Number(getArg("--limit", "0"));

const queryAsync = (sql, params = []) => pool.promise().query(sql, params).then(([rows]) => rows);

const enviarEmail = (destinatario, assunto, conteudo) => new Promise((resolve, reject) => {
    enviaEmailModel.enviaEmail(destinatario, assunto, conteudo, (err, result) => {
        if (err) return reject(err);
        return resolve(result);
    });
});

const registraResultado = async ({ usuario, email, status, detalhe }) => {
    await queryAsync(
        `INSERT INTO dosdois.termos_uso_notificacoes (versao, usuario, email, status, detalhe)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email = VALUES(email), status = VALUES(status), detalhe = VALUES(detalhe), enviado_em = CURRENT_TIMESTAMP`,
        [versao, usuario, email, status, detalhe]
    );
};

const main = async () => {
    if (!versao || !url) {
        console.error("Uso: node src/data/scripts/notificarTermosUso.mjs --versao=2026-08-27 --url=https://... [--limit=50] [--execute]");
        process.exitCode = 1;
        return;
    }

    const limiteSql = Number.isInteger(limit) && limit > 0 ? " LIMIT ?" : "";
    const params = Number.isInteger(limit) && limit > 0 ? [versao, limit] : [versao];
    const usuarios = await queryAsync(
        `SELECT u.id, u.nome, u.email
         FROM dosdois.usuario AS u
         WHERE u.email IS NOT NULL
           AND u.email <> ''
           AND (u.incompleto IS NULL OR u.incompleto = 0)
           AND NOT EXISTS (
                SELECT 1
                FROM dosdois.termos_uso_notificacoes AS n
                WHERE n.usuario = u.id AND n.versao = ?
           )
         ORDER BY u.id${limiteSql}`,
        params
    );

    console.log(`${execute ? "EXECUTE" : "DRY-RUN"}: ${usuarios.length} usuario(s) pendente(s) para a versao ${versao}.`);

    for (const usuario of usuarios) {
        const email = String(usuario.email || "").trim().toLowerCase();
        console.log(`${execute ? "Enviando" : "Pendente"}: #${usuario.id} ${email}`);

        if (!execute) continue;

        try {
            const html = AtualizacaoTermosUso({ nome: usuario.nome, versao, url });
            await enviarEmail(email, `Atualizacao dos Termos de Uso - DosDois ${versao}`, html);
            await registraResultado({ usuario: usuario.id, email, status: "enviado", detalhe: null });
        } catch (error) {
            await registraResultado({ usuario: usuario.id, email, status: "erro", detalhe: String(error).slice(0, 1000) });
            console.error(`Erro ao enviar para #${usuario.id} ${email}:`, error);
        }
    }

    console.log(execute ? "Processamento concluido." : "Dry-run concluido. Use --execute para enviar.");
};

main()
    .catch((error) => {
        console.error("Erro ao notificar termos de uso:", error);
        process.exitCode = 1;
    })
    .finally(() => {
        pool.end();
    });
