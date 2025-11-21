import express from 'express'
const cartoesRouter = express.Router()
import cartoesController from '../controllers/cartoesController.mjs'
import { autenticarJWT } from '../../../middlewares/auth.mjs'

cartoesRouter.use(autenticarJWT)

cartoesRouter.post('/addCartao', cartoesController.addCartao)
cartoesRouter.get('/getBandeiras', cartoesController.buscaBandeiras)

export default cartoesRouter