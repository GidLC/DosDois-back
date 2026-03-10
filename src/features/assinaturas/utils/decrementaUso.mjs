import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs";

export const decrementaUso = async (casal, modulo) => {
    const [module] = await queryAsync(
        `SELECT id FROM modulos WHERE nome = ?`,
        [modulo]
    );

    await queryAsync(`
        UPDATE contador_uso SET uso = uso - 1 WHERE casal = ? AND modulo = ?`,
        [casal, module.id]);
};
