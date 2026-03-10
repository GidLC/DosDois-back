import express from 'express'
const assinaturasRouter = express.Router()
import assinaturasController from '../controllers/assinaturasController.mjs'

assinaturasRouter.post('/createSub', assinaturasController.createAssinatura)
assinaturasRouter.post('/mpWebHook', assinaturasController.mpWebHook)

export default assinaturasRouter