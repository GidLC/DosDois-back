import express from 'express';
const enviaEmailRouter = express.Router();
import enviaEmailController from '../../controllers/mail/enviaEmailController.mjs';
import { autenticarJWT } from '../../middlewares/auth.mjs';

enviaEmailRouter.use(autenticarJWT)

enviaEmailRouter.post('/enviaEmail', enviaEmailController.enviaEmail)


export default enviaEmailRouter