import { Router } from 'express';
import { nanoid } from 'nanoid';
import { STATUS, normalizeStatus, normalizeName } from '../lib/normalize.js';
import { buildDriversFromRows, resolveSheetName } from '../lib/campaignImport.js';
import {
  readSheetByRange,
  readSheetHeader,
  appendSheetRow,
  deleteSheetRow,
  getSheetId,
  updateSheetRow,
  ensureSheetTab,
  setSheetHeader,
  clearSheetData,
  updateSheetRows,
} from '../services/sheets.js';
import { detectKmColumns } from '../lib/kmColumns.js';
import {
  upsertCampaignRecord,
  upsertDriverRecord,
  insertEvidenceRecord,
  deleteEvidenceRecord,
  deleteStorageFile,
  deleteStorageFilesByFolder,
  upsertMasterRecord,
  deleteMastersByCampaign,
  deleteAllCampaignData,
  deleteMasterByDriver,
  ensureDatabaseSchema,
  ensureCampaignMasterTable,
  upsertCampaignMasterRows,
  ensureCampaignGraphicsTable,
  upsertCampaignGraphicsRows,
  deleteGraphicRow,
  getCampaignTableName,
  getCampaignGraphicsTableName,
  listDriverStorageTree,
  listStorageEntriesByCampaign,
} from '../services/db.js';
import buildMasterHeader from '../lib/masterHeader.js';
import { applyCanonicalRaw, buildSheetRowValues, mergeDriverRawSources } from '../lib/driverSheet.js';
import { DRIVER_FLOW, GRAPHIC_FLOW, DRIVER_REQUIRED_STEPS, GRAPHIC_REQUIRED_STEPS } from '../lib/flows.js';
import { authenticateAdmin } from '../middleware/authenticate-admin.js';
import { logAudit } from '../middleware/audit.js';
import { ensureLegacyStoreReady, loadLegacyDb, saveLegacyDb } from '../services/legacyStore.js';

await ensureLegacyStoreReady();

const router = Router();

const CAMPAIGN_STATUS = ['ativa', 'pausada', 'encerrada', 'inativa'];

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
const CAMPAIGN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CAMPAIGN_CODE_LENGTH = 6;
const MAX_KM_PERIODS = 12;
const DEFAULT_KM_PERIODS = 3;
const DRIVER_REQUIRED_STEP_IDS = [...DRIVER_REQUIRED_STEPS];
const GRAPHIC_REQUIRED_STEP_IDS = [...GRAPHIC_REQUIRED_STEPS];

