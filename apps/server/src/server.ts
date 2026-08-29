import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';
const app = createApp();

async function closeServer(): Promise<void> {
  await app.close();
}

async function startServer(): Promise<void> {
  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void closeServer();
});

process.once('SIGTERM', () => {
  void closeServer();
});

void startServer();
