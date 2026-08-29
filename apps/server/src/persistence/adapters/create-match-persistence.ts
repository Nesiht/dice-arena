import type { CreateMatchPersistence } from '../../application/matches/create-match';
import { withTransaction } from '../db/transaction';
import { createMatchRecord, findExistingUserIds } from '../repositories/match-repository';
import type { Sql } from 'postgres';

export const createCreateMatchPersistence = (client: Sql): CreateMatchPersistence => ({
  createInitialMatch: async (match): Promise<boolean> =>
    withTransaction(client, async (transaction) => {
      const userIds = await findExistingUserIds(transaction, [
        match.state.playerAId,
        match.state.playerBId,
      ]);
      if (userIds.length !== 2) return false;
      await createMatchRecord(transaction, match);
      return true;
    }),
});
