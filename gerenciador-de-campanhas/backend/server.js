import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import campaignsRouter from './routes/campaigns.js';
import importsRouter from './routes/imports.js';
import configRouter from './routes/config.js';
import sessionRouter from './routes/sessions.js';
import storageRouter from './routes/storage.js';
import adminAuthRouter from './routes/admin-auth.js';
import os from 'os';

const app = express();
const trustProxy = process.env.TRUST_PROXY === '1';
if (trustProxy) {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

// Simple request logger to help debug static assets when testing via IP
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    try {
      const dur = Date.now() - start;
      // only log requests that look like frontend assets or html pages
      if (/\.(css|js|png|jpg|jpeg|svg|html)$/.test(req.path) || req.path === '/' || req.path.startsWith('/assets')) {
        const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
        console.log(`[REQ] ${req.method} ${proto}://${req.get('host')}${req.originalUrl} -> ${res.statusCode} (${dur}ms)`);
      }
    } catch (e) {}
  });
  next();
});

// Configuração de segurança HTTP com Helmet
// In development we avoid sending strict transport/security headers that
// cause browsers to upgrade or reject insecure origins (HSTS, COOP, origin-keying).
const isProd = (process.env.NODE_ENV === 'production');
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline necessário para captura de token do URL
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'", 'https:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: ["'self'", process.env.WORKSPACE_URL || 'http://localhost:4173', 'http://localhost:*', 'http://127.0.0.1:*'],
      upgradeInsecureRequests: null, // explicitly disable upgrade to HTTPS in dev
    },
  },
};

if (isProd) {
  helmetOptions.hsts = {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  };
} else {
  // disable headers that require secure contexts in dev to avoid browsers
  // treating local IPs as untrustworthy and upgrading requests to HTTPS
  helmetOptions.crossOriginOpenerPolicy = false;
  helmetOptions.originAgentCluster = false;
}

app.use(helmet(helmetOptions));

// Rate limiting para prevenir ataques de força bruta
// Em ambientes de desenvolvimento/tests preferimos não bloquear testes locais.
// Em produção a limitação permanece ativa. É possível desabilitar via
// env `DISABLE_RATE_LIMIT=1` ou quando NODE_ENV !== 'production' ela será
// automaticamente ignorada.
function shouldSkipRateLimit() {
  try {
    if (process.env.DISABLE_RATE_LIMIT === '1') return true;
    if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') return true;
  } catch (e) {}
  return false;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 tentativas (produção)
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip in non-production or when explicitly disabled
  skip: (req, res) => shouldSkipRateLimit(),
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 requisições (produção)
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => shouldSkipRateLimit(),
});

const corsAllowList = new Set(
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean),
);

const devOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'capacitor://localhost',
  'ionic://localhost',
]);

// Production URLs from environment variables
if (process.env.WORKSPACE_URL) devOrigins.add(process.env.WORKSPACE_URL);
if (process.env.BACKEND_URL) devOrigins.add(process.env.BACKEND_URL);
if (process.env.GERADOR_URL) devOrigins.add(process.env.GERADOR_URL);

function isSameOrigin(origin, req) {
  const host = req.get('host');
  if (!host) return false;
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http')
    .split(',')[0]
    .trim();
  return origin === `${proto}://${host}`;
}

function isAllowedOrigin(origin, req) {
  if (!origin) return true; // non-browser or same-origin requests without Origin
  if (corsAllowList.has(origin)) return true;
  // Allow devOrigins in development AND production Render URLs always
  if (devOrigins.has(origin)) return true;
  if (isSameOrigin(origin, req)) return true;
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  if (isAllowedOrigin(origin, req)) return next();
  return res.status(403).json({ error: 'Origem nao permitida' });
});

