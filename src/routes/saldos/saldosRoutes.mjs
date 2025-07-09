import express from 'express'
const saldosRouter = express.Router();
import saldosController from '../../controllers/saldos/saldosController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';

saldosRouter.use(autenticarJWT)

saldosRouter.get('/saldoGeral', saldosController.saldoGeral)
saldosRouter.get('/saldoPeriodo', saldosController.saldoPorPeriodo)

export default saldosRouter