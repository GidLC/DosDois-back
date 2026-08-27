const EmailParceiro = (nome, codigoCasal) => {
    return `
    <html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmação de Cadastro</title>
    <style>
        body {
            width: 100vw;
            height: 100vh;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #ADEFEC;
        }

        .container {
            max-width: 51%;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }

        h1 {
            color: #333333;
        }

        p {
            color: #666666;
        }

        .footer {
            margin-top: 20px;
            text-align: center;
            color: #999999;
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
        <p>Olá</p>
        <p><b>${nome}</b> acaba de se cadastrar no aplicativo DosDois e te colocou como parceiro(a).
            Seu código para se vincular a ele e criar o casal de vocês em nosso aplicativo é <b>${codigoCasal}</b>.</p>
        <p>Para se vincular basta baixar nosso aplicativo e ir em CADASTRE-SE - ATRIBUIÇÃO. Coloque lá o código recebido
            e realize o cadastro de sua própria conta.</p>
    </main>

    <footer class="footer">
        <p>Este e-mail foi enviado automaticamente. Não responda a este e-mail.</p>
    </footer>
</body>

</html>
            
            `}

export default EmailParceiro
