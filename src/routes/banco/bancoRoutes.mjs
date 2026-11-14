import express from 'express';
const bancoRouter = express.Router();
import bancoController from '../../controllers/banco/bancoController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';
import { checkModuleLimit, loadPlan } from '../../middlewares/assinatura.mjs';
import { requireActiveModule } from '../../middlewares/moduloAtivo.mjs';

bancoRouter.use(autenticarJWT);

bancoRouter.post('/addBanco', loadPlan, requireActiveModule('bancos'), checkModuleLimit('bancos'), bancoController.addBanco)
bancoRouter.get('/readBanco', bancoController.readBanco)
bancoRouter.get('/readBancoID', bancoController.readBancoID)
bancoRouter.get('/saldoBanco', bancoController.saldoBanco)
bancoRouter.put('/altSaldoInicial', requireActiveModule('bancos'), bancoController.alteraSaldoInicial)
bancoRouter.put('/arqDesBanco', loadPlan, requireActiveModule('bancos'), checkModuleLimit('bancos', true), bancoController.arqDesBanco)
bancoRouter.put('/editBanco', requireActiveModule('bancos'), bancoController.editBanco)

export default bancoRouter
