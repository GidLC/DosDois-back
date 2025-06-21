import express from 'express';
const frontRouter = express.Router();
import frontController from '../../controllers/front/frontController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';

frontRouter.use(autenticarJWT)

frontRouter.get('/buscaCores', frontController.buscaCores)
frontRouter.get('/buscaIcones', frontController.buscaIcones)
frontRouter.post('/buscaCorID', frontController.buscaCorID)
frontRouter.post('/buscaIconeID', frontController.buscaIconeID)

export default frontRouter