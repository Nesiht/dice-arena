import { randomUUID } from 'node:crypto';

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createMatch } from '@dice-arena/game-domain';

import { getRequiredDatabaseUrl } from '../../src/config/database';
import { CreateMatchError, createMatchUseCase } from '../../src/application/matches/create-match';
import { createPersistenceClient } from '../../src/persistence/db/client';
import { createCreateMatchPersistence } from '../../src/persistence/adapters/create-match-persistence';
import { withTransaction } from '../../src/persistence/db/transaction';
import {
  ConcurrencyConflictError,
  createMatchRecord,
  createUser,
  DuplicateActionError,
  appendEvents,
  loadEvents,
  loadMatch,
  loadMatchForMutation,
  saveMatch,
  storeAcceptedAction,
} from '../../src/persistence/repositories/match-repository';

const testDatabaseUrl = getRequiredDatabaseUrl('TEST_DATABASE_URL');
const parsedUrl = new URL(testDatabaseUrl);
if (parsedUrl.pathname !== '/dice_arena_test')
  throw new Error('Persistence integration tests require database dice_arena_test');

const client = createPersistenceClient(testDatabaseUrl);
const makeMatch = () => {
  const playerAId = randomUUID();
  const playerBId = randomUUID();
  return { id: randomUUID(), playerAId, playerBId, state: createMatch(playerAId, playerBId) };
};
const countRows = async (tableName: 'matches' | 'match_participants'): Promise<number> => {
  const [row] = await client.sqlClient<
    { count: number }[]
  >`SELECT COUNT(*)::int AS count FROM ${client.sqlClient(tableName)}`;
  return row?.count ?? 0;
};

beforeAll(async () => {
  await migrate(client.db, { migrationsFolder: 'src/persistence/migrations' });
});
beforeEach(async () => {
  await client.sqlClient.unsafe(
    'TRUNCATE match_events, match_actions, match_participants, matches, users',
  );
});
afterAll(async () => {
  await client.close();
});

