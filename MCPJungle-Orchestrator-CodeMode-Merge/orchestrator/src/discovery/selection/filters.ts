/**
 * Safety Filters for Tool Selection
 *
 * Implements hard constraints that filter out tools that violate user preferences.
 * These filters prevent accidental overspending or usage of low-quality tools.
 *
 * @module discovery/selection/filters
 */

import { ToolSummary, ToolWithScore } from '../supabase/types.js';
import { UserPreferences } from '../preferences/types.js';

/**
 * A tool type that can be filtered (has price and rating)
 */
export type FilterableTool = ToolSummary | ToolWithScore;

/**
 * Filter options for customizing filter behavior
 */
export interface FilterOptions {
  /** If true, tools with undefined/null ratings are excluded */
  strictRating?: boolean;
  /** If true, tools with undefined/null prices are excluded */
  strictPrice?: boolean;
}

/**
 * Default filter options
 */
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  strictRating: true,
  strictPrice: true,
};

/**
 * Checks if a tool passes the price cap constraint
 *
 * @param tool - The tool to check
 * @param maxPriceCap - Maximum allowed price per call
 * @param strict - If true, undefined prices fail the check
 * @returns true if the tool passes the price constraint
 */
export function passesPriceFilter(
  tool: FilterableTool,
  maxPriceCap: number,
  strict = true
): boolean {
  const price = tool.price_per_call;

  // Handle undefined/null price
  if (price === undefined || price === null) {
    return !strict;
  }

  return price <= maxPriceCap;
}

/**
 * Checks if a tool passes the minimum rating constraint
 *
 * @param tool - The tool to check
 * @param minRatingThreshold - Minimum required rating
 * @param strict - If true, undefined ratings fail the check
 * @returns true if the tool passes the rating constraint
 */
export function passesRatingFilter(
  tool: FilterableTool,
  minRatingThreshold: number,
  strict = true
): boolean {
  const rating = tool.average_rating;

  // Handle undefined/null rating
  if (rating === undefined || rating === null) {
    return !strict;
  }

  return rating >= minRatingThreshold;
}

/**
 * Filters tools based on user safety constraints
 *
 * Removes tools that:
 * - Exceed the user's maximum price cap
 * - Fall below the user's minimum rating threshold
 *
 * @param tools - Array of tools to filter
 * @param prefs - User preferences containing constraints
 * @param options - Optional filter behavior configuration
 * @returns Filtered array of tools that pass all constraints
 */
export function filterTools<T extends FilterableTool>(
  tools: T[],
  prefs: Pick<UserPreferences, 'maxPriceCap' | 'minRatingThreshold'>,
  options: FilterOptions = DEFAULT_FILTER_OPTIONS
): T[] {
  if (!tools || tools.length === 0) {
    return [];
  }

  const { maxPriceCap, minRatingThreshold } = prefs;
  const { strictRating = true, strictPrice = true } = options;

  return tools.filter((tool) => {
    // Check price constraint
    if (!passesPriceFilter(tool, maxPriceCap, strictPrice)) {
      return false;
    }

    // Check rating constraint
    if (!passesRatingFilter(tool, minRatingThreshold, strictRating)) {
      return false;
    }

    return true;
  });
}

/**
 * Counts how many tools would be filtered out by each constraint
 *
 * Useful for providing feedback to users about why tools were excluded.
 *
 * @param tools - Array of tools to analyze
 * @param prefs - User preferences containing constraints
 * @returns Object with counts for each filter type
 */
export function getFilterStats<T extends FilterableTool>(
  tools: T[],
  prefs: Pick<UserPreferences, 'maxPriceCap' | 'minRatingThreshold'>
): {
  total: number;
  passedAll: number;
  filteredByPrice: number;
  filteredByRating: number;
  filteredByBoth: number;
} {
  if (!tools || tools.length === 0) {
    return {
      total: 0,
      passedAll: 0,
      filteredByPrice: 0,
      filteredByRating: 0,
      filteredByBoth: 0,
    };
  }

  let filteredByPrice = 0;
  let filteredByRating = 0;
  let filteredByBoth = 0;
  let passedAll = 0;

  for (const tool of tools) {
    const passesPrice = passesPriceFilter(tool, prefs.maxPriceCap);
    const passesRating = passesRatingFilter(tool, prefs.minRatingThreshold);

    if (!passesPrice && !passesRating) {
      filteredByBoth++;
    } else if (!passesPrice) {
      filteredByPrice++;
    } else if (!passesRating) {
      filteredByRating++;
    } else {
      passedAll++;
    }
  }

  return {
    total: tools.length,
    passedAll,
    filteredByPrice,
    filteredByRating,
    filteredByBoth,
  };
}

