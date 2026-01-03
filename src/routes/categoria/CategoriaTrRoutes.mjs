import express from 'express';
const CategoriaTrRouter = express.Router();
import CategoriaTrController from '../../controllers/categoria/CategoriaTrController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';
import { checkModuleLimit, loadPlan } from '../../middlewares/assinatura.mjs';

CategoriaTrRouter.use(autenticarJWT)

CategoriaTrRouter.post('/addCategoriaTr', loadPlan, checkModuleLimit('categorias'), CategoriaTrController.addCategoriaTr)
CategoriaTrRouter.get('/loadCategoriaTr', CategoriaTrController.loadCategoriaTr)
CategoriaTrRouter.get('/loadCatTrSist', CategoriaTrController.loadCategoriasSistema)
CategoriaTrRouter.post('/loadCategoriaTrID', CategoriaTrController.loadCategoriaTrID)
CategoriaTrRouter.post('/editCategoriaTr', CategoriaTrController.editCategoriaTr)
CategoriaTrRouter.delete('/deleteCategoriaTr', CategoriaTrController.deleteCategoriaTr)
CategoriaTrRouter.put('/moveTransacoes', CategoriaTrController.moveTransacoes)

export default CategoriaTrRouter