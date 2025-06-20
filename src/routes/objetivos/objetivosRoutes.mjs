import express from 'express'
const objetivoRouter = express.Router()
import objetivosController from '../../controllers/objetivos/objetivosController.mjs'
import { autenticarJWT } from '../../appDosDois.mjs'

objetivoRouter.use(autenticarJWT)

objetivoRouter.post('/addObjetivo', objetivosController.addObjetivo)
objetivoRouter.get('/readObjetivos', objetivosController.readObjetivos)
objetivoRouter.get('/readObjetivoId', objetivosController.readObjetivoId)
objetivoRouter.delete('/deleteObjetivo', objetivosController.deleteObjetivo)
objetivoRouter.post('/aporteObjetivo', objetivosController.aporteObjetivo)
objetivoRouter.get('/readAportes', objetivosController.readAportes)
objetivoRouter.put('/mudaStatusObj', objetivosController.mudaStatusObjetivo)
objetivoRouter.put('/editObjetivo', objetivosController.editObjetivo)

export default objetivoRouter