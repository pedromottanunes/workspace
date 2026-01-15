// Aceita token via URL (vindo do workspace) e salva no localStorage
let adminToken = localStorage.getItem('adminToken');

const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');

if (tokenFromUrl) {
  localStorage.setItem('adminToken', tokenFromUrl);
  adminToken = tokenFromUrl;
  window.history.replaceState({}, document.title, window.location.pathname);
}

// Autenticação é gerenciada pelo workspace - não força login aqui

function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers['Authorization'] = `Bearer ${adminToken}`;
  return fetch(url, { ...options, headers });
}

function getAcompanheMode() {
  return (acompanheMode && acompanheMode.value === 'graphic') ? 'graphic' : 'driver';
}

function logout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  window.location.href = '/login.html';
}

// Dialog/feedback helpers (admin-wide)
const __nativeAlertCampaign = window.alert ? window.alert.bind(window) : () => {};
const confirmDialog = (message, options = {}) => {
  if (typeof window.adminConfirm === 'function') return window.adminConfirm(message, options);
  return Promise.resolve(window.confirm(message));
};
const alertDialog = (message, options = {}) => {
  if (typeof window.adminAlert === 'function') return window.adminAlert(message, options);
  __nativeAlertCampaign(String(message));
  return Promise.resolve();
};
const toast = (msg, type = 'info', opts = {}) => {
  if (typeof window.adminToast === 'function') return window.adminToast(msg, type, opts);
  __nativeAlertCampaign(String(msg));
};
window.alert = msg => alertDialog(String(msg));

const urlParams = new URLSearchParams(window.location.search);
const campaignId = urlParams.get('id');

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');
const btnDelete = document.getElementById('btnDelete');
const btnAddDriver = document.getElementById('btnAddDriver');
const btnSaveDrivers = document.getElementById('btnSaveDrivers');
const btnImportKm = document.getElementById("btnImportKm");
const btnSaveKm = document.getElementById('btnSaveKm');
const btnCreateKm = document.getElementById('btnCreateKm');
const importKmModal = document.getElementById('importKmModal');
const importKmForm = document.getElementById('importKmForm');
const importKmSheetId = document.getElementById('importKmSheetId');
const importKmSheetName = document.getElementById('importKmSheetName');
const importKmSubmit = document.getElementById('importKmSubmit');
const importKmMessage = document.getElementById('importKmMessage');
const tblDrivers = document.getElementById('tblDrivers');
const btnAddGraphic = document.getElementById('btnAddGraphic');
const tblGraphics = document.getElementById('tblGraphics');
const driverDetailModal = document.getElementById('driverDetailModal');
const driverModalTitle = document.getElementById('driverModalTitle');
const driverDetailForm = document.getElementById('driverDetailForm');
const driverDetailFields = document.getElementById('driverDetailFields');
const driverDetailSubmit = document.getElementById('driverDetailSubmit');
const driverDetailHint = document.getElementById('driverDetailHint');
const driverFormModal = document.getElementById('driverFormModal');
const driverForm = document.getElementById('driverForm');
const driverFormFields = document.getElementById('driverFormFields');
const driverFormSubmit = document.getElementById('driverFormSubmit');
const driverFormHint = document.getElementById('driverFormHint');
const graphicFormModal = document.getElementById('graphicFormModal');
const graphicForm = document.getElementById('graphicForm');
const graphicFormMessage = document.getElementById('graphicFormMessage');
const graphicFormSubmit = document.getElementById('graphicFormSubmit');
const graphicModalTitle = document.getElementById('graphicModalTitle');
const graphicFormHint = document.getElementById('graphicFormHint');
const graphicIdField = document.getElementById('graphicIdField');
const graphicCountBadge = document.getElementById('graphicCountBadge');
const graphicFieldName = document.getElementById('graphicFieldName');
const graphicFieldEmail = document.getElementById('graphicFieldEmail');
const graphicFieldPhone = document.getElementById('graphicFieldPhone');
const graphicFieldResp1Name = document.getElementById('graphicFieldResp1Name');
const graphicFieldResp1Phone = document.getElementById('graphicFieldResp1Phone');
const graphicFieldResp2Name = document.getElementById('graphicFieldResp2Name');
const graphicFieldResp2Phone = document.getElementById('graphicFieldResp2Phone');
const graphicFieldNotes = document.getElementById('graphicFieldNotes');
// Acompanhe (admin) elements
const acompanheMode = document.getElementById('acompanheMode');
const acompanheDrivers = document.getElementById('acompanheDrivers');
const acompanheGalleryGrid = document.getElementById('acompanheGalleryGrid');
const acompanheStatusPanel = document.getElementById('acompanheStatusPanel');
const acompanheStatusHint = document.getElementById('acompanheStatusHint');
const driverStatusChip = document.getElementById('driverStatusChip');
const driverStatusNote = document.getElementById('driverStatusNote');
const graphicStatusChip = document.getElementById('graphicStatusChip');
const graphicStatusNote = document.getElementById('graphicStatusNote');
const btnVerifyDriver = document.getElementById('btnVerifyDriver');
const btnVerifyGraphic = document.getElementById('btnVerifyGraphic');
const cooldownDriverInput = document.getElementById('cooldownDriver');
const cooldownGraphicInput = document.getElementById('cooldownGraphic');
const btnSaveCooldown = document.getElementById('btnSaveCooldown');
const cooldownMessage = document.getElementById('cooldownMessage');
const campaignStatusSelect = document.getElementById('campaignStatus');
const campaignCodeValue = document.getElementById('campaignCodeValue');
const copyCampaignCodeMessage = document.getElementById('copyCampaignCodeMessage');
const btnCopyCampaignCode = document.getElementById('btnCopyCampaignCode');
const graphicAccessHint = document.getElementById('graphicAccessHint');

const el = selector => document.querySelector(selector);

// Regras locais para status de evidência (mesmas etapas obrigatórias do backend)
const DRIVER_REQUIRED_STEPS_UI = ['odometer-photo','odometer-value','photo-left','photo-right','photo-rear','photo-front'];
const GRAPHIC_REQUIRED_STEPS_UI = ['photo-left','photo-right','photo-rear','photo-front'];

// Controle de blob URLs usados na galeria (para manter o clique abrindo em nova aba)
const galleryObjectUrls = new Set();
function registerGalleryObjectUrl(url) { if (url) galleryObjectUrls.add(url); }
function revokeGalleryObjectUrl(url) {
  if (!url) return;
  try { URL.revokeObjectURL(url); } catch (e) {}
  galleryObjectUrls.delete(url);
}
function cleanupGalleryObjectUrls() {
  for (const url of Array.from(galleryObjectUrls)) {
    revokeGalleryObjectUrl(url);
  }
}

function computeFlowFromItems(items = [], required = []) {
  const stepSet = new Set();
  let lastUploadAt = null;
  let lastRequiredAt = null;
  for (const it of Array.isArray(items) ? items : []) {
    const stepId = typeof it?.step === 'string' ? it.step.trim() : '';
    if (stepId) {
      stepSet.add(stepId);
      if (required.includes(stepId)) {
        const ts = Number(it.createdAt || it.uploadedAt);
        if (Number.isFinite(ts) && (!lastRequiredAt || ts > lastRequiredAt)) lastRequiredAt = ts;
      }
    }
    const ts = Number(it?.createdAt || it?.uploadedAt);
    if (Number.isFinite(ts)) lastUploadAt = lastUploadAt ? Math.max(lastUploadAt, ts) : ts;
  }
  const completed = required.every(stepId => stepSet.has(stepId));
  return {
    hasUploads: Array.isArray(items) && items.length > 0,
    totalUploads: Array.isArray(items) ? items.length : 0,
    lastUploadAt: lastUploadAt || null,
    completed: Array.isArray(items) && items.length > 0,
    completedAt: Array.isArray(items) && items.length > 0 ? (lastRequiredAt || lastUploadAt || null) : null,
    pendingSteps: Array.isArray(items) && items.length > 0 ? [] : required,
  };
}

function flattenStorageFiles(tree = {}) {
  const folders = Array.isArray(tree.folders) ? tree.folders : [];
  return folders.flatMap(f => Array.isArray(f.files) ? f.files : []);
}

function updateDriverEvidenceFromItems(driver, items = [], type = 'driver') {
  if (!driver) return;
  const required = type === 'graphic' ? GRAPHIC_REQUIRED_STEPS_UI : DRIVER_REQUIRED_STEPS_UI;
  const computed = computeFlowFromItems(items, required);
  const status = driver.evidenceStatus || {};
  const targetKey = type === 'graphic' ? 'graphicFlow' : 'driverFlow';
  const baseFlow = status[targetKey] || {};
  const mergedFlow = {
    ...computed,
    verifiedAt: computed.completed ? (baseFlow.verifiedAt || null) : null,
    verifiedBy: computed.completed ? (baseFlow.verifiedBy || null) : null,
    verifiedByName: computed.completed ? (baseFlow.verifiedByName || null) : null,
  };
  driver.evidenceStatus = {
    ...status,
    [targetKey]: mergedFlow,
  };
  selectedDriverData = driver;
  updateDriverListItemStatus(driver);
  setSelectedDriver(driver);
}
 
// globals that were accidentally removed
let currentCampaign = null;
let openModalCount = 0;
const STATUS_OPTIONS = ['agendado','confirmado','instalado','aguardando','cadastrando','problema','revisar'];
const CAMPAIGN_STATUS_OPTIONS = ['ativa','pausada','encerrada','inativa'];
const pendingDriverChanges = new Map();
let selectedDriverId = null;
let selectedDriverData = null;

const DEFAULT_DRIVER_COLUMNS = [
  'Nome',
  'Cidade',
  'Status',
  'PIX',
  'CPF',
  'Email',
  'Numero',
  'Placa',
  'Modelo',
  'Convite',
  'Data de Instalacao',
  'Horario Plotagem',
  'Observacoes',
  'Comentarios',
];

const DRIVER_FORM_HIDDEN_COLUMNS = new Set([
  'plotagem',
  'data final 90 dias',
]);

const DRIVER_DETAIL_HIDDEN_COLUMNS = new Set([
  'plotagem',
  'data final 90 dias',
]);
const STEP_LABELS = {
  'odometer-photo': 'Foto do odometro',
  'odometer-value': 'Valor do odometro',
  'photo-left': 'Foto lateral esquerda',
  'photo-right': 'Foto lateral direita',
  'photo-rear': 'Foto traseira',
  'photo-front': 'Foto frontal',
  notes: 'Observacoes',
};

const FLOW_CLASSNAMES = ['is-pending', 'is-completed', 'is-verified', 'is-progress'];

function getStepLabel(stepId) {
  return STEP_LABELS[stepId] || stepId || '-';
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function describeFlowState(flowStatus) {
  if (!flowStatus || (!flowStatus.hasUploads && !flowStatus.verifiedAt)) {
    return { className: 'is-pending', text: 'Sem envio' };
  }
  if (flowStatus.verifiedAt) return { className: 'is-verified', text: 'Verificado' };
  if (flowStatus.hasUploads) return { className: 'is-completed', text: 'Envio ok' };
  return { className: 'is-pending', text: 'Sem envio' };
}

function updateStatusChip(el, flowStatus, label) {
  if (!el) return;
  const state = describeFlowState(flowStatus);
  FLOW_CLASSNAMES.forEach(cls => el.classList.remove(cls));
  el.classList.add(state.className);
  el.textContent = `${label}: ${state.text}`;
}

function applyStatusVisibility(mode = 'driver') {
  const driverCard = document.querySelector('.status-card[data-role="driver"]');
  const graphicCard = document.querySelector('.status-card[data-role="graphic"]');
  if (mode === 'graphic') {
    if (driverCard) driverCard.style.display = 'none';
    if (graphicCard) graphicCard.style.display = 'flex';
    if (btnVerifyDriver) btnVerifyDriver.style.display = 'none';
    if (btnVerifyGraphic) btnVerifyGraphic.style.display = '';
  } else {
    if (driverCard) driverCard.style.display = 'flex';
    if (graphicCard) graphicCard.style.display = 'none';
    if (btnVerifyDriver) btnVerifyDriver.style.display = '';
    if (btnVerifyGraphic) btnVerifyGraphic.style.display = 'none';
  }
}

function formatPendingSteps(pending = []) {
  if (!Array.isArray(pending) || pending.length === 0) return '';
  return pending.map(step => getStepLabel(step)).join(', ');
}

function buildStatusNote(flowStatus) {
  if (!flowStatus || (!flowStatus.hasUploads && !flowStatus.verifiedAt)) return 'Nenhum envio registrado.';
  if (flowStatus.verifiedAt) {
    const when = formatDateTime(flowStatus.verifiedAt);
    const reviewer = flowStatus.verifiedByName || flowStatus.verifiedBy || 'admin';
    const cooldown = flowStatus.cooldownUntil && Number(flowStatus.cooldownUntil) > Date.now()
      ? ` Libera em ${formatDateTime(flowStatus.cooldownUntil)}.`
      : '';
    return when ? `Verificado em ${when} por ${reviewer}.${cooldown}` : `Verificado por ${reviewer}.${cooldown}`;
  }
  if (flowStatus.hasUploads) {
    const when = formatDateTime(flowStatus.lastUploadAt);
    return when ? `Envio registrado em ${when}.` : 'Envio registrado.';
  }
  return 'Nenhum envio registrado.';
}

function resetStatusPanel(message = 'Selecione um motorista para revisar os envios.') {
  selectedDriverId = null;
  selectedDriverData = null;
  if (acompanheStatusHint) acompanheStatusHint.textContent = message;
  updateStatusChip(driverStatusChip, null, 'Motorista');
  if (driverStatusNote) driverStatusNote.textContent = '';
  updateStatusChip(graphicStatusChip, null, 'Grafica');
  if (graphicStatusNote) graphicStatusNote.textContent = '';
  if (btnVerifyDriver) {
    btnVerifyDriver.disabled = true;
    btnVerifyDriver.textContent = 'Marcar como verificado';
  }
  if (btnVerifyGraphic) {
    btnVerifyGraphic.disabled = true;
    btnVerifyGraphic.textContent = 'Marcar como verificado';
  }
  applyStatusVisibility(getAcompanheMode());
}

function setSelectedDriver(driver) {
  if (!driver) {
    resetStatusPanel();
    return;
  }
  const mode = getAcompanheMode();
  selectedDriverId = driver.id || null;
  selectedDriverData = driver;
  if (acompanheStatusHint) {
    acompanheStatusHint.textContent = driver.name
      ? `Revisando ${driver.name}`
      : 'Revisando motorista selecionado.';
  }
  const statuses = driver.evidenceStatus || {};
  const driverFlow = statuses.driverFlow || null;
  const graphicFlow = statuses.graphicFlow || null;
  updateStatusChip(driverStatusChip, driverFlow, 'Motorista');
  if (driverStatusNote) driverStatusNote.textContent = buildStatusNote(driverFlow);
  updateStatusChip(graphicStatusChip, graphicFlow, 'Grafica');
  if (graphicStatusNote) graphicStatusNote.textContent = buildStatusNote(graphicFlow);

  if (btnVerifyDriver) {
    const completed = Boolean(driverFlow?.completed);
    const verified = Boolean(driverFlow?.verifiedAt);
    btnVerifyDriver.disabled = mode !== 'driver' || !completed;
    btnVerifyDriver.textContent = verified ? 'Liberar agora' : 'Marcar como verificado';
  }
  if (btnVerifyGraphic) {
    const completed = Boolean(graphicFlow?.completed);
    const verified = Boolean(graphicFlow?.verifiedAt);
    btnVerifyGraphic.disabled = mode !== 'graphic' || !completed;
    btnVerifyGraphic.textContent = verified ? 'Liberar agora' : 'Marcar como verificado';
  }
  applyStatusVisibility(mode);
}

function updateDriverStatusChips(container, driver, mode = 'driver') {
  if (!container) return;
  const statuses = driver?.evidenceStatus || {};
  const driverFlowState = describeFlowState(statuses.driverFlow);
  const graphicFlowState = describeFlowState(statuses.graphicFlow);
  container.innerHTML = '';
  if (mode === 'driver') {
    const driverChip = document.createElement('span');
    driverChip.className = `chip ${driverFlowState.className}`;
    driverChip.textContent = `Motorista: ${driverFlowState.text}`;
    container.appendChild(driverChip);
  } else {
    const graphicChip = document.createElement('span');
    graphicChip.className = `chip ${graphicFlowState.className}`;
    graphicChip.textContent = `Grafica: ${graphicFlowState.text}`;
    container.appendChild(graphicChip);
  }
}

function updateDriverListItemStatus(driver) {
  if (!driver?.id || !acompanheDrivers) return;
  const li = acompanheDrivers.querySelector(`[data-driver-id="${driver.id}"]`);
  if (!li) return;
  const chips = li.querySelector('.driver-status-chips');
  if (chips) updateDriverStatusChips(chips, driver, getAcompanheMode());
}

function syncDriverInState(updatedDriver) {
  if (!updatedDriver || !currentCampaign?.drivers) return null;
  const idx = currentCampaign.drivers.findIndex(d => d.id === updatedDriver.id);
  if (idx === -1) return null;
  const target = currentCampaign.drivers[idx];
  Object.assign(target, updatedDriver);
  return target;
}

async function handleVerificationAction(target) {
  if (!campaignId) {
    alert('Campanha nao carregada.');
    return;
  }
  if (!selectedDriverId) {
    alert('Selecione um motorista na lista ao lado.');
    return;
  }
  const driver =
    selectedDriverData ||
    (Array.isArray(currentCampaign?.drivers)
      ? currentCampaign.drivers.find(d => d.id === selectedDriverId)
      : null);
  if (!driver) {
    alert('Motorista nao encontrado na campanha.');
    return;
  }
  const flowStatus = target === 'graphic'
    ? driver.evidenceStatus?.graphicFlow
    : driver.evidenceStatus?.driverFlow;
  if (!flowStatus) {
    alert('Status de envio indisponivel para este perfil.');
    return;
  }
  const desired = !flowStatus.verifiedAt;
  if (desired && !flowStatus.completed) {
    alert('O envio ainda nao foi concluido para este perfil.');
    return;
  }
  const btn = target === 'graphic' ? btnVerifyGraphic : btnVerifyDriver;
  if (btn) {
    btn.disabled = true;
    btn.textContent = desired ? 'Verificando...' : 'Removendo...';
  }
  try {
    const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/drivers/${encodeURIComponent(selectedDriverId)}/evidence-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, verified: desired }),
    });
    if (!res.ok) {
      let message = '';
      try { message = await res.text(); } catch (e) {}
      throw new Error(message || `HTTP ${res.status}`);
    }
    const payload = await res.json();
    const updatedDriver = payload?.driver;
    if (updatedDriver) {
      let activeDriver = syncDriverInState(updatedDriver);
      if (!activeDriver) {
        if (!Array.isArray(currentCampaign?.drivers)) currentCampaign.drivers = [];
        const idx = currentCampaign.drivers.findIndex(d => d.id === updatedDriver.id);
        if (idx === -1) {
          currentCampaign.drivers.push(updatedDriver);
          activeDriver = currentCampaign.drivers[currentCampaign.drivers.length - 1];
        } else {
          currentCampaign.drivers[idx] = updatedDriver;
          activeDriver = currentCampaign.drivers[idx];
        }
      }
      selectedDriverData = activeDriver;
      updateDriverListItemStatus(activeDriver);
    }
  } catch (err) {
    console.error(err);
    alert(err.message || 'Falha ao atualizar verificacao.');
  } finally {
    if (btn) {
      btn.disabled = false;
      if (selectedDriverData) setSelectedDriver(selectedDriverData);
      else resetStatusPanel();
    }
  }
}
let editingGraphicId = null;
// Development/testing preset: fills the Add Driver form automatically.
// Temporary — remove when no longer needed.
const DEV_DRIVER_PRESET = {
  enabled: false,
  fullName: 'Thiago dos Santos Rodrigues',
  phone: '(51) 9 9133-5320',
  // When true, the phone will be placed into the Nome field to allow quick "login" tests
  injectPhoneIntoName: true,
};
// pending KM edits buffered in the KM tab: Map<driverId, { columnKey: value }>
const pendingKmChanges = new Map();
let currentStorageTree = null;

