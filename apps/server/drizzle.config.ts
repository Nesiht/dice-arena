import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to generate migrations');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/persistence/schema/index.ts',
  out: './src/persistence/migrations',
  dbCredentials: { url: databaseUrl },
});
