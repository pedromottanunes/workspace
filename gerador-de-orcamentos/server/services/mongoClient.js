const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || '';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'odrive_app';
const REPRESENTATIVE_REQUESTS_COLLECTION = 'representative_requests';
const PROPOSALS_COLLECTION = 'proposals';

let client = null;
let db = null;

async function getDb() {
  if (!db) {
    if (!MONGO_URI) {
      throw new Error('MongoDB não configurado (defina MONGO_URI no .env)');
    }
    
    const mongoOptions = {
      // Timeouts aumentados para lidar com cold starts e conexões lentas
      serverSelectionTimeoutMS: 30000,  // 30s (era 10s)
      socketTimeoutMS: 60000,            // 60s (era 30s)
      connectTimeoutMS: 30000,           // 30s (era 10s)
      // Connection pooling para reutilizar conexões
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
      // Keep-alive para detectar conexões mortas
      keepAlive: true,
      keepAliveInitialDelay: 30000,
      // Retry automático de writes
      retryWrites: true,
      retryReads: true,
    };
    
    console.log('[MongoDB] Conectando ao banco de dados...');
    try {
      client = new MongoClient(MONGO_URI, mongoOptions);
      await client.connect();
      db = client.db(MONGO_DB_NAME);
      console.log('[MongoDB] ✅ Conectado com sucesso ao banco:', MONGO_DB_NAME);
      
      // Event listeners para monitorar conexão
      client.on('error', (err) => {
        console.error('[MongoDB] ❌ Erro na conexão:', err.message);
      });
      client.on('close', () => {
        console.warn('[MongoDB] ⚠️ Conexão fechada');
      });
      client.on('reconnect', () => {
        console.log('[MongoDB] 🔄 Reconectado');
      });
    } catch (error) {
      console.error('[MongoDB] ❌ Falha ao conectar:', error.message);
      throw error;
    }
  }
  return db;
}

async function createRepresentativeRequest(requestData) {
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

async function listRepresentativeRequests() {
  const database = await getDb();
  const requests = await database
    .collection(REPRESENTATIVE_REQUESTS_COLLECTION)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return requests;
}

async function getRepresentativeRequestById(requestId) {
  const database = await getDb();
  const request = await database
    .collection(REPRESENTATIVE_REQUESTS_COLLECTION)
    .findOne({ id: requestId });
  return request;
}

async function updateRepresentativeRequestStatus(requestId, status) {
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

async function updateRepresentativeRequest(requestId, updates) {
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

async function deleteRepresentativeRequest(requestId) {
  const database = await getDb();
  const result = await database
    .collection(REPRESENTATIVE_REQUESTS_COLLECTION)
    .deleteOne({ id: requestId });
  return result.deletedCount > 0;
}

// ============================================
// CRUD para Proposals (Orçamentos)
// ============================================

async function createProposal(proposalData) {
  const database = await getDb();
  const now = new Date();
  const doc = {
    ...proposalData,
    id: proposalData?.id || Date.now().toString(),
    createdAt: now,
    updatedAt: now,
    status: proposalData?.status || 'draft',
  };
  const result = await database.collection(PROPOSALS_COLLECTION).insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function listProposals() {
  const database = await getDb();
  const proposals = await database
    .collection(PROPOSALS_COLLECTION)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  return proposals;
}

async function getProposalById(proposalId) {
  const database = await getDb();
  const proposal = await database
    .collection(PROPOSALS_COLLECTION)
    .findOne({ id: proposalId });
  return proposal;
}

async function updateProposal(proposalId, updates) {
  const database = await getDb();
  const result = await database
    .collection(PROPOSALS_COLLECTION)
    .updateOne(
      { id: proposalId },
      { 
        $set: { 
          ...updates,
          updatedAt: new Date() 
        } 
      }
    );
  if (result.matchedCount === 0) {
    throw new Error('Proposta não encontrada');
  }
  return await getProposalById(proposalId);
}

async function deleteProposal(proposalId) {
  const database = await getDb();
  const result = await database
    .collection(PROPOSALS_COLLECTION)
    .deleteOne({ id: proposalId });
  return result.deletedCount > 0;
}

module.exports = {
  getDb,
  createRepresentativeRequest,
  listRepresentativeRequests,
  getRepresentativeRequestById,
  updateRepresentativeRequestStatus,
  updateRepresentativeRequest,
  deleteRepresentativeRequest,
  // Proposals
  createProposal,
  listProposals,
  getProposalById,
  updateProposal,
  deleteProposal,
};