function collectEvidenceByDriver(db, campaignId, storageEntries = []) {
  const map = new Map();
  const entries = Array.isArray(db.evidence) ? db.evidence : [];
  for (const entry of entries) {
    if (!entry || entry.campaignId !== campaignId || !entry.driverId) continue;
    const key = String(entry.driverId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  return mergeStorageEvidence(map, storageEntries, campaignId);
}
function mergeStorageEvidence(map, storageEntries = [], campaignId) {
  if (!Array.isArray(storageEntries)) return map;
  for (const entry of storageEntries) {
    if (!entry || !entry.driverId) {
      if (entry && entry.uploaderType === 'graphic') {
        console.log('[mergeStorageEvidence] Skipping graphic entry without driverId:', {
          id: entry.id,
          graphicId: entry.graphicId,
          step: entry.step,
          uploaderType: entry.uploaderType
        });
      }
      continue;
    }
    const key = String(entry.driverId);
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    const already = list.some(e => (e.source === 'mongo' && e.id === entry.id) || (e.url && e.url === entry.url && e.step === entry.step));
    if (already) continue;
    const item = {
      id: entry.id,
      type: entry.uploaderType === 'graphic' ? 'graphic' : 'driver',
      campaignId,
      driverId: entry.driverId,
      graphicId: entry.graphicId || null,
      step: entry.step || '',
      url: entry.url || '',
      path: entry.path || '',
      createdAt: entry.createdAt || Date.now(),
      source: 'mongo',
    };
    console.log('[mergeStorageEvidence] Adding entry:', {
      id: item.id,
      type: item.type,
      driverId: item.driverId,
      graphicId: item.graphicId,
      step: item.step,
      uploaderType: entry.uploaderType
    });
    list.push(item);
  }
  return map;
}

function normalizeStepId(step) {
  return typeof step === 'string' ? step.trim() : '';
}

function buildFlowStatus(entries = [], requiredSteps = [], reviewState = {}) {
  let lastUploadAt = null;

  for (const entry of entries) {
    const ts = Number(entry?.createdAt || entry?.uploadedAt);
    if (Number.isFinite(ts)) lastUploadAt = lastUploadAt ? Math.max(lastUploadAt, ts) : ts;
  }

  const hasUploads = Array.isArray(entries) && entries.length > 0;
  const completed = hasUploads;

  return {
    hasUploads,
    totalUploads: Array.isArray(entries) ? entries.length : 0,
    lastUploadAt: hasUploads ? (lastUploadAt || null) : null,
    completed,
    completedAt: completed ? (lastUploadAt || null) : null,
    pendingSteps: completed ? [] : requiredSteps,
    verifiedAt: reviewState?.verifiedAt || null,
    verifiedBy: reviewState?.verifiedBy || null,
    verifiedByName: reviewState?.verifiedByName || null,
    cooldownUntil: reviewState?.cooldownUntil || null,
  };
}

function computeCooldownUntil(campaign, targetKey) {
  const baseDays = targetKey === 'graphicFlow'
    ? (campaign.graphicCooldownDays ?? 10)
    : (campaign.driverCooldownDays ?? 10);
  const ms = Number(baseDays) * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Date.now() + ms;
}

function buildDriverEvidenceStatus(driver, driverEvidence = []) {
  const driverEntries = driverEvidence.filter(entry => entry?.type === 'driver');
  const graphicEntries = driverEvidence.filter(entry => entry?.type === 'graphic');
  const review = driver?.evidenceReview || {};
  return {
    driverFlow: buildFlowStatus(driverEntries, DRIVER_REQUIRED_STEP_IDS, review.driverFlow),
    graphicFlow: buildFlowStatus(graphicEntries, GRAPHIC_REQUIRED_STEP_IDS, review.graphicFlow),
  };
}

function cloneDriverForPayload(driver, evidenceEntries = []) {
  return {
    ...driver,
    evidenceStatus: buildDriverEvidenceStatus(driver, evidenceEntries),
  };
}

function ensureEvidenceReviewTarget(driver, targetKey) {
  if (!driver.evidenceReview || typeof driver.evidenceReview !== 'object') {
    driver.evidenceReview = {};
  }
  if (!driver.evidenceReview[targetKey] || typeof driver.evidenceReview[targetKey] !== 'object') {
    driver.evidenceReview[targetKey] = { verifiedAt: null, verifiedBy: null, verifiedByName: null };
  }
  return driver.evidenceReview[targetKey];
}

function loadDB() {
  return loadLegacyDb();
}

function saveDB(db) {
  saveLegacyDb(db);
}

function trim(value) {
  return String(value ?? '').trim();
}

function digitsOnly(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function generateCampaignCode(db) {
  const used = new Set(
    (db.campaigns || [])
      .map(c => trim(c.campaignCode).toUpperCase())
      .filter(Boolean),
  );

  let attempt = 0;
  while (attempt < 1000) {
    const code = Array.from({ length: CAMPAIGN_CODE_LENGTH }, () => {
      const index = Math.floor(Math.random() * CAMPAIGN_CODE_ALPHABET.length);
      return CAMPAIGN_CODE_ALPHABET[index];
    }).join('');
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
    attempt += 1;
  }

  let fallback = `C${Date.now().toString(36).toUpperCase()}`.replace(/[^A-Z0-9]/g, '');
  if (fallback.length < CAMPAIGN_CODE_LENGTH) {
    fallback = fallback.padEnd(CAMPAIGN_CODE_LENGTH, 'X');
  } else if (fallback.length > CAMPAIGN_CODE_LENGTH) {
    fallback = fallback.slice(0, CAMPAIGN_CODE_LENGTH);
  }
  while (used.has(fallback)) {
    fallback = `${fallback.slice(0, CAMPAIGN_CODE_LENGTH - 1)}${Math.floor(Math.random() * 10)}`;
  }
  used.add(fallback);
  return fallback;
}

function ensureCampaignCode(db, campaign) {
  if (!campaign) return '';
  const current = trim(campaign.campaignCode).toUpperCase();
  if (current) {
    campaign.campaignCode = current;
    return current;
  }
  const code = generateCampaignCode(db);
  campaign.campaignCode = code;
  return code;
}

function summarizeCampaign(db, campaign) {
  ensureCampaignCode(db, campaign);
  if (typeof campaign.driverCooldownDays !== 'number') campaign.driverCooldownDays = 10;
  if (typeof campaign.graphicCooldownDays !== 'number') campaign.graphicCooldownDays = 10;
  const drivers = db.drivers.filter(d => d.campaignId === campaign.id);
  const graphics = (db.graphics || []).filter(g => g.campaignId === campaign.id);
  const reviewItems = db.review.filter(r => r.campaignId === campaign.id);

  const counts = drivers.reduce((acc, driver) => {
    const key = driver.status || 'revisar';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  for (const status of STATUS) {
    if (!counts[status]) counts[status] = 0;
  }

  return {
    ...campaign,
    counts,
    driverCount: drivers.length,
    graphicCount: graphics.length,
    reviewCount: reviewItems.length,
    updatedAt: campaign.updatedAt || campaign.createdAt || Date.now(),
    sheetHeader: Array.isArray(campaign.sheetHeader) ? [...campaign.sheetHeader] : [],
    sheetGid: campaign.sheetGid ?? null,
    driverCooldownDays: campaign.driverCooldownDays ?? 10,
    graphicCooldownDays: campaign.graphicCooldownDays ?? 10,
  };
}

function ensureSheetConfig(campaign) {
  if (!campaign.sheetId) {
    throw Object.assign(new Error('Campanha não possui sheetId configurado'), { status: 400 });
  }
  const sheetName = resolveSheetName(campaign.sheetName, 'Pagina1');
  campaign.sheetName = sheetName;
  return { sheetId: campaign.sheetId, sheetName };
}

function extractRowNumber(range) {
  if (!range) return 0;
  const [, segment = ''] = range.split('!');
  const match = segment.match(/([0-9]+)(?::[A-Z]*([0-9]+))?$/i);
  if (!match) return 0;
  const [, start, end] = match;
  return parseInt(end || start, 10);
}

function respondNotFound(res, message) {
  return res.status(404).json({ error: message });
}

function parseKmPeriods(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > MAX_KM_PERIODS) return null;
  return rounded;
}

function buildAppendValues(header, fieldsInput) {
  const normalized = {};
  Object.entries(fieldsInput || {}).forEach(([key, value]) => {
    normalized[key] = value;
    const lower = key.toLowerCase();
    if (!(lower in normalized)) normalized[lower] = value;
    const compact = lower.replace(/\s+/g, '');
    if (!(compact in normalized)) normalized[compact] = value;
  });

  return header.map(col => {
    const direct = normalized[col];
    if (direct !== undefined) return direct;
    const lower = col.toLowerCase();
    if (normalized[lower] !== undefined) return normalized[lower];
    const compact = lower.replace(/\s+/g, '');
    if (normalized[compact] !== undefined) return normalized[compact];
    return '';
  });
}
async function getEvidenceEntries(db, campaign, filter = {}) {
  let storageEntries = [];
  try {
    storageEntries = await listStorageEntriesByCampaign(campaign.id);
  } catch (err) {
    console.warn('[campaigns] storage entries listing error', err?.message || err);
  }
  const evidenceMap = collectEvidenceByDriver(db, campaign.id, storageEntries);

  const drivers = db.drivers || [];
  const graphics = db.graphics || [];
  
  // Get all valid storage file IDs to check for orphaned evidence
  const validStorageIds = new Set(storageEntries.map(e => e.id));

  const list = [];
  evidenceMap.forEach(entries => {
    for (const item of entries) {
      if (filter.driverId !== undefined && String(item.driverId) !== String(filter.driverId)) continue;
      if (filter.graphicId !== undefined && String(item.graphicId || '') !== String(filter.graphicId)) continue;
      
      // EXPLICIT TYPE FILTERING: When filtering by driverId, only show driver uploads
      // When filtering by graphicId, only show graphic uploads
      if (filter.driverId !== undefined && item.type !== 'driver') continue;
      if (filter.graphicId !== undefined && item.type !== 'graphic') continue;
      
      // Skip evidence that references deleted storage files (orphaned URLs)
      if (item.url && item.url.startsWith('/api/storage/')) {
        const storageId = item.url.split('/').pop();
        if (!validStorageIds.has(storageId)) {
          console.log('[campaigns] Skipping orphaned evidence:', { id: item.id, url: item.url });
          continue; // Skip this orphaned evidence
        }
      }
      
      const entry = { ...item };
      const driver = drivers.find(d => d.id === entry.driverId);
      if (driver) entry.driver = { id: driver.id, name: driver.name };
      const graphic = graphics.find(g => g.id === entry.graphicId);
      if (graphic) entry.graphic = { id: graphic.id, name: graphic.name };
      list.push(entry);
    }
  });
  return list;
}

// Protege todas as rotas com autenticação admin
router.use(authenticateAdmin);

router.use((req, res, next) => {
  if (process.env.DEBUG_ROUTES === '1') {
    console.log(`[campaigns] ${req.method} ${req.originalUrl}`);
  }
  next();
});

router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.campaigns.map(c => summarizeCampaign(db, c)));
});

router.get('/:id', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');
  const payload = summarizeCampaign(db, campaign);
  let storageEntries = [];
  try {
    storageEntries = await listStorageEntriesByCampaign(campaign.id);
  } catch (err) {
    console.warn('[campaigns] storage entries listing error', err?.message || err);
  }
  const evidenceByDriver = collectEvidenceByDriver(db, campaign.id, storageEntries);
  payload.drivers = db.drivers
    .filter(d => d.campaignId === campaign.id)
    .map(driver => cloneDriverForPayload(driver, evidenceByDriver.get(String(driver.id)) || []));
  payload.review = db.review.filter(r => r.campaignId === campaign.id);
  payload.graphics = (db.graphics || []).filter(g => g.campaignId === campaign.id);
  res.json(payload);
});

router.get('/:id/graphics', (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');
  res.json((db.graphics || []).filter(g => g.campaignId === campaign.id));
});

router.post('/:id/graphics', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const {
    name,
    email = '',
    phone = '',
    responsible1Name = '',
    responsible1Phone = '',
    responsible2Name = '',
    responsible2Phone = '',
    notes = '',
  } = req.body || {};

  if (!trim(name)) {
    return res.status(400).json({ error: 'Nome da Gráfica obrigatorio' });
  }
  if (!trim(responsible1Name)) {
    return res.status(400).json({ error: 'Nome do responsavel 1 obrigatorio' });
  }

  const now = Date.now();
  const graphic = {
    id: nanoid(),
    campaignId: campaign.id,
    name: trim(name),
    email: trim(email),
    phone: trim(phone),
    phoneDigits: digitsOnly(phone),
    responsible1Name: trim(responsible1Name),
    responsible1Phone: trim(responsible1Phone),
    responsible1PhoneDigits: digitsOnly(responsible1Phone),
    responsible2Name: trim(responsible2Name),
    responsible2Phone: trim(responsible2Phone),
    responsible2PhoneDigits: digitsOnly(responsible2Phone),
    notes: trim(notes),
    createdAt: now,
    updatedAt: now,
  };

  db.graphics = Array.isArray(db.graphics) ? db.graphics : [];
  db.graphics.push(graphic);
  campaign.updatedAt = now;
  saveDB(db);

  try {
    await ensureCampaignGraphicsTable(campaign);
    await upsertCampaignGraphicsRows(campaign, [graphic]);
  } catch (err) {
    console.warn('[campaigns] db grafica create', err?.message || err);
  }

  res.status(201).json({ graphic });
});

