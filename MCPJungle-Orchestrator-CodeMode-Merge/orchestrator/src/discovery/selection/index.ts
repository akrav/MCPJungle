/**
 * Selection Service Facade
 *
 * Combines filtering and ranking into a unified service for tool selection.
 * This is the main entry point for the selection logic layer.
 *
 * @module discovery/selection
 */

import { ToolSummary, ToolWithScore } from '../supabase/types.js';
import { UserPreferences, SortStrategy, DiscoveryMode } from '../preferences/types.js';
import { filterTools, FilterOptions, getFilterStats } from './filters.js';
import { rankTools, getBestTool, getTopRanked } from './ranking.js';

// Re-export sub-modules
export * from './filters.js';
export * from './ranking.js';

/**
 * A tool type that can be selected (has price and rating)
 */
export type SelectableTool = ToolSummary | ToolWithScore;

/**
 * Result of the selection process
 */
export interface SelectionResult<T extends SelectableTool = SelectableTool> {
  /** All tools that passed the safety filters, ranked by strategy */
  candidates: T[];
  /** The auto-selected tool (null in manual mode or if no candidates) */
  autoSelected: T | null;
  /** The mode used for selection */
  mode: DiscoveryMode;
  /** Statistics about how many tools were filtered */
  stats: {
    totalInput: number;
    passedFilters: number;
    filteredByPrice: number;
    filteredByRating: number;
    filteredByBoth: number;
  };
}

/**
 * Options for the selection process
 */
export interface SelectionOptions {
  /** Override the discovery mode from preferences */
  modeOverride?: DiscoveryMode;
  /** Override the sort strategy from preferences */
  strategyOverride?: SortStrategy;
  /** Filter options for handling missing values */
  filterOptions?: FilterOptions;
  /** Maximum number of candidates to return (for performance) */
  maxCandidates?: number;
}

/**
 * Selects the best tool(s) from a list based on user preferences
 *
 * This is the main facade that orchestrates:
 * 1. Filtering out tools that violate safety constraints
 * 2. Ranking remaining tools by the user's preferred strategy
 * 3. Auto-selecting the top tool (if in auto mode)
 *
 * @param tools - Array of tools to select from
 * @param prefs - User preferences for filtering and ranking
 * @param options - Optional overrides and configuration
 * @returns SelectionResult with candidates and possibly auto-selected tool
 */
export function selectBestTool<T extends SelectableTool>(
  tools: T[],
  prefs: UserPreferences,
  options: SelectionOptions = {}
): SelectionResult<T> {
  const {
    modeOverride,
    strategyOverride,
    filterOptions,
    maxCandidates,
  } = options;

  // Use overrides if provided, otherwise use preferences
  const mode = modeOverride ?? prefs.discoveryMode;
  const strategy = strategyOverride ?? prefs.autoInstallStrategy;

  // Get filter statistics before filtering (for feedback)
  const stats = getFilterStats(tools, prefs);

  // Step 1: Filter tools by safety constraints
  const filtered = filterTools(tools, prefs, filterOptions);

  // Step 2: Rank filtered tools by strategy
  const ranked = rankTools(filtered, strategy);

  // Step 3: Limit candidates if specified
  const candidates = maxCandidates
    ? ranked.slice(0, maxCandidates)
    : ranked;

  // Step 4: Auto-select if in auto mode and we have candidates
  let autoSelected: T | null = null;
  if (mode === 'auto' && candidates.length > 0) {
    autoSelected = candidates[0];
  }

  return {
    candidates,
    autoSelected,
    mode,
    stats: {
      totalInput: stats.total,
      passedFilters: stats.passedAll,
      filteredByPrice: stats.filteredByPrice,
      filteredByRating: stats.filteredByRating,
      filteredByBoth: stats.filteredByBoth,
    },
  };
}

/**
 * Quick helper to get the best tool for auto mode
 *
 * @param tools - Array of tools
 * @param prefs - User preferences
 * @returns The best tool or null if none pass filters
 */
export function getAutoSelectedTool<T extends SelectableTool>(
  tools: T[],
  prefs: UserPreferences
): T | null {
  const result = selectBestTool(tools, prefs, { modeOverride: 'auto' });
  return result.autoSelected;
}

/**
 * Get candidates for manual selection
 *
 * @param tools - Array of tools
 * @param prefs - User preferences
 * @param limit - Maximum number of candidates to return
 * @returns Array of ranked candidates
 */
export function getManualCandidates<T extends SelectableTool>(
  tools: T[],
  prefs: UserPreferences,
  limit = 10
): T[] {
  const result = selectBestTool(tools, prefs, {
    modeOverride: 'manual',
    maxCandidates: limit,
  });
  return result.candidates;
}

/**
 * Checks if any tools would pass the user's filters
 *
 * Useful for quickly checking if a search has viable results.
 *
 * @param tools - Array of tools to check
 * @param prefs - User preferences with filter constraints
 * @returns true if at least one tool passes filters
 */
export function hasViableCandidates<T extends SelectableTool>(
  tools: T[],
  prefs: Pick<UserPreferences, 'maxPriceCap' | 'minRatingThreshold'>
): boolean {
  const filtered = filterTools(tools, prefs);
  return filtered.length > 0;
}

/**
 * Describes why tools were filtered out (for user feedback)
 *
 * @param tools - Original tools
 * @param prefs - User preferences
 * @returns Human-readable message about filtering
 */
export function describeFiltering<T extends SelectableTool>(
  tools: T[],
  prefs: UserPreferences
): string {
  const stats = getFilterStats(tools, prefs);

  if (stats.total === 0) {
    return 'No tools were provided to filter.';
  }

  if (stats.passedAll === stats.total) {
    return `All ${stats.total} tools passed the filters.`;
  }

  if (stats.passedAll === 0) {
    const reasons: string[] = [];
    if (stats.filteredByPrice > 0 || stats.filteredByBoth > 0) {
      reasons.push(`price cap of $${prefs.maxPriceCap.toFixed(2)}`);
    }
    if (stats.filteredByRating > 0 || stats.filteredByBoth > 0) {
      reasons.push(`minimum rating of ${prefs.minRatingThreshold.toFixed(1)}`);
    }
    return `No tools passed the filters (${reasons.join(' and ')}).`;
  }

  const parts: string[] = [];
  parts.push(`${stats.passedAll} of ${stats.total} tools passed.`);

  if (stats.filteredByPrice > 0) {
    parts.push(`${stats.filteredByPrice} exceeded price cap.`);
  }
  if (stats.filteredByRating > 0) {
    parts.push(`${stats.filteredByRating} below rating threshold.`);
  }
  if (stats.filteredByBoth > 0) {
    parts.push(`${stats.filteredByBoth} failed both criteria.`);
  }

  return parts.join(' ');
}

