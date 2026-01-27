/**
 * Ranking Strategies for Tool Selection
 *
 * Implements sorting strategies to order tools based on user preferences.
 * Uses the Strategy Pattern for extensible ranking logic.
 *
 * @module discovery/selection/ranking
 */

import { ToolSummary, ToolWithScore } from '../supabase/types.js';
import { SortStrategy } from '../preferences/types.js';

/**
 * A tool type that can be ranked (has price and rating)
 */
export type RankableTool = ToolSummary | ToolWithScore;

/**
 * Comparator function type for Array.sort
 */
type ToolComparator<T extends RankableTool> = (a: T, b: T) => number;

/**
 * Compares tools by price (ascending - cheapest first)
 *
 * @param a - First tool
 * @param b - Second tool
 * @returns Negative if a is cheaper, positive if b is cheaper, 0 if equal
 */
export function compareByPriceAsc<T extends RankableTool>(a: T, b: T): number {
  const priceA = a.price_per_call ?? Infinity;
  const priceB = b.price_per_call ?? Infinity;
  return priceA - priceB;
}

/**
 * Compares tools by rating (descending - highest rated first)
 *
 * @param a - First tool
 * @param b - Second tool
 * @returns Negative if a has higher rating, positive if b has higher rating
 */
export function compareByRatingDesc<T extends RankableTool>(a: T, b: T): number {
  const ratingA = a.average_rating ?? 0;
  const ratingB = b.average_rating ?? 0;
  return ratingB - ratingA;
}

/**
 * Calculates a balanced score that weighs both rating and price
 *
 * Higher score = better tool
 * Formula: (rating * 10) - (price * 100)
 *
 * This gives:
 * - A 5-star tool at $0.01 = 50 - 1 = 49
 * - A 4-star tool at $0.01 = 40 - 1 = 39
 * - A 5-star tool at $0.10 = 50 - 10 = 40
 * - A 3-star tool at $0.00 = 30 - 0 = 30
 *
 * @param tool - The tool to score
 * @returns The balanced score (higher is better)
 */
export function calculateBalancedScore<T extends RankableTool>(tool: T): number {
  const rating = tool.average_rating ?? 0;
  const price = tool.price_per_call ?? 0;

  // Weight: rating is worth more than price savings
  // A 1-star improvement is worth $0.10 in price
  return (rating * 10) - (price * 100);
}

/**
 * Compares tools by balanced score (descending - best value first)
 *
 * @param a - First tool
 * @param b - Second tool
 * @returns Negative if a has higher score, positive if b has higher score
 */
export function compareByBalancedScore<T extends RankableTool>(a: T, b: T): number {
  const scoreA = calculateBalancedScore(a);
  const scoreB = calculateBalancedScore(b);
  return scoreB - scoreA;
}

/**
 * Gets the comparator function for a given strategy
 *
 * @param strategy - The sort strategy to use
 * @returns The comparator function
 */
export function getComparator<T extends RankableTool>(
  strategy: SortStrategy
): ToolComparator<T> {
  switch (strategy) {
    case 'cheapest':
      return compareByPriceAsc;
    case 'rating':
      return compareByRatingDesc;
    case 'balanced':
      return compareByBalancedScore;
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = strategy;
      throw new Error(`Unknown strategy: ${_exhaustive}`);
  }
}

/**
 * Ranks tools according to the specified strategy
 *
 * @param tools - Array of tools to rank
 * @param strategy - The ranking strategy to use
 * @returns New array of tools sorted according to strategy
 */
export function rankTools<T extends RankableTool>(
  tools: T[],
  strategy: SortStrategy
): T[] {
  if (!tools || tools.length === 0) {
    return [];
  }

  // Create a copy to avoid mutating the original array
  const sorted = [...tools];
  const comparator = getComparator<T>(strategy);

  return sorted.sort(comparator);
}

/**
 * Gets the top N tools after ranking
 *
 * @param tools - Array of tools to rank
 * @param strategy - The ranking strategy to use
 * @param limit - Maximum number of tools to return
 * @returns Top N tools according to strategy
 */
export function getTopRanked<T extends RankableTool>(
  tools: T[],
  strategy: SortStrategy,
  limit: number
): T[] {
  const ranked = rankTools(tools, strategy);
  return ranked.slice(0, Math.max(0, limit));
}

/**
 * Gets the best tool according to the strategy (first after ranking)
 *
 * @param tools - Array of tools to rank
 * @param strategy - The ranking strategy to use
 * @returns The best tool, or null if no tools
 */
export function getBestTool<T extends RankableTool>(
  tools: T[],
  strategy: SortStrategy
): T | null {
  const ranked = rankTools(tools, strategy);
  return ranked.length > 0 ? ranked[0] : null;
}

