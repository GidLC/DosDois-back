import EventoProdutoModel from '../models/eventoProdutoModel.mjs';

const registrarSessao = async (req, res) => {
    const casal = req.authContext?.cod_casal;
    const usuario = req.authContext?.id;
    const sessionId = String(req.body?.sessionId || '');

    if (!casal || !usuario || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
        return res.status(400).json({ message: 'Sessao invalida.' });
    }

    await EventoProdutoModel.registrar({
        evento: 'app_session_started',
        casal,
        usuario,
        dedupeKey: `session:${sessionId}`,
    });

    return res.status(204).end();
};

export default { registrarSessao };
