import PreferenciasModulosModel from '../models/preferenciasModulosModel.mjs';
import EventoProdutoModel from '../../telemetria/models/eventoProdutoModel.mjs';

const isEnabled = (value) => value === true || value === 1 || value === '1';

const respondWithError = (res, error, message) => {
    console.error(message, error);
    return res.status(500).json({ error: message });
};

const readModules = async (req, res) => {
    try {
        const casal = req.authContext?.cod_casal;
        if (!casal) return res.status(400).json({ error: 'Casal nao identificado.' });

        const settings = await PreferenciasModulosModel.getByCouple(casal);
        const planCode = String(req.plano?.codigo || '').toLowerCase();
        const isPaidPlan = Boolean(planCode) && planCode !== 'free';

        return res.status(200).json({
            settings: {
                ...settings,
                bancosAtivo: settings.bancosAtivo,
                cartoesAtivo: settings.cartoesAtivo,
            },
            availability: {
                receitas: true,
                bancos: isPaidPlan,
                cartoes: isPaidPlan,
                gestaoCompleta: isPaidPlan,
            },
        });
    } catch (error) {
        return respondWithError(res, error, 'Nao foi possivel carregar as preferencias dos modulos.');
    }
};

const saveModules = async (req, res) => {
    try {
        const casal = req.authContext?.cod_casal;
        if (!casal) return res.status(400).json({ error: 'Casal nao identificado.' });

        const { tipoGestao, receitasAtivo, bancosAtivo, cartoesAtivo } = req.body || {};
        const planCode = String(req.plano?.codigo || '').toLowerCase();
        const isPaidPlan = Boolean(planCode) && planCode !== 'free';

        if (!['simplificada', 'completa', 'personalizada'].includes(tipoGestao)) {
            return res.status(400).json({ error: 'Tipo de gestao invalido.' });
        }

        const previousSettings = await PreferenciasModulosModel.getByCouple(casal);

        const settings = {
            tipoGestao,
            receitasAtivo: isEnabled(receitasAtivo),
            bancosAtivo: isPaidPlan
                ? isEnabled(bancosAtivo)
                : Boolean(previousSettings?.bancosAtivo && isEnabled(bancosAtivo)),
            cartoesAtivo: isPaidPlan
                ? isEnabled(cartoesAtivo)
                : Boolean(previousSettings?.cartoesAtivo && isEnabled(cartoesAtivo)),
        };

        if (tipoGestao === 'simplificada') {
            settings.receitasAtivo = false;
            settings.bancosAtivo = false;
            settings.cartoesAtivo = false;
        }

        if (tipoGestao === 'completa') {
            if (!isPaidPlan) {
                return res.status(403).json({
                    error: 'UPGRADE_REQUIRED',
                    message: 'A gestao completa esta disponivel no plano pago.',
                });
            }

            settings.receitasAtivo = true;
            settings.bancosAtivo = true;
            settings.cartoesAtivo = true;
        }

        const saved = await PreferenciasModulosModel.saveForCouple(casal, settings);
        const actor = req.authContext?.id;
        const modules = ['receitas', 'bancos', 'cartoes'];
        const settingKey = {
            receitas: 'receitasAtivo',
            bancos: 'bancosAtivo',
            cartoes: 'cartoesAtivo',
        };

        const preferencesChanged = modules.some(module => previousSettings[settingKey[module]] !== saved[settingKey[module]])
            || previousSettings.tipoGestao !== saved.tipoGestao;

        if (actor && preferencesChanged) {
            const metadata = {
                antes: previousSettings,
                depois: saved,
            };
            const events = [{
                evento: 'module_preferences_saved',
                metadata,
            }];

            if (previousSettings.tipoGestao !== saved.tipoGestao) {
                events.push({
                    evento: 'management_profile_changed',
                    perfilAnterior: previousSettings.tipoGestao,
                    perfilNovo: saved.tipoGestao,
                });
            }

            modules.forEach(module => {
                const key = settingKey[module];
                if (previousSettings[key] === saved[key]) return;
                events.push({
                    evento: saved[key] ? 'module_activated' : 'module_deactivated',
                    modulo: module,
                    valorAnterior: previousSettings[key],
                    valorNovo: saved[key],
                    perfilAnterior: previousSettings.tipoGestao,
                    perfilNovo: saved.tipoGestao,
                });
            });

            await Promise.all(events.map(event => EventoProdutoModel.registrar({
                ...event,
                casal,
                usuario: actor,
            })));
        }

        return res.status(200).json({ settings: saved });
    } catch (error) {
        return respondWithError(res, error, 'Nao foi possivel salvar as preferencias dos modulos.');
    }
};

export default { readModules, saveModules };
