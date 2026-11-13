import 'server-only';
import { MongoClient } from 'mongodb';

// One pool per server process, including Next development reloads. Never connect
// during import, expose the URI, or create collections/indexes automatically.
const shared = globalThis as typeof globalThis & { propbankMongo?: Promise<MongoClient> };
export async function getMobileMongo() {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_MOBILE_DATABASE;
  if (process.env.NODE_ENV === 'production' && database !== 'propbank_mobile_registry') throw new Error('MONGODB_PRODUCTION_DATABASE_REQUIRED');
  if (!uri || !database || !/^[a-zA-Z0-9_-]+$/.test(database)) throw new Error('MONGODB_MOBILE_CONFIGURATION_REQUIRED');
  if (!shared.propbankMongo) {
    const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
    shared.propbankMongo = client.connect().catch(async () => {
      shared.propbankMongo = undefined;
      await client.close().catch(() => {});
      throw new Error('MONGODB_MOBILE_UNAVAILABLE');
    });
  }
  return { client: await shared.propbankMongo, db: (await shared.propbankMongo).db(database) };
}