describe('Match repository with PostgreSQL', () => {
  it('creates an active match through the CreateMatch application path', async () => {
    const playerAId = randomUUID();
    const playerBId = randomUUID();
    await withTransaction(client.sqlClient, async (transaction) => {
      await createUser(transaction, playerAId, 'A');
      await createUser(transaction, playerBId, 'B');
    });
    const result = await createMatchUseCase(createCreateMatchPersistence(client.sqlClient), {
      playerAUserId: playerAId,
      playerBUserId: playerBId,
    });
    await withTransaction(client.sqlClient, async (transaction) => {
      const match = await loadMatch(transaction, result.matchId);
      expect(match).toMatchObject({ status: 'ACTIVE', version: 0 });
      expect(match?.state).toEqual(createMatch(playerAId, playerBId));
      expect(match?.state.activePlayerId).toBe(playerAId);
      expect(
        (
          await transaction`SELECT seat, result, final_score FROM match_participants WHERE match_id = ${result.matchId} ORDER BY seat`
        ).map((row) => row.seat),
      ).toEqual(['A', 'B']);
    });
  });

  it('rolls back the CreateMatch application path when persistence fails after match insert', async () => {
    const playerAId = randomUUID();
    const playerBId = randomUUID();
    await withTransaction(client.sqlClient, async (transaction) => {
      await createUser(transaction, playerAId, 'A');
      await createUser(transaction, playerBId, 'B');
    });
    await client.sqlClient.unsafe(`
      CREATE OR REPLACE FUNCTION fail_create_match_participants_for_test()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'forced create match persistence rollback';
      END;
      $$;

      CREATE TRIGGER fail_create_match_participants_for_test
      BEFORE INSERT ON match_participants
      FOR EACH STATEMENT
      EXECUTE FUNCTION fail_create_match_participants_for_test();
    `);

    try {
      await expect(
        createMatchUseCase(createCreateMatchPersistence(client.sqlClient), {
          playerAUserId: playerAId,
          playerBUserId: playerBId,
        }),
      ).rejects.toThrow('forced create match persistence rollback');
    } finally {
      await client.sqlClient.unsafe(`
        DROP TRIGGER IF EXISTS fail_create_match_participants_for_test ON match_participants;
        DROP FUNCTION IF EXISTS fail_create_match_participants_for_test();
      `);
    }

    expect(await countRows('matches')).toBe(0);
    expect(await countRows('match_participants')).toBe(0);
  });

  it('rejects a CreateMatch request with the same player twice without writing rows', async () => {
    const playerId = randomUUID();
    await withTransaction(client.sqlClient, async (transaction) => {
      await createUser(transaction, playerId, 'A');
    });

    await expect(
      createMatchUseCase(createCreateMatchPersistence(client.sqlClient), {
        playerAUserId: playerId,
        playerBUserId: playerId,
      }),
    ).rejects.toThrow(CreateMatchError);

    expect(await countRows('matches')).toBe(0);
    expect(await countRows('match_participants')).toBe(0);
  });

  it('rejects a CreateMatch request when player A is missing without writing rows', async () => {
    const playerAId = randomUUID();
    const playerBId = randomUUID();
    await withTransaction(client.sqlClient, async (transaction) => {
      await createUser(transaction, playerBId, 'B');
    });

    await expect(
      createMatchUseCase(createCreateMatchPersistence(client.sqlClient), {
        playerAUserId: playerAId,
        playerBUserId: playerBId,
      }),
    ).rejects.toThrow(CreateMatchError);

    expect(await countRows('matches')).toBe(0);
    expect(await countRows('match_participants')).toBe(0);
  });

  it('rejects a CreateMatch request when player B is missing without writing rows', async () => {
    const playerAId = randomUUID();
    const playerBId = randomUUID();
    await withTransaction(client.sqlClient, async (transaction) => {
      await createUser(transaction, playerAId, 'A');
    });

    await expect(
      createMatchUseCase(createCreateMatchPersistence(client.sqlClient), {
        playerAUserId: playerAId,
        playerBUserId: playerBId,
      }),
    ).rejects.toThrow(CreateMatchError);

    expect(await countRows('matches')).toBe(0);
    expect(await countRows('match_participants')).toBe(0);
  });

  it('commits a locked, guarded state update with events and action atomically', async () => {
    const match = makeMatch();
    await withTransaction(client.sqlClient, async (transaction) => {
      await createUser(transaction, match.playerAId, 'A');
      await createUser(transaction, match.playerBId, 'B');
      await createMatchRecord(transaction, match);
    });
    await withTransaction(client.sqlClient, async (transaction) => {
      const locked = await loadMatchForMutation(transaction, match.id);
      expect(locked?.version).toBe(0);
      const version = await saveMatch(transaction, match.id, 0, match.state);
      await appendEvents(transaction, [
        { matchId: match.id, sequenceNumber: 1, type: 'MATCH_CREATED', payload: {} },
        { matchId: match.id, sequenceNumber: 2, type: 'TURN_STARTED', payload: {} },
      ]);
      await storeAcceptedAction(transaction, {
        id: randomUUID(),
        matchId: match.id,
        actionId: randomUUID(),
        actorUserId: match.playerAId,
        expectedVersion: 0,
        actionType: 'CREATE',
        requestPayload: {},
        resultVersion: version,
        responsePayload: {},
      });
    });
    await withTransaction(client.sqlClient, async (transaction) => {
      expect((await loadMatch(transaction, match.id))?.version).toBe(1);
      expect(await loadEvents(transaction, match.id)).toEqual([
        { sequence_number: 1, type: 'MATCH_CREATED' },
        { sequence_number: 2, type: 'TURN_STARTED' },
      ]);
    });
  });

  it('rolls back all writes and reports stale version and duplicate action conflicts', async () => {
    const match = makeMatch();
    const action = {
      id: randomUUID(),
      matchId: match.id,
      actionId: randomUUID(),
      actorUserId: match.playerAId,
      expectedVersion: 0,
      actionType: 'CREATE',
      requestPayload: {},
      resultVersion: 0,
      responsePayload: {},
    };
    await withTransaction(client.sqlClient, async (transaction) => {
      await createUser(transaction, match.playerAId, 'A');
      await createUser(transaction, match.playerBId, 'B');
      await createMatchRecord(transaction, match);
    });
    await expect(
      withTransaction(client.sqlClient, async (transaction) => {
        await saveMatch(transaction, match.id, 0, match.state);
        await appendEvents(transaction, [
          { matchId: match.id, sequenceNumber: 1, type: 'MATCH_CREATED', payload: {} },
        ]);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    await withTransaction(client.sqlClient, async (transaction) => {
      expect((await loadMatch(transaction, match.id))?.version).toBe(0);
      expect(await loadEvents(transaction, match.id)).toEqual([]);
      await expect(saveMatch(transaction, match.id, 9, match.state)).rejects.toThrow(
        ConcurrencyConflictError,
      );
      await storeAcceptedAction(transaction, action);
    });
    await expect(
      withTransaction(client.sqlClient, async (transaction) =>
        storeAcceptedAction(transaction, { ...action, id: randomUUID() }),
      ),
    ).rejects.toThrow(DuplicateActionError);
  });
});