function updateSaveKmButtonState() {
  if (!btnSaveKm) return;
  btnSaveKm.disabled = pendingKmChanges.size === 0;
}

function setCopyCampaignMessage(text = '', tone = 'muted') {
  if (!copyCampaignCodeMessage) return;
  copyCampaignCodeMessage.textContent = text;
  copyCampaignCodeMessage.classList.remove('text-success');
  copyCampaignCodeMessage.classList.add('muted');
  if (tone === 'success') {
    copyCampaignCodeMessage.classList.remove('muted');
    copyCampaignCodeMessage.classList.add('text-success');
  }
}

function bufferKmChange(driverId, column, value, originalValue = '') {
  if (!driverId || !column) return;
  const current = pendingKmChanges.get(driverId) || {};
  const trimmed = value;
  if (trimmed === (originalValue ?? '')) {
    delete current[column];
    if (Object.keys(current).length === 0) {
      pendingKmChanges.delete(driverId);
    } else {
      pendingKmChanges.set(driverId, current);
    }
  } else {
    current[column] = trimmed;
    pendingKmChanges.set(driverId, current);
  }
  updateSaveKmButtonState();
}

async function saveKmChanges() {
  if (!btnSaveKm) return;
  if (pendingKmChanges.size === 0) return alert('Nenhuma alteração de KM pendente.');
  const originalLabel = btnSaveKm.textContent;
  btnSaveKm.disabled = true;
  btnSaveKm.textContent = 'Salvando...';
  try {
    for (const [driverId, fields] of Array.from(pendingKmChanges.entries())) {
      const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/km/${encodeURIComponent(driverId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      pendingKmChanges.delete(driverId);
    }
    await init();
    alert('KM salvo com sucesso.');
  } catch (err) {
    console.error(err);
    alert('Falha ao salvar KM. Veja o console para detalhes.');
  } finally {
    btnSaveKm.textContent = originalLabel || 'Salvar KM';
    updateSaveKmButtonState();
  }
}

function normalizeKey(key) {
  return String(key || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeSelector(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/([:\.\[\]\,=\$\#\s])/g, '\\$1');
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function findColumnKey(targets) {
  const header = getCampaignHeader();
  if (!Array.isArray(header) || header.length === 0) return null;
  const list = Array.isArray(targets) ? targets : [targets];
  const normalizedTargets = list.map(normalizeKey);
  return header.find(col => normalizedTargets.includes(normalizeKey(col))) || null;
}

const kmNumberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const percentNumberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

function formatKmValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number' && Number.isFinite(value)) return kmNumberFormatter.format(value);
  const parsed = Number(String(value).replace(/\./g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? kmNumberFormatter.format(parsed) : String(value);
}

function formatPercentValue(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
  return `${percentNumberFormatter.format(Number(value))}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('pt-BR');
  const parsed = Number(String(value).replace(/\./g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed.toLocaleString('pt-BR') : String(value);
}

function formatStorageDateFolder(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  // Expecting folder in YYYY-MM-DD format. Parse manually as UTC to avoid timezone shifts.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const dt = new Date(Date.UTC(year, month - 1, day));
      return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatStorageTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function detectKmPeriodsFromHeader(header) {
  if (!Array.isArray(header) || header.length === 0) return null;
  let maxIdx = 0;
  const re = /(?:KM RODADO|META KM|KM|STATUS)\s*(\d+)/i;
  for (const h of header) {
    const m = String(h || '').match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxIdx) maxIdx = n;
    }
  }
  return maxIdx || null;
}

// KM periods control wiring (number input in KM toolbar)
let kmPeriodsDebounce = null;
function setupKmPeriodsControl() {
  const input = el('#kmPeriodsInput');
  if (!input) return;
  // derive initial value: campaign.kmPeriods or based on kmSheetHeader or default 3
  const header = Array.isArray(currentCampaign?.kmSheetHeader) && currentCampaign.kmSheetHeader.length
    ? currentCampaign.kmSheetHeader
    : (Array.isArray(currentCampaign?.sheetHeader) && currentCampaign.sheetHeader.length ? currentCampaign.sheetHeader : []);
  const detected = currentCampaign?.kmPeriods ?? detectKmPeriodsFromHeader(header) ?? 3;
  input.value = detected;

  input.addEventListener('change', () => {
    const val = Number(input.value);
    if (!Number.isFinite(val) || val < 1) {
      alert('Informe um numero valido de periodos (min 1).');
      input.value = currentCampaign?.kmPeriods ?? 3;
      return;
    }
    // debounce and send PATCH to update campaign
    if (kmPeriodsDebounce) clearTimeout(kmPeriodsDebounce);
    kmPeriodsDebounce = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kmPeriods: Math.max(1, Math.min(12, Math.round(val))) }),
        });
        if (!res.ok) { const txt = await res.text(); throw new Error(txt || `HTTP ${res.status}`); }
        const data = await res.json();
        // update currentCampaign and re-render KM table
        currentCampaign = data.campaign;
        await init();
      } catch (err) {
        console.error(err);
        alert('Nao foi possivel atualizar o numero de periodos');
      }
    }, 400);
  });
}

async function saveCooldownSettings() {
  if (!currentCampaign || !btnSaveCooldown) return;
  const driverDays = Number(cooldownDriverInput?.value ?? 0);
  const graphicDays = Number(cooldownGraphicInput?.value ?? 0);
  if (!Number.isFinite(driverDays) || driverDays < 0 || driverDays > 365) {
    alert('Dias para motorista invalido (0-365).');
    return;
  }
  if (!Number.isFinite(graphicDays) || graphicDays < 0 || graphicDays > 365) {
    alert('Dias para grafica invalido (0-365).');
    return;
  }
  const original = btnSaveCooldown.textContent;
  btnSaveCooldown.disabled = true;
  btnSaveCooldown.textContent = 'Salvando...';
  if (cooldownMessage) {
    cooldownMessage.textContent = '';
    cooldownMessage.classList.remove('text-success', 'text-danger');
  }
  try {
    const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverCooldownDays: driverDays, graphicCooldownDays: graphicDays }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = await res.json();
    currentCampaign.driverCooldownDays = data?.campaign?.driverCooldownDays ?? driverDays;
    currentCampaign.graphicCooldownDays = data?.campaign?.graphicCooldownDays ?? graphicDays;
    if (cooldownMessage) {
      cooldownMessage.textContent = 'Cooldown atualizado com sucesso.';
      cooldownMessage.classList.add('text-success');
    }
  } catch (err) {
    console.error(err);
    if (cooldownMessage) {
      cooldownMessage.textContent = 'Nao foi possivel salvar o cooldown.';
      cooldownMessage.classList.add('text-danger');
    }
  } finally {
    btnSaveCooldown.disabled = false;
    btnSaveCooldown.textContent = original || 'Salvar';
  }
}

function parseLocalNumber(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim();
  if (!s) return null;
  const cleaned = s.replace(/\./g, '').replace(/,/g, '.').replace('%', '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function updateDriverTotals(driverId) {
  try {
    const tbody = el('#tblKm');
    if (!tbody) return;
    const trTotal = tbody.querySelector(`tr[data-driver-id="${driverId}"][data-is-total="1"]`);
    if (!trTotal) return;

    // Sum KM and Meta from period rows
    // collect only period inputs (exclude TOTAL inputs to avoid double-counting)
    const allKmInputs = Array.from(tbody.querySelectorAll(`input[data-driver-id="${driverId}"][data-column^="KM RODADO "]`));
    const kmInputs = allKmInputs.filter(i => /^KM RODADO \d+$/.test(String(i.dataset.column || '').trim()));
    const allMetaInputs = Array.from(tbody.querySelectorAll(`input[data-driver-id="${driverId}"][data-column^="META KM "]`));
    const metaInputs = allMetaInputs.filter(i => /^META KM \d+$/.test(String(i.dataset.column || '').trim()));

    let kmSum = 0; let kmCount = 0;
    kmInputs.forEach(i => {
      const v = parseLocalNumber(i.value);
      if (Number.isFinite(v)) { kmSum += v; kmCount++; }
    });
    let metaSum = 0; let metaCount = 0;
    metaInputs.forEach(i => {
      const v = parseLocalNumber(i.value);
      if (Number.isFinite(v)) { metaSum += v; metaCount++; }
    });

    // Update total km input (if exists)
    const totalKmInput = trTotal.querySelector('input[data-column="KM RODADO TOTAL"]');
    if (totalKmInput) {
      totalKmInput.value = kmSum || '';
      totalKmInput.dataset.originalValue = totalKmInput.value;
    }
    const totalMetaInput = trTotal.querySelector('input[data-column="META KM TOTAL"]');
    if (totalMetaInput) {
      totalMetaInput.value = metaSum || '';
      totalMetaInput.dataset.originalValue = totalMetaInput.value;
    }

    // Update percent cell
    const percentCell = trTotal.querySelector('[data-column^="PERCENT"]');
    const percentVal = (metaSum && metaSum !== 0) ? (kmSum / metaSum) * 100 : null;
    if (percentCell) percentCell.textContent = formatPercentValue(percentVal);

    // Update status cell (simple derivation)
    const statusCell = trTotal.querySelector('input[data-column="STATUS TOTAL"]');
    if (statusCell) {
      // derive status from percent
      let status = '';
      if (percentVal === null) status = '';
      else if (percentVal >= 100) status = 'OK';
      else if (percentVal >= 80) status = 'Atenção';
      else status = 'Crítico';
      statusCell.value = status;
      statusCell.dataset.originalValue = status;
    }
  } catch (err) {
    console.error('updateDriverTotals error', err);
  }
}
 
function normalizeDriverStatus(value) {
  const status = normalizeKey(value);
  if (!status) return '';
  const map = {
    agendada: 'agendado',
    confirmada: 'confirmado',
    instalada: 'instalado',
    pendente: 'aguardando',
    'em cadastro': 'cadastrando',
  };
  const normalized = map[status] || status;
  return STATUS_OPTIONS.includes(normalized) ? normalized : status;
}

function showModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  openModalCount += 1;
  document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
  if (!modal) return;
  if (!modal.classList.contains('hidden')) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    openModalCount = Math.max(0, openModalCount - 1);
    if (openModalCount === 0) document.body.style.overflow = '';
  }
  if (modal === driverFormModal && driverForm) {
    driverForm.reset();
  }
  if (modal === driverDetailModal && driverDetailForm) {
    driverDetailForm.reset();
  }
  if (modal === graphicFormModal && graphicForm) {
    graphicForm.reset();
    editingGraphicId = null;
    if (graphicFormMessage) graphicFormMessage.textContent = '';
  }
  if (modal === importKmModal) resetImportKmFormState();
}

function resetImportKmFormState() {
  if (importKmForm) importKmForm.reset();
  clearImportKmMessage();
}

function clearImportKmMessage() {
  if (!importKmMessage) return;
  importKmMessage.textContent = '';
  if (importKmMessage.classList) importKmMessage.classList.remove('text-success', 'text-danger');
}

function formatStatusPill(value) {
  const status = String(value || '').toLowerCase();
  if (!status) return { label: '-', className: '' };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return { label, className: status };
}

async function confirmCampaignStatusChange(nextStatus) {
  const { label } = formatStatusPill(nextStatus);
  const prettyLabel = label || nextStatus || '-';
  if (typeof openAdminPrompt === 'function') {
    const result = await openAdminPrompt({
      title: 'Atualizar status da campanha',
      description: `Deseja confirmar a mudanca do status para "${prettyLabel}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      fields: [],
    });
    return result !== null;
  }
  return confirmDialog(`Deseja confirmar a mudanca do status para "${prettyLabel}"?`, {
    title: 'Confirmar atualizacao',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
  });
}

function ensureTableState(table) {
  if (!table) return;
  const body = table.querySelector('tbody');
  const emptyMessage = table.dataset.empty || 'Sem registros.';
  if (!body) return;

  if (body.children.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = table.querySelectorAll('th').length || 1;
    cell.className = 'empty-row';
    cell.textContent = emptyMessage;
    row.appendChild(cell);
    body.appendChild(row);
  }
}

function markDriverRowDirty(driverId, dirty) {
  if (!tblDrivers || !driverId) return;
  const row = tblDrivers.querySelector(
    `tr[data-driver-id="${escapeSelector(driverId)}"]`,
  );
  if (row) row.classList.toggle('pending-row', dirty);
}

function updateSaveButtonState() {
  if (!btnSaveDrivers) return;
  btnSaveDrivers.disabled = pendingDriverChanges.size === 0;
}

function bufferDriverChange(driverId, column, value, originalValue = '') {
  if (!driverId || !column) return;
  const trimmed = value;
  const current = pendingDriverChanges.get(driverId) || {};

  if (trimmed === (originalValue ?? '')) {
    delete current[column];
    if (Object.keys(current).length === 0) {
      pendingDriverChanges.delete(driverId);
      markDriverRowDirty(driverId, false);
    } else {
      pendingDriverChanges.set(driverId, current);
    }
  } else {
    current[column] = trimmed;
    pendingDriverChanges.set(driverId, current);
    markDriverRowDirty(driverId, true);
  }

  updateSaveButtonState();
}

async function fetchCampaign(id) {
  const url = `/api/campaigns/${encodeURIComponent(id)}`;
  console.debug('fetchCampaign url=', url);
  const res = await authFetch(url);
  if (!res.ok) {
    let message = '';
    try { message = await res.text(); } catch (e) { message = String(e); }
    const err = new Error(message || `HTTP ${res.status}`);
    err.status = res.status;
    err.responseText = message;
    throw err;
  }
  return res.json();
}

function renderCounts(counts = {}) {
  el('#cAg').textContent = counts.agendado || 0;
  el('#cCf').textContent = counts.confirmado || 0;
  el('#cIn').textContent = counts.instalado || 0;
  el('#cPb').textContent = counts.problema || 0;
  el('#cRv').textContent = counts.revisar || 0;
}

function renderDrivers(drivers = []) {
  const tbody = tblDrivers;
  if (!tbody) return;
  tbody.innerHTML = '';
  pendingDriverChanges.clear();
  updateSaveButtonState();

  // sort drivers alphabetically (pt-BR) by name for consistent UI
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', ignorePunctuation: true });
  const sortedDrivers = Array.isArray(drivers) ? [...drivers].sort((a, b) => collator.compare((a.name||''), (b.name||''))) : [];

  const columnCity = findColumnKey(['cidade', 'city']);
  const columnStatus = findColumnKey(['status']);
  const columnAdh = findColumnKey(['aderencia']);
  for (const driver of sortedDrivers) {
    const row = document.createElement('tr');
    row.dataset.driverId = driver.id || '';

    // Nome
    const nameCell = document.createElement('td');
    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'link-button driver-name';
    nameButton.dataset.driverId = driver.id || '';
    nameButton.textContent = driver.name || '-';
    nameCell.appendChild(nameButton);
    row.appendChild(nameCell);

    // Cidade
    const cityCell = document.createElement('td');
    const originalCity =
      (driver.raw && columnCity ? driver.raw[columnCity] : null) ||
      driver.city ||
      '';
    if (columnCity) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'driver-input';
      input.value = originalCity;
      input.dataset.originalValue = originalCity;
      input.addEventListener('input', () =>
        bufferDriverChange(
          driver.id,
          columnCity,
          input.value,
          input.dataset.originalValue,
        ),
      );
      cityCell.appendChild(input);
    } else {
      cityCell.textContent = originalCity || '-';
    }
    row.appendChild(cityCell);

    // Status
    const statusCell = document.createElement('td');
    const rawStatus =
      (driver.raw && columnStatus ? driver.raw[columnStatus] : null) ||
      driver.status ||
      '';
    if (columnStatus) {
      const select = document.createElement('select');
      select.className = 'driver-input';
      STATUS_OPTIONS.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        select.appendChild(option);
      });
      const normalizedStatus = normalizeDriverStatus(rawStatus);
      const originalStatus =
        (STATUS_OPTIONS.includes(normalizedStatus) && normalizedStatus) ||
        rawStatus ||
        'agendado';
      if (!STATUS_OPTIONS.includes(originalStatus)) {
        const option = document.createElement('option');
        option.value = originalStatus;
        option.textContent =
          originalStatus.charAt(0).toUpperCase() + originalStatus.slice(1);
        select.appendChild(option);
      }
      select.value = originalStatus;
      select.dataset.originalValue = originalStatus;
      select.addEventListener('change', () =>
        bufferDriverChange(
          driver.id,
          columnStatus,
          select.value,
          select.dataset.originalValue,
        ),
      );
      statusCell.appendChild(select);
    } else {
      const pill = document.createElement('span');
      const statusInfo = formatStatusPill(rawStatus);
      pill.className = `status ${statusInfo.className}`;
      pill.textContent = statusInfo.label;
      statusCell.appendChild(pill);
    }
    row.appendChild(statusCell);

    // Aderencia
    const adhCell = document.createElement('td');
    const originalAdh =
      (driver.raw && columnAdh ? driver.raw[columnAdh] : null) ||
      driver.adh ||
      '';
    if (columnAdh) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'driver-input';
      input.value = originalAdh;
      input.dataset.originalValue = originalAdh;
      input.addEventListener('input', () =>
        bufferDriverChange(
          driver.id,
          columnAdh,
          input.value,
          input.dataset.originalValue,
        ),
      );
      adhCell.appendChild(input);
    } else {
      adhCell.textContent = originalAdh || '-';
    }
    row.appendChild(adhCell);

    // KM
    const kmCell = document.createElement('td');
    kmCell.textContent = formatKmValue(driver.km?.total?.kmRodado ?? null);
    row.appendChild(kmCell);

    // Acoes
    const actionsCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn--ghost driver-action-delete';
    deleteButton.dataset.driverId = driver.id || '';
    deleteButton.textContent = 'Excluir';
    actionsCell.appendChild(deleteButton);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  }

  ensureTableState(tbody.closest('table'));
}

function updateGraphicCountBadge(count) {
  if (!graphicCountBadge) return;
  const total = Number(count) || 0;
  graphicCountBadge.textContent = total === 1 ? '1 grafica' : `${total} graficas`;
}

function formatGraphicContact(name, phone) {
  const parts = [];
  if (trim(name)) parts.push(`<div>${escapeHTML(trim(name))}</div>`);
  if (trim(phone)) parts.push(`<div class="small muted">${escapeHTML(trim(phone))}</div>`);
  return parts.length ? parts.join('') : '-';
}

function renderGraphics(graphics = []) {
  if (!tblGraphics) return;
  const table = tblGraphics.closest('table');
  tblGraphics.innerHTML = '';

  const list = Array.isArray(graphics) ? [...graphics] : [];
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', ignorePunctuation: true });
  list.sort((a, b) => collator.compare(a?.name || '', b?.name || ''));

  currentCampaign = currentCampaign || {};
  currentCampaign.graphics = list;

  for (const graphic of list) {
    const row = document.createElement('tr');
    row.dataset.graphicId = graphic.id || '';
    const notesHtml = trim(graphic.notes)
      ? `<p class="small muted">${escapeHTML(graphic.notes)}</p>`
      : '';
    const emailHtml = trim(graphic.email)
      ? `<a href="mailto:${escapeHTML(graphic.email)}">${escapeHTML(graphic.email)}</a>`
      : '-';
    const phoneHtml = trim(graphic.phone) ? escapeHTML(graphic.phone) : '-';

    row.innerHTML = `
      <td>
        <div class="strong">${escapeHTML(graphic.name || '')}</div>
        ${notesHtml}
      </td>
      <td>${emailHtml}</td>
      <td>${phoneHtml}</td>
      <td>${formatGraphicContact(graphic.responsible1Name, graphic.responsible1Phone)}</td>
      <td>${formatGraphicContact(graphic.responsible2Name, graphic.responsible2Phone)}</td>
      <td class="actions">
        <button type="button" class="btn btn--small graphic-edit" data-graphic-id="${escapeHTML(graphic.id || '')}">Editar</button>
        <button type="button" class="btn btn--small btn--danger graphic-delete" data-graphic-id="${escapeHTML(graphic.id || '')}">Remover</button>
      </td>
    `;
    tblGraphics.appendChild(row);
  }

  ensureTableState(table);
  updateGraphicCountBadge(list.length);
}

// ---------------- Acompanhe (admin) ----------------
async function fetchCampaignEvidence(campaignId) {
  if (!campaignId) return [];
  try {
    const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/evidence`);
    if (!res.ok) throw new Error('Falha ao buscar evidencias');
    const data = await res.json();
    return Array.isArray(data.evidence) ? data.evidence : [];
  } catch (err) {
    console.warn('fetchCampaignEvidence error', err);
    return [];
  }
}

async function fetchDriverEvidence(campaignId, driverId) {
  if (!campaignId || !driverId) return [];
  try {
    const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/evidence/driver/${encodeURIComponent(driverId)}`);
    if (!res.ok) throw new Error('Falha ao buscar evidencias do motorista');
    const data = await res.json();
    return Array.isArray(data.evidence) ? data.evidence : [];
  } catch (err) {
    console.warn('fetchDriverEvidence error', err);
    return [];
  }
}

