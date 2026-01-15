const express = require('express');
const mongoClient = require('../services/mongoClient');

function sanitizeText(value = '') {
  return String(value || '').trim().slice(0, 2000);
}

function buildProposalFromRequest(request) {
  const now = new Date().toISOString();
  return {
    id: `rep-${Date.now()}`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    fonte: 'representante',
    representante: {
      nome: sanitizeText(request.representanteNome),
      email: sanitizeText(request.representanteEmail),
      telefone: sanitizeText(request.representanteTelefone)
    },
    cliente: {
      nomeAnunciante: sanitizeText(request.anunciante || request.empresa),
      nomeEmpresa: sanitizeText(request.empresa),
      pracas: sanitizeText(request.pracas)
    },
    comercial: {
      numeroCarros: Number(request.numeroCarros) || null,
      tempoCampanhaDias: Number(request.tempoCampanhaDias) || null,
      tempoCampanha: request.tempoCampanhaDias ? `${request.tempoCampanhaDias} dias` : '',
      dataInicio: sanitizeText(request.dataInicio),
      dataFim: sanitizeText(request.dataFim),
      validadeDias: Number(request.validadeDias) || null,
      observacoes: sanitizeText(request.observacoes)
    }
  };
}

module.exports = function buildRepresentativesRouter(store) {
  const router = express.Router();

  router.get('/requests', async (req, res) => {
    try {
      const list = await mongoClient.listRepresentativeRequests();
      res.json(list);
    } catch (err) {
      console.error('Erro ao listar solicitações:', err);
      res.status(500).json({ error: 'Erro ao listar solicitações' });
    }
  });

  router.get('/requests/:id', async (req, res) => {
    try {
      const found = await mongoClient.getRepresentativeRequestById(req.params.id);
      if (!found) return res.status(404).json({ error: 'Solicitação não encontrada' });
      res.json(found);
    } catch (err) {
      console.error('Erro ao buscar solicitação:', err);
      res.status(500).json({ error: 'Erro ao buscar solicitação' });
    }
  });

  router.post('/requests', async (req, res) => {
    const {
      representanteNome,
      representanteEmail,
      representanteTelefone,
      anunciante,
      empresa,
      pracas,
      numeroCarros,
      tempoCampanhaDias,
      dataInicio,
      dataFim,
      validadeDias,
      observacoes
    } = req.body || {};

    if (!representanteNome || !representanteEmail) {
      return res.status(400).json({ error: 'Informe nome e e-mail do representante.' });
    }
    if (!anunciante && !empresa) {
      return res.status(400).json({ error: 'Informe o anunciante ou empresa.' });
    }

    try {
      const entry = {
        id: `rep-${Date.now()}`,
        status: 'novo',
        representanteNome: sanitizeText(representanteNome),
        representanteEmail: sanitizeText(representanteEmail),
        representanteTelefone: sanitizeText(representanteTelefone),
        anunciante: sanitizeText(anunciante),
        empresa: sanitizeText(empresa),
        pracas: sanitizeText(pracas),
        numeroCarros: Number(numeroCarros) || null,
        tempoCampanhaDias: Number(tempoCampanhaDias) || null,
        dataInicio: sanitizeText(dataInicio),
        dataFim: sanitizeText(dataFim),
        validadeDias: Number(validadeDias) || null,
        observacoes: sanitizeText(observacoes || '')
      };

      const created = await mongoClient.createRepresentativeRequest(entry);
      res.status(201).json(created);
    } catch (err) {
      console.error('Erro ao criar solicitação:', err);
      res.status(500).json({ error: 'Erro ao criar solicitação' });
    }
  });

  router.patch('/requests/:id/status', async (req, res) => {
    const { status } = req.body || {};
    try {
      const updated = await mongoClient.updateRepresentativeRequestStatus(
        req.params.id,
        sanitizeText(status || 'em_avaliacao')
      );
      res.json(updated);
    } catch (err) {
      if (err.message === 'Solicitação não encontrada') {
        return res.status(404).json({ error: err.message });
      }
      console.error('Erro ao atualizar status:', err);
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  });

  router.post('/requests/:id/convert', async (req, res) => {
    try {
      const request = await mongoClient.getRepresentativeRequestById(req.params.id);
      if (!request) return res.status(404).json({ error: 'Solicitação não encontrada' });

      const proposals = (await store.get('proposals')) || [];
      const proposal = buildProposalFromRequest(request);
      proposals.push(proposal);
      await store.set('proposals', proposals);

      await mongoClient.updateRepresentativeRequest(req.params.id, {
        status: 'convertida',
        proposalId: proposal.id
      });

      res.json({ success: true, proposalId: proposal.id });
    } catch (err) {
      console.error('Erro ao converter solicitação:', err);
      res.status(500).json({ error: 'Erro ao converter solicitação' });
    }
  });

  router.delete('/requests/:id', async (req, res) => {
    try {
      const deleted = await mongoClient.deleteRepresentativeRequest(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Solicitação não encontrada' });
      }
      res.json({ success: true, message: 'Solicitação removida com sucesso' });
    } catch (err) {
      console.error('Erro ao remover solicitação:', err);
      res.status(500).json({ error: 'Erro ao remover solicitação' });
    }
  });

  return router;
};
