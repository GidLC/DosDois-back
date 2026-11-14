import express from 'express';
const receitaRouter = express.Router();
import receitaController from '../../controllers/transacao/receitaController.mjs'
import { autenticarJWT } from '../../middlewares/auth.mjs';
import { requireActiveModule } from '../../middlewares/moduloAtivo.mjs';

receitaRouter.use(autenticarJWT)

receitaRouter.post('/addReceita', requireActiveModule('receitas'), receitaController.addReceita)
receitaRouter.get('/readReceita', receitaController.readReceita)
receitaRouter.get('/readReceitaFiltrada', receitaController.readReceitaFiltrada)
receitaRouter.get('/readReceitasCasal', receitaController.readReceitasCasal)
receitaRouter.delete('/deleteReceita', requireActiveModule('receitas'), receitaController.deleteReceita)
receitaRouter.get('/readReceitaID', receitaController.readReceitaID)
receitaRouter.put('/editReceita', requireActiveModule('receitas'), receitaController.editReceita)
receitaRouter.put('/efetivaReceita', requireActiveModule('receitas'), receitaController.efetivaReceita)
receitaRouter.put('/editReceitaFixa', requireActiveModule('receitas'), receitaController.editReceitaFixa)

export default receitaRouter
