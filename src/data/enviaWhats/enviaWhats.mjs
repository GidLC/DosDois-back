import { apiWhatsURL } from "../apiConfig.mjs";

//Função acessa API externa para envio de whatsapp
const enviaWhats = async (num, msg) => {
    try {
        const response = await fetch(`${apiWhatsURL}/enviaWhats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                num,
                msg
            },
        });
    
        return response.json();
    } catch (error) {
        console.error(`Houve um erro no envio da mensagem de Whatsapp. ${error}`)
    }
};

export default enviaWhats;