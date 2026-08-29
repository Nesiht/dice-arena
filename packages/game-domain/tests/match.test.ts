import {
  createMatch,
  rollMatch,
  setMatchDieHeld,
  scoreMatchCategory,
  MatchError,
  type MatchState,
} from '../src/match';
import { isCategoryUsed } from '../src/scorecard';
import { type DiceRoll, type ScoreCategory } from '../src/game';

describe('Match domain', () => {
  describe('match creation', () => {
    it('creates an ACTIVE match', () => {
      const match = createMatch('A', 'B');
      expect(match.status).toBe('ACTIVE');
    });

    it('has two distinct player IDs', () => {
      const match = createMatch('playerA', 'playerB');
      expect(match.playerAId).toBe('playerA');
      expect(match.playerBId).toBe('playerB');
    });

    it('sets player A as active', () => {
      const match = createMatch('A', 'B');
      expect(match.activePlayerId).toBe('A');
    });

    it('initializes both scorecards as empty', () => {
      const match = createMatch('A', 'B');
      expect(match.playerAScorecard.ones).toBeNull();
      expect(match.playerBScorecard.ones).toBeNull();
    });

    it('creates independent scorecards', () => {
      const match = createMatch('A', 'B');
      const scoreA = match.playerAScorecard;
      const scoreB = match.playerBScorecard;
      expect(scoreA).not.toBe(scoreB);
    });

    it('creates fresh TurnState', () => {
      const match = createMatch('A', 'B');
      expect(match.currentTurn.status).toBe('ACTIVE');
      expect(match.currentTurn.rollCount).toBe(0);
      expect(match.currentTurn.currentDice).toBeNull();
    });

    it('has no final result initially', () => {
      const match = createMatch('A', 'B');
      expect(match.status).toBe('ACTIVE');
    });

    it('rejects identical player IDs', () => {
      expect(() => createMatch('A', 'A')).toThrow(MatchError);
      expect(() => createMatch('A', 'A')).toThrow(/distinct players/);
    });

    it('creates independent matches', () => {
      const match1 = createMatch('A', 'B');
      const match2 = createMatch('C', 'D');
      expect(match1).not.toBe(match2);
      expect(match1.playerAId).not.toBe(match2.playerAId);
    });
  });

  describe('player A turn', () => {
    it('allows player A to roll', () => {
      const match = createMatch('A', 'B');
      const dice: DiceRoll = [5, 5, 5, 3, 2];
      const rolled = rollMatch(match, 'A', dice);

      expect(rolled.currentTurn.currentDice).toEqual(dice);
    });

    it('allows player A to hold', () => {
      const match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      rolled = setMatchDieHeld(rolled, 'A', 0, true);

      expect(rolled.currentTurn.heldState?.[0]).toBe(true);
    });

    it('allows player A to score', () => {
      const match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      rolled = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      expect(rolled.playerAScorecard.threeOfAKind).toBe(15);
    });

    it('rejects player B rolling during A turn', () => {
      const match = createMatch('A', 'B');
      const dice: DiceRoll = [5, 5, 5, 3, 2];

      expect(() => rollMatch(match, 'B', dice)).toThrow(MatchError);
      expect(() => rollMatch(match, 'B', dice)).toThrow(/active player/);
    });

    it('rejects player B holding during A turn', () => {
      const match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);

      expect(() => setMatchDieHeld(rolled, 'B', 0, true)).toThrow(MatchError);
      expect(() => setMatchDieHeld(rolled, 'B', 0, true)).toThrow(/active player/);
    });

    it('rejects player B scoring during A turn', () => {
      const match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);

      expect(() => scoreMatchCategory(rolled, 'B', 'threeOfAKind')).toThrow(MatchError);
      expect(() => scoreMatchCategory(rolled, 'B', 'threeOfAKind')).toThrow(/active player/);
    });

    it('rejects unknown player rolling', () => {
      const match = createMatch('A', 'B');
      const dice: DiceRoll = [5, 5, 5, 3, 2];

      expect(() => rollMatch(match, 'UNKNOWN', dice)).toThrow(MatchError);
    });

    it('rejects unknown player holding', () => {
      const match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);

      expect(() => setMatchDieHeld(rolled, 'UNKNOWN', 0, true)).toThrow(MatchError);
    });

    it('rejects unknown player scoring', () => {
      const match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);

      expect(() => scoreMatchCategory(rolled, 'UNKNOWN', 'threeOfAKind')).toThrow(MatchError);
    });
  });

  describe('player transition', () => {
    it('switches to player B after A scores', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      expect(match.activePlayerId).toBe('B');
    });

    it('gives B a fresh TurnState', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      expect(match.currentTurn.rollCount).toBe(0);
      expect(match.currentTurn.currentDice).toBeNull();
    });

    it('preserves A scorecard after A scores', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      expect(match.playerAScorecard.threeOfAKind).toBe(15);
    });

    it('leaves B scorecard unchanged when A scores', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      expect(match.playerBScorecard.threeOfAKind).toBeNull();
    });

    it('switches back to A after B scores', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      rolled = rollMatch(match, 'B', [6, 6, 6, 4, 4]);
      match = scoreMatchCategory(rolled, 'B', 'fullHouse');

      expect(match.activePlayerId).toBe('A');
    });

    it('gives A a fresh TurnState on return', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      rolled = rollMatch(match, 'B', [6, 6, 6, 4, 4]);
      match = scoreMatchCategory(rolled, 'B', 'fullHouse');

      expect(match.currentTurn.rollCount).toBe(0);
      expect(match.currentTurn.currentDice).toBeNull();
    });

    it('retains both scorecards after two turns', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      rolled = rollMatch(match, 'B', [6, 6, 6, 4, 4]);
      match = scoreMatchCategory(rolled, 'B', 'fullHouse');

      expect(match.playerAScorecard.threeOfAKind).toBe(15);
      expect(match.playerBScorecard.fullHouse).toBe(26);
    });
  });

  describe('delegation', () => {
    it('delegates fourth roll rejection to Turn Engine', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      rolled = rollMatch(rolled, 'A', [5, 5, 5, 3, 2]);
      rolled = rollMatch(rolled, 'A', [5, 5, 5, 3, 2]);

      const dice: DiceRoll = [1, 1, 1, 1, 1];
      expect(() => rollMatch(rolled, 'A', dice)).toThrow();
    });

    it('delegates held dice preservation to Turn Engine', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [2, 6, 6, 3, 6]);
      rolled = setMatchDieHeld(rolled, 'A', 1, true);
      rolled = setMatchDieHeld(rolled, 'A', 2, true);

      rolled = rollMatch(rolled, 'A', [5, 6, 6, 1, 6]);

      expect(rolled.currentTurn.currentDice?.[1]).toBe(6);
      expect(rolled.currentTurn.currentDice?.[2]).toBe(6);
    });

    it('delegates all-held roll rejection to Turn Engine', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [6, 6, 6, 6, 6]);

      for (let i = 0; i < 5; i++) {
        rolled = setMatchDieHeld(rolled, 'A', i, true);
      }

      const dice: DiceRoll = [1, 1, 1, 1, 1];
      expect(() => rollMatch(rolled, 'A', dice)).toThrow();
    });

    it('delegates scoring-before-roll rejection to Turn Engine', () => {
      const match = createMatch('A', 'B');

      expect(() => scoreMatchCategory(match, 'A', 'threeOfAKind')).toThrow();
    });
  });

  describe('scorecard ownership', () => {
    it('A scoring modifies only A scorecard', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      expect(match.playerAScorecard.threeOfAKind).toBe(15);
      expect(match.playerBScorecard.threeOfAKind).toBeNull();
    });

    it('B scoring modifies only B scorecard', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      rolled = rollMatch(match, 'B', [6, 6, 6, 4, 4]);
      match = scoreMatchCategory(rolled, 'B', 'fullHouse');

      expect(match.playerBScorecard.fullHouse).toBe(26);
      expect(match.playerAScorecard.fullHouse).toBeNull();
    });

    it('stores zero score correctly', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [1, 2, 3, 4, 5]);
      match = scoreMatchCategory(rolled, 'A', 'yatzy');

      expect(match.playerAScorecard.yatzy).toBe(0);
      expect(isCategoryUsed(match.playerAScorecard, 'yatzy')).toBe(true);
    });

    it('propagates duplicate category error', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      rolled = rollMatch(match, 'B', [1, 2, 3, 4, 5]);
      rolled = rollMatch(rolled, 'B', [1, 2, 3, 4, 5]);
      rolled = rollMatch(rolled, 'B', [1, 2, 3, 4, 5]);
      match = scoreMatchCategory(rolled, 'B', 'chance');

      rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);

      expect(() => scoreMatchCategory(rolled, 'A', 'threeOfAKind')).toThrow();
    });
  });

  describe('match remains active', () => {
    it('one complete scorecard does not end match', () => {
      let match = createMatch('A', 'B');
      const dice: DiceRoll = [6, 6, 6, 6, 6];

      // Score all 15 categories for A
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

      for (let i = 0; i < 15; i++) {
        let rolled = rollMatch(match, match.activePlayerId, dice);
        match = scoreMatchCategory(rolled, match.activePlayerId, categories[i] as ScoreCategory);
      }

      // After 15 turns, A is complete but B is not
      // Current active player should be B, and match should still be ACTIVE
      expect(match.status).toBe('ACTIVE');
    });
  });

  describe('match completion', () => {
    it('both scorecards complete triggers COMPLETED status', () => {
      let match = createMatch('A', 'B');
      const dice: DiceRoll = [6, 6, 6, 6, 6];

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

      // Complete both scorecards
      for (let i = 0; i < 30; i++) {
        let rolled = rollMatch(match, match.activePlayerId, dice);
        match = scoreMatchCategory(rolled, match.activePlayerId, categories[i % 15]);
      }

      expect(match.status).toBe('COMPLETED');
    });

    it('calculates final scores', () => {
      let match = createMatch('A', 'B');
      const dice: DiceRoll = [6, 6, 6, 6, 6];

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

      for (let i = 0; i < 30; i++) {
        let rolled = rollMatch(match, match.activePlayerId, dice);
        match = scoreMatchCategory(rolled, match.activePlayerId, categories[i % 15]);
      }

      expect(match.status).toBe('COMPLETED');
      if (match.status === 'COMPLETED') {
        expect(match.finalResult.playerAFinalScore).toBeDefined();
        expect(match.finalResult.playerBFinalScore).toBeDefined();
      }
    });

    it('A WIN when A > B', () => {
      // Create a match where A has higher total than B
      let match = createMatch('A', 'B');
      let rolled: MatchState;

      const sixes: DiceRoll = [6, 6, 6, 6, 6];
      const ones: DiceRoll = [1, 1, 1, 1, 1];

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

      for (let round = 0; round < 15; round++) {
        // A scores with sixes (higher)
        rolled = rollMatch(match, 'A', sixes);
        match = scoreMatchCategory(rolled, 'A', categories[round]);

        // B scores with ones (lower)
        rolled = rollMatch(match, 'B', ones);
        match = scoreMatchCategory(rolled, 'B', categories[round]);
      }

      expect(match.status).toBe('COMPLETED');
      if (match.status === 'COMPLETED') {
        expect(match.finalResult.playerAResult).toBe('WIN');
        expect(match.finalResult.playerBResult).toBe('LOSS');
      }
    });

    it('A LOSS when A < B', () => {
      let match = createMatch('A', 'B');
      let rolled: MatchState;

      const ones: DiceRoll = [1, 1, 1, 1, 1];
      const sixes: DiceRoll = [6, 6, 6, 6, 6];

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

      for (let round = 0; round < 15; round++) {
        // A scores with ones (lower)
        rolled = rollMatch(match, 'A', ones);
        match = scoreMatchCategory(rolled, 'A', categories[round]);

        // B scores with sixes (higher)
        rolled = rollMatch(match, 'B', sixes);
        match = scoreMatchCategory(rolled, 'B', categories[round]);
      }

      expect(match.status).toBe('COMPLETED');
      if (match.status === 'COMPLETED') {
        expect(match.finalResult.playerAResult).toBe('LOSS');
        expect(match.finalResult.playerBResult).toBe('WIN');
      }
    });

    it('DRAW when scores equal', () => {
      let match = createMatch('A', 'B');
      let rolled: MatchState;

      const sixes: DiceRoll = [6, 6, 6, 6, 6];

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

      for (let round = 0; round < 15; round++) {
        // Both score with same dice (sixes), so scores are equal
        rolled = rollMatch(match, 'A', sixes);
        match = scoreMatchCategory(rolled, 'A', categories[round]);

        rolled = rollMatch(match, 'B', sixes);
        match = scoreMatchCategory(rolled, 'B', categories[round]);
      }

      expect(match.status).toBe('COMPLETED');
      if (match.status === 'COMPLETED') {
        expect(match.finalResult.playerAResult).toBe('DRAW');
        expect(match.finalResult.playerBResult).toBe('DRAW');
      }
    });
  });

  describe('completed match behavior', () => {
    it('rejects roll on completed match', () => {
      let match = createMatch('A', 'B');
      const dice: DiceRoll = [6, 6, 6, 6, 6];

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

      for (let i = 0; i < 30; i++) {
        let rolled = rollMatch(match, match.activePlayerId, dice);
        match = scoreMatchCategory(rolled, match.activePlayerId, categories[i % 15]);
      }

      expect(() => rollMatch(match, 'A', dice)).toThrow(MatchError);
      expect(() => rollMatch(match, 'A', dice)).toThrow(/completed match/);
    });

    it('rejects hold on completed match', () => {
      let match = createMatch('A', 'B');
      const dice: DiceRoll = [6, 6, 6, 6, 6];

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

      for (let i = 0; i < 30; i++) {
        let rolled = rollMatch(match, match.activePlayerId, dice);
        match = scoreMatchCategory(rolled, match.activePlayerId, categories[i % 15]);
      }

      expect(() => setMatchDieHeld(match, 'A', 0, true)).toThrow(MatchError);
    });

    it('rejects score on completed match', () => {
      let match = createMatch('A', 'B');
      const dice: DiceRoll = [6, 6, 6, 6, 6];

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

      for (let i = 0; i < 30; i++) {
        let rolled = rollMatch(match, match.activePlayerId, dice);
        match = scoreMatchCategory(rolled, match.activePlayerId, categories[i % 15]);
      }

      expect(() => scoreMatchCategory(match, 'A', 'ones')).toThrow(MatchError);
    });

    it('preserves final result', () => {
      let match = createMatch('A', 'B');
      const dice: DiceRoll = [6, 6, 6, 6, 6];

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

      for (let i = 0; i < 30; i++) {
        let rolled = rollMatch(match, match.activePlayerId, dice);
        match = scoreMatchCategory(rolled, match.activePlayerId, categories[i % 15]);
      }

      expect(match.status).toBe('COMPLETED');
      if (match.status === 'COMPLETED') {
        expect(match.finalResult.playerAFinalScore).toBeDefined();
        expect(match.finalResult.playerBFinalScore).toBeDefined();
      }
    });
  });

  describe('immutability', () => {
    it('roll does not mutate original match', () => {
      const original = createMatch('A', 'B');
      const dice: DiceRoll = [5, 5, 5, 3, 2];

      rollMatch(original, 'A', dice);

      expect(original.currentTurn.currentDice).toBeNull();
      expect(original.currentTurn.rollCount).toBe(0);
    });

    it('hold does not mutate original match', () => {
      const original = createMatch('A', 'B');
      const dice: DiceRoll = [5, 5, 5, 3, 2];
      let rolled = rollMatch(original, 'A', dice);

      setMatchDieHeld(rolled, 'A', 0, true);

      expect(rolled.currentTurn.heldState?.[0]).toBe(false);
    });

    it('score does not mutate original scorecard', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);

      const scoreABefore = match.playerAScorecard;
      scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      expect(scoreABefore.threeOfAKind).toBeNull();
    });

    it('player transition creates new match', () => {
      let match = createMatch('A', 'B');
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      const matchAfterA = scoreMatchCategory(rolled, 'A', 'threeOfAKind');

      expect(matchAfterA).not.toBe(match);
      expect(match.activePlayerId).toBe('A');
      expect(matchAfterA.activePlayerId).toBe('B');
    });

    it('completion creates new match', () => {
      let match = createMatch('A', 'B');
      const dice: DiceRoll = [6, 6, 6, 6, 6];

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

      const matchBefore = match;
      for (let i = 0; i < 30; i++) {
        let rolled = rollMatch(match, match.activePlayerId, dice);
        match = scoreMatchCategory(rolled, match.activePlayerId, categories[i % 15]);
      }

      expect(match).not.toBe(matchBefore);
      expect(matchBefore.status).toBe('ACTIVE');
      expect(match.status).toBe('COMPLETED');
    });
  });

  describe('determinism', () => {
    it('identical inputs produce equivalent results', () => {
      const match1 = createMatch('A', 'B');
      const match2 = createMatch('A', 'B');

      const dice: DiceRoll = [5, 5, 5, 3, 2];
      const rolled1 = rollMatch(match1, 'A', dice);
      const rolled2 = rollMatch(match2, 'A', dice);

      expect(rolled1.currentTurn.currentDice).toEqual(rolled2.currentTurn.currentDice);
      expect(rolled1.activePlayerId).toBe(rolled2.activePlayerId);
    });
  });

  describe('alternating turn scenario', () => {
    it('alternates correctly between A and B', () => {
      let match = createMatch('A', 'B');

      // A ROLL
      let rolled = rollMatch(match, 'A', [5, 5, 5, 3, 2]);
      expect(rolled.activePlayerId).toBe('A');

      // A SCORE
      match = scoreMatchCategory(rolled, 'A', 'threeOfAKind');
      expect(match.activePlayerId).toBe('B');
      expect(match.playerAScorecard.threeOfAKind).toBe(15);
      expect(match.playerBScorecard.threeOfAKind).toBeNull();

      // B ROLL
      rolled = rollMatch(match, 'B', [6, 6, 6, 4, 4]);
      expect(rolled.activePlayerId).toBe('B');

      // B SCORE
      match = scoreMatchCategory(rolled, 'B', 'fullHouse');
      expect(match.activePlayerId).toBe('A');
      expect(match.playerBScorecard.fullHouse).toBe(26);
      expect(match.playerAScorecard.fullHouse).toBeNull();
      expect(match.playerAScorecard.threeOfAKind).toBe(15);
    });
  });

  describe('zero score scenario', () => {
    it('zero score completes turn normally', () => {
      let match = createMatch('A', 'B');

      // A rolls incompatible dice
      let rolled = rollMatch(match, 'A', [1, 2, 3, 4, 5]);

      // A scores YATZY (incompatible, will be 0)
      match = scoreMatchCategory(rolled, 'A', 'yatzy');

      expect(match.playerAScorecard.yatzy).toBe(0);
      expect(match.activePlayerId).toBe('B');
    });
  });

  describe('important draw scenario', () => {
    it('draw result when final scores equal', () => {
      let match = createMatch('A', 'B');
      const sixes: DiceRoll = [6, 6, 6, 6, 6];

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

      for (let round = 0; round < 15; round++) {
        let rolled = rollMatch(match, 'A', sixes);
        match = scoreMatchCategory(rolled, 'A', categories[round]);

        rolled = rollMatch(match, 'B', sixes);
        match = scoreMatchCategory(rolled, 'B', categories[round]);
      }

      expect(match.status).toBe('COMPLETED');
      if (match.status === 'COMPLETED') {
        expect(match.finalResult.playerAResult).toBe('DRAW');
        expect(match.finalResult.playerBResult).toBe('DRAW');
        expect(match.finalResult.playerAFinalScore).toBe(match.finalResult.playerBFinalScore);
      }
    });
  });
});
