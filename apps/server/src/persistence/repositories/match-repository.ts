import type { MatchState } from '@dice-arena/game-domain';
import type { TransactionSql } from 'postgres';

import {
  PERSISTED_MATCH_STATE_SCHEMA_VERSION,
  type PersistedMatchStateV1,
} from '../persisted-match-state';
import { toDomainMatchState, toPersistedMatchState } from '../mappers/match-state-mapper';

export type PersistenceMatchStatus = 'ACTIVE' | 'COMPLETED';
export type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };
export type PersistedMatch = {
  readonly id: string;
  readonly status: PersistenceMatchStatus;
  readonly version: number;
  readonly state: MatchState;
};
export type NewMatch = { readonly id: string; readonly state: MatchState };
export type NewMatchEvent = {
  readonly matchId: string;
  readonly sequenceNumber: number;
  readonly type: string;
  readonly actorUserId?: string;
  readonly payload: JsonObject;
};
export type AcceptedMatchAction = {
  readonly id: string;
  readonly matchId: string;
  readonly actionId: string;
  readonly actorUserId: string;
  readonly expectedVersion: number;
  readonly actionType: string;
  readonly requestPayload: JsonObject;
  readonly resultVersion: number;
  readonly responsePayload: JsonObject;
};

type MatchRow = {
  id: string;
  status: PersistenceMatchStatus;
  version: string | number;
  state_schema_version: number;
  state: PersistedMatchStateV1;
};
type EventRow = { sequence_number: string | number; type: string };

export class ConcurrencyConflictError extends Error {
  constructor() {
    super('Match update conflicted with a newer version');
    this.name = 'ConcurrencyConflictError';
  }
}
export class DuplicateActionError extends Error {
  constructor() {
    super('Match action ID has already been recorded');
    this.name = 'DuplicateActionError';
  }
}

export const toSafeInteger = (value: string | number, fieldName: string): number => {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) {
    throw new Error(`${fieldName} exceeds JavaScript safe integer range`);
  }
  return numberValue;
};

const toMatch = (row: MatchRow): PersistedMatch => ({
  id: row.id,
  status: row.status,
  version: toSafeInteger(row.version, 'Match version'),
  state: toDomainMatchState(row.state_schema_version, row.state),
});

export const createUser = async (
  transaction: TransactionSql,
  id: string,
  displayName: string,
): Promise<void> => {
  await transaction`INSERT INTO users (id, display_name) VALUES (${id}, ${displayName})`;
};

export const createMatchRecord = async (
  transaction: TransactionSql,
  match: NewMatch,
): Promise<void> => {
  const state = toPersistedMatchState(match.state);
  await transaction`INSERT INTO matches (id, status, version, state_schema_version, state, active_player_id) VALUES (${match.id}, ${match.state.status}, 0, ${PERSISTED_MATCH_STATE_SCHEMA_VERSION}, ${JSON.stringify(state)}::jsonb, ${match.state.activePlayerId})`;
  await transaction`INSERT INTO match_participants (match_id, user_id, seat) VALUES (${match.id}, ${match.state.playerAId}, 'A'), (${match.id}, ${match.state.playerBId}, 'B')`;
};

export const loadMatch = async (
  transaction: TransactionSql,
  id: string,
): Promise<PersistedMatch | undefined> => {
  const [row] = await transaction<
    MatchRow[]
  >`SELECT id, status, version, state_schema_version, state FROM matches WHERE id = ${id}`;
  return row ? toMatch(row) : undefined;
};

export const loadMatchForMutation = async (
  transaction: TransactionSql,
  id: string,
): Promise<PersistedMatch | undefined> => {
  const [row] = await transaction<
    MatchRow[]
  >`SELECT id, status, version, state_schema_version, state FROM matches WHERE id = ${id} FOR UPDATE`;
  return row ? toMatch(row) : undefined;
};

export const saveMatch = async (
  transaction: TransactionSql,
  id: string,
  expectedVersion: number,
  state: MatchState,
): Promise<number> => {
  const persistedState = toPersistedMatchState(state);
  const [row] = await transaction<
    { version: number }[]
  >`UPDATE matches SET status = ${state.status}, state_schema_version = ${PERSISTED_MATCH_STATE_SCHEMA_VERSION}, state = ${JSON.stringify(persistedState)}::jsonb, active_player_id = ${state.activePlayerId}, version = version + 1, updated_at = NOW() WHERE id = ${id} AND version = ${expectedVersion} RETURNING version`;
  if (!row) throw new ConcurrencyConflictError();
  return toSafeInteger(row.version, 'Match version');
};

export const appendEvents = async (
  transaction: TransactionSql,
  events: readonly NewMatchEvent[],
): Promise<void> => {
  for (const event of events)
    await transaction`INSERT INTO match_events (match_id, sequence_number, type, actor_user_id, payload) VALUES (${event.matchId}, ${event.sequenceNumber}, ${event.type}, ${event.actorUserId ?? null}, ${JSON.stringify(event.payload)}::jsonb)`;
};

export const storeAcceptedAction = async (
  transaction: TransactionSql,
  action: AcceptedMatchAction,
): Promise<void> => {
  try {
    await transaction`INSERT INTO match_actions (id, match_id, action_id, actor_user_id, expected_version, action_type, request_payload, status, result_version, response_payload) VALUES (${action.id}, ${action.matchId}, ${action.actionId}, ${action.actorUserId}, ${action.expectedVersion}, ${action.actionType}, ${JSON.stringify(action.requestPayload)}::jsonb, 'ACCEPTED', ${action.resultVersion}, ${JSON.stringify(action.responsePayload)}::jsonb)`;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505')
      throw new DuplicateActionError();
    throw error;
  }
};

export const loadEvents = async (
  transaction: TransactionSql,
  matchId: string,
): Promise<readonly { readonly sequence_number: number; readonly type: string }[]> => {
  const rows = await transaction<
    EventRow[]
  >`SELECT sequence_number, type FROM match_events WHERE match_id = ${matchId} ORDER BY sequence_number`;
  return rows.map((row) => ({
    sequence_number: toSafeInteger(row.sequence_number, 'Event sequence number'),
    type: row.type,
  }));
};