async function fetchGraphicEvidence(campaignId, graphicId) {
  if (!campaignId || !graphicId) return [];
  try {
    const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/evidence/graphic/${encodeURIComponent(graphicId)}`);
    if (!res.ok) throw new Error('Falha ao buscar evidencias da gráfica');
    const data = await res.json();
    return Array.isArray(data.evidence) ? data.evidence : [];
  } catch (err) {
    console.warn('fetchGraphicEvidence error', err);
    return [];
  }
}

async function fetchGraphicDriverEvidence(campaignId, graphicId, driverId) {
  if (!campaignId || !graphicId || !driverId) return [];
  try {
    const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/evidence/graphic/${encodeURIComponent(graphicId)}/driver/${encodeURIComponent(driverId)}`);
    if (!res.ok) throw new Error('Falha ao buscar evidencias da gráfica para o motorista');
    const data = await res.json();
    return Array.isArray(data.evidence) ? data.evidence : [];
  } catch (err) {
    console.warn('fetchGraphicDriverEvidence error', err);
    return [];
  }
}

async function fetchGraphicStorageTree(campaignIdValue, driverIdValue) {
  if (!campaignIdValue || !driverIdValue) return null;
  try {
    const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignIdValue)}/storage/graphic/${encodeURIComponent(driverIdValue)}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data?.storage || null;
  } catch (err) {
    console.warn('fetchGraphicStorageTree error', err);
    return null;
  }
}
async function fetchDriverStorageTree(campaignIdValue, driverIdValue) {
  if (!campaignIdValue || !driverIdValue) return null;
  try {
    const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignIdValue)}/storage/driver/${encodeURIComponent(driverIdValue)}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data?.storage || null;
  } catch (err) {
    console.warn('fetchDriverStorageTree error', err);
    return null;
  }
}

async function collectEvidenceSnapshot({ driverId, graphicId = null, driverTree = null, graphicTree = null } = {}) {
  const snapshot = { driverItems: [], graphicItems: [] };
  if (!driverId) return snapshot;

  try {
    const tree = driverTree || await fetchDriverStorageTree(campaignId, driverId);
    if (tree && Array.isArray(tree.folders) && tree.folders.length) {
      snapshot.driverItems = flattenStorageFiles(tree);
    }
  } catch (err) { console.warn('collectEvidenceSnapshot driver tree', err); }
  if (!snapshot.driverItems.length) {
    try {
      const legacy = await fetchDriverEvidence(campaignId, driverId);
      if (legacy?.length) snapshot.driverItems = legacy;
    } catch (err) { console.warn('collectEvidenceSnapshot driver evidence', err); }
  }

  try {
    const gTree = graphicTree || await fetchGraphicStorageTree(campaignId, driverId);
    if (gTree && Array.isArray(gTree.folders) && gTree.folders.length) {
      snapshot.graphicItems = flattenStorageFiles(gTree);
    }
  } catch (err) { console.warn('collectEvidenceSnapshot graphic tree', err); }
  if (!snapshot.graphicItems.length && graphicId) {
    try {
      const legacyG = await fetchGraphicDriverEvidence(campaignId, graphicId, driverId);
      if (legacyG?.length) snapshot.graphicItems = legacyG;
    } catch (err) { console.warn('collectEvidenceSnapshot graphic evidence', err); }
  }

  return snapshot;
}

function clearAcompanheGallery() {
  if (!acompanheGalleryGrid) return;
  cleanupGalleryObjectUrls();
  acompanheGalleryGrid.classList.remove('is-explorer');
  acompanheGalleryGrid.innerHTML = '';
  currentStorageTree = null;
}

