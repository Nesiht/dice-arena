import {
  createTurn,
  applyRoll,
  setDieHeld,
  scoreTurn,
  isScoringAllowed,
  TurnError,
} from '../src/turn';
import { createEmptyScorecard, isCategoryUsed, scoreCategory } from '../src/scorecard';
import { type DiceRoll } from '../src/game';

describe('Turn domain', () => {
  describe('initial state', () => {
    it('creates an active turn', () => {
      const turn = createTurn();
      expect(turn.status).toBe('ACTIVE');
    });

    it('starts with zero rolls', () => {
      const turn = createTurn();
      expect(turn.rollCount).toBe(0);
    });

    it('has no current dice', () => {
      const turn = createTurn();
      expect(turn.currentDice).toBeNull();
    });

    it('has no held state', () => {
      const turn = createTurn();
      expect(turn.heldState).toBeNull();
    });

    it('does not allow scoring', () => {
      const turn = createTurn();
      expect(isScoringAllowed(turn)).toBe(false);
    });

    it('creates independent turns', () => {
      const turn1 = createTurn();
      const turn2 = createTurn();
      expect(turn1).not.toBe(turn2);
    });
  });

  describe('first roll', () => {
    it('accepts authoritative dice', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];

      const rolled = applyRoll(turn, dice);

      expect(rolled.currentDice).toEqual(dice);
    });

    it('increments roll count to 1', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];

      const rolled = applyRoll(turn, dice);

      expect(rolled.rollCount).toBe(1);
    });

    it('initializes all dice unheld', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];

      const rolled = applyRoll(turn, dice);

      expect(rolled.heldState).toEqual([false, false, false, false, false]);
    });

    it('keeps turn active', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];

      const rolled = applyRoll(turn, dice);

      expect(rolled.status).toBe('ACTIVE');
    });

    it('allows scoring after roll 1', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];

      const rolled = applyRoll(turn, dice);

      expect(isScoringAllowed(rolled)).toBe(true);
    });

    it('does not mutate original turn', () => {
      const original = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];

      applyRoll(original, dice);

      expect(original.rollCount).toBe(0);
      expect(original.currentDice).toBeNull();
    });
  });

  describe('hold/release', () => {
    it('holds individual dice by position', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];
      let rolled = applyRoll(turn, dice);

      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, true);
      rolled = setDieHeld(rolled, 4, true);

      expect(rolled.heldState).toEqual([false, true, true, false, true]);
    });

    it('releases held dice', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];
      let rolled = applyRoll(turn, dice);

      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, true);
      rolled = setDieHeld(rolled, 1, false);

      expect(rolled.heldState).toEqual([false, false, true, false, false]);
    });

    it('handles duplicate-value dice by position', () => {
      const turn = createTurn();
      const dice: DiceRoll = [6, 6, 6, 3, 3];
      let rolled = applyRoll(turn, dice);

      // Hold the first two 6's but not the third
      rolled = setDieHeld(rolled, 0, true);
      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, false);

      expect(rolled.heldState).toEqual([true, true, false, false, false]);
    });

    it('rejects invalid die index (negative)', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];
      const rolled = applyRoll(turn, dice);

      expect(() => setDieHeld(rolled, -1, true)).toThrow(TurnError);
      expect(() => setDieHeld(rolled, -1, true)).toThrow(/Invalid die index/);
    });

    it('rejects invalid die index (too high)', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];
      const rolled = applyRoll(turn, dice);

      expect(() => setDieHeld(rolled, 5, true)).toThrow(TurnError);
      expect(() => setDieHeld(rolled, 5, true)).toThrow(/Invalid die index/);
    });

    it('rejects non-integer die index', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];
      const rolled = applyRoll(turn, dice);

      expect(() => setDieHeld(rolled, 1.5, true)).toThrow(TurnError);
    });

    it('rejects hold before first roll', () => {
      const turn = createTurn();

      expect(() => setDieHeld(turn, 0, true)).toThrow(TurnError);
      expect(() => setDieHeld(turn, 0, true)).toThrow(/before first roll/);
    });

    it('rejects hold changes after roll 3', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);
      rolled = applyRoll(rolled, [6, 6, 6, 4, 6]);

      expect(() => setDieHeld(rolled, 0, true)).toThrow(TurnError);
      expect(() => setDieHeld(rolled, 0, true)).toThrow(/after third roll/);
    });

    it('does not mutate original turn on hold', () => {
      const turn = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];
      const rolled = applyRoll(turn, dice);

      setDieHeld(rolled, 1, true);

      expect(rolled.heldState).toEqual([false, false, false, false, false]);
    });
  });

  describe('second roll', () => {
    it('preserves held dice', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, true);
      rolled = setDieHeld(rolled, 4, true);

      // Roll 2 with new values for positions 0 and 3
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);

      expect(rolled.currentDice).toEqual([5, 6, 6, 1, 6]);
      expect(rolled.heldState).toEqual([false, true, true, false, true]);
    });

    it('rejects if held positions change', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = setDieHeld(rolled, 1, true);

      // Try to change position 1 (which is held) from 6 to 5
      expect(() => applyRoll(rolled, [2, 5, 6, 3, 6])).toThrow(TurnError);
      expect(() => applyRoll(rolled, [2, 5, 6, 3, 6])).toThrow(
        /Held die at position 1 cannot change/,
      );
    });

    it('allows unheld positions to reroll to the same value', () => {
      // Semantic edge case: unheld position may legitimately reroll to same value
      // Position 0 is NOT held, so it may contain any valid die value, including the same value
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, true);
      rolled = setDieHeld(rolled, 4, true);

      // Roll 2: positions 0 and 3 are unheld
      // Position 0 rerolls but happens to get value 2 again (same as before)
      // This MUST be accepted - held state determines constraints, not numeric change
      rolled = applyRoll(rolled, [2, 6, 6, 5, 6]);

      expect(rolled.currentDice).toEqual([2, 6, 6, 5, 6]);
      expect(rolled.rollCount).toBe(2);
    });

    it('increments roll count to 2', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);

      expect(rolled.rollCount).toBe(2);
    });

    it('allows scoring after roll 2', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);

      expect(isScoringAllowed(rolled)).toBe(true);
    });
  });

  describe('third roll', () => {
    it('preserves held dice', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, true);
      rolled = setDieHeld(rolled, 4, true);

      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);
      rolled = applyRoll(rolled, [6, 6, 6, 4, 6]);

      expect(rolled.currentDice).toEqual([6, 6, 6, 4, 6]);
      expect(rolled.heldState).toEqual([false, true, true, false, true]);
    });

    it('increments roll count to 3', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);
      rolled = applyRoll(rolled, [6, 6, 6, 4, 6]);

      expect(rolled.rollCount).toBe(3);
    });

    it('rejects a fourth roll', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);
      rolled = applyRoll(rolled, [6, 6, 6, 4, 6]);

      expect(() => applyRoll(rolled, [1, 1, 1, 1, 1])).toThrow(TurnError);
      expect(() => applyRoll(rolled, [1, 1, 1, 1, 1])).toThrow(/Cannot roll more than 3 times/);
    });

    it('allows scoring after roll 3', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);
      rolled = applyRoll(rolled, [6, 6, 6, 4, 6]);

      expect(isScoringAllowed(rolled)).toBe(true);
    });
  });

  describe('all dice held', () => {
    it('allows state with all dice held', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 6, 6, 6]);

      for (let i = 0; i < 5; i++) {
        rolled = setDieHeld(rolled, i, true);
      }

      expect(rolled.heldState).toEqual([true, true, true, true, true]);
    });

    it('rejects roll while all dice are held', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 6, 6, 6]);

      for (let i = 0; i < 5; i++) {
        rolled = setDieHeld(rolled, i, true);
      }

      expect(() => applyRoll(rolled, [1, 1, 1, 1, 1])).toThrow(TurnError);
      expect(() => applyRoll(rolled, [1, 1, 1, 1, 1])).toThrow(
        /Cannot roll when all five dice are held/,
      );
    });

    it('allows roll after releasing at least one die', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 6, 6, 6]);

      for (let i = 0; i < 5; i++) {
        rolled = setDieHeld(rolled, i, true);
      }

      rolled = setDieHeld(rolled, 0, false);
      rolled = applyRoll(rolled, [1, 6, 6, 6, 6]);

      expect(rolled.currentDice).toEqual([1, 6, 6, 6, 6]);
      expect(rolled.rollCount).toBe(2);
    });

    it('allows scoring with all dice held', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 6, 6, 6]);

      for (let i = 0; i < 5; i++) {
        rolled = setDieHeld(rolled, i, true);
      }

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'yatzy');

      expect(result.turn.status).toBe('COMPLETED');
    });
  });

  describe('early scoring', () => {
    it('scores after roll 1', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'onePair');

      expect(result.turn.status).toBe('COMPLETED');
      expect(result.scorecard.onePair).toBe(12);
    });

    it('scores after roll 2', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, true);
      rolled = setDieHeld(rolled, 4, true);
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'onePair');

      expect(result.turn.status).toBe('COMPLETED');
      expect(result.scorecard.onePair).toBe(12);
    });

    it('scores after roll 3', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, true);
      rolled = setDieHeld(rolled, 4, true);
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);
      rolled = applyRoll(rolled, [6, 6, 6, 4, 6]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'onePair');

      expect(result.turn.status).toBe('COMPLETED');
      expect(result.scorecard.onePair).toBe(12);
    });
  });

  describe('zero scoring', () => {
    it('allows zero score as valid', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [1, 2, 3, 4, 5]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'yatzy');

      expect(result.scorecard.yatzy).toBe(0);
      expect(result.turn.status).toBe('COMPLETED');
    });

    it('marks zero-scored category as used', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [1, 2, 3, 4, 5]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'yatzy');

      expect(isCategoryUsed(result.scorecard, 'yatzy')).toBe(true);
    });

    it('counts zero toward turn completion', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [1, 2, 3, 4, 5]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'yatzy');

      expect(result.turn.status).toBe('COMPLETED');
    });
  });

  describe('duplicate category error', () => {
    it('rejects duplicate category', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      let updated = scoreCategory(scorecard, 'onePair', rolled.currentDice!);

      // Try to score the same category again with different dice
      rolled = applyRoll(rolled, [5, 5, 3, 2, 1]);

      expect(() => scoreTurn(rolled, updated, 'onePair')).toThrow();
    });

    it('keeps turn active on duplicate error', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      const updated = scoreCategory(scorecard, 'onePair', rolled.currentDice!);

      rolled = applyRoll(rolled, [5, 5, 3, 2, 1]);

      try {
        scoreTurn(rolled, updated, 'onePair');
      } catch {
        // Expected
      }

      expect(rolled.status).toBe('ACTIVE');
    });

    it('does not mutate scorecard on duplicate error', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      const updated = scoreCategory(scorecard, 'onePair', rolled.currentDice!);
      const scoreBefore = updated.onePair;

      rolled = applyRoll(rolled, [5, 5, 3, 2, 1]);

      try {
        scoreTurn(rolled, updated, 'onePair');
      } catch {
        // Expected
      }

      expect(updated.onePair).toBe(scoreBefore);
    });
  });

  describe('completion behavior', () => {
    it('completes turn on successful scoring', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'onePair');

      expect(result.turn.status).toBe('COMPLETED');
    });

    it('rejects roll on completed turn', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'onePair');

      expect(() => applyRoll(result.turn, [1, 1, 1, 1, 1])).toThrow(TurnError);
      expect(() => applyRoll(result.turn, [1, 1, 1, 1, 1])).toThrow(/completed turn/);
    });

    it('rejects hold on completed turn', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'onePair');

      expect(() => setDieHeld(result.turn, 0, true)).toThrow(TurnError);
      expect(() => setDieHeld(result.turn, 0, true)).toThrow(/completed turn/);
    });

    it('rejects second scoring on completed turn', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'onePair');

      expect(() => scoreTurn(result.turn, result.scorecard, 'twos')).toThrow(TurnError);
      expect(() => scoreTurn(result.turn, result.scorecard, 'twos')).toThrow(/completed turn/);
    });
  });

  describe('immutability', () => {
    it('does not mutate original turn on roll', () => {
      const original = createTurn();
      const dice: DiceRoll = [6, 6, 4, 3, 1];

      const rolled = applyRoll(original, dice);

      expect(original.rollCount).toBe(0);
      expect(original.currentDice).toBeNull();
      expect(original).not.toBe(rolled);
    });

    it('does not mutate original turn on hold', () => {
      const original = createTurn();
      const dice: DiceRoll = [6, 6, 4, 3, 1];
      const rolled = applyRoll(original, dice);

      const held = setDieHeld(rolled, 1, true);

      expect(rolled.heldState).toEqual([false, false, false, false, false]);
      expect(rolled).not.toBe(held);
    });

    it('maintains independent state across multiple rolls', () => {
      const turn1 = createTurn();
      const roll1a = applyRoll(turn1, [2, 6, 6, 3, 6]);
      const roll1b = applyRoll(turn1, [5, 5, 5, 1, 1]);

      expect(roll1a.currentDice).toEqual([2, 6, 6, 3, 6]);
      expect(roll1b.currentDice).toEqual([5, 5, 5, 1, 1]);
      expect(roll1a).not.toBe(roll1b);
    });

    it('does not mutate scorecard on scoring', () => {
      let turn = createTurn();
      let rolled = applyRoll(turn, [6, 6, 4, 3, 1]);

      const scorecard = createEmptyScorecard();
      scoreTurn(rolled, scorecard, 'onePair');

      expect(scorecard.onePair).toBeNull();
    });
  });

  describe('determinism', () => {
    it('produces same result for identical inputs', () => {
      const turn1 = createTurn();
      const turn2 = createTurn();

      const dice: DiceRoll = [2, 6, 6, 3, 6];
      const rolled1 = applyRoll(turn1, dice);
      const rolled2 = applyRoll(turn2, dice);

      expect(rolled1.rollCount).toBe(rolled2.rollCount);
      expect(rolled1.currentDice).toEqual(rolled2.currentDice);
      expect(rolled1.heldState).toEqual(rolled2.heldState);
    });

    it('produces consistent hold state changes', () => {
      const turn1 = createTurn();
      const turn2 = createTurn();
      const dice: DiceRoll = [2, 6, 6, 3, 6];

      let rolled1 = applyRoll(turn1, dice);
      let rolled2 = applyRoll(turn2, dice);

      rolled1 = setDieHeld(rolled1, 1, true);
      rolled2 = setDieHeld(rolled2, 1, true);

      expect(rolled1.heldState).toEqual(rolled2.heldState);
    });
  });

  describe('complete turn scenario', () => {
    it('executes full turn: roll 1 → hold → roll 2 → hold → roll 3 → score', () => {
      // START
      let turn = createTurn();

      // ROLL 1: [2,6,6,3,6]
      let rolled = applyRoll(turn, [2, 6, 6, 3, 6]);
      expect(rolled.rollCount).toBe(1);
      expect(rolled.currentDice).toEqual([2, 6, 6, 3, 6]);

      // HOLD positions 1, 2, 4 (keeping the three 6's)
      rolled = setDieHeld(rolled, 1, true);
      rolled = setDieHeld(rolled, 2, true);
      rolled = setDieHeld(rolled, 4, true);
      expect(rolled.heldState).toEqual([false, true, true, false, true]);

      // ROLL 2: unheld positions 0,3 become 5,1
      rolled = applyRoll(rolled, [5, 6, 6, 1, 6]);
      expect(rolled.rollCount).toBe(2);
      expect(rolled.currentDice).toEqual([5, 6, 6, 1, 6]);
      expect(rolled.heldState).toEqual([false, true, true, false, true]);

      // ROLL 3: unheld positions 0,3 become 6,4
      rolled = applyRoll(rolled, [6, 6, 6, 4, 6]);
      expect(rolled.rollCount).toBe(3);
      expect(rolled.currentDice).toEqual([6, 6, 6, 4, 6]);

      // SCORE: fourOfAKind with current dice [6,6,6,4,6]
      const scorecard = createEmptyScorecard();
      const result = scoreTurn(rolled, scorecard, 'fourOfAKind');

      expect(result.turn.status).toBe('COMPLETED');
      expect(result.scorecard.fourOfAKind).toBe(24); // 6+6+6+6
    });
  });
});
