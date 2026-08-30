import type { FastifyInstance } from 'fastify';
import {
  type CreateMatchCommand,
  type CreateMatchPersistence,
  createMatchUseCase,
  CreateMatchError,
} from '../application/matches/create-match';

export type CreateMatchRequestBody = {
  readonly playerAUserId: string;
  readonly playerBUserId: string;
};

export type CreateMatchResponse = {
  readonly matchId: string;
  readonly status: 'ACTIVE';
  readonly version: 0;
  readonly playerAUserId: string;
  readonly playerBUserId: string;
  readonly activePlayerId: string;
  readonly createdAt: string;
};

export type CreateMatchErrorResponse = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
};

export function registerMatchesRoutes(
  app: FastifyInstance,
  persistence: CreateMatchPersistence,
): void {
  app.post<{ Body: CreateMatchRequestBody }>(
    '/matches',
    {
      schema: {
        body: {
          type: 'object',
          required: ['playerAUserId', 'playerBUserId'],
          properties: {
            playerAUserId: { type: 'string', minLength: 1 },
            playerBUserId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { playerAUserId, playerBUserId } = request.body;

      try {
        const createdMatch = await createMatchUseCase(persistence, {
          playerAUserId,
          playerBUserId,
        } as CreateMatchCommand);

        const response: CreateMatchResponse = {
          ...createdMatch,
          createdAt: new Date().toISOString(),
        };

        return reply.code(201).send(response);
      } catch (error) {
        if (error instanceof CreateMatchError) {
          const message = error.message;

          if (message === 'Match players must be distinct') {
            return reply.code(422).send({
              error: {
                code: 'SAME_PLAYER',
                message: 'Match players must be distinct',
              },
            } as CreateMatchErrorResponse);
          }

          if (message === 'One or more players do not exist') {
            return reply.code(404).send({
              error: {
                code: 'USER_NOT_FOUND',
                message: 'One or more players do not exist',
              },
            } as CreateMatchErrorResponse);
          }

          return reply.code(400).send({
            error: {
              code: 'INVALID_REQUEST',
              message: message,
            },
          } as CreateMatchErrorResponse);
        }

        app.log.error(error, 'Unexpected error in POST /matches');
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        } as CreateMatchErrorResponse);
      }
    },
  );
}
