const express = require('express');
const GoogleSlidesGenerator = require('../../src/lib/google/generator');

module.exports = function buildSlidesRouter(store, googleAuthService) {
  const router = express.Router();

  router.post('/generate', async (req, res) => {
    try {
      const { proposalData, options } = req.body || {};
      if (!proposalData) {
        return res.status(400).json({ success: false, error: 'Dados da proposta nÇœo enviados.' });
      }

      const accessToken = await googleAuthService.getValidAccessToken();
      if (!accessToken) {
        return res.status(401).json({ success: false, error: 'Conecte-se ao Google antes de gerar a apresentaÇõÇœo.' });
      }

      const configOverrides = (await store.get('googleConfig')) || {};
      const generator = new GoogleSlidesGenerator(accessToken, configOverrides);
      const progressTrail = [];
      const result = await generator.generateProposal(
        proposalData,
        (progress, message) => {
          progressTrail.push({ progress, message });
        },
        options || {}
      );

      res.json({ success: true, ...result, progress: progressTrail });
    } catch (error) {
      console.error('[Slides] Falha na geração:', error?.message || error, error?.stack);
      res.status(500).json({
        success: false,
        error: error?.message || 'Erro interno ao gerar proposta.',
        details: error?.response?.data || null,
        status: error?.response?.status || null
      });
    }
  });

  router.post('/export-pdf', async (req, res) => {
    try {
      const { presentationId, proposalId } = req.body || {};
      if (!presentationId) {
        return res.status(400).json({ success: false, error: 'presentationId obrigatÇõÇœrio.' });
      }

      const accessToken = await googleAuthService.getValidAccessToken();
      if (!accessToken) {
        return res.status(401).json({ success: false, error: 'Conecte-se ao Google antes de exportar o PDF.' });
      }

      const configOverrides = (await store.get('googleConfig')) || {};
      const generator = new GoogleSlidesGenerator(accessToken, configOverrides);
      const buffer = await generator.client.exportPresentationPdf(presentationId);
      const fileName = `proposta-${proposalId || Date.now()}.pdf`;

      res.json({
        success: true,
        base64: Buffer.from(buffer).toString('base64'),
        fileName
      });
    } catch (error) {
      console.error('[Slides] Falha ao exportar PDF:', error);
      res.status(500).json({ success: false, error: error.message || 'Erro interno ao exportar PDF.' });
    }
  });

  router.post('/oauth/start', async (req, res) => {
    try {
      const session = await googleAuthService.startSession();
      res.json({ success: true, ...session });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  async function handleOAuthCallback(req, res) {
    try {
      await googleAuthService.handleCallback(req.query);
      res.send('<h2>Autorização concluída. Você pode fechar esta janela.</h2>');
    } catch (error) {
      res.status(400).send(`<h2>Erro na autorizaÇõÇœo: ${error.message}</h2>`);
    }
  }

  router.get('/oauth/callback', handleOAuthCallback);
  router.get('/google/callback', handleOAuthCallback);

  router.get('/token-info', async (req, res) => {
    const info = await googleAuthService.getTokenInfo();
    res.json(info || null);
  });

  router.post('/disconnect', async (req, res) => {
    await googleAuthService.disconnect();
    res.json({ success: true });
  });

  router.post('/refresh', async (req, res) => {
    try {
      const data = await googleAuthService.refreshToken();
      res.json({ success: true, tokenData: data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
};
