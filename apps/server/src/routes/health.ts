import type { FastifyInstance } from 'fastify';

const healthResponse = {
  status: 'ok',
  service: 'dice-arena-server',
} as const;

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async () => healthResponse);
}