function renderGalleryItems(items = [], { type = 'driver', driver = null } = {}) {
  if (!acompanheGalleryGrid) return;
  cleanupGalleryObjectUrls();
  acompanheGalleryGrid.classList.remove('is-explorer');
  acompanheGalleryGrid.innerHTML = '';
  
  // Filter out items without renderable images
  const list = Array.isArray(items) ? items.filter(it => it && (it.url || it.photoData)) : [];
  
  if (list.length === 0) {
    acompanheGalleryGrid.classList.add('is-explorer');
    acompanheGalleryGrid.innerHTML = '<div class="storage-empty">Nenhuma evidência encontrada para este motorista.</div>';
    return;
  }
  
  let renderedCount = 0;
  
  for (const it of list) {
    const card = document.createElement('div');
    card.className = 'thumb-card';
    card.style.position = 'relative';
    card.style.display = 'none'; // Hide initially until image loads
    
    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'block';

    const img = document.createElement('img');
    img.alt = it.step || '';
    img.loading = 'lazy';
    img.style.width = '100%';
    img.style.height = '120px';
    img.style.objectFit = 'cover';
    link.appendChild(img);
    card.appendChild(link);

    // Helper to set image source. If the URL points to internal storage (/api/storage/*),
    // fetch it with `authFetch` to include Authorization header and convert to a blob URL.
    (async () => {
      try {
        // If the item already has an inline data URL, use it directly
        if (it.photoData && typeof it.photoData === 'string' && it.photoData.startsWith('data:image')) {
          img.src = it.photoData;
          link.href = it.photoData;
          img.onload = () => { card.style.display = ''; renderedCount++; };
          img.onerror = () => { try { card.remove(); } catch (e) { card.style.display = 'none'; } };
          return;
        }

        const src = it.url || '';
        if (!src) {
          // nothing to show
          try { card.remove(); } catch (e) { card.style.display = 'none'; }
          return;
        }

        if (typeof src === 'string' && src.startsWith('/api/storage/')) {
          // fetch with auth header and convert to blob URL
          const res = await authFetch(src);
          if (!res.ok) throw new Error('Imagem nao autorizada ou indisponivel');
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          registerGalleryObjectUrl(blobUrl);
          img.src = blobUrl;
          link.href = blobUrl;
          img.dataset.blobUrl = blobUrl;
          link.dataset.blobUrl = blobUrl;
          img.onload = () => { card.style.display = ''; renderedCount++; };
          img.onerror = () => { revokeGalleryObjectUrl(blobUrl); try { card.remove(); } catch (e) { card.style.display = 'none'; } };
          return;
        }

        // Fallback: external/public URL
        img.src = src;
        link.href = src;
        img.onload = () => { card.style.display = ''; renderedCount++; };
        img.onerror = () => { try { card.remove(); } catch (e) { card.style.display = 'none'; } };
      } catch (err) {
        console.warn('Erro ao carregar imagem protegida', err);
        if (img?.dataset?.blobUrl) revokeGalleryObjectUrl(img.dataset.blobUrl);
        try { card.remove(); } catch (e) { card.style.display = 'none'; }
      }
    })();
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'evidence-delete-btn';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Deletar imagem';
    deleteBtn.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(255,0,0,0.8);color:white;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:14px;z-index:10;';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog('Tem certeza que deseja deletar esta imagem? Esta acao nao pode ser desfeita.', {
          title: 'Deletar imagem',
          confirmLabel: 'Deletar',
          cancelLabel: 'Cancelar',
          tone: 'danger',
        });
        if (!ok) return;
        try {
          deleteBtn.disabled = true;
        deleteBtn.textContent = '...';
        // Use correct endpoint based on source: mongo (storage_files) or local (evidence)
        const endpoint = it.source === 'mongo'
          ? `/api/campaigns/${encodeURIComponent(campaignId)}/storage/${encodeURIComponent(it.id)}`
          : `/api/campaigns/${encodeURIComponent(campaignId)}/evidence/${encodeURIComponent(it.id)}`;
        const res = await authFetch(endpoint, {
          method: 'DELETE'
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        if (img?.dataset?.blobUrl) revokeGalleryObjectUrl(img.dataset.blobUrl);
        card.remove();
        // Atualiza status do driver/gráfica após deletar
        const currentDriver = driver || selectedDriverData || null;
        if (currentDriver) {
          const idx = list.indexOf(it);
          if (idx >= 0) list.splice(idx, 1);
          updateDriverEvidenceFromItems(currentDriver, list, type === 'graphic' ? 'graphic' : 'driver');
        }
        // Check if gallery is now empty after delete
        setTimeout(() => {
          if (acompanheGalleryGrid && acompanheGalleryGrid.children.length === 0) {
            acompanheGalleryGrid.classList.add('is-explorer');
            acompanheGalleryGrid.innerHTML = '<div class="storage-empty">Nenhuma evidência encontrada para este motorista.</div>';
          }
        }, 50);
        alert('Imagem deletada com sucesso.');
      } catch (err) {
        console.error('Erro ao deletar imagem:', err);
        alert('Não foi possível deletar a imagem.');
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '🗑️';
      }
    });
    
    const meta = document.createElement('div');
    meta.className = 'thumb-meta small muted';
    const when = it.createdAt ? new Date(it.createdAt).toLocaleString() : '';
    meta.textContent = `${it.step || ''} ${when ? ' · ' + when : ''}`;
    card.appendChild(img);
    card.appendChild(deleteBtn);
    card.appendChild(meta);
    acompanheGalleryGrid.appendChild(card);
  }
}

function renderGraphicStorageLoading(message = 'Carregando galeria...') {
  if (!acompanheGalleryGrid) return;
  acompanheGalleryGrid.classList.add('is-explorer');
  acompanheGalleryGrid.innerHTML = `
    <div class="storage-loading">
      <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
      <span>${escapeHTML(message)}</span>
    </div>`;
}

function renderGraphicStorageExplorer(
  tree = {},
  { driver, headingText = "Arquivos enviados pela gr&aacute;fica", emptyMessage, uploaderType = null } = {}
) {
  if (!acompanheGalleryGrid) return;
  cleanupGalleryObjectUrls();
  acompanheGalleryGrid.classList.add('is-explorer');
  acompanheGalleryGrid.innerHTML = '';

  const mode = getAcompanheMode();

  const folders = Array.isArray(tree.folders) ? tree.folders : [];
  const driverName = driver?.name || tree.driverName || '';
  const normalizedHeading = String(headingText || '')
    .replace(/&[aA]acute;/g, 'a')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const resolvedUploaderType = (uploaderType || tree.uploaderType || '')
    .toString()
    .trim()
    .toLowerCase();
  const type = mode === 'graphic'
    ? 'graphic'
    : (resolvedUploaderType === 'graphic'
      ? 'graphic'
      : (normalizedHeading.includes('grafica') ? 'graphic' : 'driver'));
  const noDataMessage = emptyMessage || (type === 'graphic'
    ? 'Nenhuma imagem enviada pela gr&aacute;fica para este motorista.'
    : 'Nenhuma imagem enviada para este motorista.');
  if (!folders.length) {
    acompanheGalleryGrid.innerHTML = `<div class="storage-empty">${noDataMessage}</div>`;
    currentStorageTree = { ...tree, uploaderType: type, folders: [] };
    return;
  }

  const selectedName = folders.some(f => f.name === tree.selectedDate)
    ? tree.selectedDate
    : folders[0].name;
  const selectedFolder = folders.find(f => f.name === selectedName) || folders[0];
  currentStorageTree = { ...tree, selectedDate: selectedName, driverName, uploaderType: type };

  const explorer = document.createElement('div');
  explorer.className = 'storage-explorer';

  const heading = document.createElement('div');
  heading.className = 'storage-heading';
  heading.innerHTML = `
    <h3 class="m0">${headingText}</h3>
    ${driverName ? `<p class="small muted">Motorista: ${escapeHTML(driverName)}</p>` : ''}
  `;
  explorer.appendChild(heading);

  const folderList = document.createElement('div');
  folderList.className = 'storage-folder-list';
    folders.forEach(folder => {
      const folderItem = document.createElement('div');
      folderItem.style.cssText = 'display:flex;align-items:center;gap:4px;';
      
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `storage-folder-button${folder.name === selectedName ? ' active' : ''}`;
      button.style.flex = '1';
      button.innerHTML = `<span class="folder-icon">&#128193;</span>${escapeHTML(formatStorageDateFolder(folder.name))}`;
      button.addEventListener('click', () => {
        renderGraphicStorageExplorer(
          { ...tree, selectedDate: folder.name },
          { driver, headingText, uploaderType: type }
        );
      });
    
    // Add delete folder button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Deletar toda a pasta';
    deleteBtn.style.cssText = 'background:rgba(255,0,0,0.8);color:white;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:14px;';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fileCount = folder.files?.length || 0;
      const ok = await confirmDialog(`Deletar toda a pasta "${formatStorageDateFolder(folder.name)}" com ${fileCount} arquivo(s)? Esta acao nao pode ser desfeita.`, {
        title: 'Deletar pasta',
        confirmLabel: 'Deletar',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      
      deleteBtn.disabled = true;
      deleteBtn.textContent = '...';
      
      try {
        const uploaderType = type;
        const response = await authFetch(
          `/api/campaigns/${campaignId}/storage/folder/${driver.id}/${encodeURIComponent(folder.name)}?uploaderType=${uploaderType}`,
          { method: 'DELETE' }
        );
        
        if (response.ok) {
          const result = await response.json();
          alert(`${result.deletedCount} arquivo(s) deletado(s) com sucesso!`);
          // Reload storage tree and atualizar status
          const updatedTree = uploaderType === 'graphic'
            ? await fetchGraphicStorageTree(campaignId, driver.id)
            : await fetchDriverStorageTree(campaignId, driver.id);
          if (updatedTree) {
            renderGraphicStorageExplorer(updatedTree, { driver, headingText, uploaderType });
            let itemsForStatus = flattenStorageFiles(updatedTree);
            if (uploaderType !== 'graphic') {
              try {
                const legacy = await fetchDriverEvidence(campaignId, driver.id);
                if (legacy?.length) itemsForStatus = itemsForStatus.concat(legacy);
              } catch (err) {
                console.warn('fetchDriverEvidence merge (folder delete)', err);
              }
            }
            updateDriverEvidenceFromItems(driver, itemsForStatus, uploaderType === 'graphic' ? 'graphic' : 'driver');
          }
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao deletar pasta');
        }
      } catch (err) {
        console.error('Delete folder error:', err);
        alert('Erro ao deletar pasta: ' + err.message);
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️';
      }
    });
    
    folderItem.appendChild(button);
    folderItem.appendChild(deleteBtn);
    folderList.appendChild(folderItem);
  });
  explorer.appendChild(folderList);

  const fileGrid = document.createElement('div');
  fileGrid.className = 'storage-file-grid';
  const files = Array.isArray(selectedFolder?.files) ? selectedFolder.files : [];
  if (!files.length) {
    const empty = document.createElement('div');
    empty.className = 'storage-empty';
    empty.textContent = 'Nenhuma imagem enviada nesta data.';
    fileGrid.appendChild(empty);
  } else {
    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'storage-file-card';
      card.style.position = 'relative';
      
      const link = document.createElement('a');
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const img = document.createElement('img');
      img.alt = file.name || '';
      img.loading = 'lazy';

      // Set image and link. If file.url is internal (/api/storage/...), fetch with auth.
      (async () => {
        try {
          const src = file.url || '';
          if (!src) {
            card.style.display = 'none';
            return;
          }
          if (typeof src === 'string' && src.startsWith('/api/storage/')) {
            const res = await authFetch(src);
            if (!res.ok) throw new Error('Nao autorizado');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            registerGalleryObjectUrl(blobUrl);
            img.src = blobUrl;
            link.href = blobUrl;
            img.dataset.blobUrl = blobUrl;
            link.dataset.blobUrl = blobUrl;
            img.onerror = () => { revokeGalleryObjectUrl(blobUrl); card.classList.add('broken'); card.style.display = 'none'; };
          } else {
            img.src = src;
            link.href = src;
            img.onerror = () => { card.classList.add('broken'); card.style.display = 'none'; };
          }
        } catch (err) {
          console.warn('Erro ao carregar arquivo de storage:', err);
          if (img?.dataset?.blobUrl) revokeGalleryObjectUrl(img.dataset.blobUrl);
          card.classList.add('broken');
          card.style.display = 'none';
        }
      })();

      link.appendChild(img);
      card.appendChild(link);
      
      // Add delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑️';
      deleteBtn.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(255,0,0,0.8);color:white;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:14px;z-index:10;';
      deleteBtn.title = 'Deletar arquivo';
      deleteBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const ok = await confirmDialog(`Deletar o arquivo "${file.name}"?`, {
          title: 'Deletar arquivo',
          confirmLabel: 'Deletar',
          cancelLabel: 'Cancelar',
          tone: 'danger',
        });
        if (!ok) return;
        
        deleteBtn.disabled = true;
        deleteBtn.textContent = '...';
        
        try {
          const storageId = file.id || file._id || file.storageFileId || null;
          if (!storageId) {
            throw new Error('ID do arquivo indisponivel para exclusao.');
          }
          const response = await authFetch(`/api/campaigns/${campaignId}/storage/${encodeURIComponent(storageId)}`, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            // Recarrega a árvore para refletir status e UI
            const updatedTree = type === 'graphic'
              ? await fetchGraphicStorageTree(campaignId, driver.id)
              : await fetchDriverStorageTree(campaignId, driver.id);
            if (updatedTree) {
              renderGraphicStorageExplorer(
                { ...updatedTree, driverId: driver.id, driverName: driver.name },
                { driver, headingText, uploaderType: type }
              );
              let itemsForStatus = flattenStorageFiles(updatedTree);
              if (type !== 'graphic') {
                try {
                  const legacy = await fetchDriverEvidence(campaignId, driver.id);
                  if (legacy?.length) itemsForStatus = itemsForStatus.concat(legacy);
                } catch (err) {
                  console.warn('fetchDriverEvidence merge (file delete)', err);
                }
              }
              updateDriverEvidenceFromItems(driver, itemsForStatus, type === 'graphic' ? 'graphic' : 'driver');
            } else {
              if (img?.dataset?.blobUrl) revokeGalleryObjectUrl(img.dataset.blobUrl);
              card.remove();
            }
            alert('Arquivo deletado com sucesso!');
          } else {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao deletar arquivo');
          }
        } catch (err) {
          console.error('Delete storage file error:', err);
          alert('Erro ao deletar arquivo: ' + err.message);
          deleteBtn.disabled = false;
          deleteBtn.textContent = '🗑️';
        }
      };
      card.appendChild(deleteBtn);
      
      const caption = document.createElement('div');
      caption.className = 'storage-file-caption small';
      const title = document.createElement('div');
      title.textContent = file.name || '(arquivo)';
      caption.appendChild(title);
      const timestamp = formatStorageTimestamp(file.updatedAt || file.createdAt);
      if (timestamp) {
        const meta = document.createElement('span');
        meta.className = 'muted';
        meta.textContent = timestamp;
        caption.appendChild(meta);
      }
      card.appendChild(caption);
      fileGrid.appendChild(card);
    });
  }
  explorer.appendChild(fileGrid);

  acompanheGalleryGrid.appendChild(explorer);
}

function renderDriverList(drivers = [], options = {}) {
  // options: { checkedDriverIds: Set<string>, onDriverClick: function(driver) }
  if (!acompanheDrivers) return;
  const mode = getAcompanheMode();
  // ensure the left list header shows 'Motoristas' when rendering drivers
  try { const h = document.querySelector('#acompanhe-list h3'); if (h) h.textContent = 'Motoristas'; } catch (e) {}
  const { checkedDriverIds = new Set(), onDriverClick = null } = options || {};
  acompanheDrivers.innerHTML = '';
  const list = Array.isArray(drivers) ? [...drivers] : [];
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', ignorePunctuation: true });
  list.sort((a, b) => collator.compare((a.name||''), (b.name||'')));
  for (const d of list) {
    const li = document.createElement('li');
    li.style.padding = '8px 6px';
    li.style.borderBottom = '1px solid var(--line)';
    li.dataset.driverId = d.id || '';
    li.setAttribute('role','button');
    li.tabIndex = 0;
    const nameEl = document.createElement('div');
    nameEl.className = 'strong';
    nameEl.textContent = d.name || '-';
    const cityEl = document.createElement('div');
    cityEl.className = 'small muted';
    cityEl.textContent = d.city || '';
    li.appendChild(nameEl);
    li.appendChild(cityEl);

    const chips = document.createElement('div');
    chips.className = 'driver-status-chips';
    updateDriverStatusChips(chips, d, mode);
    li.appendChild(chips);

    // Indica quando a grafica selecionada ja enviou arquivos para este motorista
    if (checkedDriverIds && typeof checkedDriverIds.has === 'function' && checkedDriverIds.has(d.id)) {
      const info = document.createElement('div');
      info.className = 'small muted';
      info.style.marginTop = '4px';
      info.textContent = 'Esta grafica registrou envios para este motorista.';
      li.appendChild(info);
      li.classList.add('checked-by-graphic');
    }

    li.addEventListener('click', async () => {
      // highlight selection
      Array.from(acompanheDrivers.children).forEach(c => c.classList.remove('selected'));
      li.classList.add('selected');
      setSelectedDriver(d);
      clearAcompanheGallery();
      let storageTree = null;
      let itemsForStatus = [];
      if (typeof onDriverClick === 'function') {
        try {
          const maybe = onDriverClick(d);
          if (maybe && typeof maybe.then === 'function') {
            maybe.catch(err => console.error('onDriverClick error', err));
          }
        } catch (err) {
          console.error('onDriverClick error', err);
        }
      } else {
        renderGraphicStorageLoading('Carregando imagens do motorista...');
        let storageTree = null;
        try {
          storageTree = await fetchDriverStorageTree(campaignId, d.id);
        } catch (err) {
          console.warn('fetchDriverStorageTree fallback', err);
        }
        if (storageTree && Array.isArray(storageTree.folders) && storageTree.folders.length) {
      renderGraphicStorageExplorer(
        { ...storageTree, driverId: d.id, driverName: d.name },
        {
          driver: d,
          headingText: 'Arquivos enviados pelo motorista',
          uploaderType: 'driver',
          emptyMessage: 'Nenhuma imagem enviada pelo motorista para esta campanha.',
        },
      );
          itemsForStatus = flattenStorageFiles(storageTree);
          try {
            const legacyEvidence = await fetchDriverEvidence(campaignId, d.id);
            if (legacyEvidence?.length) {
              itemsForStatus = itemsForStatus.concat(legacyEvidence);
            }
          } catch (err) {
            console.warn('fetchDriverEvidence merge error', err);
          }
        } else {
          const items = await fetchDriverEvidence(campaignId, d.id);
          if (items && items.length) {
            renderGalleryItems(items, { type: 'driver', driver: d });
            itemsForStatus = items;
          } else {
            acompanheGalleryGrid.classList.add('is-explorer');
            acompanheGalleryGrid.innerHTML = '<div class="storage-empty">Nenhuma evidência encontrada para este motorista.</div>';
            currentStorageTree = { driverId: d.id, driverName: d.name, folders: [] };
          }
        }
      }
      if (typeof onDriverClick !== 'function') {
        const snapshot = await collectEvidenceSnapshot({ driverId: d.id, driverTree: storageTree });
        updateDriverEvidenceFromItems(d, snapshot.graphicItems, 'graphic');
        updateDriverEvidenceFromItems(d, snapshot.driverItems, 'driver');
      }
    });
    // keyboard accessibility: Enter / Space triggers click
    li.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        li.click();
      }
    });
    acompanheDrivers.appendChild(li);
  }

  if (!onDriverClick && acompanheGalleryGrid) {
    acompanheGalleryGrid.classList.add('is-explorer');
    acompanheGalleryGrid.innerHTML = '<div class="storage-empty">Selecione um motorista para visualizar os arquivos enviados pelo motorista.</div>';
    currentStorageTree = null;
  }
}