router.patch('/:id/graphics/:graphicId', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  db.graphics = Array.isArray(db.graphics) ? db.graphics : [];
  const graphic = db.graphics.find(g => g.id === req.params.graphicId && g.campaignId === campaign.id);
  if (!graphic) return respondNotFound(res, 'Gráfica não encontrada');

  const {
    name,
    email,
    phone,
    responsible1Name,
    responsible1Phone,
    responsible2Name,
    responsible2Phone,
    notes,
  } = req.body || {};

  if (name !== undefined && !trim(name)) {
    return res.status(400).json({ error: 'Nome da Gráfica não pode ser vazio' });
  }
  if (responsible1Name !== undefined && !trim(responsible1Name)) {
    return res.status(400).json({ error: 'Nome do responsavel 1 não pode ser vazio' });
  }

  if (name !== undefined) graphic.name = trim(name);
  if (email !== undefined) graphic.email = trim(email);
  if (phone !== undefined) {
    graphic.phone = trim(phone);
    graphic.phoneDigits = digitsOnly(phone);
  }
  if (responsible1Name !== undefined) graphic.responsible1Name = trim(responsible1Name);
  if (responsible1Phone !== undefined) {
    graphic.responsible1Phone = trim(responsible1Phone);
    graphic.responsible1PhoneDigits = digitsOnly(responsible1Phone);
  }
  if (responsible2Name !== undefined) graphic.responsible2Name = trim(responsible2Name);
  if (responsible2Phone !== undefined) {
    graphic.responsible2Phone = trim(responsible2Phone);
    graphic.responsible2PhoneDigits = digitsOnly(responsible2Phone);
  }
  if (notes !== undefined) graphic.notes = trim(notes);

  graphic.updatedAt = Date.now();
  campaign.updatedAt = graphic.updatedAt;
  saveDB(db);

  try {
    await ensureCampaignGraphicsTable(campaign);
    await upsertCampaignGraphicsRows(campaign, [graphic]);
  } catch (err) {
    console.warn('[campaigns] db grafica update', err?.message || err);
  }

  res.json({ graphic });
});

router.delete('/:id/graphics/:graphicId', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  db.graphics = Array.isArray(db.graphics) ? db.graphics : [];
  const index = db.graphics.findIndex(g => g.id === req.params.graphicId && g.campaignId === campaign.id);
  if (index === -1) return respondNotFound(res, 'Gráfica não encontrada');

  const [graphic] = db.graphics.splice(index, 1);
  campaign.updatedAt = Date.now();
  saveDB(db);

  try {
    await deleteGraphicRow(campaign, graphic.id);
  } catch (err) {
    console.warn('[campaigns] db grafica delete', err?.message || err);
  }

  res.status(204).end();
});

router.post('/', async (req, res) => {
  const { name, client, period } = req.body || {};
  const trimmedName = trim(name);
  if (!trimmedName) {
    return res.status(400).json({ error: 'Nome obrigatorio' });
  }

  const db = loadDB();
  const now = Date.now();
  const campaign = {
    id: nanoid(),
    name: trimmedName,
    client: client || '',
    period: period || '',
    status: 'ativa',
    sheetId: null,
    sheetName: null,
    driverCooldownDays: 10,
    graphicCooldownDays: 10,
    sheetHeader: [
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
    ],
    driveFolderId: null,
    campaignCode: generateCampaignCode(db),
    createdAt: now,
    updatedAt: now,
  };

  db.campaigns.push(campaign);
  saveDB(db);

  try {
    await upsertCampaignRecord(campaign);
  } catch (err) {
    console.warn('[campaigns] db upsert campaign', err?.message || err);
  }

  await logAudit(req, 'campaign:create', {
    entityType: 'campaign',
    entityId: campaign.id,
    data: { campaignName: campaign.name, client: campaign.client, period: campaign.period },
  });

  res.status(201).json({ id: campaign.id, campaignCode: campaign.campaignCode });
});

