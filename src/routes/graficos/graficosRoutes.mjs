import express from 'express'
const graficosRouter = express.Router()
import graficosControllers from '../../controllers/graficos/graficosControllers.mjs'
import { autenticarJWT } from '../../middlewares/auth.mjs';
import { loadPlan } from '../../middlewares/assinatura.mjs';

graficosRouter.use(autenticarJWT)

const bloquearGraficosFree = (req, res, next) => {
    const codigoPlano = String(req.plano?.codigo || '').toLowerCase()

    if (codigoPlano === 'free') {
        return res.status(200).json({ error: 'MODULE_NOT_ALLOWED', module: 'graficos' })
    }

    next()
}

graficosRouter.get('/receitaPorCategoria', loadPlan, bloquearGraficosFree, graficosControllers.receitaPorCategoria)
graficosRouter.get('/despesaPorCategoria', loadPlan, bloquearGraficosFree, graficosControllers.despesaPorCategoria)
graficosRouter.get('/despesaPorTag', loadPlan, bloquearGraficosFree, graficosControllers.despesaPorTag)

export default graficosRouter