app.use(cors({
  origin: true, // echo allowed origin after guard
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
// increase body limit to handle base64 images from mobile capture
const bodyLimit = process.env.JSON_BODY_LIMIT || '12mb';
app.use(express.json({ limit: bodyLimit }));

// API com rate limiting
app.use('/api/admin/login', loginLimiter); // Limite estrito para login
app.use('/api/session/driver', loginLimiter); // Limite para login de motorista
app.use('/api/session/graphic', loginLimiter); // Limite para login de gráfica
app.use('/api', apiLimiter); // Limite geral para todas as APIs

app.use('/api/campaigns', campaignsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/config', configRouter);
app.use('/api/session', sessionRouter);
app.use('/api/storage', storageRouter);
app.use('/api/admin', adminAuthRouter);

// servir o workspace unificado e o frontend existente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/workspace', express.static(path.join(__dirname, '..', '..', 'workspace')));
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

function readFileIfExists(filePath) {
  try {
    if (!filePath) return null;
    const resolved = path.resolve(process.cwd(), filePath);
    return fs.readFileSync(resolved);
  } catch (err) {
    console.warn(`[https] Nao foi possivel ler ${filePath}: ${err?.message || err}`);
    return null;
  }
}

function getHttpsOptions() {
  const pfxPath = process.env.LOCAL_SSL_PFX;
  if (pfxPath) {
    const pfx = readFileIfExists(pfxPath);
    if (!pfx) return null;
    const passphrase = process.env.LOCAL_SSL_PFX_PASSPHRASE || process.env.LOCAL_SSL_PFX_PASSWORD || undefined;
    return { pfx, passphrase };
  }

  const keyPath = process.env.LOCAL_SSL_KEY;
  const certPath = process.env.LOCAL_SSL_CERT;
  if (keyPath && certPath) {
    const key = readFileIfExists(keyPath);
    const cert = readFileIfExists(certPath);
    if (!key || !cert) return null;
    return { key, cert };
  }
  return null;
}

const wantHttps = process.env.LOCAL_HTTPS === '1';
const httpsOptions = wantHttps ? getHttpsOptions() : null;
if (wantHttps && !httpsOptions) {
  console.warn('[https] LOCAL_HTTPS=1 mas nao encontrei certificado. Iniciando em HTTP.');
}
const server = httpsOptions ? https.createServer(httpsOptions, app) : http.createServer(app);
const scheme = httpsOptions ? 'https' : 'http';

// Bind explicitly to 0.0.0.0 for cloud platforms (AWS EC2, etc)
server.listen(PORT, HOST, () => {
  console.log(`========================================`);
  console.log(`🚀 Gerenciador de Campanhas`);
  console.log(`📍 Servidor: ${scheme}://0.0.0.0:${PORT}`);
  console.log(`✅ Health: ${scheme}://0.0.0.0:${PORT}/api/session/health`);
  console.log(`🌐 Ambiente: ${isProd ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
  console.log(`========================================`);
  
  // Auto-ensure DB schema on startup (delegado ao service `db.js`)
  (async () => {
    try {
      const { ensureDatabaseSchema } = await import('./services/db.js');
      const out = await ensureDatabaseSchema();
      if (out?.created) console.log('[DB] ✅ Schema criado/garantido.');
      else console.log('[DB] ✅ Schema OK.');
    } catch (e) {
      console.warn('[DB] ⚠️ Falha ao garantir schema:', e?.message || e);
    }
  })();
  
  try {
    const nets = os.networkInterfaces();
    const addrs = Object.values(nets)
      .flat()
      .filter(Boolean)
      .filter(n => (n.family === 'IPv4' || n.family === 4) && !n.internal)
      .map(n => n.address);
    if (addrs.length) {
      console.log('🌍 Acesse pela rede local:');
      for (const ip of addrs) {
        console.log(`   Admin:    ${scheme}://${ip}:${PORT}/`);
        console.log(`   Motorista: ${scheme}://${ip}:${PORT}/driver.html`);
        console.log(`   Grafica:   ${scheme}://${ip}:${PORT}/graphic.html`);
      }
    }
  } catch (e) {
    // ignore network listing errors
  }
});
