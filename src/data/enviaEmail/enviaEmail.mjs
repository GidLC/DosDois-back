import { apiEmailURL } from '../apiConfig.mjs';

const enviaEmail = async (dest, assunto, cont) => {
    try {
        const response = await fetch(`${apiEmailURL}/enviaEmail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(
                {
                    dest,
                    assunto,
                    cont
                }
            )
        })

        return response.json()
    } catch (error) {
        return `Houve um erro no envio do e-mail, ${error}`
    }
}

export default enviaEmail
