const AtualizacaoTermosUso = ({ nome, versao, url }) => {
    const nomeUsuario = nome || "tudo bem";

    return `
        <div style="font-family: Arial, sans-serif; color: #10242f; line-height: 1.5; max-width: 620px; margin: 0 auto;">
            <h1 style="font-size: 22px; margin-bottom: 16px;">Atualizamos os Termos de Uso do DosDois</h1>
            <p>Olá, ${nomeUsuario}.</p>
            <p>Estamos avisando que os Termos de Uso do DosDois foram atualizados para a versão ${versao}.</p>
            <p>Você pode consultar a versão atualizada pelo link abaixo:</p>
            <p>
                <a href="${url}" style="display: inline-block; padding: 12px 18px; border-radius: 8px; background: #31d3cd; color: #10242f; font-weight: 700; text-decoration: none;">
                    Ver Termos de Uso
                </a>
            </p>
            <p>Se o botão não abrir, copie e cole este endereço no navegador:</p>
            <p style="word-break: break-all;"><a href="${url}">${url}</a></p>
            <p>Obrigado por usar o DosDois.</p>
        </div>
    `;
};

export default AtualizacaoTermosUso;