function renderGraphicList(graphics = []) {
  if (!acompanheDrivers) return;
  const mode = getAcompanheMode();
  // ensure the left list header shows 'Gráficas' when rendering graphics
  try { const h = document.querySelector('#acompanhe-list h3'); if (h) h.textContent = 'Gráficas'; } catch (e) {}
  acompanheDrivers.innerHTML = '';
  const list = Array.isArray(graphics) ? [...graphics] : [];
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', ignorePunctuation: true });
  list.sort((a, b) => collator.compare((a.name||''), (b.name||'')));
  for (const g of list) {
    const li = document.createElement('li');
    li.style.padding = '8px 6px';
    li.style.borderBottom = '1px solid var(--line)';
    li.dataset.graphicId = g.id || '';
    li.setAttribute('role','button');
    li.tabIndex = 0;
    li.innerHTML = `<div class="strong">${escapeHTML(g.name || '-')}</div><div class="small muted">${escapeHTML(g.email || g.phone || '')}</div>`;
    li.addEventListener('click', async () => {
      Array.from(acompanheDrivers.children).forEach(c => c.classList.remove('selected'));
      li.classList.add('selected');
      clearAcompanheGallery();
      resetStatusPanel('Selecione um motorista para revisar os envios desta grafica.');

      // Fetch all evidence uploaded by this gráfica for the campaign
      const items = await fetchGraphicEvidence(campaignId, g.id);

      // Build a map driverId -> items[] so we can render driver-specific galleries quickly
      // Normalize keys to strings to avoid type mismatches between numeric/text ids
      const driverMap = new Map();
      for (const it of Array.isArray(items) ? items : []) {
        const drv = it.driverId || (it.driver && it.driver.id) || null;
        if (!drv) continue;
        const key = String(drv);
        if (!driverMap.has(key)) driverMap.set(key, []);
        driverMap.get(key).push(it);
      }

      // Render the campaign drivers list, marking which drivers were checked by this gráfica
      const drivers = Array.isArray(currentCampaign?.drivers) ? currentCampaign.drivers : [];
        const selectedGraphicId = String(g.id || '');
        const checkedDriverIds = new Set(Array.from(driverMap.keys()).map(String));
        renderDriverList(drivers, {
          checkedDriverIds,
          onDriverClick: async (driver) => {
            Array.from(acompanheDrivers.children).forEach(c => c.classList.remove('selected'));
            const sel = Array.from(acompanheDrivers.children).find(ch => String(ch.dataset.driverId) === String(driver.id));
            if (sel) sel.classList.add('selected');
            renderGraphicStorageLoading();
            let itemsForStatus = [];
            let driverTreeForStatus = null;
            let itemsForDriver = driverMap.get(String(driver.id)) || driverMap.get(driver.id) || [];
            if ((!itemsForDriver || itemsForDriver.length === 0) && typeof fetchGraphicDriverEvidence === 'function') {
              try {
                const fetched = await fetchGraphicDriverEvidence(campaignId, selectedGraphicId, driver.id);
                if (Array.isArray(fetched) && fetched.length) itemsForDriver = fetched;
            } catch (e) {
              console.warn('fallback fetchGraphicDriverEvidence failed', e);
            }
          }
            let storageTree = null;
            try {
              storageTree = await fetchGraphicStorageTree(campaignId, driver.id);
            } catch (err) {
              console.warn('fetchGraphicStorageTree failed', err);
            }
            if (storageTree && Array.isArray(storageTree.folders) && storageTree.folders.length) {
              renderGraphicStorageExplorer(
                { ...storageTree, driverId: driver.id, driverName: driver.name },
                { driver, uploaderType: 'graphic' }
              );
              itemsForStatus = flattenStorageFiles(storageTree);
              if (itemsForDriver && itemsForDriver.length) {
                itemsForStatus = itemsForStatus.concat(itemsForDriver);
              }
              driverTreeForStatus = await fetchDriverStorageTree(campaignId, driver.id);
            } else if (itemsForDriver && itemsForDriver.length) {
              renderGalleryItems(itemsForDriver, { type: 'graphic', driver });
              itemsForStatus = itemsForDriver;
              driverTreeForStatus = await fetchDriverStorageTree(campaignId, driver.id);
            } else {
              acompanheGalleryGrid.classList.add('is-explorer');
              acompanheGalleryGrid.innerHTML = '<div class="storage-empty">Nenhum arquivo encontrado para este motorista.</div>';
              currentStorageTree = { driverId: driver.id, driverName: driver.name, folders: [] };
            }
            const snapshot = await collectEvidenceSnapshot({
              driverId: driver.id,
              graphicId: selectedGraphicId,
              graphicTree: storageTree,
              driverTree: driverTreeForStatus,
            });
            updateDriverEvidenceFromItems(driver, snapshot.graphicItems, 'graphic');
            updateDriverEvidenceFromItems(driver, snapshot.driverItems, 'driver');
          }
        });
      if (acompanheGalleryGrid) {
        acompanheGalleryGrid.classList.add('is-explorer');
        acompanheGalleryGrid.innerHTML = '<div class="storage-empty">Selecione um motorista para visualizar os arquivos enviados pela gr&aacute;fica.</div>';
        currentStorageTree = null;
      }
    });
    li.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); li.click(); }
    });
    acompanheDrivers.appendChild(li);
  }
}

async function renderAcompanhe(data) {
  resetStatusPanel();
  applyStatusVisibility(getAcompanheMode());
  clearAcompanheGallery();
  // Render driver or graphic list depending on selected mode
  const mode = getAcompanheMode();
  if (mode === 'graphic') {
    const graphics = Array.isArray(data?.graphics) ? data.graphics : (Array.isArray(currentCampaign?.graphics) ? currentCampaign.graphics : []);
    renderGraphicList(graphics);
  } else {
    const drivers = Array.isArray(data?.drivers) ? data.drivers : (Array.isArray(currentCampaign?.drivers) ? currentCampaign.drivers : []);
    renderDriverList(drivers);
    // hide graphic status placeholders when in driver mode
  }
}

