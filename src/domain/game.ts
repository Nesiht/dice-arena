export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type DiceRoll = readonly [DieValue, DieValue, DieValue, DieValue, DieValue];
export type DiceState = {
  readonly values: DiceRoll;
  readonly isHeld: readonly [boolean, boolean, boolean, boolean, boolean];
};
export type ScoreCategory =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'onePair'
  | 'twoPairs'
  | 'threeOfAKind'
  | 'fourOfAKind'
  | 'smallStraight'
  | 'largeStraight'
  | 'fullHouse'
  | 'chance'
  | 'yatzy';
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

// Helper: Count frequency of each die value
function getFrequencies(dice: DiceRoll): Map<DieValue, number> {
  const frequencies = new Map<DieValue, number>();
  for (const die of dice) {
    frequencies.set(die, (frequencies.get(die) ?? 0) + 1);
  }
  return frequencies;
}

// Helper: Sum all dice
function sumDice(dice: DiceRoll): number {
  return dice.reduce((sum, die) => sum + die, 0);
}

// Upper section: score only matching dice
function scoreUpperSection(dice: DiceRoll, targetValue: DieValue): number {
  return dice.filter((die) => die === targetValue).reduce((sum, die) => sum + die, 0);
}

// One Pair: highest valid pair
function scoreOnePair(dice: DiceRoll): number {
  const frequencies = getFrequencies(dice);

  // Find the highest die value with count >= 2
  for (let value = 6; value >= 1; value--) {
    if ((frequencies.get(value as DieValue) ?? 0) >= 2) {
      return value * 2;
    }
  }

  return 0;
}

// Two Pairs: two different values each appearing at least twice
function scoreTwoPairs(dice: DiceRoll): number {
  const frequencies = getFrequencies(dice);

  // Find all values with at least 2 occurrences, in descending order
  const pairs: number[] = [];
  for (let value = 6; value >= 1; value--) {
    if ((frequencies.get(value as DieValue) ?? 0) >= 2) {
      pairs.push(value);
    }
  }

  // Need exactly 2 different pair values
  if (pairs.length >= 2) {
    return pairs[0] * 2 + pairs[1] * 2;
  }

  return 0;
}

// Three of a Kind: at least 3 matching dice, sum only 3 of them
function scoreThreeOfAKind(dice: DiceRoll): number {
  const frequencies = getFrequencies(dice);

  for (let value = 6; value >= 1; value--) {
    if ((frequencies.get(value as DieValue) ?? 0) >= 3) {
      return value * 3;
    }
  }

  return 0;
}

// Four of a Kind: at least 4 matching dice, sum only 4 of them
function scoreFourOfAKind(dice: DiceRoll): number {
  const frequencies = getFrequencies(dice);

  for (let value = 6; value >= 1; value--) {
    if ((frequencies.get(value as DieValue) ?? 0) >= 4) {
      return value * 4;
    }
  }

  return 0;
}

// Small Straight: exactly 1,2,3,4,5
function scoreSmallStraight(dice: DiceRoll): number {
  const sortedDice = [...dice].sort();

  // Check if sorted dice are exactly [1,2,3,4,5]
  if (
    sortedDice[0] === 1 &&
    sortedDice[1] === 2 &&
    sortedDice[2] === 3 &&
    sortedDice[3] === 4 &&
    sortedDice[4] === 5
  ) {
    return 15;
  }

  return 0;
}

// Large Straight: exactly 2,3,4,5,6
function scoreLargeStraight(dice: DiceRoll): number {
  const sortedDice = [...dice].sort();

  // Check if sorted dice are exactly [2,3,4,5,6]
  if (
    sortedDice[0] === 2 &&
    sortedDice[1] === 3 &&
    sortedDice[2] === 4 &&
    sortedDice[3] === 5 &&
    sortedDice[4] === 6
  ) {
    return 20;
  }

  return 0;
}

// Full House: exactly 3 of one value and 2 of another
function scoreFullHouse(dice: DiceRoll): number {
  const frequencies = getFrequencies(dice);

  // Check if we have exactly 2 different values with counts 3 and 2
  const counts = Array.from(frequencies.values()).sort((a, b) => b - a);

  if (counts.length === 2 && counts[0] === 3 && counts[1] === 2) {
    return sumDice(dice);
  }

  return 0;
}

// Chance: sum all dice
function scoreChance(dice: DiceRoll): number {
  return sumDice(dice);
}

// Yatzy: all five dice identical, scores 50
function scoreYatzy(dice: DiceRoll): number {
  const frequencies = getFrequencies(dice);

  // Check if there's exactly one unique value with count 5
  if (frequencies.size === 1) {
    return 50;
  }

  return 0;
}

// Main scoring function
export function calculateScore(category: ScoreCategory, dice: DiceRoll): number {
  switch (category) {
    case 'ones':
      return scoreUpperSection(dice, 1);
    case 'twos':
      return scoreUpperSection(dice, 2);
    case 'threes':
      return scoreUpperSection(dice, 3);
    case 'fours':
      return scoreUpperSection(dice, 4);
    case 'fives':
      return scoreUpperSection(dice, 5);
    case 'sixes':
      return scoreUpperSection(dice, 6);
    case 'onePair':
      return scoreOnePair(dice);
    case 'twoPairs':
      return scoreTwoPairs(dice);
    case 'threeOfAKind':
      return scoreThreeOfAKind(dice);
    case 'fourOfAKind':
      return scoreFourOfAKind(dice);
    case 'smallStraight':
      return scoreSmallStraight(dice);
    case 'largeStraight':
      return scoreLargeStraight(dice);
    case 'fullHouse':
      return scoreFullHouse(dice);
    case 'chance':
      return scoreChance(dice);
    case 'yatzy':
      return scoreYatzy(dice);
  }
}
