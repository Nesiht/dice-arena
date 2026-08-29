import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '../schema';

export function createPersistenceClient(connectionString: string) {
  const sqlClient = postgres(connectionString, { max: 10, onnotice: () => undefined });
  const db = drizzle(sqlClient, { schema });

  return {
    db,
    sqlClient,
    close: (): Promise<void> => sqlClient.end({ timeout: 5 }),
  };
}
