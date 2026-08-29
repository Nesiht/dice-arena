import {
  calculateScore,
  generateDieValue,
  isValidDieValue,
  rollDice,
  type DiceRoll,
} from '../src/game';

describe('game domain utilities', () => {
  it('accepts valid dice values', () => {
    expect(isValidDieValue(1)).toBe(true);
    expect(isValidDieValue(6)).toBe(true);
  });

  it('rejects invalid dice values', () => {
    expect(isValidDieValue(0)).toBe(false);
    expect(isValidDieValue(7)).toBe(false);
    expect(isValidDieValue(2.5)).toBe(false);
    expect(isValidDieValue(Number.NaN)).toBe(false);
  });

  it('generates dice values within the allowed range', () => {
    const value = generateDieValue();

    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
    expect(isValidDieValue(value)).toBe(true);
  });

  it('rolls a complete set of five dice', () => {
    const values = rollDice();

    expect(values).toHaveLength(5);
    values.forEach((value) => {
      expect(isValidDieValue(value)).toBe(true);
    });
  });
});

describe('scoring engine', () => {
  describe('upper section', () => {
    it('scores ones correctly', () => {
      expect(calculateScore('ones', [5, 5, 5, 3, 2])).toBe(0);
      expect(calculateScore('ones', [1, 2, 3, 4, 5])).toBe(1);
      expect(calculateScore('ones', [1, 1, 1, 2, 3])).toBe(3);
    });

    it('scores twos correctly', () => {
      expect(calculateScore('twos', [5, 5, 5, 3, 2])).toBe(2);
      expect(calculateScore('twos', [1, 2, 3, 4, 5])).toBe(2);
      expect(calculateScore('twos', [2, 2, 2, 1, 3])).toBe(6);
    });

    it('scores threes correctly', () => {
      expect(calculateScore('threes', [5, 5, 5, 3, 2])).toBe(3);
      expect(calculateScore('threes', [1, 2, 3, 4, 5])).toBe(3);
      expect(calculateScore('threes', [3, 3, 3, 1, 2])).toBe(9);
    });

    it('scores fours correctly', () => {
      expect(calculateScore('fours', [5, 5, 5, 3, 2])).toBe(0);
      expect(calculateScore('fours', [1, 2, 3, 4, 5])).toBe(4);
      expect(calculateScore('fours', [4, 4, 4, 1, 2])).toBe(12);
    });

    it('scores fives correctly', () => {
      expect(calculateScore('fives', [5, 5, 5, 3, 2])).toBe(15);
      expect(calculateScore('fives', [1, 2, 3, 4, 5])).toBe(5);
      expect(calculateScore('fives', [5, 5, 5, 5, 1])).toBe(20);
    });

    it('scores sixes correctly', () => {
      expect(calculateScore('sixes', [5, 5, 5, 3, 2])).toBe(0);
      expect(calculateScore('sixes', [1, 2, 3, 4, 6])).toBe(6);
      expect(calculateScore('sixes', [6, 6, 6, 1, 2])).toBe(18);
    });
  });

  describe('one pair', () => {
    it('scores highest valid pair', () => {
      expect(calculateScore('onePair', [6, 6, 4, 3, 1])).toBe(12);
      expect(calculateScore('onePair', [6, 6, 5, 5, 1])).toBe(12);
      expect(calculateScore('onePair', [5, 5, 5, 3, 2])).toBe(10);
    });

    it('returns 0 when no pair exists', () => {
      expect(calculateScore('onePair', [1, 2, 3, 4, 5])).toBe(0);
      expect(calculateScore('onePair', [1, 2, 3, 4, 6])).toBe(0);
    });

    it('handles three of a kind as a pair', () => {
      expect(calculateScore('onePair', [6, 6, 6, 2, 1])).toBe(12);
    });

    it('handles yatzy as a pair', () => {
      expect(calculateScore('onePair', [6, 6, 6, 6, 6])).toBe(12);
      expect(calculateScore('onePair', [1, 1, 1, 1, 1])).toBe(2);
    });
  });

  describe('two pairs', () => {
    it('scores two pairs correctly', () => {
      expect(calculateScore('twoPairs', [6, 6, 5, 5, 1])).toBe(22);
      expect(calculateScore('twoPairs', [4, 4, 3, 3, 2])).toBe(14);
    });

    it('scores three of a kind with another pair as two pairs', () => {
      expect(calculateScore('twoPairs', [6, 6, 6, 4, 4])).toBe(20);
      expect(calculateScore('twoPairs', [5, 5, 5, 3, 3])).toBe(16);
    });

    it('returns 0 for single pair', () => {
      expect(calculateScore('twoPairs', [6, 6, 4, 3, 1])).toBe(0);
      expect(calculateScore('twoPairs', [5, 5, 5, 3, 2])).toBe(0);
    });

    it('returns 0 for four or five of a kind without another different value', () => {
      expect(calculateScore('twoPairs', [6, 6, 6, 6, 4])).toBe(0);
      expect(calculateScore('twoPairs', [6, 6, 6, 6, 6])).toBe(0);
    });

    it('returns 0 for no pairs', () => {
      expect(calculateScore('twoPairs', [1, 2, 3, 4, 5])).toBe(0);
    });
  });

  describe('three of a kind', () => {
    it('scores three matching dice', () => {
      expect(calculateScore('threeOfAKind', [5, 5, 5, 3, 2])).toBe(15);
    });

    it('scores only three dice when more match', () => {
      expect(calculateScore('threeOfAKind', [6, 6, 6, 6, 2])).toBe(18);
      expect(calculateScore('threeOfAKind', [6, 6, 6, 6, 6])).toBe(18);
    });

    it('returns 0 when fewer than three dice match', () => {
      expect(calculateScore('threeOfAKind', [5, 5, 3, 2, 1])).toBe(0);
      expect(calculateScore('threeOfAKind', [1, 2, 3, 4, 5])).toBe(0);
    });
  });

  describe('four of a kind', () => {
    it('scores four matching dice', () => {
      expect(calculateScore('fourOfAKind', [4, 4, 4, 4, 2])).toBe(16);
    });

    it('scores only four dice when yatzy', () => {
      expect(calculateScore('fourOfAKind', [6, 6, 6, 6, 6])).toBe(24);
      expect(calculateScore('fourOfAKind', [1, 1, 1, 1, 1])).toBe(4);
    });

    it('returns 0 when fewer than four dice match', () => {
      expect(calculateScore('fourOfAKind', [5, 5, 5, 3, 2])).toBe(0);
      expect(calculateScore('fourOfAKind', [6, 6, 6, 2, 1])).toBe(0);
      expect(calculateScore('fourOfAKind', [1, 2, 3, 4, 5])).toBe(0);
    });
  });

  describe('small straight', () => {
    it('scores small straight in any order', () => {
      expect(calculateScore('smallStraight', [1, 2, 3, 4, 5])).toBe(15);
      expect(calculateScore('smallStraight', [5, 4, 3, 2, 1])).toBe(15);
      expect(calculateScore('smallStraight', [3, 1, 4, 5, 2])).toBe(15);
    });

    it('returns 0 for non-small-straight', () => {
      expect(calculateScore('smallStraight', [1, 2, 3, 4, 4])).toBe(0);
      expect(calculateScore('smallStraight', [2, 3, 4, 5, 6])).toBe(0);
      expect(calculateScore('smallStraight', [1, 2, 3, 4, 6])).toBe(0);
      expect(calculateScore('smallStraight', [1, 1, 3, 4, 5])).toBe(0);
    });
  });

  describe('large straight', () => {
    it('scores large straight in any order', () => {
      expect(calculateScore('largeStraight', [2, 3, 4, 5, 6])).toBe(20);
      expect(calculateScore('largeStraight', [6, 5, 4, 3, 2])).toBe(20);
      expect(calculateScore('largeStraight', [4, 2, 6, 3, 5])).toBe(20);
    });

    it('returns 0 for non-large-straight', () => {
      expect(calculateScore('largeStraight', [2, 3, 4, 5, 5])).toBe(0);
      expect(calculateScore('largeStraight', [1, 2, 3, 4, 5])).toBe(0);
      expect(calculateScore('largeStraight', [2, 3, 4, 5, 1])).toBe(0);
      expect(calculateScore('largeStraight', [2, 2, 4, 5, 6])).toBe(0);
    });
  });

  describe('full house', () => {
    it('scores full house correctly', () => {
      expect(calculateScore('fullHouse', [5, 5, 5, 3, 3])).toBe(21);
      expect(calculateScore('fullHouse', [6, 6, 6, 4, 4])).toBe(26);
      expect(calculateScore('fullHouse', [2, 2, 3, 3, 3])).toBe(13);
    });

    it('returns 0 for yatzy', () => {
      expect(calculateScore('fullHouse', [6, 6, 6, 6, 6])).toBe(0);
      expect(calculateScore('fullHouse', [1, 1, 1, 1, 1])).toBe(0);
    });

    it('returns 0 for four of a kind', () => {
      expect(calculateScore('fullHouse', [6, 6, 6, 6, 4])).toBe(0);
      expect(calculateScore('fullHouse', [4, 4, 4, 4, 1])).toBe(0);
    });

    it('returns 0 for three of a kind without pair', () => {
      expect(calculateScore('fullHouse', [5, 5, 5, 3, 2])).toBe(0);
    });

    it('returns 0 for two pairs', () => {
      expect(calculateScore('fullHouse', [6, 6, 5, 5, 1])).toBe(0);
    });

    it('returns 0 for single pair', () => {
      expect(calculateScore('fullHouse', [6, 6, 4, 3, 1])).toBe(0);
    });
  });

  describe('chance', () => {
    it('scores sum of all dice', () => {
      expect(calculateScore('chance', [6, 5, 4, 3, 2])).toBe(20);
      expect(calculateScore('chance', [6, 6, 6, 6, 6])).toBe(30);
      expect(calculateScore('chance', [1, 1, 1, 1, 1])).toBe(5);
    });

    it('scores any combination', () => {
      expect(calculateScore('chance', [1, 2, 3, 4, 5])).toBe(15);
      expect(calculateScore('chance', [6, 4, 2, 1, 3])).toBe(16);
    });
  });

  describe('yatzy', () => {
    it('scores yatzy as 50 points', () => {
      expect(calculateScore('yatzy', [6, 6, 6, 6, 6])).toBe(50);
      expect(calculateScore('yatzy', [1, 1, 1, 1, 1])).toBe(50);
      expect(calculateScore('yatzy', [3, 3, 3, 3, 3])).toBe(50);
    });

    it('returns 0 for non-yatzy', () => {
      expect(calculateScore('yatzy', [6, 6, 6, 6, 5])).toBe(0);
      expect(calculateScore('yatzy', [5, 5, 5, 3, 2])).toBe(0);
      expect(calculateScore('yatzy', [1, 2, 3, 4, 5])).toBe(0);
    });
  });

  describe('cross-category edge cases', () => {
    describe('with dice [6,6,6,6,6]', () => {
      const dice: DiceRoll = [6, 6, 6, 6, 6];

      it('scores correctly across all categories', () => {
        expect(calculateScore('sixes', dice)).toBe(30);
        expect(calculateScore('onePair', dice)).toBe(12);
        expect(calculateScore('twoPairs', dice)).toBe(0);
        expect(calculateScore('threeOfAKind', dice)).toBe(18);
        expect(calculateScore('fourOfAKind', dice)).toBe(24);
        expect(calculateScore('fullHouse', dice)).toBe(0);
        expect(calculateScore('chance', dice)).toBe(30);
        expect(calculateScore('yatzy', dice)).toBe(50);
      });
    });

    describe('with dice [6,6,6,4,4]', () => {
      const dice: DiceRoll = [6, 6, 6, 4, 4];

      it('scores correctly across all categories', () => {
        expect(calculateScore('onePair', dice)).toBe(12);
        expect(calculateScore('twoPairs', dice)).toBe(20);
        expect(calculateScore('threeOfAKind', dice)).toBe(18);
        expect(calculateScore('fourOfAKind', dice)).toBe(0);
        expect(calculateScore('fullHouse', dice)).toBe(26);
        expect(calculateScore('chance', dice)).toBe(26);
        expect(calculateScore('yatzy', dice)).toBe(0);
      });
    });

    describe('with dice [5,5,5,3,2]', () => {
      const dice: DiceRoll = [5, 5, 5, 3, 2];

      it('scores correctly across all categories', () => {
        expect(calculateScore('fives', dice)).toBe(15);
        expect(calculateScore('threes', dice)).toBe(3);
        expect(calculateScore('twos', dice)).toBe(2);
        expect(calculateScore('onePair', dice)).toBe(10);
        expect(calculateScore('threeOfAKind', dice)).toBe(15);
        expect(calculateScore('fullHouse', dice)).toBe(0);
        expect(calculateScore('chance', dice)).toBe(20);
      });
    });

    describe('with dice [1,2,3,4,5]', () => {
      const dice: DiceRoll = [1, 2, 3, 4, 5];

      it('scores small straight but not large straight', () => {
        expect(calculateScore('smallStraight', dice)).toBe(15);
        expect(calculateScore('largeStraight', dice)).toBe(0);
      });

      it('scores 0 for pair categories', () => {
        expect(calculateScore('onePair', dice)).toBe(0);
        expect(calculateScore('twoPairs', dice)).toBe(0);
      });

      it('scores chance as sum', () => {
        expect(calculateScore('chance', dice)).toBe(15);
      });
    });

    describe('with dice [2,3,4,5,6]', () => {
      const dice: DiceRoll = [2, 3, 4, 5, 6];

      it('scores large straight but not small straight', () => {
        expect(calculateScore('largeStraight', dice)).toBe(20);
        expect(calculateScore('smallStraight', dice)).toBe(0);
      });

      it('scores chance as sum', () => {
        expect(calculateScore('chance', dice)).toBe(20);
      });
    });
  });

  describe('unordered dice handling', () => {
    it('handles unordered dice for straights', () => {
      expect(calculateScore('smallStraight', [5, 1, 3, 2, 4])).toBe(15);
      expect(calculateScore('largeStraight', [6, 2, 4, 3, 5])).toBe(20);
    });

    it('handles unordered dice for full house', () => {
      expect(calculateScore('fullHouse', [3, 5, 3, 5, 3])).toBe(19);
      expect(calculateScore('fullHouse', [4, 6, 4, 6, 6])).toBe(26);
    });
  });
});
