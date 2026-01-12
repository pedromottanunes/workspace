/*
Script para configurar o serviço no Render: define startCommand, importa variáveis de `render.env` e aciona deploy.
Uso:
  - Instale dependências: npm install node-fetch@2 dotenv
  - Exporte sua chave: Windows PowerShell: $env:RENDER_API_KEY = 'SUA_CHAVE'
    Linux/macOS: export RENDER_API_KEY='SUA_CHAVE'
  - Execute: node scripts/render-setup.js <serviceId>

O script NÃO envia a sua chave a terceiros; tudo roda a partir da sua máquina local.
*/

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const serviceId = process.argv[2];
if (!serviceId) {
  console.error('Usage: node render-setup.js <serviceId>');
  process.exit(1);
}
const apiKey = process.env.RENDER_API_KEY;
if (!apiKey) {
  console.error('Set RENDER_API_KEY environment variable first');
  process.exit(1);
}

const base = 'https://api.render.com/v1/services/' + serviceId;
const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

function parseEnvFile(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  const lines = txt.split(/\r?\n/);
  const vars = {};
  let key = null;
  let multi = false;
  let acc = [];
  for (let line of lines) {
    if (!multi) {
      if (!line || line.trim().startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      key = line.substring(0, eq).trim();
      let val = line.substring(eq+1);
      // handle quoted multi-line ("...\n...\n") form
      if (val.startsWith('"') && val.endsWith('\\n"')) {
        // already escaped form, keep as-is
        vars[key] = val.replace(/^"|"$/g, '');
      } else if (val.startsWith('"') && !val.endsWith('"')) {
        multi = true;
        acc = [val.replace(/^"/, '')];
      } else {
        vars[key] = val.replace(/^"|"$/g, '');
      }
    } else {
      if (line.endsWith('"')) {
        acc.push(line.replace(/"$/, ''));
        vars[key] = acc.join('\n');
        multi = false; key = null; acc = [];
      } else {
        acc.push(line);
      }
    }
  }
  return vars;
}

async function patchStartCommand(startCommand) {
  const url = base;
  const body = { startCommand };
  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Failed to patch service startCommand: ' + res.statusText);
  return res.json();
}

async function createEnvVar(name, value, secure = true) {
  const url = base + '/env-vars';
  const body = { name, value, secure };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    // if already exists, try to update
    const txt = await res.text();
    throw new Error('Failed to create env var ' + name + ': ' + res.status + ' ' + txt);
  }
  return res.json();
}

async function triggerDeploy() {
  const url = base + '/deploys';
  const res = await fetch(url, { method: 'POST', headers, body: '{}' });
  if (!res.ok) throw new Error('Failed to trigger deploy: ' + res.statusText);
  return res.json();
}

(async () => {
  try {
    const envPath = path.join(__dirname, '..', 'render.env');
    if (!fs.existsSync(envPath)) throw new Error('render.env not found at ' + envPath);
    console.log('Parsing', envPath);
    const vars = parseEnvFile(envPath);

    console.log('Updating startCommand -> npm start');
    await patchStartCommand('npm start');
    console.log('startCommand updated');

    console.log('Creating environment variables (secure)...');
    for (const [k,v] of Object.entries(vars)) {
      // Skip empty values
      if (v === undefined || v === null || String(v).trim() === '') continue;
      try {
        await createEnvVar(k, String(v), true);
        console.log(' +', k);
      } catch (err) {
        // If fails due to existing var, try to PATCH existing via edit endpoint
        try {
          // find existing env var id
          const listUrl = base + '/env-vars';
          const listRes = await fetch(listUrl, { headers });
          const list = await listRes.json();
          const found = list.find(x => x.name === k);
          if (found) {
            const editUrl = base + '/env-vars/' + found.id;
            const editRes = await fetch(editUrl, { method: 'PATCH', headers, body: JSON.stringify({ value: String(v), secure: true }) });
            if (!editRes.ok) throw new Error('Edit failed');
            console.log(' ~ updated', k);
          } else {
            console.warn(' ! skipped', k, ' (create failed)');
          }
        } catch (e) {
          console.warn(' ! could not create/update', k, '-', e.message);
        }
      }
    }

    console.log('Triggering deploy...');
    const dep = await triggerDeploy();
    console.log('Deploy triggered:', dep.id);
    console.log('Done. Verifique o deploy no painel do Render.');
  } catch (e) {
    console.error('Erro:', e.message || e);
    process.exit(2);
  }
})();