router.post('/:id/sync', async (req, res) => {
  const { sheetId: overrideSheetId, sheetName, name, client, period } = req.body || {};
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const sheetId = trim(overrideSheetId || campaign.sheetId || '');
  if (!sheetId) {
    return res.status(400).json({ error: 'Campanha não possui sheetId configurado' });
  }

  try {
    const resolvedSheetName = resolveSheetName(sheetName || campaign.sheetName || 'Pagina1', 'Pagina1');

    const rows = await readSheetByRange(sheetId, `${resolvedSheetName}!A:Z`);
    const header = await readSheetHeader(sheetId, resolvedSheetName);
    const sheetGid = await getSheetId(sheetId, resolvedSheetName);
    const now = Date.now();

    const previousDrivers = db.drivers.filter(d => d.campaignId === campaign.id);
    const { drivers, counts, imported, reviewEntries } = buildDriversFromRows(rows, {
      campaignId: campaign.id,
      now,
      previousDrivers,
    });

    db.drivers = db.drivers.filter(d => d.campaignId !== campaign.id);
    db.drivers.push(...drivers);

    db.review = db.review.filter(r => !(r.campaignId === campaign.id && r.type === 'STATUS_INVALIDO'));
    for (const entry of reviewEntries) {
      db.review.push(entry);
    }

    campaign.sheetId = sheetId;
    campaign.sheetName = resolvedSheetName;
    campaign.sheetHeader = header;
    campaign.sheetGid = sheetGid;
    if (typeof name === 'string' && trim(name)) campaign.name = trim(name);
    if (typeof client === 'string') campaign.client = client;
    if (typeof period === 'string') campaign.period = period;
    campaign.updatedAt = now;
    ensureCampaignCode(db, campaign);

    if (Array.isArray(campaign.kmSheetHeader) && campaign.kmSheetHeader.length) {
      try {
        const mapping = detectKmColumns(campaign.kmSheetHeader);
        campaign.kmColumns = mapping;
        if (mapping?.periodCount) {
          const parsed = parseKmPeriods(mapping.periodCount);
          if (parsed) campaign.kmPeriods = parsed;
        }
      } catch (err) {
        console.warn('[campaigns] detectKmColumns', err?.message || err);
      }
    }

    saveDB(db);

    res.json({
      campaign: summarizeCampaign(db, campaign),
      imported,
      review: reviewEntries.length,
      counts,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Falha ao sincronizar campanha' });
  }
});

router.delete('/:id', async (req, res) => {
  const db = loadDB();
  const index = db.campaigns.findIndex(c => c.id === req.params.id);
  if (index === -1) return respondNotFound(res, 'Campanha não encontrada');
  const [campaign] = db.campaigns.splice(index, 1);

  db.drivers = db.drivers.filter(d => d.campaignId !== campaign.id);
  db.review = db.review.filter(r => r.campaignId !== campaign.id);
  db.graphics = (db.graphics || []).filter(g => g.campaignId !== campaign.id);
  db.evidence = (db.evidence || []).filter(e => e.campaignId !== campaign.id);

  saveDB(db);

  await logAudit(req, 'campaign:delete', {
    entityType: 'campaign',
    entityId: campaign.id,
    data: { campaignName: campaign.name },
  });

  try {
    await deleteMastersByCampaign(campaign);
  } catch (err) {
    console.warn('[campaigns] db delete masters', err?.message || err);
  }

  try {
    await deleteAllCampaignData(campaign.id);
  } catch (err) {
    console.warn('[campaigns] MongoDB delete all campaign data', err?.message || err);
  }

  res.status(204).end();
});
router.post('/:id/drivers', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  let sheetId = null;
  let sheetName = null;
  let kmSheetId;
  let kmSheetName;
  let appendedRowNumber;
  let appendedKmRowNumber;

  try {
    const fieldsInput = req.body?.fields && typeof req.body.fields === 'object'
      ? req.body.fields
      : req.body;
    if (!fieldsInput || typeof fieldsInput !== 'object') {
      return res.status(400).json({ error: 'Payload invalido' });
    }

    const now = Date.now();
    const nameValue = trim(
      fieldsInput.Nome ??
        fieldsInput.nome ??
        fieldsInput.name ??
        '',
    );
    if (!nameValue) {
      throw Object.assign(new Error('Campo Nome obrigatorio'), { status: 400 });
    }

    const trimmedSheetId = trim(campaign.sheetId || '');
    const hasSheetConfig = Boolean(trimmedSheetId);

    let header = [];
    if (hasSheetConfig) {
      ({ sheetId, sheetName } = ensureSheetConfig(campaign));
      header = Array.isArray(campaign.sheetHeader) && campaign.sheetHeader.length
        ? campaign.sheetHeader
        : null;
      if (!header) {
        header = await readSheetHeader(sheetId, sheetName);
        campaign.sheetHeader = header;
        campaign.sheetGid = campaign.sheetGid ?? (await getSheetId(sheetId, sheetName));
      }
    } else {
      header =
        (Array.isArray(campaign.sheetHeader) && campaign.sheetHeader.length
          ? campaign.sheetHeader
          : null) ||
        Object.keys(fieldsInput || {}).filter(Boolean);
      if (!header.length) header = [...DEFAULT_DRIVER_COLUMNS];
      campaign.sheetHeader = header;
    }

    const values = buildAppendValues(header, fieldsInput);

    if (hasSheetConfig) {
      const updates = await appendSheetRow(sheetId, sheetName, values);
      appendedRowNumber = extractRowNumber(updates?.updatedRange) || undefined;
    }

    const raw = Object.fromEntries(header.map((col, idx) => [col, values[idx] ?? '']));

    const driver = {
      id: nanoid(),
      campaignId: campaign.id,
      name: nameValue,
      nameKey: normalizeName(nameValue),
      city:
        fieldsInput.Cidade ??
        fieldsInput.cidade ??
        fieldsInput.City ??
        fieldsInput.city ??
        raw.Cidade ??
        '',
      pix:
        fieldsInput.PIX ??
        fieldsInput.Pix ??
        fieldsInput.pix ??
        raw.PIX ??
        '',
      statusRaw:
        fieldsInput.Status ??
        fieldsInput.status ??
        fieldsInput.STATUS ??
        raw.Status ??
        '',
      status: normalizeStatus(
        fieldsInput.Status ??
          fieldsInput.status ??
          fieldsInput.STATUS ??
          raw.Status ??
          '',
      ),
      rowNumber: appendedRowNumber,
      raw,
      createdAt: now,
      updatedAt: now,
      _origin: 'ADMIN',
    };

    applyCanonicalRaw(driver);

    if (hasSheetConfig && driver.rowNumber) {
      const rowValues = buildSheetRowValues(header, driver);
      await updateSheetRow(sheetId, sheetName, driver.rowNumber, rowValues);
    }

    if (
      campaign.kmSheetId &&
      campaign.kmSheetName &&
      Array.isArray(campaign.kmSheetHeader) &&
      campaign.kmSheetHeader.length
    ) {
      kmSheetId = campaign.kmSheetId;
      kmSheetName = campaign.kmSheetName;
      const kmHeader = campaign.kmSheetHeader;
      let kmValues = [];
      if (campaign.kmColumns && typeof campaign.kmColumns === 'object') {
        kmValues = new Array(kmHeader.length).fill('');
        const { nameColumn, driverIdColumn } = campaign.kmColumns;
        if (nameColumn?.index >= 0 && nameColumn.index < kmHeader.length) {
          kmValues[nameColumn.index] = driver.name;
        }
        if (driverIdColumn?.index >= 0 && driverIdColumn.index < kmHeader.length) {
          kmValues[driverIdColumn.index] = driver.id;
        }
      } else {
        kmValues = kmHeader.map(col => {
          const upper = String(col || '').toUpperCase();
          if (upper.includes('NOME') || upper.includes('NAME')) return driver.name;
          if (upper.includes('DRIVER') || upper.includes('MOTORISTA') || upper.includes('ID')) return driver.id;
          return '';
        });
      }

      const kmUpdates = await appendSheetRow(kmSheetId, kmSheetName, kmValues);
      appendedKmRowNumber = extractRowNumber(kmUpdates?.updatedRange) || undefined;

      driver.km = driver.km || {};
      if (appendedKmRowNumber) driver.km.rowNumber = appendedKmRowNumber;
      driver.km.raw = Object.fromEntries(
        kmHeader.map((col, idx) => [col, kmValues[idx] ?? '']),
      );
    }

    db.drivers.push(driver);
    campaign.updatedAt = now;
    saveDB(db);

    try {
      await upsertDriverRecord(driver);
    } catch (err) {
      console.warn('[campaigns] db upsert driver', err?.message || err);
    }
    try {
      await upsertMasterRecord(campaign, driver);
    } catch (err) {
      console.warn('[campaigns] db upsert master', err?.message || err);
    }

    res.status(201).json({
      driver,
      campaign: summarizeCampaign(db, campaign),
    });
  } catch (err) {
    if (sheetId && sheetName && appendedRowNumber) {
      try {
        await deleteSheetRow(sheetId, sheetName, appendedRowNumber);
      } catch (cleanupErr) {
        console.warn('[campaigns] cleanup sheet row failed', cleanupErr?.message || cleanupErr);
      }
    }
    if (kmSheetId && kmSheetName && appendedKmRowNumber) {
      try {
        await deleteSheetRow(kmSheetId, kmSheetName, appendedKmRowNumber);
      } catch (cleanupErr) {
        console.warn('[campaigns] cleanup km row failed', cleanupErr?.message || cleanupErr);
      }
    }
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Falha ao adicionar motorista' });
  }
});

router.delete('/:id/drivers/:driverId', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const index = db.drivers.findIndex(
    d => d.id === req.params.driverId && d.campaignId === campaign.id,
  );
  if (index === -1) return respondNotFound(res, 'Motorista não encontrado');

  const driver = db.drivers[index];

  try {
    if (driver.rowNumber) {
      const { sheetId, sheetName } = ensureSheetConfig(campaign);
      const info = await deleteSheetRow(sheetId, sheetName, driver.rowNumber);
      campaign.sheetGid = info.sheetId;
    }
    if (
      driver.km?.rowNumber &&
      campaign.kmSheetId &&
      campaign.kmSheetName
    ) {
      await deleteSheetRow(campaign.kmSheetId, campaign.kmSheetName, driver.km.rowNumber);
    }
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Falha ao remover na planilha' });
  }

  db.drivers.splice(index, 1);
  db.review = db.review.filter(r => r.driverId !== driver.id);

  for (const other of db.drivers) {
    if (
      other.campaignId === campaign.id &&
      other.rowNumber &&
      driver.rowNumber &&
      other.rowNumber > driver.rowNumber
    ) {
      other.rowNumber -= 1;
    }
    if (
      driver.km?.rowNumber &&
      other.campaignId === campaign.id &&
      other.km?.rowNumber &&
      other.km.rowNumber > driver.km.rowNumber
    ) {
      other.km.rowNumber -= 1;
    }
  }

  campaign.updatedAt = Date.now();
  saveDB(db);

  try {
    await deleteMasterByDriver(campaign, driver.id);
  } catch (err) {
    console.warn('[campaigns] db delete master driver', err?.message || err);
  }

  res.json({ campaign: summarizeCampaign(db, campaign) });
});

