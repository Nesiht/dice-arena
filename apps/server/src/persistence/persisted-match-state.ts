import type { DiceRoll, ScoreCategory } from '@dice-arena/game-domain';

export const PERSISTED_MATCH_STATE_SCHEMA_VERSION = 1;

export type PersistedScorecard = { readonly [category in ScoreCategory]: number | null };
export type PersistedTurnState = {
  readonly status: 'ACTIVE' | 'COMPLETED';
  readonly rollCount: 0 | 1 | 2 | 3;
  readonly currentDice: DiceRoll | null;
  readonly heldState: readonly [boolean, boolean, boolean, boolean, boolean] | null;
};
export type PersistedFinalResult = {
  readonly playerAId: string;
  readonly playerAFinalScore: number;
  readonly playerAResult: 'WIN' | 'LOSS' | 'DRAW';
  readonly playerBId: string;
  readonly playerBFinalScore: number;
  readonly playerBResult: 'WIN' | 'LOSS' | 'DRAW';
};
export type PersistedMatchStateV1 = {
  readonly status: 'ACTIVE' | 'COMPLETED';
  readonly playerAId: string;
  readonly playerBId: string;
  readonly playerAScorecard: PersistedScorecard;
  readonly playerBScorecard: PersistedScorecard;
  readonly activePlayerId: string;
  readonly currentTurn: PersistedTurnState;
  readonly finalResult?: PersistedFinalResult;
};

const scoreCategories: readonly ScoreCategory[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'onePair',
  'twoPairs',
  'threeOfAKind',
  'fourOfAKind',
  'smallStraight',
  'largeStraight',
  'fullHouse',
  'chance',
  'yatzy',
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isResult = (value: unknown): value is 'WIN' | 'LOSS' | 'DRAW' =>
  value === 'WIN' || value === 'LOSS' || value === 'DRAW';
const isFiveTuple = (value: unknown, item: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.length === 5 && value.every(item);

const isScorecard = (value: unknown): value is PersistedScorecard =>
  isRecord(value) &&
  scoreCategories.every(
    (category) => value[category] === null || typeof value[category] === 'number',
  );
const isTurn = (value: unknown): value is PersistedTurnState => {
  if (
    !isRecord(value) ||
    (value.status !== 'ACTIVE' && value.status !== 'COMPLETED') ||
    ![0, 1, 2, 3].includes(value.rollCount as number)
  )
    return false;
  const diceValid =
    value.currentDice === null ||
    isFiveTuple(
      value.currentDice,
      (die) => Number.isInteger(die) && typeof die === 'number' && die >= 1 && die <= 6,
    );
  const heldValid =
    value.heldState === null || isFiveTuple(value.heldState, (held) => typeof held === 'boolean');
  return diceValid && heldValid;
};
const isFinalResult = (value: unknown): value is PersistedFinalResult =>
  isRecord(value) &&
  typeof value.playerAId === 'string' &&
  typeof value.playerAFinalScore === 'number' &&
  isResult(value.playerAResult) &&
  typeof value.playerBId === 'string' &&
  typeof value.playerBFinalScore === 'number' &&
  isResult(value.playerBResult);

export function isPersistedMatchStateV1(value: unknown): value is PersistedMatchStateV1 {
  if (
    !isRecord(value) ||
    (value.status !== 'ACTIVE' && value.status !== 'COMPLETED') ||
    typeof value.playerAId !== 'string' ||
    typeof value.playerBId !== 'string' ||
    typeof value.activePlayerId !== 'string' ||
    !isScorecard(value.playerAScorecard) ||
    !isScorecard(value.playerBScorecard) ||
    !isTurn(value.currentTurn)
  )
    return false;
  return value.status === 'COMPLETED'
    ? isFinalResult(value.finalResult)
    : value.finalResult === undefined;
}
