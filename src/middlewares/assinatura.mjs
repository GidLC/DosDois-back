import { queryAsync } from "../data/queryAsync/queryAsync.mjs";

//Carrega dados da assinatura do usuário
export const loadPlan = async (req, res, next) => {
    const auth = req.headers.auth;

    const [assinatura] = await queryAsync(`
    SELECT p.*, a.fim
    FROM assinaturas AS a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.casal = ?
      AND a.status = 'ativa'
  `, [auth]);

    console.log(auth)

    req.plano = assinatura || { codigo: 'FREE' };

    next();
};

export const loadPlanFunction = async (auth) => {

    const [assinatura] = await queryAsync(`
    SELECT p.*, a.fim
    FROM assinaturas AS a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.casal = ?
      AND a.status = 'ativa'
  `, [auth]);

    return assinatura
};

//Verifica os limites de cadastro do usuário
export const checkModuleLimit = (moduleCode, permitir = null) => {
    return async (req, res, next) => {
        const auth = req.headers.auth;

        //Busca dados do módulo a ser verificado
        const [module] = await queryAsync(
            `SELECT id, tipo FROM modulos WHERE nome = ?`,
            [moduleCode]
        );

        if (!module) return next();

        //Exceções que permitem prosseguir
        if (permitir) {
            //Arquivamento de bancos
            if (Number(req.headers.arquivo) == 1) {
                return next()
            }
        }

        //Busca limites do plano em relação a esse módulo(normalmente a quantidade de cadastros possíveis)
        const [planModule] = await queryAsync(`
      SELECT pm.limite, pm.ativo, pm.por_casal
      FROM assinaturas as a
      JOIN planos_limites as pm ON pm.plano_id = a.plano_id
      WHERE a.casal = ? AND pm.modulo = ?
    `, [auth, module.id]);

        //Se não foi encontrado o módulo ou não está ativo
        if (!planModule || !planModule.ativo) {
            return res.status(200).json({ error: 'MODULE_NOT_ALLOWED' });
        }

        //Se o tipo de limitação é contado e o usuário possui um plano limitador(especialmente free)
        if (module.tipo === 'limite' && planModule.limite !== -1) {
            //Busca a quantidade usada pelo usuário
            const [usage] = await queryAsync(`
        SELECT uso FROM contador_uso
        WHERE casal = ? AND modulo = ?
      `, [auth, module.id]);

            let uso = usage.uso
            let limite = planModule.limite

            //Caso a limitação seja por usuário divide a limitação no banco(por casal) por 2, tornando-a individual
            if (planModule.por_casal) {
                uso = Number(uso) / 2
                limite = Number(planModule.limite) / 2
            }

            //Se atingiu o limite disponível para o plano
            if ((uso || 0) >= limite) {
                return res.status(200).json({
                    error: 'LIMIT_REACHED',
                    module: moduleCode
                });
            }
        }

        next();
    };
};

