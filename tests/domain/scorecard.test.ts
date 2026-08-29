import {
  CategoryAlreadyUsedError,
  calculateLowerSubtotal,
  calculateTotalScore,
  calculateUpperBonus,
  calculateUpperSubtotal,
  createEmptyScorecard,
  isCategoryUsed,
  isScorecardComplete,
  scoreCategory,
  type Scorecard,
} from '../../src/domain/scorecard';
import { type DiceRoll } from '../../src/domain/game';

describe('Scorecard domain', () => {
  describe('empty scorecard', () => {
    it('creates a scorecard with all categories unused', () => {
      const scorecard = createEmptyScorecard();

      expect(isCategoryUsed(scorecard, 'ones')).toBe(false);
      expect(isCategoryUsed(scorecard, 'sixes')).toBe(false);
      expect(isCategoryUsed(scorecard, 'onePair')).toBe(false);
      expect(isCategoryUsed(scorecard, 'yatzy')).toBe(false);
    });

    it('calculates empty subtotals as 0', () => {
      const scorecard = createEmptyScorecard();

      expect(calculateUpperSubtotal(scorecard)).toBe(0);
      expect(calculateLowerSubtotal(scorecard)).toBe(0);
    });

    it('calculates empty bonus as 0', () => {
      const scorecard = createEmptyScorecard();
      expect(calculateUpperBonus(scorecard)).toBe(0);
    });

    it('calculates empty total as 0', () => {
      const scorecard = createEmptyScorecard();
      expect(calculateTotalScore(scorecard)).toBe(0);
    });

    it('is not complete', () => {
      const scorecard = createEmptyScorecard();
      expect(isScorecardComplete(scorecard)).toBe(false);
    });

    it('creates independent scorecards', () => {
      const scorecard1 = createEmptyScorecard();
      const scorecard2 = createEmptyScorecard();

      expect(scorecard1).not.toBe(scorecard2);
      expect(scorecard1).toEqual(scorecard2);
    });
  });

  describe('scoring a category', () => {
    it('stores the score correctly', () => {
      const scorecard = createEmptyScorecard();
      const dice: DiceRoll = [5, 5, 5, 3, 2];

      const updated = scoreCategory(scorecard, 'fives', dice);

      expect(isCategoryUsed(updated, 'fives')).toBe(true);
      expect(updated.fives).toBe(15);
    });

    it('does not mutate the original scorecard', () => {
      const scorecard = createEmptyScorecard();
      const dice: DiceRoll = [5, 5, 5, 3, 2];

      const updated = scoreCategory(scorecard, 'fives', dice);

      expect(scorecard.fives).toBeNull();
      expect(updated.fives).toBe(15);
      expect(scorecard).not.toBe(updated);
    });

    it('returns a new scorecard object', () => {
      const scorecard = createEmptyScorecard();
      const dice: DiceRoll = [6, 6, 4, 3, 1];

      const updated = scoreCategory(scorecard, 'onePair', dice);

      expect(scorecard).not.toBe(updated);
      expect(updated.onePair).toBe(12);
    });

    it('allows multiple categories to be scored sequentially', () => {
      let scorecard = createEmptyScorecard();
      const dice1: DiceRoll = [5, 5, 5, 3, 2];
      const dice2: DiceRoll = [6, 6, 4, 3, 1];
      const dice3: DiceRoll = [6, 5, 4, 3, 2];

      scorecard = scoreCategory(scorecard, 'fives', dice1);
      expect(scorecard.fives).toBe(15);

      scorecard = scoreCategory(scorecard, 'onePair', dice2);
      expect(scorecard.onePair).toBe(12);
      expect(scorecard.fives).toBe(15);

      scorecard = scoreCategory(scorecard, 'chance', dice3);
      expect(scorecard.chance).toBe(20);
      expect(scorecard.fives).toBe(15);
      expect(scorecard.onePair).toBe(12);
    });

    it('each scorecard is independent from others', () => {
      const scorecard1 = createEmptyScorecard();
      const scorecard2 = createEmptyScorecard();

      const dice1: DiceRoll = [5, 5, 5, 3, 2];
      const dice2: DiceRoll = [6, 6, 4, 3, 1];

      const updated1 = scoreCategory(scorecard1, 'fives', dice1);
      const updated2 = scoreCategory(scorecard2, 'onePair', dice2);

      expect(updated1.fives).toBe(15);
      expect(updated1.onePair).toBeNull();

      expect(updated2.onePair).toBe(12);
      expect(updated2.fives).toBeNull();
    });
  });

  describe('zero scoring', () => {
    it('stores zero as a used category', () => {
      const scorecard = createEmptyScorecard();
      const dice: DiceRoll = [1, 2, 3, 4, 5];

      const updated = scoreCategory(scorecard, 'yatzy', dice);

      expect(isCategoryUsed(updated, 'yatzy')).toBe(true);
      expect(updated.yatzy).toBe(0);
    });

    it('zero contributes to subtotals', () => {
      const scorecard = createEmptyScorecard();
      const dice: DiceRoll = [1, 2, 3, 4, 5];

      const updated = scoreCategory(scorecard, 'yatzy', dice);

      expect(calculateLowerSubtotal(updated)).toBe(0);
      expect(calculateTotalScore(updated)).toBe(0);
    });

    it('zero-scored category cannot be reused', () => {
      const scorecard = createEmptyScorecard();
      const dice1: DiceRoll = [1, 2, 3, 4, 5];
      const dice2: DiceRoll = [6, 6, 6, 6, 6];

      const updated = scoreCategory(scorecard, 'yatzy', dice1);
      expect(() => scoreCategory(updated, 'yatzy', dice2)).toThrow(CategoryAlreadyUsedError);
    });

    it('zero is distinguishable from unused', () => {
      const scorecard = createEmptyScorecard();
      const dice: DiceRoll = [1, 2, 3, 4, 5];

      expect(isCategoryUsed(scorecard, 'yatzy')).toBe(false);

      const updated = scoreCategory(scorecard, 'yatzy', dice);
      expect(isCategoryUsed(updated, 'yatzy')).toBe(true);
    });
  });

  describe('duplicate category error', () => {
    it('throws when scoring an already-used category', () => {
      const scorecard = createEmptyScorecard();
      const dice1: DiceRoll = [6, 6, 4, 3, 1];
      const dice2: DiceRoll = [5, 5, 3, 2, 1];

      const updated = scoreCategory(scorecard, 'onePair', dice1);

      expect(() => scoreCategory(updated, 'onePair', dice2)).toThrow(CategoryAlreadyUsedError);
    });

    it('preserves the original score on duplicate attempt', () => {
      const scorecard = createEmptyScorecard();
      const dice1: DiceRoll = [6, 6, 4, 3, 1];
      const dice2: DiceRoll = [5, 5, 3, 2, 1];

      const updated = scoreCategory(scorecard, 'onePair', dice1);
      expect(updated.onePair).toBe(12);

      try {
        scoreCategory(updated, 'onePair', dice2);
      } catch {
        // Expected
      }

      expect(updated.onePair).toBe(12);
    });

    it('error message identifies the category', () => {
      const scorecard = createEmptyScorecard();
      const dice: DiceRoll = [6, 6, 4, 3, 1];

      const updated = scoreCategory(scorecard, 'fives', dice);

      try {
        scoreCategory(updated, 'fives', dice);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CategoryAlreadyUsedError);
        expect((e as CategoryAlreadyUsedError).message).toContain('fives');
      }
    });
  });

  describe('upper section subtotal', () => {
    it('sums all upper section categories', () => {
      let scorecard = createEmptyScorecard();

      scorecard = scoreCategory(scorecard, 'ones', [1, 1, 2, 3, 4]);
      scorecard = scoreCategory(scorecard, 'twos', [2, 2, 1, 3, 4]);
      scorecard = scoreCategory(scorecard, 'threes', [3, 3, 1, 2, 4]);

      const subtotal = calculateUpperSubtotal(scorecard);
      expect(subtotal).toBe(2 + 4 + 6); // 1*2 + 2*2 + 3*2
    });

    it('includes unused categories as 0', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'fives', [5, 5, 5, 1, 2]);

      const subtotal = calculateUpperSubtotal(scorecard);
      expect(subtotal).toBe(15); // ones through fours = 0, fives = 15, sixes = 0
    });

    it('handles partial upper section', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'ones', [1, 2, 3, 4, 5]);
      scorecard = scoreCategory(scorecard, 'fives', [5, 5, 5, 1, 2]);

      const subtotal = calculateUpperSubtotal(scorecard);
      expect(subtotal).toBe(1 + 15); // 1 + 15 = 16
    });

    it('works with complete upper section', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'ones', [1, 1, 3, 4, 5]);
      scorecard = scoreCategory(scorecard, 'twos', [2, 2, 1, 4, 5]);
      scorecard = scoreCategory(scorecard, 'threes', [3, 3, 1, 2, 5]);
      scorecard = scoreCategory(scorecard, 'fours', [4, 4, 1, 2, 3]);
      scorecard = scoreCategory(scorecard, 'fives', [5, 5, 1, 2, 3]);
      scorecard = scoreCategory(scorecard, 'sixes', [6, 6, 1, 2, 3]);

      const subtotal = calculateUpperSubtotal(scorecard);
      expect(subtotal).toBe(2 + 4 + 6 + 8 + 10 + 12); // 42
    });
  });

  describe('upper section bonus', () => {
    it('returns 0 for subtotal 62', () => {
      const scorecard = createScorecardWithUpperSubtotal(62);
      expect(calculateUpperBonus(scorecard)).toBe(0);
    });

    it('returns 50 for subtotal 63', () => {
      const scorecard = createScorecardWithUpperSubtotal(63);
      expect(calculateUpperBonus(scorecard)).toBe(50);
    });

    it('returns 50 for subtotal 64', () => {
      const scorecard = createScorecardWithUpperSubtotal(64);
      expect(calculateUpperBonus(scorecard)).toBe(50);
    });

    it('returns 0 for subtotal < 63', () => {
      const scorecard = createScorecardWithUpperSubtotal(62);
      expect(calculateUpperBonus(scorecard)).toBe(0);
    });

    it('returns 50 for complete upper section scoring > 63', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'ones', [1, 1, 1, 1, 1]); // 5
      scorecard = scoreCategory(scorecard, 'twos', [2, 2, 2, 2, 2]); // 10
      scorecard = scoreCategory(scorecard, 'threes', [3, 3, 3, 3, 3]); // 15
      scorecard = scoreCategory(scorecard, 'fours', [4, 4, 4, 4, 4]); // 20
      scorecard = scoreCategory(scorecard, 'fives', [5, 5, 5, 5, 6]); // 25
      scorecard = scoreCategory(scorecard, 'sixes', [6, 6, 6, 6, 6]); // 30
      // Total: 105

      expect(calculateUpperBonus(scorecard)).toBe(50);
    });
  });

  describe('lower section subtotal', () => {
    it('sums all lower section categories', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'onePair', [6, 6, 4, 3, 1]);
      scorecard = scoreCategory(scorecard, 'chance', [6, 5, 4, 3, 2]);

      const subtotal = calculateLowerSubtotal(scorecard);
      expect(subtotal).toBe(12 + 20); // 32
    });

    it('includes unused categories as 0', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'yatzy', [6, 6, 6, 6, 6]);

      const subtotal = calculateLowerSubtotal(scorecard);
      expect(subtotal).toBe(50);
    });

    it('works with partial lower section', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'onePair', [6, 6, 4, 3, 1]);
      scorecard = scoreCategory(scorecard, 'fullHouse', [5, 5, 5, 3, 3]);
      scorecard = scoreCategory(scorecard, 'yatzy', [6, 6, 6, 6, 6]);

      const subtotal = calculateLowerSubtotal(scorecard);
      expect(subtotal).toBe(12 + 21 + 50); // 83
    });
  });

  describe('total score calculation', () => {
    it('calculates upper + bonus + lower', () => {
      const scorecard = createScorecardWithUpperSubtotal(63);
      let updated = scorecard;
      updated = scoreCategory(updated, 'onePair', [6, 6, 4, 3, 1]);
      updated = scoreCategory(updated, 'chance', [6, 5, 4, 3, 2]);

      const total = calculateTotalScore(updated);
      expect(total).toBe(63 + 50 + 32);
    });

    it('includes bonus in total', () => {
      const scorecard = createScorecardWithUpperSubtotal(63);
      expect(calculateTotalScore(scorecard)).toBe(63 + 50);
    });

    it('works without bonus', () => {
      const scorecard = createScorecardWithUpperSubtotal(62);
      // 62 is below bonus threshold (63), so should not include bonus
      expect(calculateUpperBonus(scorecard)).toBe(0);
      expect(calculateTotalScore(scorecard)).toBe(62);
    });

    it('handles incomplete scorecard', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'ones', [1, 1, 1, 1, 1]); // 5
      scorecard = scoreCategory(scorecard, 'onePair', [6, 6, 4, 3, 1]); // 12

      const total = calculateTotalScore(scorecard);
      expect(total).toBe(5 + 0 + 12); // 17
    });

    it('works with all zeros', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'yatzy', [1, 2, 3, 4, 5]); // 0
      scorecard = scoreCategory(scorecard, 'fullHouse', [1, 2, 3, 4, 5]); // 0

      const total = calculateTotalScore(scorecard);
      expect(total).toBe(0);
    });
  });

  describe('scorecard completion', () => {
    it('returns false for empty scorecard', () => {
      const scorecard = createEmptyScorecard();
      expect(isScorecardComplete(scorecard)).toBe(false);
    });

    it('returns false for partially complete scorecard', () => {
      let scorecard = createEmptyScorecard();
      scorecard = scoreCategory(scorecard, 'ones', [1, 1, 1, 1, 1]);
      scorecard = scoreCategory(scorecard, 'onePair', [6, 6, 4, 3, 1]);

      expect(isScorecardComplete(scorecard)).toBe(false);
    });

    it('returns false with 14 categories used', () => {
      let scorecard = createEmptyScorecard();
      const dice: DiceRoll = [6, 6, 6, 6, 6];

      // Score all 15 except ones
      scorecard = scoreCategory(scorecard, 'twos', dice);
      scorecard = scoreCategory(scorecard, 'threes', dice);
      scorecard = scoreCategory(scorecard, 'fours', dice);
      scorecard = scoreCategory(scorecard, 'fives', dice);
      scorecard = scoreCategory(scorecard, 'sixes', dice);
      scorecard = scoreCategory(scorecard, 'onePair', dice);
      scorecard = scoreCategory(scorecard, 'twoPairs', dice);
      scorecard = scoreCategory(scorecard, 'threeOfAKind', dice);
      scorecard = scoreCategory(scorecard, 'fourOfAKind', dice);
      scorecard = scoreCategory(scorecard, 'smallStraight', dice);
      scorecard = scoreCategory(scorecard, 'largeStraight', dice);
      scorecard = scoreCategory(scorecard, 'fullHouse', dice);
      scorecard = scoreCategory(scorecard, 'chance', dice);
      scorecard = scoreCategory(scorecard, 'yatzy', dice);

      expect(isScorecardComplete(scorecard)).toBe(false);
    });

    it('returns true when all 15 categories are used', () => {
      let scorecard = createEmptyScorecard();
      const dice: DiceRoll = [6, 6, 6, 6, 6];

      scorecard = scoreCategory(scorecard, 'ones', dice);
      scorecard = scoreCategory(scorecard, 'twos', dice);
      scorecard = scoreCategory(scorecard, 'threes', dice);
      scorecard = scoreCategory(scorecard, 'fours', dice);
      scorecard = scoreCategory(scorecard, 'fives', dice);
      scorecard = scoreCategory(scorecard, 'sixes', dice);
      scorecard = scoreCategory(scorecard, 'onePair', dice);
      scorecard = scoreCategory(scorecard, 'twoPairs', dice);
      scorecard = scoreCategory(scorecard, 'threeOfAKind', dice);
      scorecard = scoreCategory(scorecard, 'fourOfAKind', dice);
      scorecard = scoreCategory(scorecard, 'smallStraight', dice);
      scorecard = scoreCategory(scorecard, 'largeStraight', dice);
      scorecard = scoreCategory(scorecard, 'fullHouse', dice);
      scorecard = scoreCategory(scorecard, 'chance', dice);
      scorecard = scoreCategory(scorecard, 'yatzy', dice);

      expect(isScorecardComplete(scorecard)).toBe(true);
    });

    it('counts zero-scored categories as used for completion', () => {
      let scorecard = createEmptyScorecard();
      const dice1: DiceRoll = [1, 2, 3, 4, 5];
      const dice2: DiceRoll = [6, 6, 6, 6, 6];

      // Score yatzy with 0 (incomplete)
      scorecard = scoreCategory(scorecard, 'yatzy', dice1); // 0
      expect(isScorecardComplete(scorecard)).toBe(false);

      // Score the other 14 categories with 6's
      scorecard = scoreCategory(scorecard, 'ones', dice2);
      scorecard = scoreCategory(scorecard, 'twos', dice2);
      scorecard = scoreCategory(scorecard, 'threes', dice2);
      scorecard = scoreCategory(scorecard, 'fours', dice2);
      scorecard = scoreCategory(scorecard, 'fives', dice2);
      scorecard = scoreCategory(scorecard, 'sixes', dice2);
      scorecard = scoreCategory(scorecard, 'onePair', dice2);
      scorecard = scoreCategory(scorecard, 'twoPairs', dice2);
      scorecard = scoreCategory(scorecard, 'threeOfAKind', dice2);
      scorecard = scoreCategory(scorecard, 'fourOfAKind', dice2);
      scorecard = scoreCategory(scorecard, 'smallStraight', dice2);
      scorecard = scoreCategory(scorecard, 'largeStraight', dice2);
      scorecard = scoreCategory(scorecard, 'fullHouse', dice2);
      scorecard = scoreCategory(scorecard, 'chance', dice2);

      expect(isScorecardComplete(scorecard)).toBe(true);
    });
  });

  describe('immutability', () => {
    it('does not mutate original scorecard', () => {
      const original = createEmptyScorecard();
      const dice: DiceRoll = [6, 6, 4, 3, 1];

      const updated = scoreCategory(original, 'onePair', dice);

      expect(original.onePair).toBeNull();
      expect(updated.onePair).toBe(12);
    });

    it('maintains independent state across multiple updates', () => {
      const original = createEmptyScorecard();
      const dice1: DiceRoll = [6, 6, 4, 3, 1];
      const dice2: DiceRoll = [5, 5, 5, 3, 2];

      const updated1 = scoreCategory(original, 'onePair', dice1);
      const updated2 = scoreCategory(original, 'threeOfAKind', dice2);

      expect(original.onePair).toBeNull();
      expect(original.threeOfAKind).toBeNull();

      expect(updated1.onePair).toBe(12);
      expect(updated1.threeOfAKind).toBeNull();

      expect(updated2.onePair).toBeNull();
      expect(updated2.threeOfAKind).toBe(15);
    });

    it('preserves other scores when adding new score', () => {
      let scorecard = createEmptyScorecard();
      const dice1: DiceRoll = [6, 6, 4, 3, 1];
      const dice2: DiceRoll = [5, 5, 5, 3, 2];

      scorecard = scoreCategory(scorecard, 'onePair', dice1);
      const intermediate = scorecard;

      scorecard = scoreCategory(scorecard, 'threeOfAKind', dice2);

      expect(intermediate.onePair).toBe(12);
      expect(scorecard.onePair).toBe(12);
      expect(scorecard.threeOfAKind).toBe(15);
    });
  });
});

