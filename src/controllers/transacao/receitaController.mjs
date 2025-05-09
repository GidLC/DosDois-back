import ReceitaModel from "../../models/transacoes/receitaModel.mjs";

const addReceita = (req, res) => {
  const { descricao, valor, categoria, status, data, banco, tipo, fixa, tag, obs, repetir } = req.body;
  const cod_casal = req.header('auth');
  const usuario = req.header('usuario')
  ReceitaModel.addReceita(descricao, valor, usuario, cod_casal, categoria, status, data, banco, tipo, tag, fixa, obs, repetir, (err, resultado) => {
    if (err) {
      console.error('Erro ao cadastrar receita:', err);
      return res.status(500).json({ message: `Erro ao cadastrar receita. ${err}`});
    }
    res.status(200).json({ message: 'Receita cadastrada com sucesso', resultado });
  });
};

const readReceita = (req, res) => {
  const casal = req.header('auth');
  const usuario = req.header('usuario');
  const mes = req.header('mes');
  const ano = req.header('ano');
  const fixa = req.header('fixa')

  ReceitaModel.readReceita(usuario, casal, mes, ano, fixa, (err, results) => {
    if (err) {
      console.error('Erro ao Encontrar as receitas', err);
      return res.status(500).json({ error: `Erro ao buscar receitas. ${err}` });
    }

    res.status(200).json({ message: 'Receitas encontradas', results })
  })
}

const readReceitaID = (req, res) => {
  const id = req.header('id');
  const casal = req.header('auth');
  const usuario = req.header('usuario');
  const fixa = req.header('fixa')

  ReceitaModel.readReceitaID(id, usuario, casal, fixa, (err, results) => {
    if (err) {
      console.error('Erro ao Encontrar a receita', err);
      return res.status(500).json({ error: 'Erro ao buscar a receita' });
    }

    res.status(200).json({ message: 'Receita encontrada', results })
  })
}

const editReceita = (req, res) => {
  const casal = req.header('auth');
  const {id, descricao, categoria, valor, data, tipo, status, tag, obs, fixa, banco} = req.body
  ReceitaModel.editReceita(casal, tipo, id, descricao, categoria, valor, data, status, tag, obs, fixa, banco, (err, results) => {
    if (err) {
      console.error('Erro ao editar a receita', err);
      return res.status(500).json({ error: 'Erro ao editar a receita' });
    }

    res.status(200).json({ message: 'Receita editada com sucesso', results })
  })
}

const editReceitaFixa = (req, res) => {
  const casal = req.header('auth');
  const pendentes = req.header('pend');
  const { id_fixo, descricao, categoria, valor, data, tipo, tag, obs } = req.body

  ReceitaModel.editReceitaFixa(casal, id_fixo, descricao, categoria, valor, data, tipo, pendentes, tag, obs, (err, results) => {
      if (err) {
          console.error('Erro ao editar a receita', err);
          return res.status(500).json({ error: 'Erro ao editar a receita' });
      }

      res.status(200).json({ message: 'Receitas editadas com sucesso', results })
  })

}

const deleteReceita = (req, res) => {
  const casal = req.header('auth');
  const usuario = req.header('usuario');
  const id = req.header('id');
  const id_fixo = req.header('id_fixo')
  const pend = req.header('pend')

  ReceitaModel.deleteReceita(id, usuario, casal, pend, id_fixo, (err, results) => {
    if (err) {
      console.error('Erro ao excluir receita', err);
      return res.status(500).json({ message: 'Não foi possível excluir a receita' });
    }

    res.status(200).json({ message: 'Receita excluida com sucesso', results });
  })
}

const efetivaReceita = (req, res) => {
  const casal = req.header('auth');
  const receitaId = req.header('id');
  const fixa = req.header('fixa');

  ReceitaModel.efetivaReceita(casal, receitaId, fixa, (err, results) => {
    if (err) {
      console.error('Erro ao efetivar receita', err);
      return res.status(500).json({message: `Não foi possível efetivar a receita: ${err}`});
    }

    res.status(200).json({message: 'Receita efetivada com sucesso', results});
  })
}


export default { addReceita, readReceita, deleteReceita, readReceitaID, editReceita, efetivaReceita, editReceitaFixa }