import express from 'express'
const assinaturasRouter = express.Router()
import assinaturasController from '../controllers/assinaturasController.mjs'
import { autenticarJWT } from '../../../middlewares/auth.mjs'

assinaturasRouter.post('/createCheckout', autenticarJWT, assinaturasController.createCheckout)
assinaturasRouter.post('/createSub', assinaturasController.createAssinatura)
assinaturasRouter.post('/mpWebHook', assinaturasController.mpWebHook)
assinaturasRouter.get('/ofertas', assinaturasController.getOfertas)

export default assinaturasRouter
