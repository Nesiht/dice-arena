export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type DiceRoll = readonly [DieValue, DieValue, DieValue, DieValue, DieValue];
export type DiceState = {
  readonly values: DiceRoll;
  readonly isHeld: readonly [boolean, boolean, boolean, boolean, boolean];
};
export type ScoreCategory = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes' | 'chance';
export type PlayerId = string;
export type MatchId = string;

export function isValidDieValue(value: number): value is DieValue {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export function generateDieValue(): DieValue {
  return (Math.floor(Math.random() * 6) + 1) as DieValue;
}

export function rollDice(): DiceRoll {
  return [
    generateDieValue(),
    generateDieValue(),
    generateDieValue(),
    generateDieValue(),
    generateDieValue(),
  ];
}