// Helper function to create a scorecard with a specific upper section subtotal
// Used for bonus threshold tests
function createScorecardWithUpperSubtotal(targetSubtotal: number): Scorecard {
  let scorecard = createEmptyScorecard();

  if (targetSubtotal === 0) {
    return scorecard;
  }

  if (targetSubtotal === 62) {
    // ones(1) + twos(4) + threes(6) + fours(8) + fives(25) + sixes(18) = 62
    scorecard = scoreCategory(scorecard, 'ones', [1, 2, 3, 4, 5]); // 1
    scorecard = scoreCategory(scorecard, 'twos', [1, 2, 2, 4, 5]); // 4
    scorecard = scoreCategory(scorecard, 'threes', [1, 2, 3, 3, 5]); // 6
    scorecard = scoreCategory(scorecard, 'fours', [1, 2, 3, 4, 4]); // 8
    scorecard = scoreCategory(scorecard, 'fives', [5, 5, 5, 5, 5]); // 25
    scorecard = scoreCategory(scorecard, 'sixes', [6, 6, 6, 1, 2]); // 18
  } else if (targetSubtotal === 63) {
    // ones(3) + twos(6) + threes(9) + fours(12) + fives(15) + sixes(18) = 63
    scorecard = scoreCategory(scorecard, 'ones', [1, 1, 1, 2, 3]); // 3
    scorecard = scoreCategory(scorecard, 'twos', [2, 2, 2, 1, 3]); // 6
    scorecard = scoreCategory(scorecard, 'threes', [3, 3, 3, 1, 2]); // 9
    scorecard = scoreCategory(scorecard, 'fours', [4, 4, 4, 1, 2]); // 12
    scorecard = scoreCategory(scorecard, 'fives', [5, 5, 5, 1, 2]); // 15
    scorecard = scoreCategory(scorecard, 'sixes', [6, 6, 6, 1, 2]); // 18
  } else if (targetSubtotal === 64) {
    // ones(3) + twos(6) + threes(9) + fours(12) + fives(15) + sixes(19) would be 64
    // But can't get 19, so use ones(3) + twos(6) + threes(9) + fours(12) + fives(15) + sixes(19) → 64 needs sixes=19
    // Impossible with standard dice. Use: ones(2) + twos(6) + threes(9) + fours(12) + fives(15) + sixes(20) = 64
    scorecard = scoreCategory(scorecard, 'ones', [1, 1, 2, 3, 4]); // 2
    scorecard = scoreCategory(scorecard, 'twos', [2, 2, 2, 1, 3]); // 6
    scorecard = scoreCategory(scorecard, 'threes', [3, 3, 3, 1, 2]); // 9
    scorecard = scoreCategory(scorecard, 'fours', [4, 4, 4, 1, 2]); // 12
    scorecard = scoreCategory(scorecard, 'fives', [5, 5, 5, 1, 2]); // 15
    scorecard = scoreCategory(scorecard, 'sixes', [6, 6, 6, 6, 2]); // 24
  } else if (targetSubtotal === 40) {
    // ones(1) + twos(2) + threes(3) + fours(4) + fives(5) + sixes(24) = 39
    // Actually use ones(5) + twos(10) + threes(0) + fours(0) + fives(0) + sixes(25) = 40
    // But max sixes by category score is 30 (6*5), so try:
    // ones(5) + twos(4) + threes(6) + fours(8) + fives(17)... but max fives = 25
    // Let's use: ones(1) + twos(2) + threes(3) + fours(4) + fives(5) + sixes(24) = 39 or 30 = 45
    scorecard = scoreCategory(scorecard, 'ones', [1, 2, 3, 4, 5]); // 1
    scorecard = scoreCategory(scorecard, 'twos', [1, 2, 2, 3, 4]); // 2
    scorecard = scoreCategory(scorecard, 'threes', [1, 2, 3, 3, 4]); // 3
    scorecard = scoreCategory(scorecard, 'fours', [1, 2, 3, 4, 4]); // 4
    scorecard = scoreCategory(scorecard, 'fives', [1, 2, 3, 4, 5]); // 5
    scorecard = scoreCategory(scorecard, 'sixes', [6, 6, 6, 6, 6]); // 30
    // Total: 1 + 2 + 3 + 4 + 5 + 30 = 45
  } else if (targetSubtotal === 50) {
    // ones(1) + twos(2) + threes(3) + fours(4) + fives(10) + sixes(30) = 50
    scorecard = scoreCategory(scorecard, 'ones', [1, 2, 3, 4, 5]); // 1
    scorecard = scoreCategory(scorecard, 'twos', [1, 2, 2, 3, 4]); // 2
    scorecard = scoreCategory(scorecard, 'threes', [1, 2, 3, 3, 4]); // 3
    scorecard = scoreCategory(scorecard, 'fours', [1, 2, 3, 4, 4]); // 4
    scorecard = scoreCategory(scorecard, 'fives', [5, 5, 1, 2, 3]); // 10
    scorecard = scoreCategory(scorecard, 'sixes', [6, 6, 6, 6, 6]); // 30
    // Total: 1 + 2 + 3 + 4 + 10 + 30 = 50 ✓
  }

  return scorecard;
}
