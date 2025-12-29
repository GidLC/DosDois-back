import { app } from './config/config.mjs';
import cron from 'node-cron'
import authRouter from './routes/autenticacao/authRoutes.mjs';
import bancoRouter from './routes/banco/bancoRoutes.mjs';
import CategoriaTrRouter from './routes/categoria/CategoriaTrRoutes.mjs';
import frontRouter from './routes/front/frontRoutes.mjs';
import enviaEmailRouter from './routes/mail/enviaEmailRoutes.mjs';
import compraRouter from './routes/transacao/compraRoutes.mjs';
import despesaRouter from './features/despesas/routes/despesaRoutes.mjs';
import receitaRouter from './routes/transacao/receitaRoutes.mjs';
import graficosRouter from './routes/graficos/GraficosRoutes.mjs';
import saldosRouter from './routes/saldos/saldosRoutes.mjs';
import transfRouter from './routes/transacao/transferenciaRoutes.mjs';
import objetivoRouter from './routes/objetivos/objetivosRoutes.mjs';
import tagsRouter from './routes/tags/tagsRoutes.mjs';
import cartoesRouter from './features/cartoes/routes/cartoesRoutes.mjs';
import { fechaFaturas } from './jobs/fechaFaturas.mjs';

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
app.use('/apiDDv1/cartoes', cartoesRouter)

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor Node.js em execução na porta ${PORT}`);
});

//Execução de tarefas recorrentes
cron.schedule('59 16 * * *', () => {
  console.log("Executando cron da Meia noite")
  fechaFaturas()
})

export default PORT;
