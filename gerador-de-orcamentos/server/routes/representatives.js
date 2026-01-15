const express = require('express');

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
    const list = (await store.get('repRequests')) || [];
    res.json(list);
  });

  router.get('/requests/:id', async (req, res) => {
    const list = (await store.get('repRequests')) || [];
    const found = list.find((item) => item.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Solicitação não encontrada' });
    res.json(found);
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

    const list = (await store.get('repRequests')) || [];
    const now = new Date().toISOString();
    const entry = {
      id: `rep-${Date.now()}`,
      status: 'novo',
      createdAt: now,
      updatedAt: now,
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

    list.unshift(entry);
    await store.set('repRequests', list);
    res.status(201).json(entry);
  });

  router.patch('/requests/:id/status', async (req, res) => {
    const { status } = req.body || {};
    const list = (await store.get('repRequests')) || [];
    const idx = list.findIndex((item) => item.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Solicitação não encontrada' });
    list[idx].status = sanitizeText(status || 'em_avaliacao');
    list[idx].updatedAt = new Date().toISOString();
    await store.set('repRequests', list);
    res.json(list[idx]);
  });

  router.post('/requests/:id/convert', async (req, res) => {
    const list = (await store.get('repRequests')) || [];
    const idx = list.findIndex((item) => item.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Solicitação não encontrada' });

    const proposals = (await store.get('proposals')) || [];
    const proposal = buildProposalFromRequest(list[idx]);
    proposals.push(proposal);
    await store.set('proposals', proposals);

    list[idx].status = 'convertida';
    list[idx].updatedAt = new Date().toISOString();
    list[idx].proposalId = proposal.id;
    await store.set('repRequests', list);

    res.json({ success: true, proposalId: proposal.id });
  });

  router.delete('/requests/:id', async (req, res) => {
    const list = (await store.get('repRequests')) || [];
    const idx = list.findIndex((item) => item.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Solicitação não encontrada' });
    
    list.splice(idx, 1);
    await store.set('repRequests', list);
    res.json({ success: true, message: 'Solicitação removida com sucesso' });
  });

  return router;
};
