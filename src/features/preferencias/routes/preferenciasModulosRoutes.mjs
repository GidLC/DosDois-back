import express from 'express';
import { autenticarJWT } from '../../../middlewares/auth.mjs';
import { loadPlan } from '../../../middlewares/assinatura.mjs';
import preferenciasModulosController from '../controllers/preferenciasModulosController.mjs';

const preferenciasModulosRouter = express.Router();

preferenciasModulosRouter.use(autenticarJWT, loadPlan);
preferenciasModulosRouter.get('/modulos', preferenciasModulosController.readModules);
preferenciasModulosRouter.put('/modulos', preferenciasModulosController.saveModules);

export default preferenciasModulosRouter;
