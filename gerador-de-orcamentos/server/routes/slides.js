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
    console.log('[OAuth Callback] Recebendo callback do Google');
    
    try {
      // Timeout de 25 segundos para evitar que fique travado
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na autorização')), 25000)
      );
      
      const authPromise = googleAuthService.handleCallback(req.query);
      
      await Promise.race([authPromise, timeoutPromise]);
      
      console.log('[OAuth Callback] ✅ Autorização concluída');
      
      // HTML com auto-close e feedback visual
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Autorização Concluída</title>
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255,255,255,0.1);
              border-radius: 20px;
              backdrop-filter: blur(10px);
            }
            h1 { margin: 0 0 20px 0; font-size: 32px; }
            p { margin: 10px 0; opacity: 0.9; }
            .success { font-size: 64px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>Autorização Concluída!</h1>
            <p>Conexão com Google estabelecida com sucesso.</p>
            <p>Esta janela será fechada automaticamente...</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
              // Se não conseguir fechar, redireciona
              setTimeout(() => {
                window.location.href = '/app/settings/';
              }, 1000);
            }, 2000);
          </script>
        </body>
        </html>
      `);
      
    } catch (error) {
      console.error('[OAuth Callback] ❌ Erro:', error.message);
      
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Erro na Autorização</title>
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255,255,255,0.1);
              border-radius: 20px;
              backdrop-filter: blur(10px);
              max-width: 500px;
            }
            h1 { margin: 0 0 20px 0; font-size: 32px; }
            p { margin: 10px 0; opacity: 0.9; }
            .error { font-size: 64px; margin-bottom: 20px; }
            .error-msg { 
              background: rgba(0,0,0,0.2);
              padding: 15px;
              border-radius: 10px;
              margin-top: 20px;
              font-family: monospace;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">❌</div>
            <h1>Erro na Autorização</h1>
            <p>Não foi possível completar a autorização com o Google.</p>
            <div class="error-msg">${error.message}</div>
            <p style="margin-top: 20px;">Tente novamente nas configurações.</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
              setTimeout(() => {
                window.location.href = '/app/settings/';
              }, 1000);
            }, 5000);
          </script>
        </body>
        </html>
      `);
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
