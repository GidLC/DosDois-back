import express from 'express';
const receitaRouter = express.Router();
import receitaController from '../../controllers/transacao/receitaController.mjs'

receitaRouter.post('/addReceita', receitaController.addReceita)
receitaRouter.get('/readReceita', receitaController.readReceita)
receitaRouter.delete('/deleteReceita', receitaController.deleteReceita)
receitaRouter.get('/readReceitaID', receitaController.readReceitaID)
receitaRouter.put('/editReceita', receitaController.editReceita)
receitaRouter.put('/efetivaReceita', receitaController.efetivaReceita)
receitaRouter.put('/editReceitaFixa', receitaController.editReceitaFixa)

export default receitaRouter