const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const defaultData = require('./data/app-data.json');
const DataStore = require('./storage/dataStore');
const GoogleAuthService = require('./services/googleAuth');
const buildApiRouter = require('./routes');
const mongoClient = require('./services/mongoClient');

async function bootstrap() {
  const app = express();
  const port = process.env.PORT || 5173;

  const dataFile = path.join(__dirname, 'data', 'app-data.json');
  const store = new DataStore(dataFile, defaultData);
  await store.ensureReady();

  const googleAuthService = new GoogleAuthService(store);
  
  // Inicializar MongoDB no startup
  console.log('[Startup] Inicializando MongoDB...');
  try {
    await mongoClient.getDb();
    console.log('[Startup] ✅ MongoDB pronto');
  } catch (error) {
    console.error('[Startup] ⚠️ MongoDB não conectou no startup:', error.message);
    console.error('[Startup] ⚠️ Servidor vai iniciar mas MongoDB pode estar indisponível');
  }

  app.use(morgan('dev'));
  app.use(compression());
  
  // ========== CONFIGURAÇÃO CORS ==========
  // Lista de origens permitidas
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:4173',
    'https://oddrive-workspace.onrender.com',
    'https://oddrive-backend.onrender.com',
    'https://oddrive-gerador.onrender.com',
  ];
  
  // Adicionar origens customizadas do .env
  if (process.env.CORS_ORIGINS) {
    const customOrigins = process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    allowedOrigins.push(...customOrigins);
  }
  
  app.use(cors({
    origin: function(origin, callback) {
      // Permitir requests sem origin (ex: Postman, curl, same-origin)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('[CORS] Origem bloqueada:', origin);
        callback(new Error('Origem não permitida pelo CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24h cache de preflight
  }));
  
  // Aceitar payloads grandes (imagens em base64, planilhas etc.)
  app.use(express.json({ limit: '150mb' }));
  app.use(express.urlencoded({ extended: true, limit: '150mb' }));

  const textExts = new Set(['.html', '.css', '.js', '.mjs', '.cjs', '.json', '.svg', '.txt', '.md']);
  const defaultMimeByExt = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.cjs': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.md': 'text/markdown'
  };
  const utf8StaticOptions = {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!textExts.has(ext)) return;
      const currentType = res.getHeader('Content-Type');
      if (typeof currentType === 'string' && currentType.length) {
        if (!/charset=/i.test(currentType)) {
          res.setHeader('Content-Type', `${currentType}; charset=utf-8`);
        }
      } else {
        const fallback = defaultMimeByExt[ext];
        if (fallback) {
          res.setHeader('Content-Type', `${fallback}; charset=utf-8`);
        }
      }
    }
  };

  app.use('/public', express.static(path.join(__dirname, '..', 'public'), utf8StaticOptions));
  app.use('/api', buildApiRouter(store, googleAuthService));

  const staticRoot = path.join(__dirname, '..', 'src');
  app.use(express.static(staticRoot, utf8StaticOptions));

  // Health check endpoint para Render (DEVE vir antes do redirect)
  app.get('/health', async (req, res) => {
    const health = {
      status: 'ok', 
      service: 'gerador-de-orcamentos',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: 'unknown'
    };
    
    // Verificar MongoDB
    try {
      await mongoClient.getDb();
      health.mongodb = 'connected';
    } catch (error) {
      health.mongodb = 'disconnected';
      health.mongoError = error.message;
    }
    
    res.status(200).json(health);
  });

  app.get('/', (req, res) => {
    res.redirect('/app/');
  });

  app.listen(port, () => {
    console.log(`========================================`);
    console.log(`🚀 Gerador de Orçamentos`);
    console.log(`📍 Servidor: http://127.0.0.1:${port}`);
    console.log(`✅ Health: http://127.0.0.1:${port}/health`);
    console.log(`========================================`);
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar servidor:', error);
  process.exit(1);
});
