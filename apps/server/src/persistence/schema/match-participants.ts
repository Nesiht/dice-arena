import { index, integer, pgTable, primaryKey, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { matchResult, matchSeat } from './enums';
import { matches } from './matches';
import { users } from './users';

export const matchParticipants = pgTable(
  'match_participants',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    seat: matchSeat('seat').notNull(),
    result: matchResult('result'),
    finalScore: integer('final_score'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.matchId, table.userId],
      name: 'match_participants_match_user_pk',
    }),
    unique('match_participants_match_seat_unique').on(table.matchId, table.seat),
    index('match_participants_user_match_idx').on(table.userId, table.matchId),
  ],
);