function setupAcompanheUI() {
  if (!acompanheMode) return;
  acompanheMode.addEventListener('change', (e) => {
    const v = String(e.target.value || 'driver');
    resetStatusPanel();
    applyStatusVisibility(getAcompanheMode());
    // re-render list for the selected mode
    try { renderAcompanhe(currentCampaign); } catch (err) {}
    if (v === 'graphic') {
      // no-op: renderAcompanhe will populate the list; show placeholder in gallery until a graphic is clicked
      if (acompanheGalleryGrid && (!acompanheGalleryGrid.children || acompanheGalleryGrid.children.length === 0)) {
        acompanheGalleryGrid.innerHTML = '<div class="small muted">Selecione uma gráfica à esquerda para ver as evidências.</div>';
      }
    } else {
      // reset to empty until a driver is clicked
      clearAcompanheGallery();
    }
  });
  
  // Setup cleanup button
  const btnCleanup = document.getElementById('btnCleanupOrphaned');
  if (btnCleanup) {
    btnCleanup.addEventListener('click', async () => {
      if (!currentCampaign) return;
      const ok = await confirmDialog('Limpar evidencias orfas (referencias a arquivos deletados)? Esta acao removera registros que apontam para imagens que nao existem mais.', {
        title: 'Limpar evidencias',
        confirmLabel: 'Limpar',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      
      btnCleanup.disabled = true;
      btnCleanup.textContent = '...';
      
      try {
        const response = await authFetch(`/api/campaigns/${currentCampaign.id}/cleanup-orphaned-evidence`, {
          method: 'POST'
        });
        
        if (response.ok) {
          const result = await response.json();
          alert(`${result.removedCount} evidência(s) órfã(s) removida(s) com sucesso!`);
          // Reload the current campaign
          try {
            const data = await fetchCampaign(currentCampaign.id);
            currentCampaign = data;
            renderAcompanhe(data);
          } catch (err) {
            console.error('Failed to reload campaign after cleanup:', err);
            location.reload(); // Fallback: reload entire page
          }
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao limpar evidências');
        }
      } catch (err) {
        console.error('Cleanup error:', err);
        alert('Erro ao limpar evidências: ' + err.message);
      } finally {
        btnCleanup.disabled = false;
        btnCleanup.textContent = '🧹 Limpar';
      }
    });
  }
}


function openGraphicModal(graphic = null) {
  if (!graphicFormModal || !graphicForm) return;
  graphicForm.reset();
  editingGraphicId = graphic?.id || null;
  if (graphicIdField) graphicIdField.value = editingGraphicId || '';
  if (graphicFormMessage) graphicFormMessage.textContent = '';

  if (graphic) {
    if (graphicModalTitle) graphicModalTitle.textContent = 'Editar grafica';
    if (graphicFormSubmit) graphicFormSubmit.textContent = 'Salvar';
    if (graphicFormHint) graphicFormHint.textContent = 'Atualize os dados de contato da grafica.';
    if (graphicFieldName) graphicFieldName.value = trim(graphic.name);
    if (graphicFieldEmail) graphicFieldEmail.value = trim(graphic.email);
    if (graphicFieldPhone) graphicFieldPhone.value = trim(graphic.phone);
    if (graphicFieldResp1Name) graphicFieldResp1Name.value = trim(graphic.responsible1Name);
    if (graphicFieldResp1Phone) graphicFieldResp1Phone.value = trim(graphic.responsible1Phone);
    if (graphicFieldResp2Name) graphicFieldResp2Name.value = trim(graphic.responsible2Name);
    if (graphicFieldResp2Phone) graphicFieldResp2Phone.value = trim(graphic.responsible2Phone);
    if (graphicFieldNotes) graphicFieldNotes.value = trim(graphic.notes);
  } else {
    if (graphicModalTitle) graphicModalTitle.textContent = 'Adicionar grafica';
    if (graphicFormSubmit) graphicFormSubmit.textContent = 'Adicionar';
    if (graphicFormHint) graphicFormHint.textContent = 'Preencha os dados para liberar o acesso da grafica a esta campanha.';
  }

  showModal(graphicFormModal);
  if (graphicFieldName) {
    graphicFieldName.focus();
    graphicFieldName.select();
  }
}

async function submitGraphicForm(event) {
  event.preventDefault();
  if (!graphicForm || !campaignId) return;

  const payload = {
    name: trim(graphicFieldName?.value),
    email: trim(graphicFieldEmail?.value),
    phone: trim(graphicFieldPhone?.value),
    responsible1Name: trim(graphicFieldResp1Name?.value),
    responsible1Phone: trim(graphicFieldResp1Phone?.value),
    responsible2Name: trim(graphicFieldResp2Name?.value),
    responsible2Phone: trim(graphicFieldResp2Phone?.value),
    notes: trim(graphicFieldNotes?.value),
  };

  if (!payload.name) {
    if (graphicFormMessage) graphicFormMessage.textContent = 'Informe o nome da grafica.';
    if (graphicFieldName) graphicFieldName.focus();
    return;
  }
  if (!payload.responsible1Name) {
    if (graphicFormMessage) graphicFormMessage.textContent = 'Informe o nome do responsavel principal.';
    if (graphicFieldResp1Name) graphicFieldResp1Name.focus();
    return;
  }

  const method = editingGraphicId ? 'PATCH' : 'POST';
  const url = editingGraphicId
    ? `/api/campaigns/${encodeURIComponent(campaignId)}/graphics/${encodeURIComponent(editingGraphicId)}`
    : `/api/campaigns/${encodeURIComponent(campaignId)}/graphics`;

  if (graphicFormMessage) graphicFormMessage.textContent = '';
  const previousLabel = graphicFormSubmit ? graphicFormSubmit.textContent : '';
  if (graphicFormSubmit) {
    graphicFormSubmit.disabled = true;
    graphicFormSubmit.textContent = editingGraphicId ? 'Salvando...' : 'Adicionando...';
  }

  try {
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let message = 'Falha ao salvar a grafica.';
      try { message = (await res.json()).error || message; } catch (e) {
        try { message = await res.text(); } catch {}
      }
      throw new Error(message);
    }
    hideModal(graphicFormModal);
    await init();
  } catch (err) {
    console.error(err);
    if (graphicFormMessage) graphicFormMessage.textContent = err.message || 'Nao foi possivel salvar a grafica.';
  } finally {
    if (graphicFormSubmit) {
      graphicFormSubmit.disabled = false;
      graphicFormSubmit.textContent = previousLabel || (editingGraphicId ? 'Salvar' : 'Adicionar');
    }
  }
}

function openImportKmModal() {
  if (!importKmModal || !importKmForm) return;
  resetImportKmFormState();

  const defaultSheetId = trim(currentCampaign?.kmSheetId || currentCampaign?.sheetId || '');
  const defaultSheetName = trim(currentCampaign?.kmSheetName || currentCampaign?.sheetName || '') || 'Planilha1';

  if (importKmSheetId) importKmSheetId.value = defaultSheetId;
  if (importKmSheetName) importKmSheetName.value = defaultSheetName;

  showModal(importKmModal);
  if (importKmSheetId) {
    importKmSheetId.focus();
    importKmSheetId.select();
  }
}

async function submitImportKmForm(event) {
  event.preventDefault();
  if (!importKmForm || !campaignId) return;

  const spreadsheetId = trim(importKmSheetId?.value);
  const sheetNameValue = trim(importKmSheetName?.value);
  const sheetName = sheetNameValue || 'Planilha1';

  clearImportKmMessage();

  if (!spreadsheetId) {
    if (importKmMessage) importKmMessage.textContent = 'Informe o ID da planilha.';
    if (importKmSheetId) importKmSheetId.focus();
    return;
  }

  const payload = { spreadsheetId, sheetName, campaignId };

  const previousSubmitLabel = importKmSubmit ? importKmSubmit.textContent : '';
  const previousTriggerLabel = btnImportKm ? btnImportKm.textContent : '';

  if (importKmSubmit) {
    importKmSubmit.disabled = true;
    importKmSubmit.textContent = 'Importando...';
  }
  if (btnImportKm) {
    btnImportKm.disabled = true;
    btnImportKm.textContent = 'Importando...';
  }

  try {
    const res = await authFetch('/api/imports/km', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let body;
      try {
        body = await res.json();
      } catch (e) {
        body = await res.text();
      }
      const msg = body && typeof body === 'object'
        ? `${body.error || 'Erro'}${body.detail ? '\n' + body.detail : ''}${body.hint ? '\n' + body.hint : ''}`
        : String(body || `HTTP ${res.status}`);
      throw new Error(msg);
    }
    const result = await res.json();
    hideModal(importKmModal);
    await init();
    alert(`Importacao concluida.\nVinculados: ${result.linked}\nItens para revisar: ${result.review}`);
  } catch (err) {
    console.error(err);
    if (importKmMessage) importKmMessage.textContent = err.message || 'Nao foi possivel importar a planilha.';
  } finally {
    if (importKmSubmit) {
      importKmSubmit.disabled = false;
      importKmSubmit.textContent = previousSubmitLabel || 'Importar';
    }
    if (btnImportKm) {
      btnImportKm.disabled = false;
      btnImportKm.textContent = previousTriggerLabel || 'Importar KM';
    }
  }
}

function renderKm(drivers = []) {
  const tbody = el('#tblKm');
  if (!tbody) return;
  tbody.innerHTML = '';
  const header = Array.isArray(currentCampaign?.kmSheetHeader) && currentCampaign.kmSheetHeader.length
    ? currentCampaign.kmSheetHeader
    : (Array.isArray(currentCampaign?.sheetHeader) && currentCampaign.sheetHeader.length ? currentCampaign.sheetHeader : []);

  // sort drivers alphabetically (pt-BR) by name for consistent UI
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', ignorePunctuation: true });
  const sortedDrivers = Array.isArray(drivers) ? [...drivers].sort((a, b) => collator.compare((a.name||''), (b.name||''))) : [];

  for (const driver of sortedDrivers) {
    // Ensure we render every driver even if they don't have KM data yet
    let kmData = driver.km;
    if (!kmData) {
      kmData = {
        periods: [],
        total: { kmRodado: '', metaKm: '', percent: null, status: '', label: 'Total', isTotal: true },
        checkIn: '',
        comentarios: '',
        observacoes: '',
      };
    }

    // Determine how many periods to render: campaign.kmPeriods (explicit), or derived from header, or default 3
    const headerForPeriods = Array.isArray(currentCampaign?.kmSheetHeader) && currentCampaign.kmSheetHeader.length
      ? currentCampaign.kmSheetHeader
      : (Array.isArray(currentCampaign?.sheetHeader) && currentCampaign.sheetHeader.length ? currentCampaign.sheetHeader : []);
    const totalPeriods = Number.isFinite(Number(currentCampaign?.kmPeriods))
      ? Number(currentCampaign.kmPeriods)
      : (detectKmPeriodsFromHeader(headerForPeriods) || 3);

    const periods = [];
    for (let i = 1; i <= totalPeriods; i += 1) {
      let p = null;
      if (Array.isArray(kmData.periods)) {
        p = kmData.periods.find(x => Number(x.index) === i) || null;
      }
      if (p) {
        periods.push({ ...p, label: `Periodo ${i}` });
      } else {
        periods.push({ index: i, kmRodado: '', metaKm: '', percent: null, status: '', label: `Periodo ${i}` });
      }
    }

    const totalObj = kmData.total || { kmRodado: '', metaKm: '', percent: null, status: '', label: 'Total', isTotal: true };
    const totalRows = [{ ...totalObj, label: 'Total', isTotal: true, checkIn: kmData.checkIn || '', comentarios: kmData.comentarios || '', observacoes: kmData.observacoes || '' }];

    const rows = [...periods, ...totalRows];

    rows.forEach((period, index) => {
      const tr = document.createElement('tr');
      // tag the row with driver id and whether it's the total row for easier DOM updates
      if (driver.id) tr.dataset.driverId = driver.id;
      if (period.isTotal) tr.dataset.isTotal = '1';
      else tr.dataset.periodIndex = period.index;

      if (index === 0) {
        const nameCell = document.createElement('td');
        nameCell.rowSpan = rows.length;
        const nameButton = document.createElement('button');
        nameButton.type = 'button';
        nameButton.className = 'link-button km-name';
        nameButton.dataset.driverId = driver.id || '';
        nameButton.textContent = driver.name || '-';
        nameCell.appendChild(nameButton);
        tr.appendChild(nameCell);
      }

  const periodCell = document.createElement('td');
  // keep period label and number on the same line to avoid vertical stacking
  periodCell.className = 'period-cell';
  periodCell.textContent = period.label || `Periodo ${period.index || ''}`;
      tr.appendChild(periodCell);

      // KM (editable)
      const kmCell = document.createElement('td');
      const kmInput = document.createElement('input');
      kmInput.type = 'text';
      kmInput.className = 'driver-input';
      kmInput.value = period.kmRodado ?? '';
      kmInput.dataset.driverId = driver.id;
      // Determine dataset.column: prefer campaign.kmColumns mapping when available
      if (currentCampaign?.kmColumns && currentCampaign.kmColumns.periods && currentCampaign.kmColumns.periods[period.index]) {
        const mapped = currentCampaign.kmColumns.periods[period.index].kmRodado;
        kmInput.dataset.column = mapped && mapped.key ? mapped.key : `KM RODADO ${period.index}`;
      } else if (period.isTotal && currentCampaign?.kmColumns?.totals?.kmRodadoTotal) {
        kmInput.dataset.column = currentCampaign.kmColumns.totals.kmRodadoTotal.key || 'KM RODADO TOTAL';
      } else {
        kmInput.dataset.column = `KM RODADO ${period.index || (period.label === 'Total' ? 'TOTAL' : '')}`;
      }
      kmInput.dataset.originalValue = kmInput.value;
      kmInput.addEventListener('change', (e) => {
        const value = e.target.value;
        const driverId = e.target.dataset.driverId;
        const col = e.target.dataset.column;
        const prior = e.target.dataset.originalValue ?? '';
        bufferKmChange(driverId, col, value, prior);
        updateDriverTotals(driverId);
      });
      kmCell.appendChild(kmInput);
      tr.appendChild(kmCell);

      // Meta (editable)
      const metaCell = document.createElement('td');
      const metaInput = document.createElement('input');
      metaInput.type = 'text';
      metaInput.className = 'driver-input';
      metaInput.value = period.metaKm ?? '';
      metaInput.dataset.driverId = driver.id;
      if (currentCampaign?.kmColumns && currentCampaign.kmColumns.periods && currentCampaign.kmColumns.periods[period.index]) {
        const mapped = currentCampaign.kmColumns.periods[period.index].metaKm;
        metaInput.dataset.column = mapped && mapped.key ? mapped.key : `META KM ${period.index}`;
      } else if (period.isTotal && currentCampaign?.kmColumns?.totals?.metaKmTotal) {
        metaInput.dataset.column = currentCampaign.kmColumns.totals.metaKmTotal.key || 'META KM TOTAL';
      } else {
        metaInput.dataset.column = `META KM ${period.index || (period.label === 'Total' ? 'TOTAL' : '')}`;
      }
      metaInput.dataset.originalValue = metaInput.value;
      metaInput.addEventListener('change', (e) => {
        const value = e.target.value;
        const driverId = e.target.dataset.driverId;
        const col = e.target.dataset.column;
        const prior = e.target.dataset.originalValue ?? '';
        bufferKmChange(driverId, col, value, prior);
        updateDriverTotals(driverId);
      });
      metaCell.appendChild(metaInput);
      tr.appendChild(metaCell);

      const percentCell = document.createElement('td');
  percentCell.textContent = formatPercentValue(period.percent ?? null);
  percentCell.dataset.column = period.isTotal ? 'PERCENT TOTAL' : `PERCENT ${period.index || ''}`;
      tr.appendChild(percentCell);

      const statusCell = document.createElement('td');
      const statusInput = document.createElement('input');
      statusInput.type = 'text';
      statusInput.className = 'driver-input';
      statusInput.value = period.status ?? '';
      statusInput.dataset.driverId = driver.id;
      if (currentCampaign?.kmColumns && currentCampaign.kmColumns.periods && currentCampaign.kmColumns.periods[period.index]) {
        const mapped = currentCampaign.kmColumns.periods[period.index].status;
        statusInput.dataset.column = mapped && mapped.key ? mapped.key : (period.isTotal ? 'STATUS TOTAL' : `STATUS ${period.index}`);
      } else if (period.isTotal && currentCampaign?.kmColumns?.totals?.statusTotal) {
        statusInput.dataset.column = currentCampaign.kmColumns.totals.statusTotal.key || 'STATUS TOTAL';
      } else {
        statusInput.dataset.column = period.isTotal ? 'STATUS TOTAL' : `STATUS ${period.index || ''}`;
      }
      statusInput.dataset.originalValue = statusInput.value;
      statusInput.addEventListener('change', (e) => {
        const value = e.target.value;
        const driverId = e.target.dataset.driverId;
        const col = e.target.dataset.column;
        const prior = e.target.dataset.originalValue ?? '';
        bufferKmChange(driverId, col, value, prior);
        updateDriverTotals(driverId);
      });
      statusCell.appendChild(statusInput);
      tr.appendChild(statusCell);

      const checkCell = document.createElement('td');
      if (period.isTotal) {
        const checkInput = document.createElement('input');
        checkInput.type = 'text';
        checkInput.className = 'driver-input';
        checkInput.value = kmData.checkIn || '';
        checkInput.dataset.driverId = driver.id;
        // map CHECK IN to kmColumns extras if present
        if (currentCampaign?.kmColumns?.extras?.checkIn) checkInput.dataset.column = currentCampaign.kmColumns.extras.checkIn.key || 'CHECK IN';
        else checkInput.dataset.column = 'CHECK IN';
        checkInput.dataset.originalValue = checkInput.value;
        checkInput.addEventListener('change', (e) => {
          const value = e.target.value;
          const driverId = e.target.dataset.driverId;
          const col = e.target.dataset.column;
          const prior = e.target.dataset.originalValue ?? '';
          bufferKmChange(driverId, col, value, prior);
          updateDriverTotals(driverId);
        });
        checkCell.appendChild(checkInput);
      } else {
        checkCell.textContent = '';
      }
      tr.appendChild(checkCell);

      const notesCell = document.createElement('td');
      if (period.isTotal) {
        const notesInput = document.createElement('textarea');
        notesInput.className = 'driver-input';
        notesInput.value = [kmData.comentarios, kmData.observacoes].filter(v => v).join('\n') || '';
        notesInput.dataset.driverId = driver.id;
        // map comments/observacoes to detected extras key if present
        if (currentCampaign?.kmColumns?.extras?.comentarios) notesInput.dataset.column = currentCampaign.kmColumns.extras.comentarios.key || 'COMENTÁRIOS';
        else notesInput.dataset.column = 'COMENTÁRIOS';
        notesInput.dataset.originalValue = notesInput.value;
        notesInput.addEventListener('change', (e) => {
          const value = e.target.value;
          const driverId = e.target.dataset.driverId;
          const col = e.target.dataset.column;
          const prior = e.target.dataset.originalValue ?? '';
          bufferKmChange(driverId, col, value, prior);
          updateDriverTotals(driverId);
        });
        notesCell.appendChild(notesInput);
      } else {
        notesCell.textContent = '';
      }
      tr.appendChild(notesCell);

      tbody.appendChild(tr);
    });

    // After rendering driver rows, compute totals from current inputs so totals show correctly
    if (driver.id) updateDriverTotals(driver.id);
  }

  ensureTableState(tbody.closest('table'));
}

// renderKmCards removed; using table layout but with editable inputs instead

function renderKmEditForm(driver) {
  const form = document.getElementById('kmEditForm');
  const container = document.getElementById('kmEditFields');
  const hint = document.getElementById('kmEditHint');
  if (!form || !container) return;
  container.innerHTML = '';

  const header = Array.isArray(currentCampaign?.kmSheetHeader) && currentCampaign.kmSheetHeader.length
    ? currentCampaign.kmSheetHeader
    : Array.isArray(currentCampaign?.sheetHeader) && currentCampaign.sheetHeader.length
    ? currentCampaign.sheetHeader
    : Object.keys(driver?.km?.raw || {}).filter(k => !String(k).startsWith('_'));

  const raw = driver?.km?.raw || {};
  if (hint) {
    hint.textContent = driver.rowNumber ? `Linha ${driver.rowNumber} da planilha.` : 'Edite os campos abaixo e salve para atualizar a planilha.';
  }

  if (!header || !header.length) {
    const p = document.createElement('p');
    p.className = 'small muted';
    p.textContent = 'Sem colunas definidas para esta planilha.';
    container.appendChild(p);
    return;
  }

  header.forEach((column, index) => {
    if (!column) return;
    const normalized = normalizeKey(column);
    if (DRIVER_FORM_HIDDEN_COLUMNS.has(normalized)) return;
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.setAttribute('for', `km-field-${index}`);
    label.textContent = column;

    const field = createInputForColumn(column, index, 'km-field');
    const currentValue = raw[column] ?? '';
    field.value = currentValue;
    field.dataset.originalValue = currentValue;
    group.append(label, field);
    container.appendChild(group);
  });

  form.dataset.driverId = driver.id || '';
}

function openKmEdit(driverId) {
  const driver = getDriverById(driverId);
  if (!driver) {
    alert('Motorista nao encontrado.');
    return;
  }
  renderKmEditForm(driver);
  showModal(document.getElementById('kmEditModal'));
}

function renderReview(items = []) {
  const tbody = el('#tblReview');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const item of items) {
    const row = document.createElement('tr');
    row.dataset.reviewId = item.id || '';
    row.dataset.reviewType = item.type || '';
    if (item.driverId) row.dataset.driverId = item.driverId;

    const typeCell = document.createElement('td');
    typeCell.textContent = item.type || '-';
    row.appendChild(typeCell);

    const descCell = document.createElement('td');
    const lines = [];
    if (item.driverName) {
      lines.push(`<strong>${escapeHTML(item.driverName)}</strong>`);
    }
    if (item.column) {
      const value = item.value ? escapeHTML(item.value) : '<i>(vazio)</i>';
      lines.push(`${escapeHTML(item.column)}: ${value}`);
    }
    if (item.rowNumber) {
      lines.push(`Linha ${item.rowNumber}`);
    }
    if (item.note) {
      lines.push(escapeHTML(item.note));
    }
    if (item.payload && item.type === 'KM_MATCH') {
      const nome = item.payload.raw?.Nome || item.payload.raw?.NOME || '';
      const kmTotal = item.payload.kmTotal || '';
      lines.push(`Nome informado: ${escapeHTML(nome)}`);
      if (kmTotal) lines.push(`KM Total: ${escapeHTML(kmTotal)}`);
    }
    descCell.innerHTML = lines.length ? lines.join('<br/>') : 'Sem detalhes';
    row.appendChild(descCell);

    const actionCell = document.createElement('td');
    actionCell.className = 'review-actions';
    const canApplyStatus = item.type === 'STATUS_INVALIDO' && item.driverId;
    if (canApplyStatus) {
      const select = document.createElement('select');
      select.className = 'driver-input review-status-select';
      STATUS_OPTIONS.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        select.appendChild(option);
      });
      const normalized = normalizeDriverStatus(item.value);
      select.value = STATUS_OPTIONS.includes(normalized) ? normalized : 'agendado';
      actionCell.appendChild(select);

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn btn--primary review-action';
      applyBtn.textContent = 'Aplicar';
      applyBtn.dataset.reviewAction = 'apply-status';
      applyBtn.dataset.reviewId = item.id || '';
      actionCell.appendChild(applyBtn);
    }

    const ignoreBtn = document.createElement('button');
    ignoreBtn.type = 'button';
    ignoreBtn.className = 'btn btn--ghost review-action';
    ignoreBtn.textContent = 'Ignorar';
    ignoreBtn.dataset.reviewAction = 'ignore';
    ignoreBtn.dataset.reviewId = item.id || '';
    actionCell.appendChild(ignoreBtn);

    row.appendChild(actionCell);
    tbody.appendChild(row);
  }

  ensureTableState(tbody.closest('table'));
}

