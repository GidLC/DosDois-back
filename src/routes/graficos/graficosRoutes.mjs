import express from 'express'
const graficosRouter = express.Router()
import graficosControllers from '../../controllers/graficos/graficosControllers.mjs'

graficosRouter.get('/receitaPorCategoria', graficosControllers.receitaPorCategoria)
graficosRouter.get('/despesaPorCategoria', graficosControllers.despesaPorCategoria)
graficosRouter.get('/despesaPorTag', graficosControllers.despesaPorTag)

export default graficosRouter