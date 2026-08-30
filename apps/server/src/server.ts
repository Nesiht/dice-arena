import { createApp } from './app';
import { getRequiredDatabaseUrl } from './config/database';
import { createPersistenceClient } from './persistence/db/client';
import { createCreateMatchPersistence } from './persistence/adapters/create-match-persistence';

const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

async function main(): Promise<void> {
  const databaseUrl = getRequiredDatabaseUrl('DATABASE_URL');
  const persistenceClient = createPersistenceClient(databaseUrl);
  const createMatchPersistence = createCreateMatchPersistence(persistenceClient.sqlClient);
  const app = createApp({ createMatchPersistence });

  const closeAll = async (): Promise<void> => {
    await app.close();
    await persistenceClient.close();
  };

  process.once('SIGINT', () => {
    void closeAll().finally(() => process.exit(0));
  });

  process.once('SIGTERM', () => {
    void closeAll().finally(() => process.exit(0));
  });

  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    await closeAll();
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error('Fatal error during server startup:', error);
  process.exitCode = 1;
});
