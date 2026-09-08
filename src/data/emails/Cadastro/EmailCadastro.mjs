const EmailCadastro = (nome, codigoCasal, url) =>  {
  const conviteParceiro = url
    ? `
        <div class="invite-box">
            <p class="eyebrow">Convite do parceiro</p>
            <p>Quando quiser, você pode convidar seu parceiro para organizar as finanças com você. Essa etapa é opcional para começar a usar o app.</p>
            <a href="${url}" class="button">Enviar convite ao parceiro</a>
            <p class="link-fallback">Se o botão não abrir, copie este link:<br><span>${url}</span></p>
        </div>
    `
    : '';

return `
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmação de Cadastro</title>
    <style>
        body {
            width: 100vw;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 24px 12px;
            background-color: #eefaf9;
        }

        .container {
            max-width: 560px;
            margin: 0 auto;
            padding: 32px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(39, 37, 37, 0.12);
        }

        h1 {
            color: #272525;
            font-size: 24px;
            margin: 0 0 16px;
        }

        p {
            color: #4a4a4a;
            font-size: 15px;
            line-height: 1.55;
            margin: 0 0 14px;
        }

        .highlight {
            color: #272525;
            font-weight: 700;
        }

        .invite-box {
            background-color: #f4fbfb;
            border: 1px solid #c9f1ef;
            border-radius: 8px;
            margin: 24px 0;
            padding: 18px;
        }

        .eyebrow {
            color: #1f8f89;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0;
            margin-bottom: 8px;
            text-transform: uppercase;
        }

        .button {
            background-color: #32D7D0;
            border-radius: 6px;
            color: #272525;
            display: inline-block;
            font-weight: 700;
            margin: 6px 0 14px;
            padding: 12px 18px;
            text-decoration: none;
        }

        .link-fallback {
            color: #666666;
            font-size: 13px;
            margin-bottom: 0;
            word-break: break-word;
        }

        .link-fallback span {
            color: #1f8f89;
        }

        .footer {
            max-width: 560px;
            margin: 18px auto 0;
            text-align: center;
            color: #999999;
        }

        .footer p {
            color: #777777;
            font-size: 12px;
        }

        .cabecalho {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: -2%;
        }

        .imagem {
            width: 54%;
            height: 200px;
            border-radius: 10px;
        }
    </style>
</head>

<body>
    <header class="cabecalho">
    </header>

    <main class="container">
        <h1>Confirmação de Cadastro</h1>
        <p>Olá, ${nome}</p>
        <p>Seu cadastro no <span class="highlight">DosDois</span> foi criado. Você já pode começar a organizar suas finanças pelo app, mesmo antes de convidar seu parceiro.</p>
        <p>Seu código de casal é <span class="highlight">${codigoCasal}</span>. Ele identifica seu convite caso vocês decidam usar o app juntos.</p>
        ${conviteParceiro}
        <p>Se você não solicitou este cadastro, por favor, ignore este e-mail.</p>
    </main>

    <footer class="footer">
        <p>Este e-mail foi enviado automaticamente. Não responda a este e-mail.</p>
    </footer>
</body>

</html>
        
        `}

export default EmailCadastro
