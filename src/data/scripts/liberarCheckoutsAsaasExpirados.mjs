import { queryAsync } from "../queryAsync/queryAsync.mjs";
import AssinaturaModel from "../../features/assinaturas/models/assinaturasModel.mjs";

const args = process.argv.slice(2);

const getArg = (nome, padrao = null) => {
    const prefixo = `${nome}=`;
    const arg = args.find((item) => item.startsWith(prefixo));
    return arg ? arg.slice(prefixo.length) : padrao;
};

const execute = args.includes("--execute");
const minutos = Number(getArg("--minutos", "70"));
const limit = Number(getArg("--limit", "50"));
const casal = getArg("--casal");

const assertValidArgs = () => {
    if (!Number.isInteger(minutos) || minutos <= 0) {
        throw new Error("Informe --minutos com um numero inteiro positivo.");
    }

    if (!Number.isInteger(limit) || limit <= 0) {
        throw new Error("Informe --limit com um numero inteiro positivo.");
    }
};

const listarCandidatos = async () => {
    const params = [minutos];
    const casalFilter = casal ? "AND casal = ?" : "";

    if (casal) params.push(casal);
    params.push(limit);

    return queryAsync(`
        SELECT
            id,
            casal,
            plano_id,
            status,
            provider_checkout_id,
            provider_external_reference,
            provider_status,
            created_at,
            updated_at
        FROM assinaturas
        WHERE billing_provider = 'asaas'
          AND status IN ('pendente', 'criando')
          AND provider_checkout_id IS NOT NULL
          AND provider_subscription_id IS NULL
          AND provider_payment_id IS NULL
          AND updated_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
          ${casalFilter}
        ORDER BY updated_at ASC
        LIMIT ?
    `, params);
};

const main = async () => {
    assertValidArgs();

    const candidatos = await listarCandidatos();

    console.table(candidatos);
    console.log(`Candidatos encontrados: ${candidatos.length}`);

    if (!execute) {
        console.log("Dry-run concluido. Reexecute com --execute para liberar os checkouts listados.");
        process.exit(0);
    }

    const resultado = await AssinaturaModel.expirarCheckoutsAsaasSemPagamento(casal, minutos);
    console.log(`Checkouts liberados: ${resultado.affectedRows}`);
    process.exit(0);
};

main().catch((error) => {
    console.error("Erro ao liberar checkouts Asaas expirados:", error);
    process.exit(1);
});
