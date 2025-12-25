/**
 * User Preferences Store
 *
 * Manages user preferences for tool discovery in the `user_preferences_orchestrator` table.
 * Tables with the `_orchestrator` suffix are created and managed by this system.
 *
 * @module discovery/preferences/store
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client.js';
import {
  UserPreferences,
  UserPreferencesUpdate,
  DEFAULT_USER_PREFERENCES,
  DiscoveryMode,
  SortStrategy,
} from './types.js';

const TABLE_NAME = 'user_preferences_orchestrator';

/**
 * Error thrown when a preferences operation fails
 */
export class PreferencesStoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PreferencesStoreError';
  }
}

/**
 * Database row structure for user preferences
 */
interface PreferencesRow {
  user_id: string;
  discovery_mode: string;
  auto_install_strategy: string;
  max_price_cap: number;
  min_rating_threshold: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Maps a database row to a UserPreferences object
 */
function mapRowToPreferences(row: PreferencesRow): UserPreferences {
  return {
    userId: row.user_id,
    discoveryMode: row.discovery_mode as DiscoveryMode,
    autoInstallStrategy: row.auto_install_strategy as SortStrategy,
    maxPriceCap: row.max_price_cap,
    minRatingThreshold: row.min_rating_threshold,
  };
}

/**
 * Maps UserPreferences to a database row format
 */
function mapPreferencesToRow(
  userId: string,
  prefs: Partial<Omit<UserPreferences, 'userId'>>
): Partial<PreferencesRow> {
  const row: Partial<PreferencesRow> = {
    user_id: userId,
  };

  if (prefs.discoveryMode !== undefined) {
    row.discovery_mode = prefs.discoveryMode;
  }
  if (prefs.autoInstallStrategy !== undefined) {
    row.auto_install_strategy = prefs.autoInstallStrategy;
  }
  if (prefs.maxPriceCap !== undefined) {
    row.max_price_cap = prefs.maxPriceCap;
  }
  if (prefs.minRatingThreshold !== undefined) {
    row.min_rating_threshold = prefs.minRatingThreshold;
  }

  return row;
}

/**
 * Gets user preferences from the database
 *
 * @param userId - The user ID to fetch preferences for
 * @returns UserPreferences for the user, or defaults if not found
 * @throws {PreferencesStoreError} If the query fails
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  if (!isSupabaseConfigured()) {
    // Return defaults if Supabase is not configured
    return {
      userId,
      ...DEFAULT_USER_PREFERENCES,
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new PreferencesStoreError(
        `Failed to fetch user preferences: ${error.message}`,
        error
      );
    }

    // Return defaults if no preferences found
    if (!data) {
      return {
        userId,
        ...DEFAULT_USER_PREFERENCES,
      };
    }

    return mapRowToPreferences(data as PreferencesRow);
  } catch (err) {
    if (err instanceof PreferencesStoreError) {
      throw err;
    }
    throw new PreferencesStoreError('Failed to fetch user preferences', err);
  }
}

/**
 * Sets (upserts) user preferences in the database
 *
 * @param userId - The user ID to set preferences for
 * @param prefs - The preference values to set (partial update supported)
 * @returns The updated UserPreferences
 * @throws {PreferencesStoreError} If the operation fails
 */
export async function setUserPreferences(
  userId: string,
  prefs: Partial<Omit<UserPreferences, 'userId'>>
): Promise<UserPreferences> {
  if (!isSupabaseConfigured()) {
    throw new PreferencesStoreError(
      'Cannot save preferences: Supabase client not configured'
    );
  }

  try {
    const supabase = getSupabaseClient();
    const row = mapPreferencesToRow(userId, prefs);

    // Add updated_at timestamp
    const rowWithTimestamp = {
      ...row,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(rowWithTimestamp, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw new PreferencesStoreError(
        `Failed to save user preferences: ${error.message}`,
        error
      );
    }

    if (!data) {
      // If no data returned, fetch the updated record
      return getUserPreferences(userId);
    }

    return mapRowToPreferences(data as PreferencesRow);
  } catch (err) {
    if (err instanceof PreferencesStoreError) {
      throw err;
    }
    throw new PreferencesStoreError('Failed to save user preferences', err);
  }
}

/**
 * Updates specific preference fields for a user
 *
 * @param update - Object containing userId and fields to update
 * @returns The updated UserPreferences
 * @throws {PreferencesStoreError} If the operation fails
 */
export async function updateUserPreferences(
  update: UserPreferencesUpdate
): Promise<UserPreferences> {
  const { userId, ...prefs } = update;
  return setUserPreferences(userId, prefs);
}

/**
 * Deletes user preferences (resets to defaults)
 *
 * @param userId - The user ID to delete preferences for
 * @throws {PreferencesStoreError} If the operation fails
 */
export async function deleteUserPreferences(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    // No-op if Supabase is not configured
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new PreferencesStoreError(
        `Failed to delete user preferences: ${error.message}`,
        error
      );
    }
  } catch (err) {
    if (err instanceof PreferencesStoreError) {
      throw err;
    }
    throw new PreferencesStoreError('Failed to delete user preferences', err);
  }
}

/**
 * Checks if a user has custom preferences set
 *
 * @param userId - The user ID to check
 * @returns true if user has custom preferences, false otherwise
 */
export async function hasCustomPreferences(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new PreferencesStoreError(
        `Failed to check user preferences: ${error.message}`,
        error
      );
    }

    return data !== null;
  } catch (err) {
    if (err instanceof PreferencesStoreError) {
      throw err;
    }
    throw new PreferencesStoreError('Failed to check user preferences', err);
  }
}

