import {
  bigint,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { matchActionStatus } from './enums';
import { matches } from './matches';
import { users } from './users';

export const matchActions = pgTable(
  'match_actions',
  {
    id: uuid('id').primaryKey(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'restrict' }),
    actionId: uuid('action_id').notNull(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expectedVersion: bigint('expected_version', { mode: 'number' }).notNull(),
    actionType: varchar('action_type', { length: 64 }).notNull(),
    requestPayload: jsonb('request_payload').notNull(),
    status: matchActionStatus('status').notNull(),
    resultVersion: bigint('result_version', { mode: 'number' }),
    responsePayload: jsonb('response_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('match_actions_match_action_unique').on(table.matchId, table.actionId),
    index('match_actions_match_idx').on(table.matchId),
  ],
);
