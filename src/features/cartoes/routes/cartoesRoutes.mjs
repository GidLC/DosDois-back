import express from 'express'
const cartoesRouter = express.Router()
import cartoesController from '../controllers/cartoesController.mjs'
import { autenticarJWT } from '../../../middlewares/auth.mjs'
import { checkModuleLimit, loadPlan } from '../../../middlewares/assinatura.mjs'
import { requireActiveModule } from '../../../middlewares/moduloAtivo.mjs'

cartoesRouter.use(autenticarJWT)

cartoesRouter.post('/addCartao', loadPlan, requireActiveModule('cartoes'), checkModuleLimit('cartoes'), cartoesController.addCartao)
cartoesRouter.get('/getBandeiras', cartoesController.buscaBandeiras)
cartoesRouter.get('/getAllCartoes', cartoesController.getAllCartoes)
cartoesRouter.post('/pagarFatura', requireActiveModule('cartoes'), cartoesController.pagarFatura)
cartoesRouter.put('/editCartao', requireActiveModule('cartoes'), cartoesController.editCartao)

export default cartoesRouter
