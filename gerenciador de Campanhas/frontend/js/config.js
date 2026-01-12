// config.js - Configuração centralizada do backend
// Comportamento:
// 1) Se existir a variável global `window.__API_BASE__` é usada (útil para testes com ngrok ou override em runtime)
// 2) Se houver uma meta tag <meta name="api-base" content="https://..."> a URL dessa meta é usada
// 3) Se estiver em localhost (desenvolvimento web) usa http://localhost:5173
// 4) Tenta inferir a partir do hostname (ex.: 192.168.x.x) usando o mesmo protocolo/porta
// 5) Caso contrário retorna vazio (forçar configurar para produção antes de publicar)

function detectApiBase() {
  // 1) override via variável global (mais simples para mobile com ngrok)
  try {
    if (window && window.__API_BASE__ && typeof window.__API_BASE__ === 'string' && window.__API_BASE__.trim()) {
      return window.__API_BASE__.trim();
    }
  } catch (e) { /* ignore */ }

  // 2) override via meta tag
  try {
    const m = document.querySelector('meta[name="api-base"]');
    if (m && m.content && m.content.trim()) return m.content.trim();
  } catch (e) {}

  // 3) localhost (web dev)
  try {
    const host = window.location.hostname;
    const proto = window.location.protocol && window.location.protocol.startsWith('http') ? window.location.protocol : 'http:';
    const port = window.location.port ? `:${window.location.port}` : '';
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${proto}//${host}${port || ':5173'}`;
    }
    // 4) rede local (teste em dispositivo apontando para IP da máquina)
    if (/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
      // usar a mesma porta exposta pelo servidor; se vazia, manter fallback 5173
      return `${proto}//${host}${port || ':5173'}`;
    }
  } catch (e) {}

  // 5) fallback vazio (obrigatório configurar para produção)
  return '';
}

export const API_BASE = detectApiBase();
