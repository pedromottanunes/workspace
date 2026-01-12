// Node script to interact with Render API. Usage:
// RENDER_API_KEY=<key> node render-monitor.js status <serviceId>
// Actions: status, deploy, last, logs <deployId>

const fetch = require('node-fetch');
const [,, action, serviceId, maybeDeployId] = process.argv;
const key = process.env.RENDER_API_KEY;
if (!key) { console.error('Set RENDER_API_KEY env var'); process.exit(1); }
if (!action || !serviceId) { console.error('Usage: node render-monitor.js <action> <serviceId> [deployId]'); process.exit(1); }
const base = `https://api.render.com/v1/services/${serviceId}`;
const headers = { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

async function run() {
  try {
    if (action === 'status') {
      const res = await fetch(`${base}/deploys`,{ headers });
      const data = await res.json();
      console.log(data.map(d=>({ id:d.id, state:d.state, startedAt:d.startedAt, finishedAt:d.finishedAt })));
    } else if (action === 'last') {
      const res = await fetch(`${base}/deploys?limit=1`,{ headers });
      const data = await res.json();
      console.log(JSON.stringify(data[0], null, 2));
    } else if (action === 'deploy') {
      const res = await fetch(`${base}/deploys`,{ method:'POST', headers, body: '{}' });
      const data = await res.json();
      console.log('Triggered deploy:', data.id, data.state);
    } else if (action === 'logs') {
      const deployId = maybeDeployId;
      if (!deployId) { console.error('Provide deployId as 3rd arg'); process.exit(1); }
      const res = await fetch(`${base}/deploys/${deployId}/events`,{ headers });
      const data = await res.json();
      data.forEach(e => console.log(`[${e.createdAt}] ${e.message}`));
    } else {
      console.error('Unknown action', action);
    }
  } catch (err) { console.error(err); process.exit(2); }
}
run();
