import { createMatch } from '@dice-arena/game-domain';

import {
  PersistedMatchStateError,
  toDomainMatchState,
  toPersistedMatchState,
} from '../src/persistence/mappers/match-state-mapper';
import { toSafeInteger } from '../src/persistence/repositories/match-repository';

describe('MatchState persistence mapper', () => {
  it('round-trips a JSON-compatible active MatchState without mutation', () => {
    const domainState = createMatch('player-a', 'player-b');
    const persisted = toPersistedMatchState(domainState);
    const restored = toDomainMatchState(1, JSON.parse(JSON.stringify(persisted)));

    expect(restored).toEqual(domainState);
    expect(restored).not.toBe(domainState);
  });

  it('rejects an unsupported persisted state schema version', () => {
    expect(() => toDomainMatchState(999, {})).toThrow(PersistedMatchStateError);
  });

  it('round-trips a completed MatchState and rejects malformed stored state', () => {
    const active = createMatch('player-a', 'player-b');
    const completed = {
      ...active,
      status: 'COMPLETED' as const,
      finalResult: {
        playerAId: 'player-a',
        playerAFinalScore: 10,
        playerAResult: 'WIN' as const,
        playerBId: 'player-b',
        playerBFinalScore: 5,
        playerBResult: 'LOSS' as const,
      },
    };
    expect(toDomainMatchState(1, toPersistedMatchState(completed))).toEqual(completed);
    expect(() => toDomainMatchState(1, { status: 'ACTIVE' })).toThrow(PersistedMatchStateError);
  });

  it('converts only safe PostgreSQL BIGINT values', () => {
    expect(toSafeInteger('9007199254740991', 'version')).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => toSafeInteger('9007199254740992', 'version')).toThrow('safe integer');
    expect(() => toSafeInteger('invalid', 'version')).toThrow('safe integer');
  });
});
