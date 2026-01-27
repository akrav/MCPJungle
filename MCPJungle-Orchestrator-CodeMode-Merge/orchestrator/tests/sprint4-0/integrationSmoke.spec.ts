/**
 * Integration Smoke Tests for Supabase Discovery Module
 *
 * These tests verify the full chain works with a real Supabase instance.
 * Tests are skipped if SUPABASE_URL and SUPABASE_KEY are not set.
 *
 * To run manually:
 *   export SUPABASE_URL=https://your-project.supabase.co
 *   export SUPABASE_KEY=your-service-role-key
 *   npm run test -- tests/sprint4-0/integrationSmoke.spec.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initializeSupabaseClient,
  resetSupabaseClient,
  isSupabaseConfigured,
} from '../../src/discovery/supabase/client';
import { getAllTools, getActiveTools } from '../../src/discovery/supabase/service';
import {
  getUserPreferences,
  setUserPreferences,
  deleteUserPreferences,
} from '../../src/discovery/preferences/store';
import { DEFAULT_USER_PREFERENCES } from '../../src/discovery/preferences/types';

// Check if Supabase credentials are available
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const hasSupabaseCredentials = Boolean(SUPABASE_URL && SUPABASE_KEY);

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe.skipIf(!hasSupabaseCredentials)(
  'Supabase Integration Smoke Tests',
  () => {
    beforeAll(() => {
      if (hasSupabaseCredentials) {
        initializeSupabaseClient({
          supabaseUrl: SUPABASE_URL!,
          supabaseKey: SUPABASE_KEY!,
        });
      }
    });

    afterAll(() => {
      resetSupabaseClient();
    });

    describe('Tools Service', () => {
      it('getAllTools returns an array', async () => {
        const tools = await getAllTools();

        expect(Array.isArray(tools)).toBe(true);
      });

      it('getAllTools items have valid structure', async () => {
        const tools = await getAllTools();

        if (tools.length > 0) {
          const tool = tools[0];

          // Check required fields exist
          expect(tool).toHaveProperty('id');
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('description');
          expect(tool).toHaveProperty('endpoint_url');
          expect(tool).toHaveProperty('price_per_call');
          expect(tool).toHaveProperty('average_rating');
          expect(tool).toHaveProperty('listing_status');

          // Validate UUID format
          expect(tool.id).toMatch(UUID_REGEX);

          // Validate non-empty strings
          expect(typeof tool.name).toBe('string');
          expect(tool.name.length).toBeGreaterThan(0);

          // Validate numeric fields
          expect(typeof tool.price_per_call).toBe('number');
          expect(typeof tool.average_rating).toBe('number');

          // Validate enum field
          expect(['ACTIVE', 'INACTIVE']).toContain(tool.listing_status);
        }
      });

      it('getActiveTools returns only ACTIVE tools', async () => {
        const tools = await getActiveTools();

        expect(Array.isArray(tools)).toBe(true);

        // All returned tools should be ACTIVE
        for (const tool of tools) {
          expect(tool.listing_status).toBe('ACTIVE');
        }
      });
    });

    describe('Preferences Store', () => {
      const testUserId = `test-user-${Date.now()}`;

      afterAll(async () => {
        // Cleanup: delete test user preferences
        try {
          await deleteUserPreferences(testUserId);
        } catch {
          // Ignore cleanup errors
        }
      });

      it('getUserPreferences returns defaults for new user', async () => {
        const prefs = await getUserPreferences(testUserId);

        expect(prefs.userId).toBe(testUserId);
        expect(prefs.discoveryMode).toBe(DEFAULT_USER_PREFERENCES.discoveryMode);
        expect(prefs.autoInstallStrategy).toBe(
          DEFAULT_USER_PREFERENCES.autoInstallStrategy
        );
        expect(prefs.maxPriceCap).toBe(DEFAULT_USER_PREFERENCES.maxPriceCap);
        expect(prefs.minRatingThreshold).toBe(
          DEFAULT_USER_PREFERENCES.minRatingThreshold
        );
      });

      it('setUserPreferences creates and returns preferences', async () => {
        const prefs = await setUserPreferences(testUserId, {
          discoveryMode: 'auto',
          maxPriceCap: 0.25,
          minRatingThreshold: 4.0,
        });

        expect(prefs.userId).toBe(testUserId);
        expect(prefs.discoveryMode).toBe('auto');
        expect(prefs.maxPriceCap).toBe(0.25);
        expect(prefs.minRatingThreshold).toBe(4.0);
      });

      it('getUserPreferences returns saved preferences', async () => {
        // First set preferences
        await setUserPreferences(testUserId, {
          discoveryMode: 'auto',
          autoInstallStrategy: 'cheapest',
        });

        // Then retrieve them
        const prefs = await getUserPreferences(testUserId);

        expect(prefs.discoveryMode).toBe('auto');
        expect(prefs.autoInstallStrategy).toBe('cheapest');
      });

      it('deleteUserPreferences removes preferences', async () => {
        // Set then delete
        await setUserPreferences(testUserId, { discoveryMode: 'manual' });
        await deleteUserPreferences(testUserId);

        // Should get defaults now
        const prefs = await getUserPreferences(testUserId);
        expect(prefs.discoveryMode).toBe(DEFAULT_USER_PREFERENCES.discoveryMode);
      });
    });

    describe('Client Configuration', () => {
      it('isSupabaseConfigured returns true after initialization', () => {
        expect(isSupabaseConfigured()).toBe(true);
      });
    });
  }
);

// Tests that run without real Supabase connection
describe('Supabase Module (No Connection)', () => {
  it('skips integration tests when credentials not available', () => {
    if (!hasSupabaseCredentials) {
      console.log(
        'Integration tests skipped: SUPABASE_URL and SUPABASE_KEY not set'
      );
      expect(true).toBe(true);
    } else {
      // This assertion runs when credentials ARE available
      expect(SUPABASE_URL).toBeTruthy();
    }
  });

  it('exports correct module structure', async () => {
    // Verify exports without needing a connection
    const client = await import('../../src/discovery/supabase/client');
    const service = await import('../../src/discovery/supabase/service');
    const types = await import('../../src/discovery/supabase/types');
    const prefTypes = await import('../../src/discovery/preferences/types');
    const store = await import('../../src/discovery/preferences/store');

    // Client exports
    expect(typeof client.initializeSupabaseClient).toBe('function');
    expect(typeof client.getSupabaseClient).toBe('function');
    expect(typeof client.isSupabaseConfigured).toBe('function');
    expect(typeof client.resetSupabaseClient).toBe('function');

    // Service exports
    expect(typeof service.getAllTools).toBe('function');
    expect(typeof service.getActiveTools).toBe('function');
    expect(typeof service.getToolById).toBe('function');
    expect(typeof service.getToolsByName).toBe('function');

    // Types exports
    expect(types).toBeDefined();

    // Preference types exports
    expect(prefTypes.DEFAULT_USER_PREFERENCES).toBeDefined();
    expect(prefTypes.DEFAULT_USER_PREFERENCES.discoveryMode).toBe('manual');

    // Store exports
    expect(typeof store.getUserPreferences).toBe('function');
    expect(typeof store.setUserPreferences).toBe('function');
    expect(typeof store.deleteUserPreferences).toBe('function');
  });
});

