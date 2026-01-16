import { MongoClient, ObjectId, GridFSBucket } from 'mongodb';
import { applyCanonicalRaw } from '../lib/driverSheet.js';
import { normalizeName } from '../lib/normalize.js';

function getEnv(name, fallback = '') {
  const v = process.env[name];
  return (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
}

const MONGO_URI = getEnv('MONGO_URI');
const MONGO_DB_NAME = getEnv('MONGO_DB_NAME', 'odrive_app');
const MONGO_TLS_ALLOW_INVALID_CERTS = getEnv('MONGO_TLS_ALLOW_INVALID_CERTS', '0') === '1';
const MONGO_TLS_CA_FILE = getEnv('MONGO_TLS_CA_FILE');
const STORAGE_COLLECTION = 'storage_files';
const CAMPAIGNS_COLLECTION = 'campaigns';
const DRIVERS_COLLECTION = 'drivers';
const GRAPHICS_COLLECTION = 'graphics';
const EVIDENCE_COLLECTION = 'evidence';
const ADMIN_USERS_COLLECTION = 'admin_users';
const AUDIT_LOG_COLLECTION = 'admin_audit_log';
const REPRESENTATIVE_REQUESTS_COLLECTION = 'representative_requests';

let client = null;
let db = null;
let bucket = null;
let isConnecting = false;

async function getDb() {
  // Se já está conectado, retorna
  if (db) return db;
  
  // Se está conectando, aguarda
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getDb();
  }
  
  isConnecting = true;
  
  try {
    if (!MONGO_URI) {
      throw new Error('MongoDB não configurado (defina MONGO_URI no .env)');
    }
    
    const mongoOptions = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
      retryWrites: true,
      retryReads: true,
    };
    
    if (MONGO_TLS_ALLOW_INVALID_CERTS) {
      mongoOptions.tlsAllowInvalidCertificates = true;
      mongoOptions.tlsAllowInvalidHostnames = true;
    }
    if (MONGO_TLS_CA_FILE) {
      mongoOptions.tlsCAFile = MONGO_TLS_CA_FILE;
    }
    
    console.log('[MongoDB] Conectando ao banco de dados...');
    
    // Retry logic - tenta 3 vezes
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        client = new MongoClient(MONGO_URI, mongoOptions);
        await client.connect();
        db = client.db(MONGO_DB_NAME);
        console.log('[MongoDB] ✅ Conectado com sucesso ao banco:', MONGO_DB_NAME);
        
        // Event listeners
        client.on('error', (err) => {
          console.error('[MongoDB] ❌ Erro na conexão:', err.message);
          db = null;
        });
        client.on('close', () => {
          console.warn('[MongoDB] ⚠️ Conexão fechada');
          db = null;
        });
        
        isConnecting = false;
        return db;
        
      } catch (error) {
        lastError = error;
        console.error(`[MongoDB] Tentativa ${attempt}/3 falhou:`, error.message);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    throw lastError;
    
  } finally {
    isConnecting = false;
  }
}

export { getDb };

