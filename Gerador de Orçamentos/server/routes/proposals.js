const express = require('express');

module.exports = function buildProposalsRouter(store) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const proposals = (await store.get('proposals')) || [];
    res.json(proposals);
  });

  router.get('/:id', async (req, res) => {
    const proposals = (await store.get('proposals')) || [];
    const found = proposals.find((proposal) => proposal.id === req.params.id);
    if (!found) {
      return res.status(404).json({ message: 'Proposta nÇœo encontrada.' });
    }
    res.json(found);
  });

  router.post('/', async (req, res) => {
    const proposals = (await store.get('proposals')) || [];
    const now = new Date().toISOString();
    const proposal = {
      ...req.body,
      id: req.body?.id || Date.now().toString(),
      createdAt: now,
      updatedAt: now,
      status: req.body?.status || 'draft'
    };
    proposals.push(proposal);
    await store.set('proposals', proposals);
    res.status(201).json(proposal);
  });

  router.put('/:id', async (req, res) => {
    const proposals = (await store.get('proposals')) || [];
    const index = proposals.findIndex((proposal) => proposal.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ message: 'Proposta nÇœo encontrada.' });
    }

    const updated = {
      ...proposals[index],
      ...req.body,
      id: proposals[index].id,
      updatedAt: new Date().toISOString()
    };

    proposals[index] = updated;
    await store.set('proposals', proposals);
    res.json(updated);
  });

  router.delete('/:id', async (req, res) => {
    const proposals = (await store.get('proposals')) || [];
    const filtered = proposals.filter((proposal) => proposal.id !== req.params.id);
    await store.set('proposals', filtered);
    res.json({ success: true });
  });

  return router;
};
