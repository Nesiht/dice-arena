import { calculateScore, type DiceRoll, type ScoreCategory } from './game';

// Scorecard represents all 15 scoring categories
// Each category is either null (unused) or a number (the score)
export type Scorecard = {
  readonly ones: number | null;
  readonly twos: number | null;
  readonly threes: number | null;
  readonly fours: number | null;
  readonly fives: number | null;
  readonly sixes: number | null;
  readonly onePair: number | null;
  readonly twoPairs: number | null;
  readonly threeOfAKind: number | null;
  readonly fourOfAKind: number | null;
  readonly smallStraight: number | null;
  readonly largeStraight: number | null;
  readonly fullHouse: number | null;
  readonly chance: number | null;
  readonly yatzy: number | null;
};

// Error thrown when attempting to score an already-used category
export class CategoryAlreadyUsedError extends Error {
  constructor(category: ScoreCategory) {
    super(`Category ${category} has already been scored`);
    this.name = 'CategoryAlreadyUsedError';
  }
}

// Create a new empty scorecard with all categories unused
export function createEmptyScorecard(): Scorecard {
  return {
    ones: null,
    twos: null,
    threes: null,
    fours: null,
    fives: null,
    sixes: null,
    onePair: null,
    twoPairs: null,
    threeOfAKind: null,
    fourOfAKind: null,
    smallStraight: null,
    largeStraight: null,
    fullHouse: null,
    chance: null,
    yatzy: null,
  };
}

// Helper: Get the property key for a category
function getCategoryKey(category: ScoreCategory): keyof Scorecard {
  return category as keyof Scorecard;
}

// Check if a category is currently used
export function isCategoryUsed(scorecard: Scorecard, category: ScoreCategory): boolean {
  const key = getCategoryKey(category);
  return scorecard[key] !== null;
}

// Score a category with the given dice
// Returns a new scorecard with the category marked as used
// Throws CategoryAlreadyUsedError if the category is already used
export function scoreCategory(
  scorecard: Scorecard,
  category: ScoreCategory,
  dice: DiceRoll,
): Scorecard {
  if (isCategoryUsed(scorecard, category)) {
    throw new CategoryAlreadyUsedError(category);
  }

  const score = calculateScore(category, dice);
  const key = getCategoryKey(category);

  return {
    ...scorecard,
    [key]: score,
  };
}

// Helper: Get all upper section categories
function getUpperCategories(): (keyof Scorecard)[] {
  return ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
}

// Helper: Get all lower section categories
function getLowerCategories(): (keyof Scorecard)[] {
  return [
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
}

// Calculate the upper section subtotal (sum of ones through sixes)
export function calculateUpperSubtotal(scorecard: Scorecard): number {
  return getUpperCategories().reduce((sum, key) => {
    const score = scorecard[key];
    return sum + (score !== null ? score : 0);
  }, 0);
}

// Calculate the upper section bonus
// 50 points if upper subtotal is at least 63, otherwise 0
export function calculateUpperBonus(scorecard: Scorecard): number {
  const subtotal = calculateUpperSubtotal(scorecard);
  return subtotal >= 63 ? 50 : 0;
}

// Calculate the lower section subtotal (sum of all lower categories)
export function calculateLowerSubtotal(scorecard: Scorecard): number {
  return getLowerCategories().reduce((sum, key) => {
    const score = scorecard[key];
    return sum + (score !== null ? score : 0);
  }, 0);
}

// Calculate the total score
// upper subtotal + upper bonus + lower subtotal
export function calculateTotalScore(scorecard: Scorecard): number {
  return (
    calculateUpperSubtotal(scorecard) +
    calculateUpperBonus(scorecard) +
    calculateLowerSubtotal(scorecard)
  );
}

// Check if the scorecard is complete (all 15 categories used)
export function isScorecardComplete(scorecard: Scorecard): boolean {
  return Object.values(scorecard).every((score) => score !== null);
}