async function getBucket() {
  const database = await getDb();
  if (!bucket) {
    bucket = new GridFSBucket(database, { bucketName: 'media' });
  }
  return bucket;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error('Imagem base64 invalida');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function sanitizeDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function buildPhoneVariants(digits) {
  const clean = sanitizeDigits(digits);
  const variants = new Set();
  if (!clean) return variants;
  variants.add(clean);
  if (clean.startsWith('55')) variants.add(clean.slice(2));
  if (clean.length >= 11) variants.add(clean.slice(-11));
  if (clean.length >= 10) variants.add(clean.slice(-10));
  if (clean.length >= 9) variants.add(clean.slice(-9));
  if (clean.length >= 8) variants.add(clean.slice(-8));
  return variants;
}

function phoneMatchesStored(storedDigits, inputDigits) {
  const stored = sanitizeDigits(storedDigits);
  const input = sanitizeDigits(inputDigits);
  if (!stored || !input) return false;
  if (stored === input) return true;
  const strip = value => value.startsWith('55') ? value.slice(2) : value;
  if (strip(stored) === strip(input)) return true;
  return stored.endsWith(input) || input.endsWith(stored);
}

// Utility: sanitize name (compartilhado com outras camadas)
function sanitizeName(name) {
  return String(name || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function todayFolder() {
  // Use UTC date to create deterministic folder names independent of server local timezone
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function stepBaseName(step) {
  const map = {
    'odometer-photo': 'odometro',
    'photo-left': 'lateral esquerda',
    'photo-right': 'lateral direita',
    'photo-front': 'frente',
    'photo-rear': 'traseira',
  };
  return map[step] || 'foto';
}

function buildCampaignSlug(campaign) {
  return `campanha-${sanitizeName(campaign?.name || campaign?.id)}`;
}

function buildDriverSlug(driver) {
  return `driver-${sanitizeName(driver?.name || driver?.id)}-${String(driver?.id || '').slice(0, 6)}`;
}

export function getDriverStorageBasePath(campaign, driver, uploaderType = 'driver') {
  const camp = buildCampaignSlug(campaign);
  const drv = buildDriverSlug(driver);
  const type = String(uploaderType || 'driver').toLowerCase() === 'graphic' ? 'graphic' : 'driver';
  const roleFolder = type === 'graphic' ? 'Graficas' : 'Motoristas';
  return `${camp}/${roleFolder}/${drv}/${type}`;
}

// Storage: MongoDB (GridFS) guarda os binarios e expõe /api/storage/:id
export async function uploadBase64ImageMongo(
  campaign,
  driver,
  dataUrl,
  { step = 'photo', uploaderType = 'driver', refazer = false, graphicId = null } = {},
) {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  const basePrefix = getDriverStorageBasePath(campaign, driver, uploaderType);
  const date = todayFolder();
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const label = stepBaseName(step);

  const ext = (mimeType.split('/')[1] || 'jpg').toLowerCase();
  let baseName = `${label} ${hh}h${mi}`;
  if (refazer) baseName = `${baseName}_refeito`;
  const fileName = `${baseName}.${ext}`;
  const objectPath = `${basePrefix}/${date}/${fileName}`;

  const bucket = await getBucket();
  const uploadStream = bucket.openUploadStream(objectPath, {
    contentType: mimeType,
    metadata: {
      campaignId: campaign.id,
      driverId: driver?.id || null,
      graphicId: graphicId || null,
      uploaderType,
      step,
    },
  });

  await new Promise((resolve, reject) => {
    uploadStream.once('finish', resolve);
    uploadStream.once('error', reject);
    uploadStream.end(buffer);
  });

  const fileId = uploadStream.id;
  const database = await getDb();
  const storageDoc = {
    _id: fileId,
    campaignId: campaign.id,
    driverId: driver?.id || null,
    graphicId: graphicId || null,
    uploaderType,
    step,
    path: objectPath,
    fileName,
    mimeType,
    folderPath: `${basePrefix}/${date}`,
    dateFolder: date,
    url: `/api/storage/${fileId.toString()}`,
    createdAt: new Date(),
  };
  await database.collection(STORAGE_COLLECTION).insertOne(storageDoc);

  return {
    bucket: 'mongo',
    path: objectPath,
    url: storageDoc.url,
    fileId: fileId.toString(),
  };
}

export async function listDriverStorageTree(campaign, driver, { uploaderType = 'driver' } = {}) {
  const database = await getDb();
  const basePrefix = getDriverStorageBasePath(campaign, driver, uploaderType);

  const files = await database.collection(STORAGE_COLLECTION)
    .find({
      campaignId: campaign.id,
      driverId: driver?.id || null,
      uploaderType,
    })
    .sort({ createdAt: -1 })
    .toArray();

  const folderMap = new Map();
  for (const file of files) {
    const fileId = file?._id ? String(file._id) : (file.id ? String(file.id) : null);
    const folder = file.dateFolder || 'unknown';
    if (!folderMap.has(folder)) {
      folderMap.set(folder, { name: folder, files: [] });
    }
    folderMap.get(folder).files.push({
      id: fileId,
      name: file.fileName,
      path: file.path,
      url: file.url,
      size: null,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt || file.createdAt,
      uploaderType: file.uploaderType || uploaderType,
      graphicId: file.graphicId || null,
      driverId: file.driverId || null,
    });
  }

  const folders = Array.from(folderMap.values()).sort((a, b) => b.name.localeCompare(a.name));
  return { bucket: 'mongo', prefix: `${basePrefix}/`, uploaderType, folders };
}

export async function listStorageEntriesByCampaign(campaignId) {
  if (!campaignId) return [];
  const database = await getDb();
  const cursor = await database.collection(STORAGE_COLLECTION)
    .find({ campaignId })
    .sort({ createdAt: 1 });
  const docs = await cursor.toArray();
  return docs.map(doc => ({
    id: doc._id ? String(doc._id) : `${doc.campaignId || 'storage'}-${Math.random().toString(36).slice(2, 8)}`,
    campaignId: doc.campaignId,
    driverId: doc.driverId || null,
    graphicId: doc.graphicId || null,
    uploaderType: doc.uploaderType || doc.uploader_type || 'driver',
    step: doc.step || '',
    url: doc.url || '',
    path: doc.path || '',
    fileName: doc.fileName || '',
    folderPath: doc.folderPath || '',
    dateFolder: doc.dateFolder || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.getTime() : (
      doc.created_at instanceof Date ? doc.created_at.getTime() : null
    ),
  }));
}

// Campaign CRUD
export async function upsertCampaignRecord(campaign) {
  const database = await getDb();
  const payload = {
    _id: campaign.id,
    name: campaign.name || null,
    client: campaign.client || null,
    period: campaign.period || null,
    status: campaign.status || null,
    campaign_code: campaign.campaignCode || null,
    sheet_id: campaign.sheetId || null,
    sheet_name: campaign.sheetName || null,
    drive_folder_id: campaign.driveFolderId || null,
    created_at: new Date(campaign.createdAt || Date.now()),
    updated_at: new Date(campaign.updatedAt || campaign.createdAt || Date.now()),
  };
  await database.collection('campaigns').replaceOne({ _id: payload._id }, payload, { upsert: true });
}

export async function upsertDriverRecord(driver) {
  const database = await getDb();
  const normalizedName = normalizeName(String(driver.name || ''));
  const phoneDigits = driver.phoneDigits || sanitizeDigits(driver.phone);
  const kmSnapshot = driver?.km && typeof driver.km === 'object' ? driver.km : null;
  const kmTotal = kmSnapshot?.total?.kmRodado ?? kmSnapshot?.raw?.['KM RODADO TOTAL'];
  const odometerText = kmTotal != null
    ? String(kmTotal).trim()
    : (driver?.raw && driver.raw['DRV ODOMETRO VALOR INST'] ? String(driver.raw['DRV ODOMETRO VALOR INST']).trim() : null);
  let odometerValue = null;
  if (odometerText) {
    const normalized = odometerText.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) odometerValue = parsed;
  }
  const payload = {
    _id: driver.id,
    campaign_id: driver.campaignId,
    name: driver.name,
    name_key: normalizedName || null,
    phone: driver.phone || null,
    phone_digits: phoneDigits || null,
    phone_suffix: phoneDigits ? phoneDigits.slice(-9) : null,
    cpf: driver.cpf ? sanitizeDigits(driver.cpf) : null,
    plate: driver.plate || null,
    created_at: new Date(driver.createdAt || Date.now()),
    updated_at: new Date(driver.updatedAt || driver.createdAt || Date.now()),
  };
  if (odometerText) {
    payload.odometer_text = odometerText;
    payload.odometer_value = odometerValue;
    payload.odometer_updated_at = new Date(
      kmSnapshot?.total?.updatedAt || kmSnapshot?.updatedAt || driver.updatedAt || Date.now(),
    );
  }
  await database.collection(DRIVERS_COLLECTION).replaceOne({ _id: payload._id }, payload, { upsert: true });
}

export async function insertEvidenceRecord({
  id,
  campaignId,
  driverId,
  graphicId,
  step,
  url,
  odometerValue,
  createdAt,
  uploaderType,
  path,
  storageFileId,
}) {
  const database = await getDb();
  const payload = {
    _id: id,
    campaign_id: campaignId,
    driver_id: driverId,
    step,
    url,
    path: path || '',
    uploader_type: uploaderType || 'driver',
    odometer_value: odometerValue || null,
    created_at: new Date(createdAt || Date.now()),
    updated_at: new Date(),
  };
  if (graphicId) payload.graphic_id = graphicId;
  if (storageFileId) payload.storage_file_id = storageFileId;
  await database.collection('evidence').replaceOne({ _id: payload._id }, payload, { upsert: true });
}

export async function deleteEvidenceRecord(evidenceId) {
  const database = await getDb();
  console.log('[mongo] deleteEvidenceRecord called with:', evidenceId);
  
  // Try with string id first (nanoid), then with ObjectId if that fails
  let result = await database.collection('evidence').deleteOne({ _id: evidenceId });
  console.log('[mongo] deleteEvidenceRecord first attempt (string):', { evidenceId, deletedCount: result.deletedCount });
  
  if (result.deletedCount === 0) {
    try {
      // Check if it's a valid ObjectId string and convert
      if (typeof evidenceId === 'string' && /^[a-f0-9]{24}$/i.test(evidenceId)) {
        const objId = new ObjectId(evidenceId);
        result = await database.collection('evidence').deleteOne({ _id: objId });
        console.log('[mongo] deleteEvidenceRecord second attempt (ObjectId):', { evidenceId, deletedCount: result.deletedCount });
      }
    } catch (e) {
      console.warn('[mongo] deleteEvidenceRecord ObjectId conversion error:', e.message);
    }
  }
  
  return result.deletedCount > 0;
}

export async function deleteStorageFile(storageFileId) {
  const database = await getDb();
  console.log('[mongo] deleteStorageFile called with:', storageFileId);
  
  // Storage files typically use ObjectId, but try string first for compatibility
  let result = await database.collection(STORAGE_COLLECTION).deleteOne({ _id: storageFileId });
  console.log('[mongo] deleteStorageFile first attempt (string):', { storageFileId, deletedCount: result.deletedCount });
  
  if (result.deletedCount === 0) {
    try {
      // Check if it's a valid ObjectId string and convert
      if (typeof storageFileId === 'string' && /^[a-f0-9]{24}$/i.test(storageFileId)) {
        const objId = new ObjectId(storageFileId);
        result = await database.collection(STORAGE_COLLECTION).deleteOne({ _id: objId });
        console.log('[mongo] deleteStorageFile second attempt (ObjectId):', { storageFileId, deletedCount: result.deletedCount });
      }
    } catch (e) {
      console.warn('[mongo] deleteStorageFile ObjectId conversion error:', e.message);
    }
  }
  
  return result.deletedCount > 0;
}

export async function deleteStorageFilesByFolder(campaignId, driverId, dateFolder, uploaderType = null) {
  const database = await getDb();
  const filter = {
    campaignId,
    driverId,
    dateFolder
  };
  if (uploaderType) {
    filter.uploaderType = uploaderType;
  }
  console.log('[mongo] deleteStorageFilesByFolder filter:', filter);
  const result = await database.collection(STORAGE_COLLECTION).deleteMany(filter);
  console.log('[mongo] deleteStorageFilesByFolder result:', { deletedCount: result.deletedCount });
  return result.deletedCount;
}

// Master records (campaign-specific driver data aggregation)
function campaignTableSlug(campaign) {
  const base = sanitizeName(campaign?.name || campaign?.id || 'campanha')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || `campanha_${String(campaign?.id || 'padrao').slice(0, 6).toLowerCase()}`;
}

export function getCampaignTableName(campaign) {
  const slug = campaignTableSlug(campaign);
  return `campanha_${slug}`;
}

export function getCampaignGraphicsTableName(campaign) {
  const slug = campaignTableSlug(campaign);
  return `campanha_${slug}_graficas`;
}

export async function ensureCampaignMasterTable(campaign, header = []) {
  // MongoDB doesn't require schema creation; collection is created on first insert
  const tableName = getCampaignTableName(campaign);
  const database = await getDb();
  // Optionally create index on id
  try {
    await database.collection(tableName).createIndex({ id: 1 }, { unique: true });
  } catch (e) {
    // index may exist
  }
  return { created: true, tableName };
}

export async function upsertCampaignMasterRows(campaign, drivers = [], header = []) {
  const database = await getDb();
  const tableName = getCampaignTableName(campaign);
  const rows = [];
  const cols = Array.isArray(header) ? header : [];
  const campFolder = `campanha-${sanitizeName(campaign?.name || campaign?.id)}`;

  for (const d of drivers) {
    try {
      const clone = JSON.parse(JSON.stringify(d || {}));
      const raw = applyCanonicalRaw(clone);
      const row = {
        _id: clone.id,
        id: clone.id,
        'CAMPANHA ID': campaign.id,
        'CAMPANHA NOME': campaign.name || '',
        'CAMPANHA PASTA': campFolder,
      };

      for (const col of cols) {
        if (raw[col] !== undefined && raw[col] !== null) row[col] = String(raw[col]);
        else row[col] = '';
      }
      if (!row['DRIVER ID']) row['DRIVER ID'] = clone.id;
      rows.push(row);
    } catch (err) {
      // ignore row-level serialization error
    }
  }

  if (!rows.length) return { inserted: 0, tableName };

  const coll = database.collection(tableName);
  for (const row of rows) {
    await coll.replaceOne({ _id: row._id }, row, { upsert: true });
  }

  return { inserted: rows.length, tableName };
}

export async function upsertMasterRecord(campaign, driver) {
  if (!campaign || !driver) return;
  const header = Array.isArray(campaign?.sheetHeader) && campaign.sheetHeader.length
    ? campaign.sheetHeader
    : Object.keys(driver?.raw || {});
  try {
    await ensureCampaignMasterTable(campaign, header);
  } catch (e) {
    console.warn('[mongo] upsertMasterRecord ensure table:', e?.message || e);
    return;
  }

  try {
    await upsertCampaignMasterRows(campaign, [driver], header);
  } catch (e) {
    console.warn('[mongo] upsertMasterRecord error:', e?.message || e);
  }
}

export async function deleteMastersByCampaign(campaign) {
  if (!campaign) return;
  const database = await getDb();
  const tableName = getCampaignTableName(campaign);
  try {
    await database.collection(tableName).deleteMany({});
  } catch (e) {
    console.warn('[mongo] deleteMastersByCampaign error:', e?.message || e);
  }

  try {
    await deleteCampaignGraphicsTable(campaign);
  } catch (e) {
    console.warn('[mongo] deleteCampaignGraphicsTable (by master):', e?.message || e);
  }
}

export async function deleteAllCampaignData(campaignId) {
  if (!campaignId) return;
  const database = await getDb();
  const bucket = await getBucket();

  console.log(`[mongo] Deleting all data for campaign: ${campaignId}`);

  // 1. Delete storage files + underlying GridFS blobs
  try {
    const storageFiles = await database.collection(STORAGE_COLLECTION)
      .find({ campaignId })
      .project({ _id: 1 })
      .toArray();

    for (const file of storageFiles) {
      const fileId = file?._id;
      if (!fileId) continue;
      try {
        const oid = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;
        await bucket.delete(oid);
      } catch (err) {
        console.warn('[mongo] deleteAllCampaignData - gridfs delete error:', err?.message || err);
      }
    }

    const storageResult = await database.collection(STORAGE_COLLECTION).deleteMany({ campaignId });
    console.log(`[mongo] Deleted ${storageResult.deletedCount} storage files`);
  } catch (e) {
    console.warn('[mongo] deleteAllCampaignData - storage_files error:', e?.message || e);
  }

  // 2. Delete evidence records
  try {
    const evidenceResult = await database.collection(EVIDENCE_COLLECTION).deleteMany({ campaign_id: campaignId });
    console.log(`[mongo] Deleted ${evidenceResult.deletedCount} evidence records`);
  } catch (e) {
    console.warn('[mongo] deleteAllCampaignData - evidence error:', e?.message || e);
  }

  // 3. Delete drivers
  try {
    const driversResult = await database.collection(DRIVERS_COLLECTION).deleteMany({ campaign_id: campaignId });
    console.log(`[mongo] Deleted ${driversResult.deletedCount} drivers`);
  } catch (e) {
    console.warn('[mongo] deleteAllCampaignData - drivers error:', e?.message || e);
  }

  // 4. Delete graphics
  try {
    const graphicsResult = await database.collection(GRAPHICS_COLLECTION).deleteMany({ campaign_id: campaignId });
    console.log(`[mongo] Deleted ${graphicsResult.deletedCount} graphics`);
  } catch (e) {
    console.warn('[mongo] deleteAllCampaignData - graphics error:', e?.message || e);
  }

  // 5. Delete campaign record
  try {
    const campaignResult = await database.collection(CAMPAIGNS_COLLECTION).deleteOne({ _id: campaignId });
    console.log(`[mongo] Deleted ${campaignResult.deletedCount} campaign record`);
  } catch (e) {
    console.warn('[mongo] deleteAllCampaignData - campaign error:', e?.message || e);
  }

  console.log(`[mongo] Campaign ${campaignId} deletion complete`);
}

export async function deleteMasterByDriver(campaign, driverId) {
  if (!campaign || !driverId) return;
  const database = await getDb();
  const tableName = getCampaignTableName(campaign);
  try {
    await database.collection(tableName).deleteOne({ _id: driverId });
  } catch (e) {
    console.warn('[mongo] deleteMasterByDriver error:', e?.message || e);
  }
}

export async function ensureDatabaseSchema() {
  // MongoDB doesn't require explicit schema creation
  // Collections are created on first insert
  return { created: true };
}

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string') return new ObjectId(id);
  throw new Error('ObjectId invalido');
}

export async function getStorageFileMetadata(fileId) {
  const database = await getDb();
  const _id = toObjectId(fileId);
  return database.collection(STORAGE_COLLECTION).findOne({ _id });
}

export async function openStorageFileStream(fileId) {
  const bucket = await getBucket();
  const _id = toObjectId(fileId);
  return bucket.openDownloadStream(_id);
}

export async function findDriverByIdentityMongo({ name, phone }) {
  const database = await getDb();
  const normalizedName = normalizeName(String(name || ''));
  const phoneDigits = sanitizeDigits(phone);
  const query = {};
  if (normalizedName) query.name_key = normalizedName;
  if (phoneDigits) query.phone_digits = { $in: Array.from(buildPhoneVariants(phoneDigits)) };
  if (!Object.keys(query).length) return null;

  let docs = await database.collection(DRIVERS_COLLECTION).find(query).limit(20).toArray();
  if (!docs.length && normalizedName) {
    docs = await database.collection(DRIVERS_COLLECTION).find({ name_key: normalizedName }).limit(5).toArray();
  }
  if (!docs.length) return null;

  let match = docs.find(doc => (phoneDigits ? phoneMatchesStored(doc.phone_digits, phoneDigits) : true));
  if (!match) match = docs[0];
  if (!match) return null;

  return {
    id: match._id,
    campaignId: match.campaign_id,
    name: match.name || '',
    nameKey: match.name_key || normalizeName(String(match.name || '')),
    phone: match.phone || null,
    phoneDigits: match.phone_digits || null,
    status: match.status || '',
    createdAt: match.created_at ? new Date(match.created_at).getTime() : null,
    updatedAt: match.updated_at ? new Date(match.updated_at).getTime() : null,
  };
}

export async function getCampaignRecordById(campaignId) {
  if (!campaignId) return null;
  const database = await getDb();
  const doc = await database.collection(CAMPAIGNS_COLLECTION).findOne({ _id: campaignId });
  if (!doc) return null;
  return {
    id: doc._id,
    name: doc.name || '',
    client: doc.client || '',
    period: doc.period || '',
    status: doc.status || '',
    campaignCode: doc.campaign_code || '',
    sheetId: doc.sheet_id || null,
    sheetName: doc.sheet_name || null,
    driveFolderId: doc.drive_folder_id || null,
    createdAt: doc.created_at ? new Date(doc.created_at).getTime() : null,
    updatedAt: doc.updated_at ? new Date(doc.updated_at).getTime() : null,
  };
}

export async function findCampaignByCodeMongo(campaignCode) {
  if (!campaignCode) return null;
  const database = await getDb();
  const doc = await database.collection(CAMPAIGNS_COLLECTION).findOne({ campaign_code: campaignCode });
  if (!doc) return null;
  return {
    id: doc._id,
    name: doc.name || '',
    client: doc.client || '',
    period: doc.period || '',
    status: doc.status || '',
    campaignCode: doc.campaign_code || campaignCode,
    sheetId: doc.sheet_id || null,
    sheetName: doc.sheet_name || null,
    driveFolderId: doc.drive_folder_id || null,
    createdAt: doc.created_at ? new Date(doc.created_at).getTime() : null,
    updatedAt: doc.updated_at ? new Date(doc.updated_at).getTime() : null,
  };
}

export async function listCampaignGraphicsRecords(campaign) {
  if (!campaign) return [];
  const database = await getDb();
  const tableName = getCampaignGraphicsTableName(campaign);
  try {
    const docs = await database.collection(tableName).find({}).toArray();
    return docs;
  } catch (err) {
    console.warn('[mongo] listCampaignGraphicsRecords error:', err?.message || err);
    return [];
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findDriverRowInMasterTables({ name, phone }) {
  const normalizedName = normalizeName(String(name || ''));
  const phoneDigits = sanitizeDigits(phone);
  if (!normalizedName || !phoneDigits) return null;

  const database = await getDb();
  const campaignDocs = await database
    .collection(CAMPAIGNS_COLLECTION)
    .find({}, { projection: { _id: 1, name: 1 } })
    .toArray();

  const sources = campaignDocs.map(doc => ({
    tableName: getCampaignTableName({ id: doc._id, name: doc.name }),
    campaignId: doc._id,
    campaignName: doc.name || '',
  }));

  const seenTables = new Set(sources.map(src => src.tableName));
  try {
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    for (const coll of collections) {
      const collectionName = coll.name;
      if (!collectionName.startsWith('campanha_')) continue;
      if (seenTables.has(collectionName)) continue;
      const readable = collectionName.replace(/^campanha_/, '').replace(/_/g, ' ');
      sources.push({ tableName: collectionName, campaignId: null, campaignName: readable });
      seenTables.add(collectionName);
    }
  } catch {
    // ignore listCollections errors (older Mongo clusters)
  }

  const regex = new RegExp(`^${escapeRegex(String(name || '').trim())}$`, 'i');
  const nameFields = ['Nome', 'NOME', 'nome', 'Motorista'];

  for (const source of sources) {
    let rows = [];
    try {
      const query = { $or: nameFields.map(field => ({ [field]: { $regex: regex } })) };
      rows = await database
        .collection(source.tableName)
        .find(query, {
          projection: {
            _id: 1,
            id: 1,
            'DRIVER ID': 1,
            Nome: 1,
            NOME: 1,
            nome: 1,
            Motorista: 1,
            Status: 1,
            status: 1,
            Numero: 1,
            'Numero ': 1,
            'Número': 1,
            'NÚMERO': 1,
            Telefone: 1,
            telefone: 1,
            Celular: 1,
            CELULAR: 1,
            WhatsApp: 1,
            CPF: 1,
            cpf: 1,
            Email: 1,
            EMAIL: 1,
            email: 1,
            Placa: 1,
            PLACA: 1,
            placa: 1,
            PIX: 1,
            Pix: 1,
            pix: 1,
            Cidade: 1,
            cidade: 1,
            'CAMPANHA ID': 1,
            'CAMPANHA NOME': 1,
          },
        })
        .limit(8)
        .toArray();
    } catch {
      rows = [];
    }

    for (const row of rows) {
      const rowName =
        String(row.Nome || row.NOME || row.nome || row.Motorista || '').trim();
      if (!rowName || normalizeName(rowName) !== normalizedName) continue;
      const phoneRaw =
        row.Numero ||
        row['Numero '] ||
        row['Número'] ||
        row['NÚMERO'] ||
        row.Telefone ||
        row.telefone ||
        row.Celular ||
        row.CELULAR ||
        row.WhatsApp ||
        '';
      if (!phoneMatchesStored(sanitizeDigits(phoneRaw), phoneDigits)) continue;

      return {
        campaignId: row['CAMPANHA ID'] || source.campaignId,
        campaignName: row['CAMPANHA NOME'] || source.campaignName || '',
        row,
        driverId: row.id || row._id || row['DRIVER ID'] || null,
      };
    }
  }

  return null;
}

// Graphics (gráficas) management
const GRAPHIC_COLUMNS = [
  'GRAFICA NOME',
  'GRAFICA EMAIL',
  'GRAFICA TELEFONE',
  'RESPONSAVEL 1 NOME',
  'RESPONSAVEL 1 TELEFONE',
  'RESPONSAVEL 2 NOME',
  'RESPONSAVEL 2 TELEFONE',
  'OBSERVACOES',
];

export async function ensureCampaignGraphicsTable(campaign, columns = GRAPHIC_COLUMNS) {
  const tableName = getCampaignGraphicsTableName(campaign);
  const database = await getDb();
  try {
    await database.collection(tableName).createIndex({ id: 1 }, { unique: true });
  } catch (e) {
    // index may exist
  }
  return { created: true, tableName };
}

export async function upsertCampaignGraphicsRows(campaign, graphics = []) {
  const database = await getDb();
  const tableName = getCampaignGraphicsTableName(campaign);
  const campFolder = `campanha-${sanitizeName(campaign?.name || campaign?.id)}`;

  const rows = (graphics || []).map(g => ({
    _id: g.id,
    id: g.id,
    'CAMPANHA ID': campaign.id,
    'CAMPANHA NOME': campaign.name || '',
    'CAMPANHA PASTA': campFolder,
    'GRAFICA NOME': g.name || '',
    'GRAFICA EMAIL': g.email || '',
    'GRAFICA TELEFONE': g.phone || '',
    'RESPONSAVEL 1 NOME': g.responsible1Name || '',
    'RESPONSAVEL 1 TELEFONE': g.responsible1Phone || '',
    'RESPONSAVEL 2 NOME': g.responsible2Name || '',
    'RESPONSAVEL 2 TELEFONE': g.responsible2Phone || '',
    'OBSERVACOES': g.notes || '',
  }));

  if (!rows.length) return { inserted: 0, tableName };

  const coll = database.collection(tableName);
  for (const row of rows) {
    await coll.replaceOne({ _id: row._id }, row, { upsert: true });
  }

  return { inserted: rows.length, tableName };
}

export async function deleteCampaignGraphicsTable(campaign) {
  if (!campaign) return;
  const database = await getDb();
  const tableName = getCampaignGraphicsTableName(campaign);
  try {
    await database.collection(tableName).deleteMany({});
  } catch (e) {
    console.warn('[mongo] deleteCampaignGraphicsTable error:', e?.message || e);
  }
}

export async function deleteGraphicRow(campaign, graphicId) {
  if (!campaign || !graphicId) return;
  const database = await getDb();
  const tableName = getCampaignGraphicsTableName(campaign);
  try {
    await database.collection(tableName).deleteOne({ _id: graphicId });
  } catch (e) {
    console.warn('[mongo] deleteGraphicRow error:', e?.message || e);
  }
}

// ==================== ADMIN USERS ====================

export async function findAdminUserByUsername(username) {
  const database = await getDb();
  const col = database.collection(ADMIN_USERS_COLLECTION);
  const user = await col.findOne({ username: String(username).toLowerCase().trim() });
  return user;
}

export async function createAdminUser(userData) {
  const database = await getDb();
  const col = database.collection(ADMIN_USERS_COLLECTION);
  const doc = {
    username: String(userData.username).toLowerCase().trim(),
    passwordHash: userData.passwordHash,
    name: userData.name || userData.username,
    email: userData.email || null,
    role: userData.role || 'admin',
    active: userData.active !== false,
    createdAt: Date.now(),
    createdBy: userData.createdBy || 'system',
    updatedAt: Date.now(),
  };
  const result = await col.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function listAdminUsers() {
  const database = await getDb();
  const col = database.collection(ADMIN_USERS_COLLECTION);
  const users = await col.find({}).sort({ createdAt: -1 }).toArray();
  return users;
}

export async function updateAdminUser(userId, updates) {
  const database = await getDb();
  const col = database.collection(ADMIN_USERS_COLLECTION);
  const updateDoc = { $set: { ...updates, updatedAt: Date.now() } };
  await col.updateOne({ _id: new ObjectId(userId) }, updateDoc);
}

// ==================== AUDIT LOG ====================

export async function insertAuditLog(logEntry) {
  const database = await getDb();
  const col = database.collection(AUDIT_LOG_COLLECTION);
  const doc = {
    userId: logEntry.userId ? new ObjectId(logEntry.userId) : null,
    username: logEntry.username || 'unknown',
    name: logEntry.name || logEntry.username || 'Unknown',
    action: logEntry.action || 'unknown',
    entityType: logEntry.entityType || null,
    entityId: logEntry.entityId || null,
    details: logEntry.details || {},
    ipAddress: logEntry.ipAddress || null,
    userAgent: logEntry.userAgent || null,
    timestamp: logEntry.timestamp || Date.now(),
    success: logEntry.success !== false,
  };
  const result = await col.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function listAuditLogs(filters = {}, options = {}) {
  const database = await getDb();
  const col = database.collection(AUDIT_LOG_COLLECTION);
  const query = {};
  
  if (filters.username) query.username = filters.username;
  if (filters.action) query.action = filters.action;
  if (filters.entityType) query.entityType = filters.entityType;
  if (filters.entityId) query.entityId = filters.entityId;
  if (filters.startDate) query.timestamp = { $gte: filters.startDate };
  if (filters.endDate) query.timestamp = { ...query.timestamp, $lte: filters.endDate };
  
  const limit = options.limit || 100;
  const skip = options.skip || 0;
  
  const logs = await col.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  
  return logs;
}

// ============================================
// REPRESENTATIVE REQUESTS (Solicitações)
// ============================================

export async function createRepresentativeRequest(requestData) {
  const database = await getDb();
  const now = new Date();
  const doc = {
    ...requestData,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database.collection(REPRESENTATIVE_REQUESTS_COLLECTION).insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function listRepresentativeRequests() {
  const database = await getDb();
  const requests = await database
    .collection(REPRESENTATIVE_REQUESTS_COLLECTION)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return requests;
}

export async function getRepresentativeRequestById(requestId) {
  const database = await getDb();
  const request = await database
    .collection(REPRESENTATIVE_REQUESTS_COLLECTION)
    .findOne({ id: requestId });
  return request;
}

export async function updateRepresentativeRequestStatus(requestId, status) {
  const database = await getDb();
  const result = await database
    .collection(REPRESENTATIVE_REQUESTS_COLLECTION)
    .updateOne(
      { id: requestId },
      { 
        $set: { 
          status, 
          updatedAt: new Date() 
        } 
      }
    );
  if (result.matchedCount === 0) {
    throw new Error('Solicitação não encontrada');
  }
  return await getRepresentativeRequestById(requestId);
}

export async function updateRepresentativeRequest(requestId, updates) {
  const database = await getDb();
  const result = await database
    .collection(REPRESENTATIVE_REQUESTS_COLLECTION)
    .updateOne(
      { id: requestId },
      { 
        $set: { 
          ...updates,
          updatedAt: new Date() 
        } 
      }
    );
  if (result.matchedCount === 0) {
    throw new Error('Solicitação não encontrada');
  }
  return await getRepresentativeRequestById(requestId);
}

export async function deleteRepresentativeRequest(requestId) {
  const database = await getDb();
  const result = await database
    .collection(REPRESENTATIVE_REQUESTS_COLLECTION)
    .deleteOne({ id: requestId });
  return result.deletedCount > 0;
}

export default {
  uploadBase64ImageMongo,
  getDriverStorageBasePath,
  listDriverStorageTree,
  listStorageEntriesByCampaign,
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
  getCampaignTableName,
  getCampaignGraphicsTableName,
  ensureCampaignMasterTable,
  upsertCampaignMasterRows,
  ensureCampaignGraphicsTable,
  upsertCampaignGraphicsRows,
  deleteCampaignGraphicsTable,
  deleteGraphicRow,
  getDb,
  getStorageFileMetadata,
  openStorageFileStream,
  findDriverByIdentityMongo,
  getCampaignRecordById,
  findCampaignByCodeMongo,
  listCampaignGraphicsRecords,
  findDriverRowInMasterTables,
  findAdminUserByUsername,
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  insertAuditLog,
  listAuditLogs,
  createRepresentativeRequest,
  listRepresentativeRequests,
  getRepresentativeRequestById,
  updateRepresentativeRequestStatus,
  updateRepresentativeRequest,
  deleteRepresentativeRequest,
};
