import express from 'express';
const authRouter = express.Router();
import authController from '../../controllers/autenticacao/authController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';

authRouter.post('/cadastro', authController.cadastroUsuario)
//authRouter.get('/buscaCadastro', authController.buscaCadastro)
authRouter.put('/vincCadastro', authController.vincCadastro)
authRouter.post('/login', authController.loginUsuario)
authRouter.get('/buscaCadEmail', authController.gerarToken)
authRouter.put('/mudaSenha', authController.mudaSenha)
authRouter.get('/validaToken', authController.validaToken)
authRouter.put('/editCadastro', autenticarJWT, authController.editUser)
authRouter.get('/validaVinculo', authController.validaVinculo)
authRouter.get('/getPerfil', autenticarJWT, authController.getPerfil)
authRouter.get('/verificaWhats', authController.verificaWhats)
authRouter.get('/atualizaUser', autenticarJWT, authController.atualizaUsuario)
authRouter.post('/loginGoogle', authController.loginGoogle)

export default authRouter;