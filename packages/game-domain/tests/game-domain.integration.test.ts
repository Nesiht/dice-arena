import { type DiceRoll, type ScoreCategory } from '../src/game';
import {
  createMatch,
  rollMatch,
  scoreMatchCategory,
  setMatchDieHeld,
  type MatchState,
} from '../src/match';
import { calculateUpperBonus, calculateUpperSubtotal, isScorecardComplete } from '../src/scorecard';

function scoreWithSingleRoll(
  match: MatchState,
  playerId: string,
  category: ScoreCategory,
  dice: DiceRoll,
): MatchState {
  const rolled = rollMatch(match, playerId, dice);
  return scoreMatchCategory(rolled, playerId, category);
}

function scoreWithMultiRollTurn(
  match: MatchState,
  playerId: string,
  category: ScoreCategory,
  firstRoll: DiceRoll,
  heldIndexes: number[],
  secondRoll: DiceRoll,
  thirdRoll: DiceRoll,
): MatchState {
  let nextMatch = rollMatch(match, playerId, firstRoll);

  for (const index of heldIndexes) {
    nextMatch = setMatchDieHeld(nextMatch, playerId, index, true);
  }

  nextMatch = rollMatch(nextMatch, playerId, secondRoll);
  nextMatch = rollMatch(nextMatch, playerId, thirdRoll);

  return scoreMatchCategory(nextMatch, playerId, category);
}

describe('game domain integration', () => {
  it('plays a complete two-player match through the public domain APIs', () => {
    const playerATurns: readonly { category: ScoreCategory; dice: DiceRoll }[] = [
      { category: 'ones', dice: [1, 1, 1, 4, 5] },
      { category: 'twos', dice: [2, 2, 2, 3, 6] },
      { category: 'threes', dice: [3, 3, 3, 2, 4] },
      { category: 'fours', dice: [4, 4, 4, 1, 2] },
      { category: 'fives', dice: [5, 5, 5, 2, 4] },
      { category: 'sixes', dice: [6, 6, 6, 1, 2] },
      { category: 'onePair', dice: [6, 6, 4, 3, 1] },
      { category: 'twoPairs', dice: [6, 6, 5, 5, 1] },
      { category: 'threeOfAKind', dice: [5, 5, 5, 3, 2] },
      { category: 'fourOfAKind', dice: [2, 6, 6, 3, 6] },
      { category: 'smallStraight', dice: [1, 2, 3, 4, 5] },
      { category: 'largeStraight', dice: [2, 3, 4, 5, 6] },
      { category: 'fullHouse', dice: [5, 5, 5, 3, 3] },
      { category: 'chance', dice: [6, 5, 4, 3, 2] },
      { category: 'yatzy', dice: [1, 2, 3, 4, 5] },
    ];

    const playerBTurns: readonly { category: ScoreCategory; dice: DiceRoll }[] = [
      { category: 'ones', dice: [1, 1, 1, 2, 3] },
      { category: 'twos', dice: [2, 2, 3, 1, 6] },
      { category: 'threes', dice: [3, 3, 4, 5, 1] },
      { category: 'fours', dice: [4, 4, 2, 6, 1] },
      { category: 'fives', dice: [5, 5, 2, 3, 1] },
      { category: 'sixes', dice: [6, 6, 1, 2, 3] },
      { category: 'onePair', dice: [2, 2, 1, 3, 4] },
      { category: 'twoPairs', dice: [4, 4, 2, 2, 1] },
      { category: 'threeOfAKind', dice: [3, 3, 3, 1, 2] },
      { category: 'fourOfAKind', dice: [4, 4, 4, 4, 2] },
      { category: 'smallStraight', dice: [1, 2, 3, 4, 5] },
      { category: 'largeStraight', dice: [2, 3, 4, 5, 6] },
      { category: 'fullHouse', dice: [4, 4, 4, 2, 2] },
      { category: 'chance', dice: [2, 4, 6, 3, 5] },
      { category: 'yatzy', dice: [1, 2, 3, 4, 5] },
    ];

    let match = createMatch('A', 'B');

    expect(match.status).toBe('ACTIVE');
    expect(match.activePlayerId).toBe('A');

    for (let round = 0; round < 15; round++) {
      const playerATurn = playerATurns[round];
      const playerBTurn = playerBTurns[round];

      if (round === 9) {
        match = scoreWithMultiRollTurn(
          match,
          'A',
          playerATurn.category,
          playerATurn.dice,
          [1, 2, 4],
          [5, 6, 6, 1, 6],
          [6, 6, 6, 4, 6],
        );
      } else {
        match = scoreWithSingleRoll(match, 'A', playerATurn.category, playerATurn.dice);
      }

      expect(match.activePlayerId).toBe('B');
      expect(match.status).toBe('ACTIVE');

      if (round < 14) {
        match = scoreWithSingleRoll(match, 'B', playerBTurn.category, playerBTurn.dice);
        expect(match.activePlayerId).toBe('A');
        expect(match.status).toBe('ACTIVE');
      }

      if (round === 14) {
        expect(isScorecardComplete(match.playerAScorecard)).toBe(true);
        expect(isScorecardComplete(match.playerBScorecard)).toBe(false);
        expect(match.status).toBe('ACTIVE');
      }
    }

    match = scoreWithSingleRoll(match, 'B', playerBTurns[14].category, playerBTurns[14].dice);

    expect(match.status).toBe('COMPLETED');
    expect(isScorecardComplete(match.playerAScorecard)).toBe(true);
    expect(isScorecardComplete(match.playerBScorecard)).toBe(true);

    expect(calculateUpperSubtotal(match.playerAScorecard)).toBe(63);
    expect(calculateUpperBonus(match.playerAScorecard)).toBe(50);
    expect(calculateUpperSubtotal(match.playerBScorecard)).toBe(43);
    expect(calculateUpperBonus(match.playerBScorecard)).toBe(0);

    if (match.status === 'COMPLETED') {
      expect(match.playerAScorecard.yatzy).toBe(0);
      expect(match.playerBScorecard.yatzy).toBe(0);
      expect(match.finalResult.playerAFinalScore).toBe(262);
      expect(match.finalResult.playerBFinalScore).toBe(155);
      expect(match.finalResult.playerAResult).toBe('WIN');
      expect(match.finalResult.playerBResult).toBe('LOSS');
    }

    expect(() => rollMatch(match, 'A', [1, 2, 3, 4, 5])).toThrow();
  });

  it('supports a draw result through the public Match Engine flow', () => {
    let match = createMatch('A', 'B');
    const categories: ScoreCategory[] = [
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

    for (const category of categories) {
      match = scoreWithSingleRoll(match, 'A', category, [6, 6, 6, 6, 6]);
      match = scoreWithSingleRoll(match, 'B', category, [6, 6, 6, 6, 6]);
    }

    expect(match.status).toBe('COMPLETED');

    if (match.status === 'COMPLETED') {
      expect(match.finalResult.playerAResult).toBe('DRAW');
      expect(match.finalResult.playerBResult).toBe('DRAW');
      expect(match.finalResult.playerAFinalScore).toBe(match.finalResult.playerBFinalScore);
    }
  });
});
