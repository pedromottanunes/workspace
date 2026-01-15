const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || '';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'odrive_app';
const REPRESENTATIVE_REQUESTS_COLLECTION = 'representative_requests';

let client = null;
let db = null;

async function getDb() {
  if (!db) {
    if (!MONGO_URI) {
      throw new Error('MongoDB não configurado (defina MONGO_URI no .env)');
    }
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    db = client.db(MONGO_DB_NAME);
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

module.exports = {
  getDb,
  createRepresentativeRequest,
  listRepresentativeRequests,
  getRepresentativeRequestById,
  updateRepresentativeRequestStatus,
  updateRepresentativeRequest,
  deleteRepresentativeRequest,
};
