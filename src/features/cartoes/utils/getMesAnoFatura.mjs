export const getMesAnoFatura = async (diaCompra, mesCompra, anoCompra, fech) => {
    let mesFatura = mesCompra;
    let anoFatura = anoCompra;

    if (diaCompra >= fech) {
        mesFatura += 1;
        if (mesFatura === 12) {
            mesFatura = 0;
            anoFatura += 1;
        }
    }

    return { mes: Number(mesFatura), ano: Number(anoFatura) };
}
