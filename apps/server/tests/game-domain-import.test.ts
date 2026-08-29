import { calculateScore, type DiceRoll } from '@dice-arena/game-domain';

describe('game-domain integration', () => {
  it('uses the public package API for deterministic scoring', () => {
    const dice: DiceRoll = [1, 2, 3, 4, 5];

    expect(calculateScore('smallStraight', dice)).toBe(15);
  });
});
