const EmailCadastro = (nome, codigoCasal, url) =>  {return `
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
        <p>Olá, ${nome}</p>
        <p>Você acaba de se cadastrar no OneCash, o melhor aplicativo de finanças familiar. O código casal seu e de
            seu(sua) parceiro(a) é o <b>${codigoCasal}</b>.
            Para se vincular basta seu parceiro acessar o link: ${url}
        </p>
        <p>Se você não solicitou este cadastro, por favor, ignore este e-mail.</p>
    </main>

    <footer class="footer">
        <p>Este e-mail foi enviado automaticamente. Não responda a este e-mail.</p>
    </footer>
</body>

</html>
        
        `}

export default EmailCadastro