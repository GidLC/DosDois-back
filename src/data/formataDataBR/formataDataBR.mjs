export const formataDataBr = (data) => {
    const dataAjustada = new Date(data);

    const deslocamentoBrasil = (-3) * 60;
    dataAjustada.setMinutes(dataAjustada.getMinutes() + deslocamentoBrasil);

    if (dataAjustada.getHours() >= 21) {
        dataAjustada.setDate(dataAjustada.getDate() - 1);
        dataAjustada.setHours(21);
        dataAjustada.setMinutes(0);
    }

    return dataAjustada.toISOString();
}