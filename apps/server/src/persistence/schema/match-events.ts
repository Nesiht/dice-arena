import {
  bigserial,
  bigint,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { matches } from './matches';
import { users } from './users';

export const matchEvents = pgTable(
  'match_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'restrict' }),
    sequenceNumber: bigint('sequence_number', { mode: 'number' }).notNull(),
    type: varchar('type', { length: 64 }).notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('match_events_match_sequence_unique').on(table.matchId, table.sequenceNumber),
    index('match_events_match_sequence_idx').on(table.matchId, table.sequenceNumber),
  ],
);
