import type { MatchState } from '@dice-arena/game-domain';

import {
  PERSISTED_MATCH_STATE_SCHEMA_VERSION,
  type PersistedMatchStateV1,
  isPersistedMatchStateV1,
} from '../persisted-match-state';

export class PersistedMatchStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistedMatchStateError';
  }
}

const copyState = (state: MatchState): PersistedMatchStateV1 => {
  const base = {
    status: state.status,
    playerAId: state.playerAId,
    playerBId: state.playerBId,
    playerAScorecard: { ...state.playerAScorecard },
    playerBScorecard: { ...state.playerBScorecard },
    activePlayerId: state.activePlayerId,
    currentTurn: {
      ...state.currentTurn,
      currentDice:
        state.currentTurn.currentDice === null
          ? null
          : ([
              ...state.currentTurn.currentDice,
            ] as PersistedMatchStateV1['currentTurn']['currentDice']),
      heldState:
        state.currentTurn.heldState === null
          ? null
          : ([...state.currentTurn.heldState] as PersistedMatchStateV1['currentTurn']['heldState']),
    },
  };
  return state.status === 'COMPLETED'
    ? { ...base, status: 'COMPLETED', finalResult: { ...state.finalResult } }
    : { ...base, status: 'ACTIVE' };
};

export function toPersistedMatchState(state: MatchState): PersistedMatchStateV1 {
  return copyState(state);
}

export function toDomainMatchState(stateSchemaVersion: number, value: unknown): MatchState {
  if (stateSchemaVersion !== PERSISTED_MATCH_STATE_SCHEMA_VERSION)
    throw new PersistedMatchStateError(
      `Unsupported MatchState schema version: ${stateSchemaVersion}`,
    );
  if (!isPersistedMatchStateV1(value))
    throw new PersistedMatchStateError('Invalid persisted MatchState v1');
  const state =
    value.status === 'COMPLETED'
      ? {
          ...value,
          playerAScorecard: { ...value.playerAScorecard },
          playerBScorecard: { ...value.playerBScorecard },
          currentTurn: {
            ...value.currentTurn,
            currentDice:
              value.currentTurn.currentDice === null ? null : [...value.currentTurn.currentDice],
            heldState:
              value.currentTurn.heldState === null ? null : [...value.currentTurn.heldState],
          },
          finalResult: { ...value.finalResult },
        }
      : {
          ...value,
          playerAScorecard: { ...value.playerAScorecard },
          playerBScorecard: { ...value.playerBScorecard },
          currentTurn: {
            ...value.currentTurn,
            currentDice:
              value.currentTurn.currentDice === null ? null : [...value.currentTurn.currentDice],
            heldState:
              value.currentTurn.heldState === null ? null : [...value.currentTurn.heldState],
          },
        };
  return state as MatchState;
}
