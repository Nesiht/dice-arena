import { randomUUID } from 'node:crypto';

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createMatch } from '@dice-arena/game-domain';

import { getRequiredDatabaseUrl } from '../../src/config/database';
import { createPersistenceClient } from '../../src/persistence/db/client';
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