router.patch('/:id', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const payload = req.body || {};
  const driverCooldownRaw = payload.driverCooldownDays ?? payload.driverCooldown;
  const graphicCooldownRaw = payload.graphicCooldownDays ?? payload.graphicCooldown;
  let touched = false;

  if (payload.name && typeof payload.name === 'string') {
    campaign.name = trim(payload.name);
    touched = true;
  }
  if (typeof payload.client === 'string') {
    campaign.client = payload.client;
    touched = true;
  }
  if (typeof payload.period === 'string') {
    campaign.period = payload.period;
    touched = true;
  }
  if (payload.status) {
    const normalized = String(payload.status).toLowerCase();
    if (!CAMPAIGN_STATUS.includes(normalized)) {
      return res.status(400).json({ error: 'Status invalido' });
    }
    campaign.status = normalized;
    touched = true;
  }
  if (payload.kmPeriods !== undefined) {
    const parsed = parseKmPeriods(payload.kmPeriods);
    if (!parsed) {
      return res.status(400).json({ error: 'kmPeriods invalido' });
    }
    campaign.kmPeriods = parsed;
    touched = true;
  }
  if (driverCooldownRaw !== undefined) {
    const days = Number(driverCooldownRaw);
    if (!Number.isFinite(days) || days < 0 || days > 365) {
      return res.status(400).json({ error: 'driverCooldownDays invalido (0-365)' });
    }
    campaign.driverCooldownDays = days;
    touched = true;
  }
  if (graphicCooldownRaw !== undefined) {
    const days = Number(graphicCooldownRaw);
    if (!Number.isFinite(days) || days < 0 || days > 365) {
      return res.status(400).json({ error: 'graphicCooldownDays invalido (0-365)' });
    }
    campaign.graphicCooldownDays = days;
    touched = true;
  }

  if (!touched) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  }

  campaign.updatedAt = Date.now();
  saveDB(db);
  try {
    await upsertCampaignRecord(campaign);
  } catch (err) {
    console.warn('[campaigns] upsert campaign record', err?.message || err);
  }
  res.json({ campaign: summarizeCampaign(db, campaign) });
});

router.patch('/:id/review/:reviewId', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const reviewItem = db.review.find(
    r => r.id === req.params.reviewId && r.campaignId === campaign.id,
  );
  if (!reviewItem) {
    return respondNotFound(res, 'Item de revisao não encontrado');
  }
  if (reviewItem.type !== 'STATUS_INVALIDO') {
    return res.status(400).json({ error: 'Tipo de revisao não suportado' });
  }

  const requestedStatus = trim(req.body?.status);
  if (!requestedStatus) {
    return res.status(400).json({ error: 'Status obrigatorio' });
  }
  const normalizedStatus = normalizeStatus(requestedStatus);
  if (!STATUS.includes(normalizedStatus)) {
    return res.status(400).json({ error: 'Status invalido' });
  }

  const driver = db.drivers.find(
    d => d.id === reviewItem.driverId && d.campaignId === campaign.id,
  );
  if (!driver) return respondNotFound(res, 'Motorista não encontrado');
  if (!driver.rowNumber) {
    return res.status(400).json({ error: 'Motorista sem referencia de linha para atualizacao' });
  }

  try {
    const { sheetId, sheetName } = ensureSheetConfig(campaign);

    let header = Array.isArray(campaign.sheetHeader) && campaign.sheetHeader.length
      ? campaign.sheetHeader
      : null;
    if (!header) {
      header = await readSheetHeader(sheetId, sheetName);
      campaign.sheetHeader = header;
      campaign.sheetGid = campaign.sheetGid ?? (await getSheetId(sheetId, sheetName));
    }

    const columnKey = reviewItem.column || 'Status';
    if (!header.includes(columnKey)) {
      return res.status(400).json({ error: `Coluna ${columnKey} não encontrada na planilha` });
    }

    const raw = mergeDriverRawSources(driver);
    raw[columnKey] = normalizedStatus;
    driver.raw = raw;
    driver.status = normalizedStatus;
    driver.statusRaw = normalizedStatus;
    driver.updatedAt = Date.now();

    applyCanonicalRaw(driver);
    const values = buildSheetRowValues(header, driver);
    await updateSheetRow(sheetId, sheetName, driver.rowNumber, values);

    db.review = db.review.filter(r => r.id !== reviewItem.id);
    campaign.updatedAt = Date.now();
    saveDB(db);

    try {
      await upsertMasterRecord(campaign, driver);
    } catch (err) {
      console.warn('[campaigns] db upsert master review', err?.message || err);
    }

    res.json({
      driver,
      campaign: summarizeCampaign(db, campaign),
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Falha ao aplicar revisao' });
  }
});

router.delete('/:id/review/:reviewId', (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const exists = db.review.some(
    r => r.id === req.params.reviewId && r.campaignId === campaign.id,
  );
  if (!exists) return respondNotFound(res, 'Item de revisao não encontrado');

  db.review = db.review.filter(r => r.id !== req.params.reviewId);
  saveDB(db);
  res.status(204).end();
});

router.patch('/:id/drivers/:driverId', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const driver = db.drivers.find(
    d => d.id === req.params.driverId && d.campaignId === campaign.id,
  );
  if (!driver) return respondNotFound(res, 'Motorista não encontrado');

  const fieldsInput = req.body?.fields && typeof req.body.fields === 'object'
    ? req.body.fields
    : req.body;

  if (!fieldsInput || typeof fieldsInput !== 'object') {
    return res.status(400).json({ error: 'Payload invalido' });
  }

  try {
    // Merge fields into driver.raw
    const raw = mergeDriverRawSources(driver);
    Object.entries(fieldsInput).forEach(([key, value]) => {
      raw[key] = value;
    });
    driver.raw = raw;

    // Update specific driver properties
    if ('Nome' in fieldsInput || 'nome' in fieldsInput || 'name' in fieldsInput) {
      const newName =
        fieldsInput.Nome ??
        fieldsInput.nome ??
        fieldsInput.name ??
        driver.name;
      driver.name = newName;
      driver.nameKey = normalizeName(newName);
    }
    if ('Cidade' in fieldsInput || 'cidade' in fieldsInput) {
      driver.city = fieldsInput.Cidade ?? fieldsInput.cidade ?? driver.city;
    }
    if ('PIX' in fieldsInput || 'Pix' in fieldsInput || 'pix' in fieldsInput) {
      driver.pix = fieldsInput.PIX ?? fieldsInput.Pix ?? fieldsInput.pix ?? driver.pix;
    }
    if ('Status' in fieldsInput || 'status' in fieldsInput || 'STATUS' in fieldsInput) {
      const rawStatus =
        fieldsInput.Status ??
        fieldsInput.status ??
        fieldsInput.STATUS ??
        driver.status;
      driver.statusRaw = rawStatus;
      driver.status = normalizeStatus(rawStatus);
    }

    driver.updatedAt = Date.now();
    campaign.updatedAt = Date.now();

    applyCanonicalRaw(driver);

    // If campaign has a linked sheet, update it
    if (campaign.sheetId && campaign.sheetName && driver.rowNumber) {
      let header = Array.isArray(campaign.sheetHeader) && campaign.sheetHeader.length
        ? campaign.sheetHeader
        : null;
      if (!header) {
        header = await readSheetHeader(campaign.sheetId, campaign.sheetName);
        campaign.sheetHeader = header;
        campaign.sheetGid = campaign.sheetGid ?? (await getSheetId(campaign.sheetId, campaign.sheetName));
      }
      const rowValues = buildSheetRowValues(header, driver);
      await updateSheetRow(campaign.sheetId, campaign.sheetName, driver.rowNumber, rowValues);
    }

    saveDB(db);

    try {
      await upsertMasterRecord(campaign, driver);
    } catch (err) {
      console.warn('[campaigns] db upsert master driver update', err?.message || err);
    }

    res.json({ driver });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Falha ao atualizar motorista' });
  }
});

