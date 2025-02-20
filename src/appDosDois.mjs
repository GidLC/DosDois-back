import {app} from './config.mjs';
import authRouter from './routes/autenticacao/authRoutes.mjs';
import bancoRouter from './routes/banco/bancoRoutes.mjs';
import CategoriaTrRouter from './routes/categoria/CategoriaTrRoutes.mjs';
import frontRouter from './routes/front/frontRoutes.mjs';
import enviaEmailRouter from './routes/mail/enviaEmailRoutes.mjs';
import compraRouter from './routes/transacao/compraRoutes.mjs';
import despesaRouter from './routes/transacao/despesaRoutes.mjs';
import receitaRouter from './routes/transacao/receitaRoutes.mjs';
import graficosRouter from './routes/graficos/GraficosRoutes.mjs';
import saldosRouter from './routes/saldos/saldosRoutes.mjs';
import transfRouter from './routes/transacao/transferenciaRoutes.mjs';
import objetivoRouter from './routes/objetivos/objetivosRoutes.mjs';
import tagsRouter from './routes/tags/tagsRoutes.mjs';

app.use('/apiDDv1/auth', authRouter);
app.use('/apiDDv1/receita', receitaRouter);
app.use('/apiDDv1/despesa', despesaRouter);
app.use('/apiDDv1/compra', compraRouter);
app.use('/apiDDv1/banco', bancoRouter);
app.use('/apiDDv1/categoriaTr', CategoriaTrRouter);
app.use('/apiDDv1/front', frontRouter);
app.use('/apiDDv1/graph', graficosRouter);
app.use('/apiDDv1/email', enviaEmailRouter);
app.use('/apiDDv1/saldos', saldosRouter);
app.use('/apiDDv1/transf', transfRouter);
app.use('/apiDDv1/objetivos', objetivoRouter);
app.use('/apiDDv1/tags', tagsRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor Node.js em execução na porta ${PORT}`);
});

export default PORT;
