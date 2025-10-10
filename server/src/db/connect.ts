import { Db, IndexDescription, MongoClient, MongoServerError } from 'mongodb';
import { config } from '../config';

const client = new MongoClient(config.mongoUri, {
  appName: config.appName,
  maxPoolSize: 20,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  retryWrites: false,
});

let dbReady = false;
const dbMap: Record<string, Db> = {};
let connectOnce: Promise<Db> | null = null;

export function getAuthDb(): Db {
  const d = dbMap[config.authDbName];
  if (!d) throw new Error('Auth DB not ready; call connectDB() first');
  return d;
}
export function getCustomerDb(): Db {
  const d = dbMap[config.customerDbName];
  if (!d) throw new Error('Customer DB not ready; call connectDB() first');
  return d;
}

export async function connectDB(): Promise<Db> {
  if (dbReady) return getAuthDb();
  if (connectOnce) return connectOnce;

  connectOnce = (async () => {
    await client.connect();

    const authDb = client.db(config.authDbName);
    const customerDb = client.db(config.customerDbName);

    await ensureAuthIndexes(authDb);
    await ensureCustomerIndexes(customerDb);

    await authDb.command({ ping: 1 });
    await customerDb.command({ ping: 1 });

    dbMap[config.authDbName] = authDb;
    dbMap[config.customerDbName] = customerDb;
    dbReady = true;

    console.log(`✅ Connected DBs → auth="${config.authDbName}"  customer="${config.customerDbName}"`);
    return authDb;
  })();

  return connectOnce;
}

/* ---------- indexes ---------- */
async function safeEnsureIndex(
  d: Db,
  collection: string,
  keys: Record<string, 1 | -1>,
  options: Omit<IndexDescription, 'key'> & { name?: string } = {}
) {
  const coll = d.collection(collection);
  try {
    await coll.createIndex(keys, options);
  } catch (e: any) {
    const err = e as MongoServerError;
    if (err.code === 85) {
      const existing = (await coll.indexes()).find((i) => JSON.stringify(i.key) === JSON.stringify(keys));
      if (existing) {
        await coll.createIndex(keys, { ...options, name: existing.name });
        return;
      }
    }
    throw err;
  }
}

async function ensureAuthIndexes(d: Db) {
  await safeEnsureIndex(d, 'users', { email: 1 }, {
    unique: true,
    name: 'email_unique_when_present',
    partialFilterExpression: { email: { $exists: true, $type: 'string' } },
  });
  await safeEnsureIndex(d, 'users', { phone: 1 }, {
    unique: true,
    name: 'phone_unique_when_present',
    partialFilterExpression: { phone: { $exists: true, $type: 'string' } },
  });
  await safeEnsureIndex(d, 'users', { username: 1 }, { name: 'username_idx' });
}

async function ensureCustomerIndexes(d: Db) {
  await safeEnsureIndex(d, 'assistrequests', { userId: 1 }, { name: 'userId_idx' });
  await safeEnsureIndex(d, 'assistrequests', { status: 1 }, { name: 'status_idx' });
  await safeEnsureIndex(d, 'assistrequests', { createdAt: -1 }, { name: 'createdAt_idx' });
}
