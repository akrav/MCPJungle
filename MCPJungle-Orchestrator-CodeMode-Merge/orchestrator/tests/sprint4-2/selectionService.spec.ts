import { describe, it, expect } from 'vitest';
import {
  selectBestTool,
  getAutoSelectedTool,
  getManualCandidates,
  hasViableCandidates,
  describeFiltering,
  SelectionResult,
} from '../../src/discovery/selection';
import { ToolSummary } from '../../src/discovery/supabase/types';
import { UserPreferences, DEFAULT_USER_PREFERENCES } from '../../src/discovery/preferences/types';

// Test fixtures
const createTool = (
  id: string,
  name: string,
  price: number,
  rating: number
): ToolSummary => ({
  id,
  name,
  description: `${name} tool`,
  endpoint_url: `https://api.example.com/${id}`,
  price_per_call: price,
  average_rating: rating,
  listing_status: 'ACTIVE',
});

const createPrefs = (
  overrides: Partial<UserPreferences> = {}
): UserPreferences => ({
  ...DEFAULT_USER_PREFERENCES,
  userId: 'test-user',
  ...overrides,
});

// Standard test tools
const cheapGood = createTool('cheap-good', 'Cheap Good', 0.01, 4.5);
const cheapBad = createTool('cheap-bad', 'Cheap Bad', 0.01, 2.0);
const expensiveGood = createTool('expensive-good', 'Expensive Good', 5.0, 4.8);
const expensiveBad = createTool('expensive-bad', 'Expensive Bad', 5.0, 1.5);
const midTool = createTool('mid', 'Mid Tool', 0.50, 3.5);

const allTools = [cheapGood, cheapBad, expensiveGood, expensiveBad, midTool];

