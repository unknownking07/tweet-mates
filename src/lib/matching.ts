import type { PersonalityTraits, PersonalityDimension, CompatibilityResult } from './types';
import { PERSONALITY_DIMENSIONS } from './types';

const COMPLEMENTARY_PAIRS: [PersonalityDimension, PersonalityDimension][] = [
  ['assertiveness', 'empathy'],
  ['formality', 'humor'],
  ['creativity', 'formality'],
  ['adventurousness', 'optimism'],
];

export function computeCompatibility(
  traitsA: PersonalityTraits,
  traitsB: PersonalityTraits,
  interestsA: string[],
  interestsB: string[]
): CompatibilityResult {
  // Step 1: Trait distance score (0-100)
  let sumSquaredDiff = 0;
  for (const dim of PERSONALITY_DIMENSIONS) {
    const diff = traitsA[dim] - traitsB[dim];
    sumSquaredDiff += diff * diff;
  }

  const maxDistance = Math.sqrt(PERSONALITY_DIMENSIONS.length * 100 * 100);
  const euclideanDistance = Math.sqrt(sumSquaredDiff);
  const traitDistanceScore = Math.round(100 * (1 - euclideanDistance / maxDistance));

  // Step 2: Complementary bonus (0-20)
  let complementaryBonus = 0;
  const complementaryTraits: PersonalityDimension[] = [];

  for (const [traitX, traitY] of COMPLEMENTARY_PAIRS) {
    const crossSpread =
      Math.abs(traitsA[traitX] - traitsB[traitX]) +
      Math.abs(traitsA[traitY] - traitsB[traitY]);

    if (crossSpread > 80) {
      const bonus = Math.min(5, Math.round(crossSpread / 40));
      complementaryBonus += bonus;
      if (!complementaryTraits.includes(traitX)) complementaryTraits.push(traitX);
      if (!complementaryTraits.includes(traitY)) complementaryTraits.push(traitY);
    }
  }
  complementaryBonus = Math.min(20, complementaryBonus);

  // Step 3: Interest overlap (0-15)
  const normalizedA = interestsA.map((i) => i.toLowerCase().trim());
  const normalizedB = interestsB.map((i) => i.toLowerCase().trim());
  const sharedInterests = normalizedA.filter((i) => normalizedB.includes(i));

  let interestOverlapScore: number;
  if (normalizedA.length === 0 && normalizedB.length === 0) {
    interestOverlapScore = 5;
  } else {
    const maxLen = Math.max(normalizedA.length, normalizedB.length);
    if (maxLen === 0) {
      interestOverlapScore = 0;
    } else {
      const overlapRatio = sharedInterests.length / Math.min(maxLen, 10);
      interestOverlapScore = Math.round(15 * Math.min(1, overlapRatio));
    }
  }

  // Step 4: Combine
  const rawScore = traitDistanceScore * 0.65 + complementaryBonus + interestOverlapScore;
  const total = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    score: total,
    breakdown: {
      trait_distance_score: traitDistanceScore,
      complementary_bonus: complementaryBonus,
      interest_overlap_score: interestOverlapScore,
      total,
    },
    complementary_traits: complementaryTraits,
    shared_interests: sharedInterests,
  };
}
