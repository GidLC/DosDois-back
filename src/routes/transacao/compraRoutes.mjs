import express from 'express';
const compraRouter = express.Router();
import compraController from '../../controllers/transacao/compraController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';

compraRouter.use(autenticarJWT)

compraRouter.get('/buscaNF', compraController.buscaNF)

export default compraRouter