import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function isDatabaseAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

function createDb(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.warn('DATABASE_URL not set, database queries will fail');
    return {} as PostgresJsDatabase<typeof schema>;
  }
  
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export const db = createDb();

export * from './schema';
