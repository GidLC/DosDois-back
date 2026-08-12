import { queryAsync } from "../data/queryAsync/queryAsync.mjs";

const loadFreePlan = async () => {
    const [freePlan] = await queryAsync(
        `SELECT * FROM planos WHERE LOWER(codigo) = 'free' LIMIT 1`
    );

    return freePlan || { codigo: 'FREE' };
};

export const ensureFreeSubscription = async (auth) => {
    if (!auth) return null;

    const [existingSubscription] = await queryAsync(
        `SELECT id FROM assinaturas WHERE casal = ? LIMIT 1`,
        [auth]
    );

    if (existingSubscription) return existingSubscription;

    const freePlan = await loadFreePlan();
    if (!freePlan?.id) {
        console.error(`Plano FREE não encontrado; assinatura FREE não criada para o casal ${auth}`);
        return null;
    }

    await queryAsync(
        `INSERT INTO assinaturas (casal, plano_id, status, inicio)
         SELECT ?, ?, 'ativa', CURDATE()
         WHERE NOT EXISTS (
             SELECT 1 FROM assinaturas WHERE casal = ? LIMIT 1
         )`,
        [auth, freePlan.id, auth]
    );

    const [freeSubscription] = await queryAsync(
        `SELECT id FROM assinaturas WHERE casal = ? LIMIT 1`,
        [auth]
    );

    return freeSubscription || null;
};

const usageCountQueries = {
    bancos: `SELECT COUNT(*) AS total FROM banco WHERE casal = ? AND arquivo = 0`,
    categorias: `SELECT COUNT(*) AS total FROM categoria_tr WHERE casal = ?`,
    cartoes: `SELECT COUNT(*) AS total FROM cartoes WHERE casal = ?`,
    tags: `SELECT COUNT(*) AS total FROM tags WHERE casal = ?`,
    objetivos: `SELECT COUNT(*) AS total FROM objetivo WHERE casal = ? AND status = 0`,
};

const loadCurrentUsage = async (auth, moduleCode, moduleId) => {
    const countQuery = usageCountQueries[moduleCode];

    if (countQuery) {
        const [row] = await queryAsync(countQuery, [auth]);
        const uso = Number(row?.total || 0);

        await queryAsync(`
      INSERT INTO contador_uso (casal, modulo, uso)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE uso = VALUES(uso)
    `, [auth, moduleId, uso]);

        return uso;
    }

    const [usage] = await queryAsync(`
      SELECT uso FROM contador_uso
      WHERE casal = ? AND modulo = ?
    `, [auth, moduleId]);

    return Number(usage?.uso || 0);
};

const attachPendingSubscription = async (auth, plan) => {
    const [assinaturaPendente] = await queryAsync(`
    SELECT
      a.id AS assinatura_id,
      a.status AS assinatura_status,
      a.mp_status,
      a.mp_preapproval_id,
      a.inicio,
      a.fim,
      p.nome AS assinatura_plano_nome,
      p.codigo AS assinatura_plano_codigo
    FROM assinaturas AS a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.casal = ?
      AND a.status = 'pendente'
      AND LOWER(p.codigo) <> 'free'
    ORDER BY a.id DESC
    LIMIT 1
  `, [auth]);

    if (!assinaturaPendente) return plan;

    return {
        ...plan,
        assinatura_pendente: true,
        assinatura_id: assinaturaPendente.assinatura_id,
        assinatura_status: assinaturaPendente.assinatura_status,
        assinatura_mp_status: assinaturaPendente.mp_status,
        assinatura_mp_preapproval_id: assinaturaPendente.mp_preapproval_id,
        assinatura_inicio: assinaturaPendente.inicio,
        assinatura_fim: assinaturaPendente.fim,
        assinatura_plano_nome: assinaturaPendente.assinatura_plano_nome,
        assinatura_plano_codigo: assinaturaPendente.assinatura_plano_codigo,
    };
};

//Carrega dados da assinatura do usuário
export const loadPlan = async (req, res, next) => {
    const auth = req.authContext?.cod_casal || req.headers.auth;

    if (!auth) {
        req.plano = await loadFreePlan();
        return next();
    }

    let [assinatura] = await queryAsync(`
    SELECT p.*, a.fim, a.id AS assinatura_id
    FROM assinaturas AS a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.casal = ?
      AND a.status = 'ativa'
    ORDER BY (LOWER(p.codigo) = 'free') ASC, a.id DESC
    LIMIT 1
  `, [auth]);

    if (!assinatura) {
        await ensureFreeSubscription(auth);
        [assinatura] = await queryAsync(`
    SELECT p.*, a.fim, a.id AS assinatura_id
    FROM assinaturas AS a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.casal = ?
      AND a.status = 'ativa'
    ORDER BY (LOWER(p.codigo) = 'free') ASC, a.id DESC
    LIMIT 1
  `, [auth]);
    }

    req.plano = assinatura || await loadFreePlan();

    next();
};

export const loadPlanFunction = async (auth) => {
    if (!auth) {
        return await loadFreePlan();
    }

    let [assinatura] = await queryAsync(`
    SELECT p.*, a.fim, a.id AS assinatura_id
    FROM assinaturas AS a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.casal = ?
      AND a.status = 'ativa'
    ORDER BY (LOWER(p.codigo) = 'free') ASC, a.id DESC
    LIMIT 1
  `, [auth]);

    if (!assinatura) {
        await ensureFreeSubscription(auth);
        [assinatura] = await queryAsync(`
    SELECT p.*, a.fim, a.id AS assinatura_id
    FROM assinaturas AS a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.casal = ?
      AND a.status = 'ativa'
    ORDER BY (LOWER(p.codigo) = 'free') ASC, a.id DESC
    LIMIT 1
  `, [auth]);
    }

    const plan = assinatura || await loadFreePlan();

    return await attachPendingSubscription(auth, plan);
};

//Verifica os limites de cadastro do usuário
export const checkModuleLimit = (moduleCode, permitir = null) => {
    return async (req, res, next) => {
        const auth = req.authContext?.cod_casal || req.headers.auth;

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
        const plano = req.plano || await loadFreePlan();

        const [planModule] = plano.id
            ? await queryAsync(`
        SELECT pm.limite, pm.ativo, pm.por_casal
        FROM planos_limites AS pm
        WHERE pm.plano_id = ? AND pm.modulo = ?
      `, [plano.id, module.id])
            : await queryAsync(`
        SELECT pm.limite, pm.ativo, pm.por_casal
        FROM assinaturas AS a
        JOIN planos_limites AS pm ON pm.plano_id = a.plano_id
        WHERE a.casal = ? AND a.status = 'ativa' AND pm.modulo = ?
      `, [auth, module.id]);

        //Se não foi encontrado o módulo ou não está ativo
        const isFreePlan = String(plano?.codigo || '').toLowerCase() === 'free';

        if (!planModule) {
            if (!isFreePlan) {
                return next();
            }

            return res.status(200).json({
                error: 'MODULE_NOT_ALLOWED',
                module: moduleCode,
                message: 'Este recurso nao esta disponivel no plano atual.'
            });
        }

        if (!planModule.ativo) {
            return res.status(200).json({
                error: 'MODULE_NOT_ALLOWED',
                module: moduleCode,
                message: 'Este recurso nao esta disponivel no plano atual.'
            });
        }

        //Se o tipo de limitação é contado e o usuário possui um plano limitador(especialmente free)
        if (module.tipo === 'limite' && planModule.limite !== -1) {
            //Busca a quantidade usada pelo usuário
            let uso = await loadCurrentUsage(auth, moduleCode, module.id)
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

