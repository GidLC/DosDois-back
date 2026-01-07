import { queryAsync } from "../../../data/queryAsync/queryAsync.mjs";

export const incrementaUso = async (casal, modulo, qtd = 1) => {
    const [module] = await queryAsync(
        `SELECT id FROM modulos WHERE nome = ?`,
        [modulo]
    );

    await queryAsync(`
    INSERT INTO contador_uso (casal, modulo, uso)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE uso = uso + 1
  `, [casal, module.id, qtd]);
};
