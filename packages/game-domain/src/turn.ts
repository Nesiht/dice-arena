import { type DiceRoll, type ScoreCategory } from './game';
import { type Scorecard, scoreCategory } from './scorecard';

// Turn status: ACTIVE (still playable) or COMPLETED (final state)
export type TurnStatus = 'ACTIVE' | 'COMPLETED';

// Held state: tracks which of the five dice positions are held
type HeldState = readonly [boolean, boolean, boolean, boolean, boolean];

// TurnState: immutable representation of a single player's turn
export type TurnState = {
  readonly status: TurnStatus;
  readonly rollCount: 0 | 1 | 2 | 3;
  readonly currentDice: DiceRoll | null;
  readonly heldState: HeldState | null;
};

// Domain error for turn-specific violations
export class TurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TurnError';
  }
}

// Create a new active turn
// Returns a turn that has not yet rolled any dice
export function createTurn(): TurnState {
  return {
    status: 'ACTIVE',
    rollCount: 0,
    currentDice: null,
    heldState: null,
  };
}

// Apply a roll to the turn
// For roll 1: accepts full 5-dice authoritative result
// For roll 2/3: accepts full 5-dice result, validates held positions remain unchanged
export function applyRoll(turn: TurnState, dice: DiceRoll): TurnState {
  if (turn.status === 'COMPLETED') {
    throw new TurnError('Cannot roll a completed turn');
  }

  if (turn.rollCount >= 3) {
    throw new TurnError('Cannot roll more than 3 times per turn');
  }

  // Roll 1: must be able to roll, all dice unheld
  if (turn.rollCount === 0) {
    return {
      status: 'ACTIVE',
      rollCount: 1,
      currentDice: dice,
      heldState: [false, false, false, false, false],
    };
  }

  // Roll 2 or 3: verify held dice are not all held, validate held positions unchanged
  if (turn.heldState === null) {
    throw new TurnError('Internal error: heldState should exist after roll 1');
  }

  // Check if all dice are held
  if (turn.heldState.every((held) => held)) {
    throw new TurnError('Cannot roll when all five dice are held');
  }

  // Validate that held positions remain unchanged
  if (turn.currentDice === null) {
    throw new TurnError('Internal error: currentDice should exist before roll 2+');
  }

  for (let i = 0; i < 5; i++) {
    if (turn.heldState[i] && turn.currentDice[i] !== dice[i]) {
      throw new TurnError(`Held die at position ${i} cannot change during roll`);
    }
  }

  return {
    status: 'ACTIVE',
    rollCount: (turn.rollCount + 1) as 1 | 2 | 3,
    currentDice: dice,
    heldState: turn.heldState,
  };
}

// Set whether a specific die position is held
// Indices must be 0-4 (corresponding to the five die positions)
// Only valid after at least one roll
export function setDieHeld(turn: TurnState, dieIndex: number, held: boolean): TurnState {
  if (turn.status === 'COMPLETED') {
    throw new TurnError('Cannot change hold state on a completed turn');
  }

  if (turn.heldState === null) {
    throw new TurnError('Cannot hold dice before first roll');
  }

  if (turn.rollCount >= 3) {
    throw new TurnError('Cannot change hold state after third roll');
  }

  if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex > 4) {
    throw new TurnError(`Invalid die index: ${dieIndex}. Must be 0-4`);
  }

  // Create new held state with the changed position
  const newHeld: HeldState = [
    dieIndex === 0 ? held : turn.heldState[0],
    dieIndex === 1 ? held : turn.heldState[1],
    dieIndex === 2 ? held : turn.heldState[2],
    dieIndex === 3 ? held : turn.heldState[3],
    dieIndex === 4 ? held : turn.heldState[4],
  ];

  return {
    ...turn,
    heldState: newHeld,
  };
}

// Score the current turn using the given scorecard and category
// Returns: { turn: completed TurnState, scorecard: updated Scorecard }
// The completed turn state has status = COMPLETED
// The updated scorecard has the category scored
// Throws if scoring would fail (e.g., category already used, no roll yet, turn completed)
export function scoreTurn(
  turn: TurnState,
  scorecard: Scorecard,
  category: ScoreCategory,
): { turn: TurnState; scorecard: Scorecard } {
  if (turn.status === 'COMPLETED') {
    throw new TurnError('Cannot score a completed turn');
  }

  if (turn.currentDice === null) {
    throw new TurnError('Cannot score before rolling');
  }

  // scoreCategory will validate that the category is not already used
  // and will throw CategoryAlreadyUsedError if it is
  // If that throws, the turn remains active (not completed)
  const updatedScorecard = scoreCategory(scorecard, category, turn.currentDice);

  return {
    turn: {
      ...turn,
      status: 'COMPLETED',
    },
    scorecard: updatedScorecard,
  };
}

// Helper: Check if scoring is allowed
// Scoring is allowed if at least one roll has occurred and turn is still active
export function isScoringAllowed(turn: TurnState): boolean {
  return turn.status === 'ACTIVE' && turn.rollCount >= 1;
}
