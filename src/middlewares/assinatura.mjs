import { queryAsync } from "../data/queryAsync/queryAsync.mjs";

export const loadPlan = async (req, res, next) => {
    const auth = req.headers.auth;

    const [assinatura] = await queryAsync(`
    SELECT p.*, a.fim
    FROM assinaturas AS a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.casal = ?
      AND a.status = 'ativa'
  `, [auth]);

    req.plano = assinatura || { codigo: 'FREE' };

    next();
};

export const checkModuleLimit = (moduleCode) => {
    return async (req, res, next) => {
        const auth = req.headers.auth;

        const [module] = await queryAsync(
            `SELECT id, tipo FROM modulos WHERE nome = ?`,
            [moduleCode]
        );

        if (!module) return next();

        const [planModule] = await queryAsync(`
      SELECT pm.limite, pm.ativo
      FROM assinaturas as a
      JOIN planos_limites as pm ON pm.id = a.plano_id
      WHERE a.casal = ? AND pm.modulo = ?
    `, [auth, module.id]);

        console.log(planModule)

        if (!planModule || !planModule.ativo) {
            return res.status(500).json({ error: 'MODULE_NOT_ALLOWED' });
        }

        if (module.tipo === 'limite' && planModule.limite !== -1) {
            const [usage] = await queryAsync(`
        SELECT uso FROM contador_uso
        WHERE casal = ? AND modulo = ?
      `, [auth, module.id]);

            if ((usage?.uso || 0) >= planModule.limite) {
                return res.status(500).json({
                    error: 'LIMIT_REACHED',
                    module: moduleCode
                });
            }
        }

        next();
    };
};

