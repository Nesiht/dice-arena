import { type DiceRoll, type ScoreCategory } from './game';
import {
  type Scorecard,
  createEmptyScorecard,
  calculateTotalScore,
  isScorecardComplete,
} from './scorecard';
import { type TurnState, createTurn, applyRoll, setDieHeld, scoreTurn } from './turn';

// Player ID: opaque string identifier
export type PlayerId = string;

// Competitive result: WIN, LOSS, or DRAW
export type CompetitiveResult = 'WIN' | 'LOSS' | 'DRAW';

// Final match result when status is COMPLETED
export type FinalResult = {
  readonly playerAId: PlayerId;
  readonly playerAFinalScore: number;
  readonly playerAResult: CompetitiveResult;
  readonly playerBId: PlayerId;
  readonly playerBFinalScore: number;
  readonly playerBResult: CompetitiveResult;
};

// Active match state: gameplay in progress
export type ActiveMatchState = {
  readonly status: 'ACTIVE';
  readonly playerAId: PlayerId;
  readonly playerBId: PlayerId;
  readonly playerAScorecard: Scorecard;
  readonly playerBScorecard: Scorecard;
  readonly activePlayerId: PlayerId;
  readonly currentTurn: TurnState;
};

// Completed match state: final state with result
export type CompletedMatchState = {
  readonly status: 'COMPLETED';
  readonly playerAId: PlayerId;
  readonly playerBId: PlayerId;
  readonly playerAScorecard: Scorecard;
  readonly playerBScorecard: Scorecard;
  readonly activePlayerId: PlayerId;
  readonly currentTurn: TurnState;
  readonly finalResult: FinalResult;
};

// MatchState: discriminated union that encodes ACTIVE/COMPLETED invariant
export type MatchState = ActiveMatchState | CompletedMatchState;

// Domain error for match-specific violations
export class MatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchError';
  }
}

// Create a new match between two players
// Player A starts first
// Both scorecards are empty and independent
export function createMatch(playerAId: PlayerId, playerBId: PlayerId): MatchState {
  if (playerAId === playerBId) {
    throw new MatchError('Match must have two distinct players');
  }

  return {
    status: 'ACTIVE',
    playerAId,
    playerBId,
    playerAScorecard: createEmptyScorecard(),
    playerBScorecard: createEmptyScorecard(),
    activePlayerId: playerAId,
    currentTurn: createTurn(),
  } as const;
}

// Apply an authoritative DiceRoll to the active player's current turn
// playerId must be the active player
export function rollMatch(match: MatchState, playerId: PlayerId, dice: DiceRoll): MatchState {
  if (match.status === 'COMPLETED') {
    throw new MatchError('Cannot roll on a completed match');
  }

  if (playerId !== match.activePlayerId) {
    throw new MatchError('Only the active player can roll');
  }

  if (playerId !== match.playerAId && playerId !== match.playerBId) {
    throw new MatchError('Player not in this match');
  }

  const updatedTurn = applyRoll(match.currentTurn, dice);

  return {
    ...match,
    currentTurn: updatedTurn,
  };
}

// Set whether a specific die position is held for the active player
export function setMatchDieHeld(
  match: MatchState,
  playerId: PlayerId,
  dieIndex: number,
  held: boolean,
): MatchState {
  if (match.status === 'COMPLETED') {
    throw new MatchError('Cannot hold dice on a completed match');
  }

  if (playerId !== match.activePlayerId) {
    throw new MatchError('Only the active player can hold dice');
  }

  if (playerId !== match.playerAId && playerId !== match.playerBId) {
    throw new MatchError('Player not in this match');
  }

  const updatedTurn = setDieHeld(match.currentTurn, dieIndex, held);

  return {
    ...match,
    currentTurn: updatedTurn,
  };
}

// Score a category for the active player
// On success, transitions to next player with fresh TurnState
// On failure, propagates error and leaves match unchanged
export function scoreMatchCategory(
  match: MatchState,
  playerId: PlayerId,
  category: ScoreCategory,
): MatchState {
  if (match.status === 'COMPLETED') {
    throw new MatchError('Cannot score on a completed match');
  }

  if (playerId !== match.activePlayerId) {
    throw new MatchError('Only the active player can score');
  }

  if (playerId !== match.playerAId && playerId !== match.playerBId) {
    throw new MatchError('Player not in this match');
  }

  // Get the active player's current scorecard
  const activeScorecard =
    playerId === match.playerAId ? match.playerAScorecard : match.playerBScorecard;

  // Attempt to score (may throw CategoryAlreadyUsedError)
  const { scorecard: updatedScorecard } = scoreTurn(match.currentTurn, activeScorecard, category);

  // Update the appropriate player's scorecard
  const newPlayerAScorecard =
    playerId === match.playerAId ? updatedScorecard : match.playerAScorecard;
  const newPlayerBScorecard =
    playerId === match.playerBId ? updatedScorecard : match.playerBScorecard;

  // Check if match is complete (both players' scorecards complete)
  const matchComplete =
    isScorecardComplete(newPlayerAScorecard) && isScorecardComplete(newPlayerBScorecard);

  if (matchComplete) {
    // Calculate final scores and determine results
    const playerAScore = calculateTotalScore(newPlayerAScorecard);
    const playerBScore = calculateTotalScore(newPlayerBScorecard);

    let playerAResult: CompetitiveResult;
    let playerBResult: CompetitiveResult;

    if (playerAScore > playerBScore) {
      playerAResult = 'WIN';
      playerBResult = 'LOSS';
    } else if (playerBScore > playerAScore) {
      playerAResult = 'LOSS';
      playerBResult = 'WIN';
    } else {
      playerAResult = 'DRAW';
      playerBResult = 'DRAW';
    }

    const finalResult: FinalResult = {
      playerAId: match.playerAId,
      playerAFinalScore: playerAScore,
      playerAResult,
      playerBId: match.playerBId,
      playerBFinalScore: playerBScore,
      playerBResult,
    };

    return {
      status: 'COMPLETED',
      playerAId: match.playerAId,
      playerBId: match.playerBId,
      playerAScorecard: newPlayerAScorecard,
      playerBScorecard: newPlayerBScorecard,
      activePlayerId: match.activePlayerId,
      currentTurn: match.currentTurn,
      finalResult,
    } as const;
  }

  // Match continues; transition to other player with fresh turn
  const otherPlayerId = playerId === match.playerAId ? match.playerBId : match.playerAId;

  return {
    ...match,
    playerAScorecard: newPlayerAScorecard,
    playerBScorecard: newPlayerBScorecard,
    activePlayerId: otherPlayerId,
    currentTurn: createTurn(),
  };
}
