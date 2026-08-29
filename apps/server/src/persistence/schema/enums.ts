import { pgEnum } from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', ['ACTIVE', 'DISABLED']);
export const matchLifecycleStatus = pgEnum('match_lifecycle_status', [
  'CREATED',
  'WAITING',
  'ACTIVE',
  'COMPLETED',
  'FORFEITED',
  'EXPIRED',
  'CANCELLED',
]);
export const matchSeat = pgEnum('match_seat', ['A', 'B']);
export const matchResult = pgEnum('match_result', ['WIN', 'LOSS', 'DRAW']);
export const matchActionStatus = pgEnum('match_action_status', ['ACCEPTED', 'REJECTED']);
