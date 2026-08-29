import Fastify, { type FastifyInstance } from 'fastify';

import { registerHealthRoute } from './routes/health';

export function createApp(): FastifyInstance {
  const app = Fastify();

  registerHealthRoute(app);

  return app;
}
