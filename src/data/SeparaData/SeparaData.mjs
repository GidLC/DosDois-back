import { DateTime } from 'luxon'

const separaData = async (data) => {
    const date = new Date(data) //Adiciona 3 horas para o GMT 0
    const dateBRT = DateTime.fromJSDate(date, { zone: 'utc' }).setZone('America/Sao_Paulo') //Diminui 3 horas para o horário de São Paulo

    return {
        ano: dateBRT.year,
        mes: dateBRT.month < 10 ? Number(`0${dateBRT.month}`) - 1 : dateBRT.month - 1,
        dia: dateBRT.day,
        hora: dateBRT.hour,
        minuto: dateBRT.minute,
        segundo: dateBRT.second
    }
}

export default separaData