import express from 'express';
const bancoRouter = express.Router();
import bancoController from '../../controllers/banco/bancoController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';
import { checkModuleLimit, loadPlan } from '../../middlewares/assinatura.mjs';

bancoRouter.use(autenticarJWT);

bancoRouter.post('/addBanco', loadPlan, checkModuleLimit('bancos'), bancoController.addBanco)
bancoRouter.get('/readBanco', bancoController.readBanco)
bancoRouter.get('/readBancoID', bancoController.readBancoID)
bancoRouter.get('/saldoBanco', bancoController.saldoBanco)
bancoRouter.put('/altSaldoInicial', bancoController.alteraSaldoInicial)
bancoRouter.put('/arqDesBanco', bancoController.arqDesBanco)
bancoRouter.put('/editBanco', bancoController.editBanco)

export default bancoRouter