router.patch('/:id/drivers/:driverId/evidence-status', async (req, res) => {
  const { target, verified, reviewerName } = req.body || {};
  if (typeof target !== 'string') {
    return res.status(400).json({ error: 'Campo target obrigatorio (driver ou graphic).' });
  }
  if (typeof verified !== 'boolean') {
    return res.status(400).json({ error: 'Campo verified obrigatorio (boolean).' });
  }

  const normalizedTarget = target.toLowerCase();
  const targetKey = normalizedTarget === 'graphic'
    ? 'graphicFlow'
    : normalizedTarget === 'driver'
      ? 'driverFlow'
      : null;
  if (!targetKey) {
    return res.status(400).json({ error: 'Valor de target invalido. Use \"driver\" ou \"graphic\".' });
  }

  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha nǜo encontrada');

  const driver = db.drivers.find(d => d.id === req.params.driverId && d.campaignId === campaign.id);
  if (!driver) return respondNotFound(res, 'Motorista nǜo encontrado');

  let storageEntries = [];
  try {
    storageEntries = await listStorageEntriesByCampaign(campaign.id);
  } catch (err) {
    console.warn('[campaigns] storage entries listing error', err?.message || err);
  }
  const evidenceByDriver = collectEvidenceByDriver(db, campaign.id, storageEntries);
  const driverEvidence = evidenceByDriver.get(String(driver.id)) || [];
  const currentStatus = buildDriverEvidenceStatus(driver, driverEvidence);
  const flowStatus = currentStatus[targetKey];

  if (verified && !flowStatus.completed) {
    return res.status(400).json({ error: 'Envio ainda nǜo foi concluido para este perfil.' });
  }

  const reviewer = req.adminUser ? req.adminUser.name : (trim(reviewerName) || 'admin');
  const reviewEntry = ensureEvidenceReviewTarget(driver, targetKey);
  if (verified) {
    reviewEntry.verifiedAt = Date.now();
    reviewEntry.verifiedBy = reviewer;
    reviewEntry.verifiedByName = reviewer;
    reviewEntry.cooldownUntil = computeCooldownUntil(campaign, targetKey);
  } else {
    reviewEntry.verifiedAt = null;
    reviewEntry.verifiedBy = null;
    reviewEntry.verifiedByName = null;
    reviewEntry.cooldownUntil = null;
  }

  driver.updatedAt = Date.now();
  campaign.updatedAt = driver.updatedAt;
  saveDB(db);

  try {
    await upsertDriverRecord(driver);
  } catch (err) {
    console.warn('[campaigns] upsert driver record after evidence verification', err?.message || err);
  }

  await logAudit(req, 'evidence:verify', {
    entityType: 'driver',
    entityId: driver.id,
    data: {
      campaignName: campaign.name,
      driverName: driver.name,
      flowType: target,
      verified,
    },
  });

  const payloadDriver = cloneDriverForPayload(driver, driverEvidence);
  res.json({ ok: true, driver: payloadDriver });
});

