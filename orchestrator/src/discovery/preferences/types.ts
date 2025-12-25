/**
 * Type definitions for user preferences in the discovery system
 *
 * These types define how users configure their tool discovery behavior,
 * including auto/manual mode and filtering/sorting strategies.
 *
 * @module discovery/preferences/types
 */

/**
 * Discovery mode determines how tools are selected when a new capability is needed
 * - 'auto': System automatically selects and installs the best matching tool
 * - 'manual': System presents options to the user for manual selection
 */
export type DiscoveryMode = 'auto' | 'manual';

/**
 * Sorting strategy for ranking candidate tools in auto mode
 * - 'cheapest': Prioritize lowest price_per_call
 * - 'rating': Prioritize highest average_rating
 * - 'balanced': Optimize for best value (high rating relative to cost)
 */
export type SortStrategy = 'cheapest' | 'rating' | 'balanced';

/**
 * User preferences for tool discovery behavior
 *
 * These preferences are stored in the `user_preferences_orchestrator` Supabase table
 * (tables with _orchestrator suffix are created and managed by this system).
 */
export interface UserPreferences {
  /** Unique identifier for the user */
  userId: string;
  /** Whether to auto-install or prompt for manual selection */
  discoveryMode: DiscoveryMode;
  /** How to rank tools when in auto mode */
  autoInstallStrategy: SortStrategy;
  /** Maximum price per call the user is willing to pay (hard filter) */
  maxPriceCap: number;
  /** Minimum rating threshold the user requires (hard filter) */
  minRatingThreshold: number;
}

/**
 * Default user preferences for new users or when preferences are not set
 */
export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'userId'> = {
  discoveryMode: 'manual',
  autoInstallStrategy: 'balanced',
  maxPriceCap: 1.0, // $1.00 per call max by default
  minRatingThreshold: 3.0, // 3+ stars minimum by default
};

/**
 * Partial preferences for updates (all fields optional except userId)
 */
export type UserPreferencesUpdate = Partial<Omit<UserPreferences, 'userId'>> & {
  userId: string;
};