function getDriverById(id) {
  if (!currentCampaign || !Array.isArray(currentCampaign.drivers)) return null;
  return currentCampaign.drivers.find(d => d.id === id);
}

function renderDriverDetails(driver) {
  if (!driverModalTitle || !driverDetailFields || !driverDetailForm) return;
  driverModalTitle.textContent = driver.name || 'Motorista';
  driverDetailForm.dataset.driverId = driver.id || '';
  driverDetailFields.innerHTML = '';

  const header = getCampaignHeader();
  const raw = driver.raw || {};
  // Campos que nao devem aparecer no popup de Motoristas (ficam na aba KM Metas)
  const HIDE_KEYS = (() => {
    const base = [
      'KM RODADO TOTAL','META KM TOTAL','STATUS TOTAL','PERCENT TOTAL','CHECK IN',
      'COMENTARIOS','PASTA DRIVE','_ATUALIZADO EM','_ORIGEM','PLOTAGEM','DATA FINAL 90 DIAS',
      'DRV FOTO ODOMETRO INST','DRV ODOMETRO VALOR INST','DRV FOTO LATERAL ESQ INST',
      'DRV FOTO LATERAL DIR INST','DRV FOTO TRASEIRA INST','DRV FOTO FRENTE INST',
      'GFX FOTO LATERAL ESQ INST','GFX FOTO LATERAL DIR INST','GFX FOTO TRASEIRA INST',
      'GFX FOTO FRENTE INST','FOTOS CHECKIN 3','FOTOS CHECKOUT'
    ];
    base.push(...Array.from(DRIVER_DETAIL_HIDDEN_COLUMNS));
    for (let i=1;i<=3;i++) {
      base.push(
        `DATA INICIO ${i}`, `DATA ATUAL ${i}`, `QTDE DIAS ${i}`,
        `KM RODADO ${i}`, `META KM ${i}`, `STATUS ${i}`,
      );
    }
    // normalizar p/ comparacao
    return new Set(base.map(k => normalizeKey(k)));
  })();

  const entries = header.length
    ? header
        .filter(col => !HIDE_KEYS.has(normalizeKey(col)))
        .map(col => [col, raw[col] ?? ''])
    : Object
        .entries(raw)
        .filter(([key]) => key && !String(key).startsWith('_') && !HIDE_KEYS.has(normalizeKey(key)));

  if (!entries.length) {
    const message = document.createElement('p');
    message.className = 'small muted';
    message.textContent = 'Sem dados complementares para este motorista.';
    driverDetailFields.appendChild(message);
    return;
  }

  if (driverDetailHint) {
    driverDetailHint.textContent = driver.rowNumber
      ? `Linha ${driver.rowNumber} da planilha.`
      : 'Edite os campos abaixo e salve para atualizar a planilha.';
  }

  entries.forEach(([column, value], index) => {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.setAttribute('for', `driver-detail-field-${index}`);
    label.textContent = column;

    const field = createInputForColumn(column, index, 'driver-detail-field');
    const currentValue = value ?? '';
    field.value = currentValue;
    field.dataset.originalValue = currentValue;
    if (field.tagName === 'TEXTAREA') {
      group.classList.add('form-group--full');
    }
    if (field.tagName === 'SELECT') {
      const exists = Array.from(field.options).some(opt => opt.value === field.value);
      if (!exists && field.value) {
        const option = document.createElement('option');
        option.value = field.value;
        option.textContent = field.value;
        field.appendChild(option);
      }
      field.value = field.value || 'agendado';
    }

    group.append(label, field);
    driverDetailFields.appendChild(group);
  });
}

function openDriverDetail(driverId) {
  const driver = getDriverById(driverId);
  if (!driver) {
    alert('Motorista nao encontrado.');
    return;
  }
  renderDriverDetails(driver);
  showModal(driverDetailModal);
}

function getCampaignHeader() {
  if (
    currentCampaign &&
    Array.isArray(currentCampaign.sheetHeader) &&
    currentCampaign.sheetHeader.length
  ) {
    return currentCampaign.sheetHeader;
  }

  if (currentCampaign?.drivers?.length) {
    const raw = currentCampaign.drivers[0].raw || {};
    const keys = Object.keys(raw).filter(key => key && !String(key).startsWith('_'));
    if (keys.length) return keys;
  }

  return [...DEFAULT_DRIVER_COLUMNS];
}

function createInputForColumn(column, index, prefix = 'driver-field') {
  const lower = column.toLowerCase();
  const id = `${prefix}-${index}`;
  let field;

  if (lower === 'status') {
    field = document.createElement('select');
    STATUS_OPTIONS.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
      field.appendChild(option);
    });
    field.value = 'agendado';
  } else if (lower.includes('observ') || lower.includes('coment')) {
    field = document.createElement('textarea');
    field.rows = 3;
  } else {
    field = document.createElement('input');
    field.type = 'text';
  }

  field.id = id;
  field.dataset.column = column;
  if (lower === 'nome') {
    field.required = true;
  }
  return field;
}

function renderDriverFormFields() {
  if (!driverFormFields) return;
  driverFormFields.innerHTML = '';
  const header = getCampaignHeader();

  header.forEach((column, index) => {
    if (!column) return;
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.setAttribute('for', `driver-field-${index}`);
    label.textContent = column;

    const field = createInputForColumn(column, index);
    if (field.tagName === 'TEXTAREA') {
      group.classList.add('form-group--full');
    }

    group.append(label, field);
    driverFormFields.appendChild(group);
  });

  if (driverFormHint) {
    driverFormHint.textContent = 'Campos vazios serao gravados em branco. Nome eh obrigatorio.';
  }
}

