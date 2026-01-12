const path = require('path');
const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const defaultData = require('./data/app-data.json');
const DataStore = require('./storage/dataStore');
const GoogleAuthService = require('./services/googleAuth');
const buildApiRouter = require('./routes');

async function bootstrap() {
  const app = express();
  const port = process.env.PORT || 5173;

  const dataFile = path.join(__dirname, 'data', 'app-data.json');
  const store = new DataStore(dataFile, defaultData);
  await store.ensureReady();

  const googleAuthService = new GoogleAuthService(store);

  app.use(morgan('dev'));
  app.use(compression());
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

  app.get('/', (req, res) => {
    res.redirect('/app/');
  });

  app.listen(port, () => {
    console.log(`Servidor iniciado em http://127.0.0.1:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar servidor:', error);
  process.exit(1);
});
