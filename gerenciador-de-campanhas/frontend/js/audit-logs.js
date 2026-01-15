const API_BASE = window.location.origin;

// Token já foi capturado no index.html inline script
let adminToken = localStorage.getItem('adminToken');
console.log('[AUTH] Token carregado em audit-logs.js:', adminToken ? 'PRESENTE' : 'AUSENTE');

function authFetch(url, options = {}) {
  const headers = options.headers || {};
  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }
  return fetch(url, { ...options, headers });
}

function logout() {
  console.log('[AUTH] Logout chamado de audit-logs');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  const workspaceUrl = window.WORKSPACE_CONFIG?.WORKSPACE_URL || window.location.origin.replace('backend', 'workspace');
  window.location.href = `${workspaceUrl}/login.html`;
}

const filterUsername = document.getElementById('filterUsername');
const filterAction = document.getElementById('filterAction');
const btnFilter = document.getElementById('btnFilter');
const btnLogout = document.getElementById('btnLogout');
const auditTableBody = document.getElementById('auditTableBody');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const btnLoadMore = document.getElementById('btnLoadMore');
const adminUserName = document.getElementById('adminUserName');

let currentFilters = {};
let currentSkip = 0;
const LIMIT = 50;

function getActionBadgeClass(action) {
  if (action.includes('create')) return 'action-create';
  if (action.includes('update')) return 'action-update';
  if (action.includes('delete')) return 'action-delete';
  if (action.includes('verify')) return 'action-verify';
  if (action.includes('sync')) return 'action-sync';
  return '';
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAction(action) {
  const map = {
    'campaign:create': 'Criar Campanha',
    'campaign:update': 'Atualizar Campanha',
    'campaign:delete': 'Deletar Campanha',
    'driver:create': 'Criar Motorista',
    'driver:update': 'Atualizar Motorista',
    'driver:delete': 'Deletar Motorista',
    'graphic:create': 'Criar Gráfica',
    'graphic:update': 'Atualizar Gráfica',
    'graphic:delete': 'Deletar Gráfica',
    'evidence:verify': 'Verificar Evidência',
    'campaign:sync': 'Sincronizar Campanha',
  };
  return map[action] || action;
}

function formatDetails(log) {
  const details = log.details || {};
  const parts = [];
  
  if (details.campaignName) parts.push(`Campanha: ${details.campaignName}`);
  if (details.driverName) parts.push(`Motorista: ${details.driverName}`);
  if (details.graphicName) parts.push(`Gráfica: ${details.graphicName}`);
  if (details.flowType) parts.push(`Fluxo: ${details.flowType}`);
  if (details.verified !== undefined) parts.push(details.verified ? 'Verificado' : 'Desverificado');
  
  return parts.length > 0 ? parts.join(' | ') : '-';
}

function renderLogs(logs, append = false) {
  if (!append) {
    auditTableBody.innerHTML = '';
  }

  if (logs.length === 0 && !append) {
    auditTableBody.innerHTML = '<tr><td colspan="5" class="no-logs">Nenhum registro encontrado</td></tr>';
    loadMoreContainer.style.display = 'none';
    return;
  }

  logs.forEach(log => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="timestamp">${formatTimestamp(log.timestamp)}</td>
      <td class="user-name">${log.name || log.username || 'Unknown'}</td>
      <td><span class="action-badge ${getActionBadgeClass(log.action)}">${formatAction(log.action)}</span></td>
      <td>${log.entityType || '-'}</td>
      <td>${formatDetails(log)}</td>
    `;
    auditTableBody.appendChild(row);
  });

  if (logs.length >= LIMIT) {
    loadMoreContainer.style.display = 'block';
  } else {
    loadMoreContainer.style.display = 'none';
  }
}

async function loadLogs(append = false) {
  try {
    const params = new URLSearchParams({
      limit: LIMIT,
      skip: append ? currentSkip : 0,
      ...currentFilters,
    });

    const response = await authFetch(`${API_BASE}/api/admin/audit-logs?${params}`);
    
    if (response.status === 401) {
      logout();
      return;
    }

    if (!response.ok) {
      throw new Error('Erro ao carregar logs');
    }

    const data = await response.json();
    renderLogs(data.logs || [], append);

    if (append) {
      currentSkip += data.logs.length;
    } else {
      currentSkip = data.logs.length;
    }
  } catch (err) {
    console.error('Erro ao carregar logs:', err);
    auditTableBody.innerHTML = '<tr><td colspan="5" class="no-logs">Erro ao carregar logs</td></tr>';
  }
}

function applyFilters() {
  currentFilters = {};
  if (filterUsername.value.trim()) {
    currentFilters.username = filterUsername.value.trim();
  }
  if (filterAction.value) {
    currentFilters.action = filterAction.value;
  }
  currentSkip = 0;
  loadLogs();
}

btnFilter.addEventListener('click', applyFilters);
btnLoadMore.addEventListener('click', () => loadLogs(true));

btnLogout.addEventListener('click', async () => {
  try {
    await authFetch('/api/admin/logout', { method: 'POST' });
  } catch (err) {
    console.error('Erro no logout:', err);
  }
  logout();
});

// Exibe nome do usuário
const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
if (adminUserName && adminUser.name) {
  adminUserName.textContent = adminUser.name;
}

// Carrega logs inicial
loadLogs();

// Voltar ao dashboard (adiciona listener em vez de usar onclick inline)
const btnBackDashboard = document.getElementById('btnBackDashboard');
if (btnBackDashboard) {
  btnBackDashboard.addEventListener('click', () => {
    // Prefer explicit navegação para o dashboard
    window.location.href = '/index.html';
  });
}