function parseNumeric(value) {
  if (value == null) return 0;
  const normalized = String(value)
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateMetrics(drivers = []) {
  let totalKm = 0;
  for (const driver of drivers) {
    const kmTotal = driver?.km?.total?.kmRodado;
    if (kmTotal !== null && kmTotal !== undefined) {
      totalKm += parseNumeric(kmTotal);
    }
  }
  return { totalKm };
}
async function savePendingDriverChanges() {
  if (!btnSaveDrivers) return;
  if (pendingDriverChanges.size === 0) {
    alert('Nenhuma alteração pendente.');
    return;
  }

  const originalLabel = btnSaveDrivers.textContent;
  btnSaveDrivers.disabled = true;
  btnSaveDrivers.textContent = 'Salvando...';

  try {
    const entries = Array.from(pendingDriverChanges.entries());
    for (const [driverId, fields] of entries) {
      const res = await authFetch(
        `/api/campaigns/${encodeURIComponent(campaignId)}/drivers/${encodeURIComponent(driverId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      pendingDriverChanges.delete(driverId);
      markDriverRowDirty(driverId, false);
    }
    await init();
    alert('Alteracoes salvas com sucesso.');
  } catch (err) {
    console.error(err);
    alert('Nao foi possivel salvar as alteracoes.');
  } finally {
    btnSaveDrivers.textContent = originalLabel;
    updateSaveButtonState();
  }
}

function populateSummary(campaign, metrics = {}) {
  currentCampaign = campaign;
  el('#campTitle').textContent = campaign.name || 'Campanha';
  el('#campClient').textContent = campaign.client || '-';
  el('#campPeriod').textContent = campaign.period || '-';

  const code = String(campaign?.campaignCode || '').trim().toUpperCase();
  const hasCode = Boolean(code);
  if (campaignCodeValue) {
    campaignCodeValue.textContent = hasCode ? code : '---';
    if (hasCode) campaignCodeValue.dataset.code = code;
    else delete campaignCodeValue.dataset.code;
    campaignCodeValue.classList.toggle('is-empty', !hasCode);
  }
  if (btnCopyCampaignCode) {
    btnCopyCampaignCode.disabled = !hasCode;
    if (hasCode) btnCopyCampaignCode.removeAttribute('aria-disabled');
    else btnCopyCampaignCode.setAttribute('aria-disabled', 'true');
  }
  if (graphicAccessHint) {
    graphicAccessHint.textContent = hasCode
      ? 'Compartilhe com a grafica o nome do responsavel cadastrado e o codigo abaixo. Esses dois campos sao usados para acessar a area da grafica.'
      : 'Esta campanha ainda nao possui codigo. Gere um novo login ou salve a campanha novamente para criar o codigo automaticamente.';
  }
  setCopyCampaignMessage(
    hasCode
      ? 'Clique em copiar para compartilhar o codigo com a grafica.'
      : 'Codigo ainda nao definido para esta campanha.',
    hasCode ? 'muted' : 'muted',
  );

  if (campaignStatusSelect) {
    if (!campaignStatusSelect.options.length) {
      CAMPAIGN_STATUS_OPTIONS.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        campaignStatusSelect.appendChild(option);
      });
    }
    const normalizedStatus = normalizeKey(campaign.status || 'ativa');
    const selected = CAMPAIGN_STATUS_OPTIONS.includes(normalizedStatus)
      ? normalizedStatus
      : CAMPAIGN_STATUS_OPTIONS[0];
    campaignStatusSelect.value = selected;
    campaignStatusSelect.dataset.currentValue = selected;
  }

  renderCounts(campaign.counts);

  // KPIs ainda serao refinados quando definirmos regras oficiais
  el('#kpiAd').textContent = metrics.averageAdherence || campaign.adh || '-';
  el('#kpiKm').textContent = formatNumber(metrics.totalKm || 0);
  el('#kpiInst').textContent = campaign.counts?.instalado || 0;
  el('#kpiRev').textContent = campaign.reviewCount || 0;

  const configInfo = el('#configInfo');
  if (configInfo) {
    const infos = [
      campaign.sheetId && `Sheet ID: ${campaign.sheetId}`,
      campaign.sheetName && `Aba: ${campaign.sheetName}`,
    ].filter(Boolean);
    configInfo.textContent = infos.length ? infos.join(' | ') : configInfo.textContent;
  }
  if (cooldownDriverInput) cooldownDriverInput.value = Number(campaign.driverCooldownDays ?? 10);
  if (cooldownGraphicInput) cooldownGraphicInput.value = Number(campaign.graphicCooldownDays ?? 10);

  // Setup KM periods control (if present in DOM)
  try { setupKmPeriodsControl(); } catch (e) { /* ignore */ }
}

async function copyCampaignCodeToClipboard() {
  const code = campaignCodeValue?.dataset?.code || '';
  const value = String(code || '').trim();
  if (!value) {
    setCopyCampaignMessage('Codigo ainda nao definido para esta campanha.', 'muted');
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const temp = document.createElement('input');
      temp.value = value;
      temp.setAttribute('readonly', 'true');
      temp.style.position = 'absolute';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      temp.setSelectionRange(0, value.length);
      const ok = document.execCommand ? document.execCommand('copy') : false;
      document.body.removeChild(temp);
      if (!ok) throw new Error('Clipboard API indisponivel');
    }
    setCopyCampaignMessage('Codigo copiado para a area de transferencia.', 'success');
  } catch (err) {
    console.error(err);
    setCopyCampaignMessage('Nao foi possivel copiar automaticamente. Copie manualmente.', 'muted');
  }
}

async function init() {
  if (!campaignId) {
    alert('Campanha nao encontrada (ID ausente).');
    window.location.href = 'index.html';
    return;
  }
  console.debug('init campaignId=', campaignId);
  try {
    const data = await fetchCampaign(campaignId);
    // keep a reference to current campaign payload for other panels (Acompanhe)
    currentCampaign = data;
    const metrics = calculateMetrics(data.drivers);
    populateSummary(data, metrics);
    renderDrivers(data.drivers);
    renderGraphics(data.graphics || []);
    renderKm(data.drivers);
    renderReview(data.review);
      // Acompanhe panel rendering (admin monitoring)
      try { renderAcompanhe(data); } catch (e) { /* non-fatal */ }
  } catch (err) {
    console.error('init: failed to load campaign', err);
    const details = [];
    if (err && err.status) details.push(`status=${err.status}`);
    if (err && err.responseText) details.push(err.responseText);
    const msg = `Erro ao carregar detalhes da campanha. ${details.join('\n')}`;
    // show informative alert but don't immediately redirect so we can debug
    alert(msg);
    // leave the page so you can inspect console/network; user can manually return to list
  }
}

function setupTabs() {
  tabs.forEach(tab =>
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(panel => panel.classList.remove('active'));

      tab.classList.add('active');
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      if (target) target.classList.add('active');
    }),
  );
}

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  init();
  // Acompanhe UI setup
  try { setupAcompanheUI(); } catch (e) {}
  resetStatusPanel();

  if (btnVerifyDriver) {
    btnVerifyDriver.addEventListener('click', () => handleVerificationAction('driver'));
  }
  if (btnVerifyGraphic) {
    btnVerifyGraphic.addEventListener('click', () => handleVerificationAction('graphic'));
  }

  if (btnCopyCampaignCode) {
    btnCopyCampaignCode.addEventListener('click', event => {
      event.preventDefault();
      copyCampaignCodeToClipboard();
    });
  }

  document.addEventListener('click', event => {
    const dismiss = event.target.closest('[data-modal-dismiss]');
    if (dismiss) {
      const modal = dismiss.closest('.modal');
      if (modal) hideModal(modal);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const open = Array.from(document.querySelectorAll('.modal:not(.hidden)'));
      const last = open[open.length - 1];
      if (last) hideModal(last);
    }
  });

  if (btnSaveDrivers) {
    btnSaveDrivers.addEventListener('click', savePendingDriverChanges);
    updateSaveButtonState();
  }

  if (btnAddGraphic) {
    btnAddGraphic.addEventListener('click', () => openGraphicModal());
  }

  if (graphicForm) {
    graphicForm.addEventListener('submit', submitGraphicForm);
  }

  if (tblGraphics) {
    tblGraphics.addEventListener('click', async event => {
      const editButton = event.target.closest('.graphic-edit');
      if (editButton) {
        const graphicId = editButton.dataset.graphicId;
        const record = currentCampaign?.graphics?.find(g => g.id === graphicId);
        if (record) openGraphicModal(record);
        return;
      }

      const deleteButton = event.target.closest('.graphic-delete');
      if (deleteButton) {
        const graphicId = deleteButton.dataset.graphicId;
        if (!graphicId) return;
        const ok = await confirmDialog('Deseja remover esta grafica?', {
          title: 'Remover grafica',
          confirmLabel: 'Remover',
          cancelLabel: 'Cancelar',
          tone: 'danger',
        });
        if (!ok) return;
        const originalText = deleteButton.textContent;
        try {
          deleteButton.disabled = true;
          deleteButton.textContent = 'Removendo...';
          const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/graphics/${encodeURIComponent(graphicId)}`, { method: 'DELETE' });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt || `HTTP ${res.status}`);
          }
          await init();
        } catch (err) {
          console.error(err);
          alert('Nao foi possivel remover a grafica.');
        } finally {
          deleteButton.disabled = false;
          deleteButton.textContent = originalText;
        }
      }
    });
  }

  if (tblDrivers) {
    tblDrivers.addEventListener('click', async event => {
      const nameButton = event.target.closest('.driver-name');
      if (nameButton) {
        const driverId = nameButton.dataset.driverId;
        if (driverId) openDriverDetail(driverId);
        return;
      }

      const deleteButton = event.target.closest('.driver-action-delete');
      if (deleteButton) {
        const driverId = deleteButton.dataset.driverId;
        if (!driverId) return;
        const ok = await confirmDialog('Deseja excluir este motorista?', {
          title: 'Excluir motorista',
          confirmLabel: 'Excluir',
          cancelLabel: 'Cancelar',
          tone: 'danger',
        });
        if (!ok) return;

        const original = deleteButton.textContent;
        try {
          deleteButton.disabled = true;
          deleteButton.textContent = 'Excluindo...';
          const res = await authFetch(
            `/api/campaigns/${encodeURIComponent(campaignId)}/drivers/${encodeURIComponent(driverId)}`,
            { method: 'DELETE' },
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status}`);
          }
          await init();
        } catch (err) {
          console.error(err);
          alert('Nao foi possivel excluir o motorista.');
        } finally {
          if (document.body.contains(deleteButton)) {
            deleteButton.disabled = false;
            deleteButton.textContent = original;
          }
        }
      }
    });
  }

  // KM table click handling (open edit modal)
  const tblKm = document.getElementById('tblKm');
  if (tblKm) {
    tblKm.addEventListener('click', event => {
      const nameButton = event.target.closest('.km-name');
      if (nameButton) {
        const driverId = nameButton.dataset.driverId;
        if (driverId) openKmEdit(driverId);
      }
    });
  }

  if (btnImportKm) {
    btnImportKm.addEventListener('click', openImportKmModal);
  }

  if (importKmForm) {
    importKmForm.addEventListener('submit', submitImportKmForm);
  }

  const btnSyncKm = document.getElementById('btnSyncKm');
  if (btnSyncKm) {
    btnSyncKm.addEventListener('click', async () => {
      if (!currentCampaign?.kmSheetId && !currentCampaign?.sheetId) {
        alert('Campanha nao possui planilha vinculada para sincronizacao de KM. Primeiro importe a planilha de KM.');
        return;
      }
      const spreadsheetId = currentCampaign.kmSheetId || currentCampaign.sheetId;
      const sheetName = currentCampaign.kmSheetName || currentCampaign.sheetName || 'Planilha1';
      try {
        btnSyncKm.disabled = true;
        btnSyncKm.textContent = 'Sincronizando KM...';
        const res = await authFetch('/api/imports/km', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spreadsheetId, sheetName, campaignId }),
        });
        if (!res.ok) {
          let body;
          try { body = await res.json(); } catch (e) { body = await res.text(); }
          const msg = body && typeof body === 'object' ? `${body.error || ''}\n${body.detail || ''}\n${body.hint || ''}` : String(body || 'Erro');
          throw new Error(msg);
        }
        const result = await res.json();
        alert(`Sincronizacao de KM concluida. Vinculados: ${result.linked} | Revisar: ${result.review}`);
        await init();
      } catch (err) {
        console.error(err);
        alert(String(err.message || err));
      } finally {
        btnSyncKm.disabled = false;
        btnSyncKm.textContent = 'Sincronizar KM';
      }
    });
  }

  const reviewTable = document.getElementById('tblReview');
  if (reviewTable) {
    reviewTable.addEventListener('click', async event => {
      const actionBtn = event.target.closest('[data-review-action]');
      if (!actionBtn) return;
      const reviewId = actionBtn.dataset.reviewId;
      const action = actionBtn.dataset.reviewAction;
      if (!reviewId || !action) return;
      const row = actionBtn.closest('tr');
      if (!row) return;

      if (action === 'apply-status') {
        const select = row.querySelector('.review-status-select');
        if (!select) return;
        const newStatus = select.value;
        if (!newStatus) {
          alert('Selecione um status valido.');
          return;
        }
        const ignoreBtn = row.querySelector('[data-review-action="ignore"]');
        const originalText = actionBtn.textContent;
        actionBtn.disabled = true;
        actionBtn.textContent = 'Aplicando...';
        if (ignoreBtn) ignoreBtn.disabled = true;
        try {
          const res = await authFetch(
            `/api/campaigns/${encodeURIComponent(campaignId)}/review/${encodeURIComponent(reviewId)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            },
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status}`);
          }
          await init();
        } catch (err) {
          console.error(err);
          alert('Nao foi possivel aplicar o status.');
          actionBtn.disabled = false;
          actionBtn.textContent = originalText;
          if (ignoreBtn) ignoreBtn.disabled = false;
          return;
        }
        return;
      }

      if (action === 'ignore') {
        const ok = await confirmDialog('Deseja ignorar este item?', {
          title: 'Ignorar item',
          confirmLabel: 'Ignorar',
          cancelLabel: 'Cancelar',
          tone: 'danger',
        });
        if (!ok) return;
        actionBtn.disabled = true;
        try {
          const res = await authFetch(
            `/api/campaigns/${encodeURIComponent(campaignId)}/review/${encodeURIComponent(reviewId)}`,
            { method: 'DELETE' },
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status}`);
          }
          await init();
        } catch (err) {
          console.error(err);
          alert('Nao foi possivel ignorar o item.');
          actionBtn.disabled = false;
        }
      }
    });
  }
  if (btnSaveKm) {
    btnSaveKm.addEventListener('click', saveKmChanges);
    updateSaveKmButtonState();
  }

  if (btnAddDriver) {
    btnAddDriver.addEventListener('click', () => {
      if (driverForm) driverForm.reset();
      renderDriverFormFields();

      // If a development preset is enabled, prefill some fields to speed testing
      try {
        if (DEV_DRIVER_PRESET && DEV_DRIVER_PRESET.enabled) {
          // Wait a tick so renderDriverFormFields has created inputs
          setTimeout(() => {
            const inputs = driverFormFields ? Array.from(driverFormFields.querySelectorAll('[data-column]')) : [];
            for (const input of inputs) {
              const col = String(input.dataset.column || '').toLowerCase();
              // Place phone into the Nome field if requested
              if (DEV_DRIVER_PRESET.injectPhoneIntoName && col === 'nome') {
                input.value = DEV_DRIVER_PRESET.phone || '';
                input.dataset.originalValue = input.value;
              }
              // Populate any phone/celular/telefone field if present
              if (/(telefone|celular|phone|mobile)/i.test(col)) {
                input.value = DEV_DRIVER_PRESET.phone || '';
                input.dataset.originalValue = input.value;
              }
              // Also populate a full name field if present (so DB stores the real name if needed)
              if (col === 'nome completo' || col === 'nome_completo' || (col === 'nome' && !DEV_DRIVER_PRESET.injectPhoneIntoName)) {
                input.value = DEV_DRIVER_PRESET.fullName || '';
                input.dataset.originalValue = input.value;
              }
            }
          }, 10);
        }
      } catch (err) {
        console.error('DEV preset applied failed', err);
      }

      showModal(driverFormModal);
    });
  }

  if (driverForm) {
    driverForm.addEventListener('submit', async event => {
      event.preventDefault();
      const inputs = driverFormFields
        ? Array.from(driverFormFields.querySelectorAll('[data-column]'))
        : [];
      const fields = {};
      let hasName = false;

      inputs.forEach(input => {
        const column = input.dataset.column;
        if (!column) return;
        const value = input.value.trim();
        if (!hasName && column.toLowerCase() === 'nome' && value) hasName = true;
        if (value) fields[column] = value;
      });

      if (!hasName) {
        alert('Informe o campo Nome.');
        return;
      }

      const originalText = driverFormSubmit ? driverFormSubmit.textContent : '';
      if (driverFormSubmit) {
        driverFormSubmit.disabled = true;
        driverFormSubmit.textContent = 'Salvando...';
      }

      try {
        const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/drivers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        hideModal(driverFormModal);
        if (driverForm) driverForm.reset();
        await init();
        alert('Motorista adicionado com sucesso.');
      } catch (err) {
        console.error(err);
        alert('Nao foi possivel adicionar o motorista.');
      } finally {
        if (driverFormSubmit) {
          driverFormSubmit.disabled = false;
          driverFormSubmit.textContent = originalText || 'Salvar';
        }
      }

      // Create KM manual flow
      const createKmModal = document.getElementById('createKmModal');
      const createKmForm = document.getElementById('createKmForm');
      const createKmDriver = document.getElementById('createKmDriver');
      const createKmNote = document.getElementById('createKmNote');
      const btnSyncKm = document.getElementById('btnSyncKm');

      if (btnCreateKm && createKmModal) {
        btnCreateKm.addEventListener('click', () => {
          // populate driver select with drivers that belong to this campaign
          if (createKmDriver) {
            createKmDriver.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '-- selecione --';
            createKmDriver.appendChild(placeholder);
            if (Array.isArray(currentCampaign?.drivers)) {
              const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', ignorePunctuation: true });
              const sorted = [...currentCampaign.drivers].sort((a,b) => collator.compare(a.name||'', b.name||''));
              for (const d of sorted) {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.name || d.raw?.Nome || d.raw?.nome || d.id;
                createKmDriver.appendChild(opt);
              }
            }
          }
          if (createKmNote) createKmNote.value = '';
          console.debug('Opening create KM modal');
          showModal(createKmModal);
        });
      }

      if (createKmForm) {
        createKmForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const driverId = createKmDriver ? createKmDriver.value : null;
          if (!driverId) return alert('Selecione um motorista.');
          const note = createKmNote ? createKmNote.value.trim() : '';

          try {
            const payload = { fields: {} };
            if (note) payload.fields['COMENTÁRIOS'] = note;

            console.debug('Creating manual KM for driver', driverId, payload);

            const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/km/${encodeURIComponent(driverId)}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });

            if (!res.ok) {
              let body;
              try { body = await res.json(); } catch (e) { body = await res.text(); }
              console.error('Create KM failed', res.status, body);
              const msg = body && typeof body === 'object' ? `${body.error || ''}\n${body.detail || ''}\n${body.hint || ''}` : String(body || `HTTP ${res.status}`);
              return alert('Falha ao criar KM manual:\n' + msg);
            }

            hideModal(createKmModal);
            await init();
            // open km edit modal for the driver so user can fill remaining fields
            openKmEdit(driverId);
            alert('KM criado (local) com sucesso. Preencha os campos na modal.');
          } catch (err) {
            console.error('Create KM error', err);
            alert('Nao foi possivel criar KM manual. Veja o console para detalhes.');
          }
        });
      } else {
        console.debug('createKmForm not found in DOM');
      }
    });
  }

  if (driverDetailForm) {
    driverDetailForm.addEventListener('submit', async event => {
      event.preventDefault();
      const driverId = driverDetailForm.dataset.driverId;
      const driver = getDriverById(driverId);
      if (!driver) {
        alert('Motorista nao encontrado.');
        return;
      }

      const inputs = driverDetailFields
        ? Array.from(driverDetailFields.querySelectorAll('[data-column]'))
        : [];
      const fields = {};
      inputs.forEach(input => {
        const column = input.dataset.column;
        if (!column) return;
        const value = input.value.trim();
        const original = driver.raw?.[column] ?? '';
        if (value !== original) fields[column] = value;
      });

      if (!Object.keys(fields).length) {
        alert('Nenhuma alteração realizada.');
        return;
      }

      const originalLabel = driverDetailSubmit ? driverDetailSubmit.textContent : '';
      if (driverDetailSubmit) {
        driverDetailSubmit.disabled = true;
        driverDetailSubmit.textContent = 'Salvando...';
      }

      try {
        const res = await authFetch(
          `/api/campaigns/${encodeURIComponent(campaignId)}/drivers/${encodeURIComponent(driverId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        pendingDriverChanges.delete(driverId);
        markDriverRowDirty(driverId, false);
        hideModal(driverDetailModal);
        await init();
        alert('Motorista atualizado com sucesso.');
      } catch (err) {
        console.error(err);
        alert('Nao foi possivel atualizar o motorista.');
      } finally {
        if (driverDetailSubmit) {
          driverDetailSubmit.disabled = false;
          driverDetailSubmit.textContent = originalLabel || 'Salvar';
        }
      }
    });
  }

  // KM Edit form submit
  const kmEditForm = document.getElementById('kmEditForm');
  const kmEditSubmit = document.getElementById('kmEditSubmit');
  if (kmEditForm) {
    kmEditForm.addEventListener('submit', async event => {
      event.preventDefault();
      const driverId = kmEditForm.dataset.driverId;
      if (!driverId) return alert('Motorista nao identificado.');

      const inputs = Array.from(kmEditForm.querySelectorAll('[data-column]'));
      const fields = {};
      inputs.forEach(input => {
        const col = input.dataset.column;
        if (!col) return;
        const value = input.value.trim();
        const original = input.dataset.originalValue ?? '';
        if (value !== original) fields[col] = value;
      });

      if (!Object.keys(fields).length) {
        alert('Nenhuma alteração realizada.');
        return;
      }

      const originalLabel = kmEditSubmit ? kmEditSubmit.textContent : '';
      if (kmEditSubmit) {
        kmEditSubmit.disabled = true;
        kmEditSubmit.textContent = 'Salvando...';
      }

      try {
        const res = await authFetch(
          `/api/campaigns/${encodeURIComponent(campaignId)}/km/${encodeURIComponent(driverId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        hideModal(document.getElementById('kmEditModal'));
        await init();
        alert('KM atualizado com sucesso.');
      } catch (err) {
        console.error(err);
        alert('Nao foi possivel salvar o KM.');
      } finally {
        if (kmEditSubmit) {
          kmEditSubmit.disabled = false;
          kmEditSubmit.textContent = originalLabel || 'Salvar KM';
        }
      }
    });
  }

  if (campaignStatusSelect) {
    campaignStatusSelect.addEventListener('change', async () => {
      const selected = campaignStatusSelect.value;
      const original = campaignStatusSelect.dataset.currentValue;
      if (selected === original) return;

      const confirmed = await confirmCampaignStatusChange(selected);
      if (!confirmed) {
        campaignStatusSelect.value = original;
        return;
      }

      campaignStatusSelect.disabled = true;
      try {
        const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: selected }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        campaignStatusSelect.dataset.currentValue = selected;
        if (currentCampaign) currentCampaign.status = selected;
        await init();
        toast('Status da campanha atualizado.', 'success');
      } catch (err) {
        console.error(err);
        toast('Nao foi possivel atualizar o status.', 'error');
        campaignStatusSelect.value = original;
      } finally {
        campaignStatusSelect.disabled = false;
      }
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const ok = await confirmDialog('Tem certeza que deseja excluir esta campanha? Essa acao nao pode ser desfeita.', {
        title: 'Excluir campanha',
        confirmLabel: 'Excluir',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) {
        return;
      }
      const original = btnDelete.textContent;
      try {
        btnDelete.disabled = true;
        btnDelete.textContent = 'Excluindo...';
        const res = await authFetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        alert('Campanha excluida.');
        window.location.href = 'index.html';
      } catch (err) {
        console.error(err);
        alert('Nao foi possivel excluir a campanha.');
        btnDelete.disabled = false;
        btnDelete.textContent = original;
      }
    });
  }

  if (btnSaveCooldown) {
    btnSaveCooldown.addEventListener('click', saveCooldownSettings);
  }

});















