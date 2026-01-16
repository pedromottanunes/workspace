/**
 * KEEP-ALIVE SCRIPT - Mantém serviços Render acordados
 * 
 * Este script faz ping nos serviços a cada 10 minutos para evitar que
 * entrem em "sleep mode" no plano Free do Render.
 * 
 * COMO USAR:
 * 1. Local: node scripts/keep-alive.js
 * 2. Como serviço: adicione ao cron job ou task scheduler
 * 3. Cloud: use um serviço como UptimeRobot (grátis) ou cron-job.org
 * 
 * IMPORTANTE: No plano Free do Render, os serviços dormem após 15min
 * de inatividade. Este script previne isso.
 */

const https = require('https');

// URLs dos seus serviços no Render
const SERVICES = [
  {
    name: 'Backend (Gerenciador)',
    url: 'https://oddrive-backend.onrender.com/api/session/health',
  },
  {
    name: 'Gerador de Orçamentos',
    url: 'https://oddrive-gerador.onrender.com/health',
  },
  {
    name: 'Workspace',
    url: 'https://oddrive-workspace.onrender.com/index.html',
  },
];

// Intervalo entre pings (10 minutos = 600000ms)
const PING_INTERVAL = 10 * 60 * 1000;

// Timeout para cada request (30 segundos)
const REQUEST_TIMEOUT = 30000;

function formatDate() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

async function pingService(service) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = https.get(service.url, { timeout: REQUEST_TIMEOUT }, (res) => {
      const duration = Date.now() - startTime;
      
      if (res.statusCode >= 200 && res.statusCode < 400) {
        console.log(`✅ [${formatDate()}] ${service.name} - OK (${res.statusCode}) - ${duration}ms`);
        resolve({ success: true, status: res.statusCode, duration });
      } else {
        console.warn(`⚠️  [${formatDate()}] ${service.name} - Status ${res.statusCode} - ${duration}ms`);
        resolve({ success: false, status: res.statusCode, duration });
      }
      
      // Descartar corpo da resposta
      res.resume();
    });

    req.on('timeout', () => {
      req.destroy();
      console.error(`❌ [${formatDate()}] ${service.name} - TIMEOUT (>${REQUEST_TIMEOUT}ms)`);
      resolve({ success: false, error: 'timeout' });
    });

    req.on('error', (err) => {
      console.error(`❌ [${formatDate()}] ${service.name} - ERRO: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.end();
  });
}

async function pingAllServices() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔔 [${formatDate()}] Iniciando ping em todos os serviços...`);
  console.log('='.repeat(60));
  
  const results = await Promise.all(
    SERVICES.map(service => pingService(service))
  );
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log('='.repeat(60));
  console.log(`📊 Resultado: ${successCount}/${totalCount} serviços online`);
  console.log(`⏱️  Próximo ping em ${PING_INTERVAL / 60000} minutos`);
  console.log('='.repeat(60));
}

// Executar imediatamente ao iniciar
console.log('🚀 Keep-Alive Script iniciado');
console.log(`📅 ${formatDate()}`);
console.log(`⏱️  Intervalo: ${PING_INTERVAL / 60000} minutos`);
console.log(`🌐 Monitorando ${SERVICES.length} serviços`);

pingAllServices();

// Executar a cada intervalo
setInterval(pingAllServices, PING_INTERVAL);

// Manter o processo vivo
process.on('SIGINT', () => {
  console.log('\n\n👋 Keep-Alive encerrado pelo usuário');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Erro não tratado:', err);
  // Não encerrar - continuar monitorando
});
