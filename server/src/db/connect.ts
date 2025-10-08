import { MongoClient, Db, MongoServerError, IndexDescription } from 'mongodb';
import { config } from '../config';

if (!config.mongoUri) throw new Error('MONGODB_URI is missing');
if (!config.dbName) throw new Error('DB name is missing');

const client = new MongoClient(config.mongoUri, {
  appName: config.appName,
  maxPoolSize: 20,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  retryWrites: false,
});

let db: Db | undefined;
let connectOnce: Promise<Db> | null = null;
let dbReady = false;

export function isDbReady() {
  return dbReady;
}

export async function connectDB(): Promise<Db> {
  if (db) return db;
  if (connectOnce) return connectOnce;

  connectOnce = (async () => {
    await client.connect();
    const d = client.db(config.dbName);

    // --- Ensure indexes safely ---
    await ensureIndexes(d);

    // confirm connectivity
    await d.command({ ping: 1 });

    dbReady = true;
    db = d;
    console.log(`✅ DB connected & ready → ${config.dbName}`);
    return d;
  })();

  try {
    return await connectOnce;
  } catch (err) {
    connectOnce = null; // allow retry on next call
    throw err;
  }
}

export async function ping(): Promise<boolean> {
  try {
    const d = await connectDB();
    const res = await d.command({ ping: 1 });
    return res.ok === 1;
  } catch {
    return false;
  }
}

/**
 * Create/align an index without crashing on:
 * - 11000 (duplicate key while building unique) → make error actionable
 * - 85 (IndexOptionsConflict) → reuse existing name or reconcile
 */
async function safeEnsureIndex(
  d: Db,
  collection: string,
  keys: Record<string, 1 | -1>,
  options: Omit<IndexDescription, 'key'> & { name?: string } = {}
) {
  const coll = d.collection(collection);

  try {
    await coll.createIndex(keys, options);
    return;
  } catch (e: any) {
    const err = e as MongoServerError;

    // Duplicate data while building unique index
    if (err.code === 11000) {
      const requestedName = options?.name || `${JSON.stringify(keys)}`;
      err.message =
        `E11000 duplicate key while creating unique index "${requestedName}" on "${collection}". ` +
        `There are existing documents violating the unique constraint. Clean duplicates, then retry.`;
      throw err;
    }

    // Index exists with a different name/options
    if (err.code === 85) {
      const existing = (await coll.indexes()).find(
        (idx) => JSON.stringify(idx.key) === JSON.stringify(keys)
      );
      if (!existing) throw err;

      const desiredUnique = !!(options as any)?.unique;
      const existingUnique = !!existing.unique;

      if (desiredUnique === existingUnique) {
        // Reattempt with the existing name to avoid conflict
        await coll.createIndex(keys, { ...options, name: existing.name });
        return;
      }

      // Changing uniqueness → must drop & recreate (ensure no duplicates first!)
      console.warn(
        `⚠️ Changing uniqueness for index on ${collection} ${JSON.stringify(
          keys
        )} from ${existingUnique} → ${desiredUnique}. Dropping "${existing.name}" and recreating.`
      );
      await coll.dropIndex(existing.name);
      await coll.createIndex(keys, options);
      return;
    }

    // Some older Mongo versions can throw code 67 (CannotCreateIndex) for unsupported partial expressions.
    throw err;
  }
}

async function ensureIndexes(d: Db) {
  // email: must be unique; let Mongo reuse existing name (e.g., email_1)
  await safeEnsureIndex(d, 'users', { email: 1 }, { unique: true });

  // phone: unique only when present & a string.
  // NOTE: No `$ne: ""` (older Mongo rejects `$not/$ne` in partial indexes).
  await safeEnsureIndex(d, 'users', { phone: 1 }, {
    unique: true,
    name: 'phone_unique_when_present',
    partialFilterExpression: {
      phone: { $exists: true, $type: 'string' },
    },
  });

  // username: non-unique (plain index)
  await safeEnsureIndex(d, 'users', { username: 1 }, { unique: false, name: 'username_idx' });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await client.close();
    console.log('🛑 Mongo client closed');
  } finally {
    process.exit(0);
  }
});
