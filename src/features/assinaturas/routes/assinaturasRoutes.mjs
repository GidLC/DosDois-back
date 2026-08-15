import express from 'express'
const assinaturasRouter = express.Router()
import assinaturasController from '../controllers/assinaturasController.mjs'
import { autenticarJWT } from '../../../middlewares/auth.mjs'

assinaturasRouter.post('/createCheckout', autenticarJWT, assinaturasController.createCheckout)
assinaturasRouter.post('/createPreferenceValidacao', autenticarJWT, assinaturasController.createPreferenceValidacao)
assinaturasRouter.post('/cancelar', autenticarJWT, assinaturasController.cancelarAssinatura)
assinaturasRouter.post('/asaas/syncPayment', autenticarJWT, assinaturasController.sincronizarPagamentoAsaas)
assinaturasRouter.post('/createSub', assinaturasController.createAssinatura)
assinaturasRouter.get('/mpWebHook', assinaturasController.mpWebHookHealth)
assinaturasRouter.post('/mpWebHook', assinaturasController.mpWebHook)
assinaturasRouter.get('/asaasWebHook', assinaturasController.asaasWebHookHealth)
assinaturasRouter.post('/asaasWebHook', assinaturasController.asaasWebHook)
assinaturasRouter.post('/eventos', assinaturasController.registrarEventoConversao)
assinaturasRouter.get('/ofertas', assinaturasController.getOfertas)

export default assinaturasRouter
