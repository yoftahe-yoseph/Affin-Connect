import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

const { Pool } = pg;

declare global {
  var _postgresPool: pg.Pool | undefined;
}

export function isSqlConfigured(): boolean {
  return Boolean(
    process.env.SQL_HOST &&
      process.env.SQL_DB_NAME &&
      process.env.SQL_USER
  );
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 5000,
    });

    global._postgresPool.on('error', (err) => {
      if (isSqlConfigured()) {
        console.warn('Idle SQL pool notice:', err.message);
      }
    });
  }
  return global._postgresPool;
};

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
let cachedDb: DrizzleDb | null = null;

export function getDb(): DrizzleDb {
  if (!cachedDb) {
    cachedDb = drizzle(createPool(), { schema });
  }
  return cachedDb;
}

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
