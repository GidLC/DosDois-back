const SeparaData = async (data) => {
    const [dataPart, horaPart] = data.split("T");
    const [ano, mes, dia] = dataPart.split("-");
    const [hora, minuto, segundo] = horaPart.split(":");

    const objData = {
        ano: parseInt(ano),
        mes: parseInt(mes -1),
        dia: parseInt(dia),
        hora: parseInt(hora),
        minuto: parseInt(minuto),
        segundo: parseInt(segundo)
    }

    return objData
}

export default  SeparaData 