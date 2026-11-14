import express from 'express';
const despesaRouter = express.Router();
import despesaController from '../controllers/despesaController.mjs';
import { autenticarJWT } from '../../../middlewares/auth.mjs';
import { requireCardModuleWhenPresent } from '../../../middlewares/moduloAtivo.mjs';

despesaRouter.use(autenticarJWT)

despesaRouter.post('/addDespesa', requireCardModuleWhenPresent, despesaController.addDespesa);
despesaRouter.get('/readDespesa', despesaController.readDespesa);
despesaRouter.get('/readCalendarioGastos', despesaController.readCalendarioGastos);
despesaRouter.get('/readDespesaID', despesaController.readDespesaID);
despesaRouter.delete('/deleteDespesa', requireCardModuleWhenPresent, despesaController.deleteDespesa);
despesaRouter.put('/editDespesa', requireCardModuleWhenPresent, despesaController.editDespesa);
despesaRouter.put('/editDespesaFixa', despesaController.editDespesaFixa);
despesaRouter.put('/efetivaDespesa', requireCardModuleWhenPresent, despesaController.efetivaDespesa);

export default despesaRouter;
