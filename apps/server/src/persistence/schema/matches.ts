import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import type { PersistedMatchStateV1 } from '../persisted-match-state';
import { matchLifecycleStatus } from './enums';
import { users } from './users';

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey(),
    status: matchLifecycleStatus('status').notNull(),
    version: bigint('version', { mode: 'number' }).notNull().default(0),
    stateSchemaVersion: integer('state_schema_version').notNull().default(1),
    state: jsonb('state').$type<PersistedMatchStateV1>(),
    activePlayerId: uuid('active_player_id').references(() => users.id, { onDelete: 'restrict' }),
    turnDeadlineAt: timestamp('turn_deadline_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    check('matches_version_nonnegative', sql`${table.version} >= 0`),
    index('matches_status_turn_deadline_idx').on(table.status, table.turnDeadlineAt),
    index('matches_active_player_status_idx').on(table.activePlayerId, table.status),
    index('matches_created_at_idx').on(table.createdAt),
  ],
);
