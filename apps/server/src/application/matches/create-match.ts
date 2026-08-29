import { randomUUID } from 'node:crypto';

import { createMatch, type MatchState } from '@dice-arena/game-domain';

export type CreateMatchCommand = { readonly playerAUserId: string; readonly playerBUserId: string };
export type CreatedMatch = {
  readonly matchId: string;
  readonly status: 'ACTIVE';
  readonly version: 0;
  readonly playerAUserId: string;
  readonly playerBUserId: string;
  readonly activePlayerId: string;
};
export class CreateMatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreateMatchError';
  }
}
export type CreateMatchPersistence = {
  createInitialMatch(match: { readonly id: string; readonly state: MatchState }): Promise<boolean>;
};

export const createMatchUseCase = async (
  persistence: CreateMatchPersistence,
  command: CreateMatchCommand,
): Promise<CreatedMatch> => {
  if (!command.playerAUserId || !command.playerBUserId)
    throw new CreateMatchError('Both players are required');
  if (command.playerAUserId === command.playerBUserId)
    throw new CreateMatchError('Match players must be distinct');
  const matchId = randomUUID();
  const state = createMatch(command.playerAUserId, command.playerBUserId);
  if (!(await persistence.createInitialMatch({ id: matchId, state })))
    throw new CreateMatchError('One or more players do not exist');
  return {
    matchId,
    status: 'ACTIVE',
    version: 0,
    playerAUserId: state.playerAId,
    playerBUserId: state.playerBId,
    activePlayerId: state.activePlayerId,
  };
};
