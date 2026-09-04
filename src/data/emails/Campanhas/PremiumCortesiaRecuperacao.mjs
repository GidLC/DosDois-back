const escapeHtml = (value = "") =>
    String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

const PremiumCortesiaRecuperacao = ({
    nome,
    meses = 3,
    url,
    playStoreUrl = "https://play.google.com/store/apps/details?id=br.com.dosdoisapp&hl=pt_BR",
    dataFim,
}) => {
    const nomeUsuario = escapeHtml(nome || "tudo bem");
    const mesesTexto = Number(meses) === 1 ? "1 mês" : `${Number(meses) || 3} meses`;
    const urlSeguro = escapeHtml(url);
    const playStoreUrlSeguro = escapeHtml(playStoreUrl);
    const dataFimTexto = dataFim ? escapeHtml(dataFim) : null;

    return `
        <div style="font-family: Arial, sans-serif; color: #10242f; line-height: 1.55; max-width: 640px; margin: 0 auto; padding: 24px;">
            <div style="border: 1px solid #d7eceb; border-radius: 8px; overflow: hidden; background: #ffffff;">
                <div style="background: #31d3cd; padding: 22px 24px;">
                    <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase;">DosDois</p>
                    <h1 style="font-size: 24px; line-height: 1.25; margin: 0; color: #10242f;">Uma cortesia para você voltar com calma</h1>
                </div>

                <div style="padding: 24px;">
                    <p>Olá, ${nomeUsuario}.</p>

                    <p>Nas últimas semanas, alguns cadastros e telas do plano Free foram prejudicados por falhas no app e por anúncios que atrapalharam o uso. Essa não é a experiência que queremos entregar.</p>

                    <p>Como pedido de desculpas, liberamos <strong>${mesesTexto} de Premium grátis</strong> para sua conta, sem cobrança e sem pedir cartão.</p>

                    <p>Durante esse período você pode usar os recursos Premium para organizar a rotina financeira do casal com mais tranquilidade: limites maiores, gráficos completos, fechamento mensal e uma experiência sem anúncios.</p>

                    <p>Antes de voltar, recomendamos atualizar o app pela Play Store para receber as correções que removem os bloqueios no cadastro e no uso do plano Free.</p>

                    <p style="margin: 24px 0;">
                        <a href="${urlSeguro}" style="display: inline-block; padding: 13px 18px; border-radius: 8px; background: #10242f; color: #ffffff; font-weight: 700; text-decoration: none;">
                            Ativar Premium grátis
                        </a>
                    </p>

                    <p style="margin: -10px 0 22px; font-size: 14px; color: #4a5f66;">
                        Se preferir ir direto para a loja, acesse:
                        <a href="${playStoreUrlSeguro}" style="color: #10242f; font-weight: 700;">Atualizar ou baixar o app</a>.
                    </p>

                    ${dataFimTexto ? `<p style="font-size: 14px; color: #4a5f66;">Sua cortesia fica disponível até <strong>${dataFimTexto}</strong>.</p>` : ""}

                    <p style="font-size: 14px; color: #4a5f66;">Quando a cortesia terminar, seus dados continuam salvos. O plano Free volta a valer apenas para novos cadastros e recursos Premium.</p>

                    <p>Obrigado por dar uma nova chance ao DosDois.</p>
                </div>
            </div>

            <p style="font-size: 12px; color: #6b7f86; margin-top: 18px;">Este e-mail foi enviado porque você criou uma conta no DosDois recentemente. Se precisar de ajuda, responda esta mensagem.</p>
        </div>
    `;
};

export default PremiumCortesiaRecuperacao;
