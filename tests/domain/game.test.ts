import { generateDieValue, isValidDieValue, rollDice } from '../../src/domain/game';

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
