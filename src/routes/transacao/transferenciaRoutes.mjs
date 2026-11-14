import express from 'express'
const transfRouter = express.Router();
import transferenciaController from '../../controllers/transacao/transferenciaController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';
import { requireActiveModule } from '../../middlewares/moduloAtivo.mjs';

transfRouter.use(autenticarJWT)

transfRouter.post('/addTransf', requireActiveModule('bancos'), transferenciaController.addTransferencia)
transfRouter.get('/readTransf', transferenciaController.readTransferencias)
transfRouter.delete('/deleteTransf', requireActiveModule('bancos'), transferenciaController.deleteTransferencia)
transfRouter.get('/readTransfID', transferenciaController.readTransferenciaID)
transfRouter.put('/editTransf', requireActiveModule('bancos'), transferenciaController.editTransferencia)

export default transfRouter
