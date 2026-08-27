import { apiWhatsURL } from "../apiConfig.mjs";

//Função acessa API externa para envio de whatsapp
const enviaWhats = async (num, msg) => {
    try {
        const response = await fetch(`${apiWhatsURL}/enviaWhats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ num, msg }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data?.details || data?.error || `WhatsApp API respondeu com status ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error(`Houve um erro no envio da mensagem de Whatsapp. ${error}`)
        throw error;
    }
};

export default enviaWhats;
