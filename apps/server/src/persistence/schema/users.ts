import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { userStatus } from './enums';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  status: userStatus('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
