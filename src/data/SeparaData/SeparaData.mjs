import { DateTime } from 'luxon'

const separaData = async (data) => {
    const dateBRT = DateTime.fromISO(data, { zone: 'utc' }).setZone('America/Sao_Paulo')

    return {
        ano: dateBRT.year,
        mes: dateBRT.month < 10 ? Number(`0${dateBRT.month}`) : dateBRT.month - 1,
        dia: dateBRT.day,
        hora: dateBRT.hour,
        minuto: dateBRT.minute,
        segundo: dateBRT.second
    }
}

export default separaData