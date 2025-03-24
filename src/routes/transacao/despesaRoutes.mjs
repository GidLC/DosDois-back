import express from 'express';
const despesaRouter = express.Router();
import despesaController from '../../controllers/transacao/despesaController.mjs';

despesaRouter.post('/addDespesa', despesaController.addDespesa);
despesaRouter.get('/readDespesa', despesaController.readDespesa);
despesaRouter.get('/readDespesaID', despesaController.readDespesaID);
despesaRouter.delete('/deleteDespesa', despesaController.deleteDespesa);
despesaRouter.put('/editDespesa', despesaController.editDespesa);
despesaRouter.put('/editDespesaFixa', despesaController.editDespesaFixa);
despesaRouter.put('/efetivaDespesa', despesaController.efetivaDespesa);

export default despesaRouter;