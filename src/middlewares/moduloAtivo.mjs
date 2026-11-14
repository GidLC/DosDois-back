import { loadPlanFunction } from './assinatura.mjs';
import PreferenciasModulosModel from '../features/preferencias/models/preferenciasModulosModel.mjs';
import { queryAsync } from '../data/queryAsync/queryAsync.mjs';

const settingByModule = {
    receitas: 'receitasAtivo',
    bancos: 'bancosAtivo',
    cartoes: 'cartoesAtivo',
};

export const requireActiveModule = (moduleCode) => async (req, res, next) => {
    try {
        const casal = req.authContext?.cod_casal;
        const settingName = settingByModule[moduleCode];

        if (!casal || !settingName) {
            return res.status(400).json({ error: 'Modulo ou casal invalido.' });
        }

        if (moduleCode === 'bancos' || moduleCode === 'cartoes') {
            const plan = req.plano || await loadPlanFunction(casal);
            const planCode = String(plan?.codigo || '').toLowerCase();

            if (!planCode || planCode === 'free') {
                return res.status(403).json({
                    error: 'UPGRADE_REQUIRED',
                    module: moduleCode,
                    message: 'Este modulo esta disponivel apenas nos planos pagos.',
                });
            }
        }

        const settings = await PreferenciasModulosModel.getByCouple(casal);
        if (!settings[settingName]) {
            return res.status(403).json({
                error: 'MODULE_DISABLED_BY_COUPLE',
                module: moduleCode,
                message: 'Ative este modulo nas preferencias para continuar.',
            });
        }

        return next();
    } catch (error) {
        console.error(`Nao foi possivel validar o modulo ${moduleCode}`, error);
        return res.status(500).json({ error: 'Nao foi possivel validar o acesso a este modulo.' });
    }
};

const hasCardValue = (value) => value !== undefined
    && value !== null
    && value !== false
    && value !== 0
    && !['', '0', 'false', 'null', 'undefined'].includes(String(value).trim().toLowerCase());

export const requireCardModuleWhenPresent = async (req, res, next) => {
    try {
        let hasCard = hasCardValue(req.body?.cartao);

        // An edit may remove the card ID from the request, so inspect the saved
        // expense too. This keeps a disabled card module from being changed via
        // a request that simply omits the card field.
        const expenseId = req.body?.id || req.header('id');
        const casal = req.authContext?.cod_casal;
        if (!hasCard && expenseId && casal && req.method !== 'POST') {
            const [expense] = await queryAsync(
                'SELECT cartao FROM despesa WHERE casal = ? AND id = ? LIMIT 1',
                [casal, expenseId]
            );
            hasCard = hasCardValue(expense?.cartao);
        }

        if (!hasCard) return next();
        return requireActiveModule('cartoes')(req, res, next);
    } catch (error) {
        console.error('Nao foi possivel validar o modulo de cartoes da despesa', error);
        return res.status(500).json({ error: 'Nao foi possivel validar o acesso a esta despesa.' });
    }
};
