import graficosModel from "../../models/graficos/graficosModel.mjs";

const receitaPorCategoria = (req, res) => {
    const casal = req.header('auth');
    const usuario = req.header('usuario')
    const mes = req.header('mes')
    const ano = req.header('ano')
    
    graficosModel.receitaPorCategoria(casal, usuario, mes, ano, (err, results) => {
        if(err) {
            return res.status(500).json({error: 'Não foi possível encontrar os saldos das categorias'});
        }

        res.status(200).json({message: 'Saldos encontrados com sucesso', results});
    });
};

const despesaPorCategoria = (req, res) => {
    const casal = req.header('auth');
    const usuario = req.header('usuario')
    const mes = req.header('mes')
    const ano = req.header('ano')
    const tipo = req.header('tipo')
    const parceiro = req.header('parc')
    
    graficosModel.despesaPorCategoria(casal, usuario, mes, ano, parceiro, tipo, (err, results) => {
        if(err) {
            return res.status(500).json({error: 'Não foi possível encontrar os saldos das categorias'});
        }

        res.status(200).json({message: 'Saldos encontrados com sucesso', results});
    });
};

export default {receitaPorCategoria, despesaPorCategoria}