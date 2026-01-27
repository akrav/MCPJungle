/**
 * Supabase Client Singleton
 *
 * Provides a singleton instance of the Supabase client for use across
 * the discovery module. The client is lazily initialized on first access.
 *
 * @module discovery/supabase/client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Singleton instance of the Supabase client */
let supabaseInstance: SupabaseClient | null = null;

/**
 * Configuration required for Supabase client initialization
 */
export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * Error thrown when Supabase configuration is missing or invalid
 */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

/**
 * Validates that the required Supabase configuration is present
 *
 * @param config - Configuration object to validate
 * @throws {SupabaseConfigError} If required configuration is missing
 */
function validateConfig(config: Partial<SupabaseConfig>): asserts config is SupabaseConfig {
  if (!config.supabaseUrl) {
    throw new SupabaseConfigError(
      'SUPABASE_URL is required for Supabase client initialization'
    );
  }
  if (!config.supabaseKey) {
    throw new SupabaseConfigError(
      'SUPABASE_KEY is required for Supabase client initialization'
    );
  }
}

/**
 * Initializes the Supabase client singleton with the provided configuration.
 * This should be called once during application startup.
 *
 * @param config - Configuration containing supabaseUrl and supabaseKey
 * @throws {SupabaseConfigError} If configuration is missing or invalid
 * @returns The initialized Supabase client instance
 */
export function initializeSupabaseClient(config: Partial<SupabaseConfig>): SupabaseClient {
  validateConfig(config);

  supabaseInstance = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      // We're using service role key for server-side operations
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseInstance;
}

/**
 * Gets the Supabase client singleton instance.
 * The client must be initialized via initializeSupabaseClient() before calling this.
 *
 * @throws {SupabaseConfigError} If the client has not been initialized
 * @returns The Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    throw new SupabaseConfigError(
      'Supabase client not initialized. Call initializeSupabaseClient() first.'
    );
  }
  return supabaseInstance;
}

/**
 * Checks if the Supabase client has been initialized
 *
 * @returns true if the client is available, false otherwise
 */
export function isSupabaseConfigured(): boolean {
  return supabaseInstance !== null;
}

/**
 * Resets the Supabase client singleton (primarily for testing)
 * @internal
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

