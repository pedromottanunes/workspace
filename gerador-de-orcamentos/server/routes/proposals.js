const express = require('express');
const mongoClient = require('../services/mongoClient');

module.exports = function buildProposalsRouter() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const proposals = await mongoClient.listProposals();
      res.json(proposals);
    } catch (error) {
      console.error('[PROPOSALS] Erro ao listar propostas:', error);
      res.status(500).json({ message: 'Erro ao listar propostas.' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const found = await mongoClient.getProposalById(req.params.id);
      if (!found) {
        return res.status(404).json({ message: 'Proposta não encontrada.' });
      }
      res.json(found);
    } catch (error) {
      console.error('[PROPOSALS] Erro ao buscar proposta:', error);
      res.status(500).json({ message: 'Erro ao buscar proposta.' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const proposal = await mongoClient.createProposal(req.body);
      res.status(201).json(proposal);
    } catch (error) {
      console.error('[PROPOSALS] Erro ao criar proposta:', error);
      res.status(500).json({ message: 'Erro ao criar proposta.' });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const updated = await mongoClient.updateProposal(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      if (error.message === 'Proposta não encontrada') {
        return res.status(404).json({ message: error.message });
      }
      console.error('[PROPOSALS] Erro ao atualizar proposta:', error);
      res.status(500).json({ message: 'Erro ao atualizar proposta.' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const deleted = await mongoClient.deleteProposal(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Proposta não encontrada.' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[PROPOSALS] Erro ao deletar proposta:', error);
      res.status(500).json({ message: 'Erro ao deletar proposta.' });
    }
  });

  return router;
};