router.patch('/:id/km/:driverId', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const driver = db.drivers.find(
    d => d.id === req.params.driverId && d.campaignId === campaign.id,
  );
  if (!driver) return respondNotFound(res, 'Motorista não encontrado');

  const sheetId = campaign.kmSheetId || campaign.sheetId || '';
  const sheetName = campaign.kmSheetName || campaign.sheetName || '';
  const usingKmSheet = Boolean(campaign.kmSheetId && campaign.kmSheetName);

  let header = Array.isArray(campaign.kmSheetHeader) && campaign.kmSheetHeader.length
    ? campaign.kmSheetHeader
    : null;

  try {
    if (!header) {
      if (Array.isArray(campaign.sheetHeader) && campaign.sheetHeader.length && !usingKmSheet) {
        header = campaign.sheetHeader;
      } else if (sheetId && sheetName) {
        header = await readSheetHeader(sheetId, sheetName);
        if (usingKmSheet) {
          campaign.kmSheetHeader = header;
        } else {
          campaign.sheetHeader = header;
        }
      }
    }
  } catch (err) {
    console.warn('[campaigns] read km header', err?.message || err);
  }

  const fieldsInput = req.body?.fields && typeof req.body.fields === 'object'
    ? req.body.fields
    : req.body;
  if (!fieldsInput || typeof fieldsInput !== 'object') {
    return res.status(400).json({ error: 'Payload invalido' });
  }

  const kmRowNumber = (sheetId && sheetName && header)
    ? (usingKmSheet ? driver.km?.rowNumber : driver.rowNumber)
    : undefined;

  if (sheetId && sheetName && header && !kmRowNumber) {
    return res.status(400).json({ error: 'Motorista sem referencia de linha para atualizacao de KM' });
  }

  try {
    const normalizeKeyForMatch = value => String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/["'`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    const sourceRaw = usingKmSheet ? (driver.km?.raw || {}) : (driver.raw || {});
    const raw = { ...sourceRaw };

    const headerList = Array.isArray(header) ? header : [];
    for (const [key, value] of Object.entries(fieldsInput)) {
      const normalizedKey = normalizeKeyForMatch(key);
      let matched = null;
      if (headerList.length) {
        matched = headerList.find(h => normalizeKeyForMatch(h) === normalizedKey);
        if (!matched) {
          matched = headerList.find(h => normalizeKeyForMatch(h).includes(normalizedKey) || normalizedKey.includes(normalizeKeyForMatch(h)));
        }
        if (!matched) {
          const re = /(KM|KM RODADO|META KM|STATUS)\s*(\d+)/i;
          const match = String(key || '').match(re);
          if (match && match[1] && match[2]) {
            const base = match[1].toUpperCase();
            const num = match[2];
            matched = headerList.find(
              h => normalizeKeyForMatch(h).includes(base) && normalizeKeyForMatch(h).includes(num),
            );
          }
        }
      }
      if (matched) raw[matched] = value;
      else raw[key] = value;
    }

    if (sheetId && sheetName && header && usingKmSheet) {
      const values = header.map(col => raw[col] ?? '');
      await updateSheetRow(sheetId, sheetName, kmRowNumber, values);
    }

    driver.km = driver.km || {};
    if (!usingKmSheet) {
      driver.raw = raw;
    }
    driver.km.raw = raw;

    const parseNum = (val) => {
      if (val === undefined || val === null) return null;
      const str = String(val).trim();
      if (!str) return null;
      const cleaned = str.replace(/\./g, '').replace(/,/g, '.').replace('%', '');
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : null;
    };

    let maxPeriod = 0;
    const periodRegex = /(KM|META|STATUS)\s*(\d+)/i;
    Object.keys(raw).forEach(key => {
      const match = String(key || '').match(periodRegex);
      if (match && match[2]) {
        const idx = parseInt(match[2], 10);
        if (Number.isFinite(idx) && idx > maxPeriod) maxPeriod = idx;
      }
    });

    const periodCount = Number.isFinite(Number(campaign.kmPeriods))
      ? Number(campaign.kmPeriods)
      : (maxPeriod > 0 ? maxPeriod : DEFAULT_KM_PERIODS);

    const periods = [];
    let totalKm = 0;
    let totalMeta = 0;

    for (let i = 1; i <= periodCount; i += 1) {
      const kmKeys = [`KM RODADO ${i}`, `KM RODADO${i}`, `KM ${i}`, `KM${i}`];
      const metaKeys = [`META KM ${i}`, `META KM${i}`];
      const statusKeys = [`STATUS ${i}`];

      let kmValue = null;
      for (const key of kmKeys) {
        if (raw[key] !== undefined && String(raw[key]).trim() !== '') {
          kmValue = parseNum(raw[key]);
          break;
        }
      }
      if (Number.isFinite(kmValue)) totalKm += kmValue ?? 0;

      let metaValue = null;
      for (const key of metaKeys) {
        if (raw[key] !== undefined && String(raw[key]).trim() !== '') {
          metaValue = parseNum(raw[key]);
          break;
        }
      }
      if (Number.isFinite(metaValue)) totalMeta += metaValue ?? 0;

      let statusValue = '';
      for (const key of statusKeys) {
        if (raw[key] !== undefined && String(raw[key]).trim() !== '') {
          statusValue = String(raw[key]);
          break;
        }
      }

      periods.push({
        index: i,
        kmRodado: Number.isFinite(kmValue) ? kmValue : '',
        metaKm: Number.isFinite(metaValue) ? metaValue : '',
        percent: null,
        status: statusValue,
      });
    }

    const totalPercent = (Number.isFinite(totalKm) && Number.isFinite(totalMeta) && totalMeta)
      ? (totalKm / totalMeta) * 100
      : null;

    const pickFirst = (keys) => {
      const normalizedTargets = keys.map(normalizeKeyForMatch);
      for (const [key, value] of Object.entries(raw)) {
        if (normalizedTargets.includes(normalizeKeyForMatch(key)) && String(value).trim() !== '') {
          return value;
        }
      }
      for (const key of keys) {
        if (raw[key] !== undefined && String(raw[key]).trim() !== '') return raw[key];
      }
      return '';
    };

    driver.km.periods = periods;
    driver.km.total = {
      kmRodado: Number.isFinite(totalKm) ? totalKm : '',
      metaKm: Number.isFinite(totalMeta) ? totalMeta : '',
      percent: Number.isFinite(totalPercent) ? totalPercent : '',
      status: pickFirst(['STATUS TOTAL']),
    };
    driver.km.checkIn = pickFirst(['CHECK IN', 'CHECK-IN', 'CHECKIN']);
    driver.km.comentarios = pickFirst(['COMENTÁRIOS', 'COMENT\u00c1RIOS', 'COMENTARIO']);
    driver.km.observacoes = pickFirst(['OBSERVAÇÕES', 'OBSERVA\u00c7\u00d5ES', 'OBSERVACAO']);

    driver.km.importedAt = Date.now();
    driver.updatedAt = Date.now();

    applyCanonicalRaw(driver);

    if (!usingKmSheet && sheetId && sheetName && header && kmRowNumber) {
      const rowValues = buildSheetRowValues(header, driver);
      await updateSheetRow(sheetId, sheetName, kmRowNumber, rowValues);
    }

    campaign.updatedAt = Date.now();
    saveDB(db);

    try {
      await upsertMasterRecord(campaign, driver);
    } catch (err) {
      console.warn('[campaigns] db upsert master km', err?.message || err);
    }

    res.json({ driver });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Falha ao atualizar KM' });
  }
});
router.get('/:id/evidence', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const evidence = await getEvidenceEntries(db, campaign);
    res.json({ evidence });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get('/:id/evidence/driver/:driverId', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const evidence = await getEvidenceEntries(db, campaign, { driverId: req.params.driverId });
    res.json({ evidence });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get('/:id/evidence/graphic/:graphicId', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const evidence = await getEvidenceEntries(db, campaign, { graphicId: req.params.graphicId });
    res.json({ evidence });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get('/:id/evidence/graphic/:graphicId/driver/:driverId', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const evidence = await getEvidenceEntries(db, campaign, {
      graphicId: req.params.graphicId,
      driverId: req.params.driverId,
    });
    res.json({ evidence });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.delete('/:id/evidence/:evidenceId', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const evidenceId = req.params.evidenceId;
    if (!evidenceId) {
      return res.status(400).json({ error: 'ID da evidência obrigatório' });
    }

    let removedFromDbJson = false;
    // Remove from db.json evidence array (if exists)
    if (Array.isArray(db.evidence)) {
      const index = db.evidence.findIndex(e => e.id === evidenceId && e.campaignId === campaign.id);
      if (index >= 0) {
        db.evidence.splice(index, 1);
        saveDB(db);
        removedFromDbJson = true;
        console.log('[evidence:delete] Removed from db.json:', evidenceId);
      }
    }

    // Remove from MongoDB
    const deleted = await deleteEvidenceRecord(evidenceId);
    console.log('[evidence:delete] MongoDB result:', { evidenceId, deleted, removedFromDbJson });

    await logAudit(req, 'evidence:delete', {
      entityType: 'evidence',
      entityId: evidenceId,
      data: { campaignId: campaign.id, campaignName: campaign.name },
    });

    res.json({ success: true, deleted, removedFromDbJson });
  } catch (err) {
    console.error('[evidence:delete] Error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.delete('/:id/storage/:storageFileId', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const storageFileId = req.params.storageFileId;
    if (!storageFileId) {
      return res.status(400).json({ error: 'ID do arquivo obrigatório' });
    }

    console.log('[storage:delete] Deleting storage file:', storageFileId);

    // Remove from MongoDB
    const deleted = await deleteStorageFile(storageFileId);
    console.log('[storage:delete] MongoDB result:', { storageFileId, deleted });

    await logAudit(req, 'storage:delete', {
      entityType: 'storage_file',
      entityId: storageFileId,
      data: { campaignId: campaign.id, campaignName: campaign.name },
    });

    res.json({ success: true, deleted });
  } catch (err) {
    console.error('[storage:delete] Error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.delete('/:id/storage/folder/:driverId/:dateFolder', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const { driverId, dateFolder } = req.params;
    const { uploaderType } = req.query; // optional: 'driver' or 'graphic'

    if (!driverId || !dateFolder) {
      return res.status(400).json({ error: 'Driver ID e pasta de data são obrigatórios' });
    }

    console.log('[storage:delete-folder] Deleting folder:', { driverId, dateFolder, uploaderType });

    // Delete all storage files in this folder
    const deletedCount = await deleteStorageFilesByFolder(
      campaign.id,
      driverId,
      dateFolder,
      uploaderType || null
    );

    console.log('[storage:delete-folder] Result:', { deletedCount });

    await logAudit(req, 'storage:delete-folder', {
      entityType: 'storage_folder',
      entityId: `${driverId}/${dateFolder}`,
      data: { 
        campaignId: campaign.id, 
        campaignName: campaign.name,
        driverId,
        dateFolder,
        uploaderType: uploaderType || 'all',
        deletedCount 
      },
    });

    res.json({ success: true, deletedCount });
  } catch (err) {
    console.error('[storage:delete-folder] Error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.post('/:id/cleanup-orphaned-evidence', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    // Get all valid storage file IDs
    let storageEntries = [];
    try {
      storageEntries = await listStorageEntriesByCampaign(campaign.id);
    } catch (err) {
      console.warn('[campaigns] storage entries listing error', err?.message || err);
    }
    
    const validStorageIds = new Set(storageEntries.map(e => e.id));
    
    // Find and remove orphaned evidence from db.json
    const evidenceBefore = (db.evidence || []).length;
    db.evidence = (db.evidence || []).filter(item => {
      // Keep if not related to this campaign
      if (item.campaignId !== campaign.id) return true;
      
      // Remove if URL references a deleted storage file
      if (item.url && item.url.startsWith('/api/storage/')) {
        const storageId = item.url.split('/').pop();
        if (!validStorageIds.has(storageId)) {
          console.log('[cleanup] Removing orphaned evidence with deleted file:', { id: item.id, url: item.url });
          return false;
        }
      }
      
      // Also remove standalone odometer-value entries that don't have corresponding photo entries
      // (These are orphaned after their photos were deleted)
      if (item.step === 'odometer-value' && !item.url && !item.photoData) {
        // Check if there's a corresponding odometer-photo entry
        const hasCorrespondingPhoto = db.evidence.some(e => 
          e.campaignId === campaign.id &&
          e.driverId === item.driverId &&
          e.step === 'odometer-photo' &&
          (e.url || e.photoData) &&
          Math.abs(e.createdAt - item.createdAt) < 60000 // within 1 minute
        );
        
        if (!hasCorrespondingPhoto) {
          console.log('[cleanup] Removing orphaned odometer-value:', { id: item.id, driverId: item.driverId });
          return false;
        }
      }
      
      return true;
    });
    
    saveDB(db);
    const removedCount = evidenceBefore - db.evidence.length;
    
    console.log('[cleanup] Orphaned evidence cleanup:', { removedCount });

    await logAudit(req, 'evidence:cleanup', {
      entityType: 'evidence',
      entityId: campaign.id,
      data: { 
        campaignId: campaign.id, 
        campaignName: campaign.name,
        removedCount 
      },
    });

    res.json({ success: true, removedCount });
  } catch (err) {
    console.error('[cleanup] Error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get('/:id/storage/graphic/:driverId', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const driver = (db.drivers || []).find(
      d => d.id === req.params.driverId && d.campaignId === campaign.id,
    );
    if (!driver) return respondNotFound(res, 'Motorista não encontrado na campanha');

    const tree = await listDriverStorageTree(campaign, driver, { uploaderType: 'graphic' });
    res.json({ storage: tree });
  } catch (err) {
    console.warn('[campaigns] storage graphic listing error', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get('/:id/storage/driver/:driverId', async (req, res) => {
  try {
    const db = loadDB();
    const campaign = db.campaigns.find(c => c.id === req.params.id);
    if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

    const driver = (db.drivers || []).find(
      d => d.id === req.params.driverId && d.campaignId === campaign.id,
    );
    if (!driver) return respondNotFound(res, 'Motorista não encontrado na campanha');

    const tree = await listDriverStorageTree(campaign, driver, { uploaderType: 'driver' });
    res.json({ storage: tree });
  } catch (err) {
    console.warn('[campaigns] storage driver listing error', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});







router.post('/:id/master-ensure', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');
  const settings = db.settings || {};
  const masterSheetId = settings.masterSheetId;
  const masterProvider = String(process.env.MASTER_PROVIDER || '').toLowerCase();

  const useMongoDatabase = masterProvider !== 'sheets';

  if (useMongoDatabase) {
    try {
      const schemaResult = await ensureDatabaseSchema();
      if (schemaResult?.requiresManual) {
        return res.status(400).json({
          error: 'Schema do MongoDB ainda não existe.',
          hint: schemaResult.message,
        });
      }

      const baseHeader = Array.isArray(campaign.sheetHeader) ? campaign.sheetHeader : [];
      const periods = Number.isFinite(Number(campaign.kmPeriods))
        ? Number(campaign.kmPeriods)
        : DEFAULT_KM_PERIODS;
      const header = buildMasterHeader({ periods, baseHeader });

      campaign.sheetHeader = header;
      campaign.sheetName = campaign.sheetName || trim(campaign.name) || `Campanha ${campaign.id.slice(0, 6)}`;
      campaign.updatedAt = Date.now();
      saveDB(db);

      const tableResult = await ensureCampaignMasterTable(campaign, header);
      if (tableResult?.requiresManual) {
        return res.status(400).json({
          error: 'Tabela da campanha no MongoDB não pode ser criada automaticamente.',
          hint: tableResult.message || 'Crie/atualize manualmente as coleções no MongoDB.',
        });
      }

      const drivers = db.drivers.filter(d => d.campaignId === campaign.id);
      const { inserted } = await upsertCampaignMasterRows(campaign, drivers, header);

      try {
        const graphics = (db.graphics || []).filter(g => g.campaignId === campaign.id);
        await ensureCampaignGraphicsTable(campaign);
        if (graphics.length) await upsertCampaignGraphicsRows(campaign, graphics);
      } catch (err) {
        console.warn('[campaigns] db graphics ensure', err?.message || err);
      }

      return res.json({
        ok: true,
        provider: 'mongo',
        rowsWritten: inserted,
        table: getCampaignTableName(campaign),
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ error: err.message || 'Falha ao vincular campanha ao MongoDB' });
    }
  }

  if (!masterSheetId) {
    return res.status(400).json({ error: 'Planilha mestre não configurada. Defina em /api/config/master-sheet' });
  }

  const title = String(campaign.name || `Campanha ${campaign.id.slice(0, 6)}`).trim().slice(0, 96);

  try {
    const tab = await ensureSheetTab(masterSheetId, title);

    const baseHeader = Array.isArray(campaign.sheetHeader) ? campaign.sheetHeader : [];
    const periods = Number.isFinite(Number(campaign.kmPeriods))
      ? Number(campaign.kmPeriods)
      : DEFAULT_KM_PERIODS;
    const header = buildMasterHeader({ periods, baseHeader });
    await setSheetHeader(masterSheetId, title, header);

    campaign.sheetId = masterSheetId;
    campaign.sheetName = title;
    campaign.sheetHeader = header;
    campaign.sheetGid = tab.sheetId ?? (await getSheetId(masterSheetId, title));
    campaign.updatedAt = Date.now();
    saveDB(db);

    const drivers = db.drivers.filter(d => d.campaignId === campaign.id);
    const rows = drivers.map(driver => buildSheetRowValues(header, driver));

    await clearSheetData(masterSheetId, title);
    if (rows.length) {
      await updateSheetRows(masterSheetId, title, 2, header.length, rows);
    }

    drivers.forEach((driver, idx) => {
      driver.rowNumber = idx + 2;
    });
    saveDB(db);

    let mongoMirrored = false;
    try {
      await ensureDatabaseSchema();
      const tableResult = await ensureCampaignMasterTable(campaign, header);
      if (!tableResult?.requiresManual) {
        await upsertCampaignMasterRows(campaign, drivers, header);
        const graphics = (db.graphics || []).filter(g => g.campaignId === campaign.id);
        await ensureCampaignGraphicsTable(campaign);
        if (graphics.length) await upsertCampaignGraphicsRows(campaign, graphics);
        mongoMirrored = true;
      }
    } catch (err) {
      console.warn('[campaigns] db mirror master', err?.message || err);
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(masterSheetId)}/edit#gid=${encodeURIComponent(campaign.sheetGid)}`;
    res.json({
      ok: true,
      provider: 'sheets',
      campaign: summarizeCampaign(db, campaign),
      sheetUrl,
      rowsWritten: drivers.length,
      mirroredToDb: mongoMirrored,
      dbTable: mongoMirrored ? getCampaignTableName(campaign) : null,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Falha ao vincular campanha a planilha mestre' });
  }
});

router.get('/:id/master-status', async (req, res) => {
  const db = loadDB();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!campaign) return respondNotFound(res, 'Campanha não encontrada');

  const settings = db.settings || {};
  const masterSheetId = settings.masterSheetId;
  if (!masterSheetId) {
    return res.status(400).json({ error: 'Planilha mestre não configurada' });
  }

  const title = String(campaign.sheetName || campaign.name || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'Nome da aba mestre não configurado' });
  }

  try {
    const sheetGid = await getSheetId(masterSheetId, title);
    const header = await readSheetHeader(masterSheetId, title);
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(masterSheetId)}/edit#gid=${encodeURIComponent(sheetGid)}`;

    res.json({
      sheetId: masterSheetId,
      sheetName: title,
      sheetGid,
      sheetUrl,
      header,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Falha ao inspecionar planilha' });
  }
});

export default router;
