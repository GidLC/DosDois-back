import express from 'express'
const cartoesRouter = express.Router()
import cartoesController from '../controllers/cartoesController.mjs'
import { autenticarJWT } from '../../../middlewares/auth.mjs'

cartoesRouter.use(autenticarJWT)

cartoesRouter.post('/addCartao', cartoesController.addCartao)
cartoesRouter.get('/getBandeiras', cartoesController.buscaBandeiras)
cartoesRouter.get('/getAllCartoes', cartoesController.getAllCartoes)
cartoesRouter.post('/pagarFatura', cartoesController.pagarFatura)
cartoesRouter.put('/editCartao', cartoesController.editCartao)

export default cartoesRouter