describe('Selection Service Facade', () => {
  describe('selectBestTool', () => {
    it('returns empty result for empty input', () => {
      const prefs = createPrefs();
      const result = selectBestTool([], prefs);

      expect(result.candidates).toHaveLength(0);
      expect(result.autoSelected).toBeNull();
      expect(result.stats.totalInput).toBe(0);
    });

    describe('filtering', () => {
      it('filters by price cap', () => {
        const prefs = createPrefs({
          maxPriceCap: 0.1,
          minRatingThreshold: 0,
        });

        const result = selectBestTool(allTools, prefs);

        expect(result.candidates.every((t) => t.price_per_call <= 0.1)).toBe(true);
        expect(result.stats.filteredByPrice).toBeGreaterThan(0);
      });

      it('filters by rating threshold', () => {
        const prefs = createPrefs({
          maxPriceCap: 100,
          minRatingThreshold: 4.0,
        });

        const result = selectBestTool(allTools, prefs);

        expect(result.candidates.every((t) => t.average_rating >= 4.0)).toBe(true);
        expect(result.stats.filteredByRating).toBeGreaterThan(0);
      });

      it('filters by both constraints', () => {
        const prefs = createPrefs({
          maxPriceCap: 0.1,
          minRatingThreshold: 4.0,
        });

        const result = selectBestTool(allTools, prefs);

        // Only cheapGood passes
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].id).toBe('cheap-good');
      });
    });

    describe('ranking', () => {
      it('ranks by cheapest strategy', () => {
        const prefs = createPrefs({
          maxPriceCap: 100,
          minRatingThreshold: 0,
          autoInstallStrategy: 'cheapest',
        });

        const result = selectBestTool(allTools, prefs);

        // Cheapest tools should be first
        expect(result.candidates[0].price_per_call).toBe(0.01);
        expect(result.candidates[1].price_per_call).toBe(0.01);
      });

      it('ranks by rating strategy', () => {
        const prefs = createPrefs({
          maxPriceCap: 100,
          minRatingThreshold: 0,
          autoInstallStrategy: 'rating',
        });

        const result = selectBestTool(allTools, prefs);

        // Highest rated should be first
        expect(result.candidates[0].average_rating).toBe(4.8);
      });

      it('ranks by balanced strategy', () => {
        const prefs = createPrefs({
          maxPriceCap: 100,
          minRatingThreshold: 0,
          autoInstallStrategy: 'balanced',
        });

        const result = selectBestTool(allTools, prefs);

        // cheapGood should win (high rating, low price)
        expect(result.candidates[0].id).toBe('cheap-good');
      });
    });

    describe('auto mode', () => {
      it('auto-selects the top ranked tool', () => {
        const prefs = createPrefs({
          discoveryMode: 'auto',
          maxPriceCap: 100,
          minRatingThreshold: 0,
          autoInstallStrategy: 'rating',
        });

        const result = selectBestTool(allTools, prefs);

        expect(result.mode).toBe('auto');
        expect(result.autoSelected).not.toBeNull();
        expect(result.autoSelected?.average_rating).toBe(4.8); // Best rated
      });

      it('auto-selects null when no candidates pass', () => {
        const prefs = createPrefs({
          discoveryMode: 'auto',
          maxPriceCap: 0.001, // Impossible
          minRatingThreshold: 5.0, // Impossible
        });

        const result = selectBestTool(allTools, prefs);

        expect(result.mode).toBe('auto');
        expect(result.autoSelected).toBeNull();
        expect(result.candidates).toHaveLength(0);
      });
    });

    describe('manual mode', () => {
      it('returns candidates but no auto-selection', () => {
        const prefs = createPrefs({
          discoveryMode: 'manual',
          maxPriceCap: 100,
          minRatingThreshold: 0,
        });

        const result = selectBestTool(allTools, prefs);

        expect(result.mode).toBe('manual');
        expect(result.autoSelected).toBeNull();
        expect(result.candidates.length).toBeGreaterThan(0);
      });
    });

    describe('options', () => {
      it('respects modeOverride', () => {
        const prefs = createPrefs({
          discoveryMode: 'manual',
          maxPriceCap: 100,
          minRatingThreshold: 0,
        });

        const result = selectBestTool(allTools, prefs, { modeOverride: 'auto' });

        expect(result.mode).toBe('auto');
        expect(result.autoSelected).not.toBeNull();
      });

      it('respects strategyOverride', () => {
        const prefs = createPrefs({
          autoInstallStrategy: 'cheapest',
          maxPriceCap: 100,
          minRatingThreshold: 0,
        });

        const cheapestResult = selectBestTool(allTools, prefs);
        const ratingResult = selectBestTool(allTools, prefs, { strategyOverride: 'rating' });

        // Different strategies should produce different orderings
        expect(cheapestResult.candidates[0].id).not.toBe(ratingResult.candidates[0].id);
      });

      it('respects maxCandidates', () => {
        const prefs = createPrefs({
          maxPriceCap: 100,
          minRatingThreshold: 0,
        });

        const result = selectBestTool(allTools, prefs, { maxCandidates: 2 });

        expect(result.candidates).toHaveLength(2);
      });
    });

    describe('stats', () => {
      it('correctly reports filter statistics', () => {
        const prefs = createPrefs({
          maxPriceCap: 0.5,
          minRatingThreshold: 3.0,
        });

        const result = selectBestTool(allTools, prefs);

        expect(result.stats.totalInput).toBe(5);
        expect(result.stats.passedFilters + result.stats.filteredByPrice +
          result.stats.filteredByRating + result.stats.filteredByBoth).toBe(5);
      });
    });
  });

  describe('getAutoSelectedTool', () => {
    it('returns the best tool for auto mode', () => {
      const prefs = createPrefs({
        maxPriceCap: 100,
        minRatingThreshold: 0,
        autoInstallStrategy: 'rating',
      });

      const tool = getAutoSelectedTool(allTools, prefs);

      expect(tool).not.toBeNull();
      expect(tool?.average_rating).toBe(4.8);
    });

    it('returns null when no tools pass filters', () => {
      const prefs = createPrefs({
        maxPriceCap: 0.001,
        minRatingThreshold: 5.0,
      });

      const tool = getAutoSelectedTool(allTools, prefs);

      expect(tool).toBeNull();
    });
  });

  describe('getManualCandidates', () => {
    it('returns ranked candidates for manual selection', () => {
      const prefs = createPrefs({
        maxPriceCap: 100,
        minRatingThreshold: 0,
      });

      const candidates = getManualCandidates(allTools, prefs, 3);

      expect(candidates).toHaveLength(3);
    });

    it('returns all if limit exceeds count', () => {
      const prefs = createPrefs({
        maxPriceCap: 100,
        minRatingThreshold: 0,
      });

      const candidates = getManualCandidates(allTools, prefs, 100);

      expect(candidates).toHaveLength(5);
    });
  });

  describe('hasViableCandidates', () => {
    it('returns true when some tools pass', () => {
      const prefs = createPrefs({
        maxPriceCap: 0.1,
        minRatingThreshold: 2.0,
      });

      expect(hasViableCandidates(allTools, prefs)).toBe(true);
    });

    it('returns false when no tools pass', () => {
      const prefs = createPrefs({
        maxPriceCap: 0.001,
        minRatingThreshold: 5.0,
      });

      expect(hasViableCandidates(allTools, prefs)).toBe(false);
    });
  });

  describe('describeFiltering', () => {
    it('describes empty input', () => {
      const prefs = createPrefs();
      const message = describeFiltering([], prefs);

      expect(message).toContain('No tools were provided');
    });

    it('describes all tools passing', () => {
      const prefs = createPrefs({
        maxPriceCap: 100,
        minRatingThreshold: 0,
      });
      const message = describeFiltering(allTools, prefs);

      expect(message).toContain('All 5 tools passed');
    });

    it('describes no tools passing', () => {
      const prefs = createPrefs({
        maxPriceCap: 0.001,
        minRatingThreshold: 5.0,
      });
      const message = describeFiltering(allTools, prefs);

      expect(message).toContain('No tools passed');
    });

    it('describes partial filtering', () => {
      const prefs = createPrefs({
        maxPriceCap: 0.1,
        minRatingThreshold: 4.0,
      });
      const message = describeFiltering(allTools, prefs);

      expect(message).toContain('1 of 5');
      expect(message).toContain('passed');
    });
  });
});

