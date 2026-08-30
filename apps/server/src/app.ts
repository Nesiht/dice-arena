import Fastify, { type FastifyInstance } from 'fastify';

import { registerHealthRoute } from './routes/health';
import { registerMatchesRoutes } from './routes/matches';
import type { CreateMatchPersistence } from './application/matches/create-match';

export interface AppDependencies {
  readonly createMatchPersistence?: CreateMatchPersistence;
}

export function createApp(dependencies?: AppDependencies): FastifyInstance {
  const app = Fastify();

  registerHealthRoute(app);

  if (dependencies?.createMatchPersistence) {
    registerMatchesRoutes(app, dependencies.createMatchPersistence);
  }

  return app;
}
