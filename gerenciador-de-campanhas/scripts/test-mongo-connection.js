#!/usr/bin/env node
import 'dotenv/config';
import { MongoClient } from 'mongodb';

function getEnv(name, fallback = '') {
  const v = process.env[name];
  return (typeof v === 'string' && v.trim()) ? v.trim() : fallback;
}

const MONGO_URI = getEnv('MONGO_URI');
const MONGO_DB_NAME = getEnv('MONGO_DB_NAME', 'odrive_app');

async function main() {
  if (!MONGO_URI) {
    console.error('MONGO_URI não definido. Coloque no .env ou em $env:MONGO_URI e tente novamente.');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log(`[test] ✅ Conectado ao MongoDB`);
    const db = client.db(MONGO_DB_NAME);
    const cols = await db.listCollections().toArray();
    console.log('[test] Collections em', MONGO_DB_NAME, ':', cols.map(c => c.name));
  } catch (err) {
    console.error('[test] ❌ Erro conectando:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.close();
  }
}

main();
