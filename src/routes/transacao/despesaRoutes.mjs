import express from 'express';
const despesaRouter = express.Router();
import despesaController from '../../controllers/transacao/despesaController.mjs';
import { autenticarJWT } from '../../appDosDois.mjs';

despesaRouter.use(autenticarJWT)

despesaRouter.post('/addDespesa', despesaController.addDespesa);
despesaRouter.get('/readDespesa', despesaController.readDespesa);
despesaRouter.get('/readDespesaID', despesaController.readDespesaID);
despesaRouter.delete('/deleteDespesa', despesaController.deleteDespesa);
despesaRouter.put('/editDespesa', despesaController.editDespesa);
despesaRouter.put('/editDespesaFixa', despesaController.editDespesaFixa);
despesaRouter.put('/efetivaDespesa', despesaController.efetivaDespesa);

export default despesaRouter;