import express from 'express';
import { autenticarJWT } from '../../../middlewares/auth.mjs';
import eventoProdutoController from '../controllers/eventoProdutoController.mjs';

const eventoProdutoRouter = express.Router();
eventoProdutoRouter.use(autenticarJWT);
eventoProdutoRouter.post('/sessao', eventoProdutoController.registrarSessao);

export default eventoProdutoRouter;
