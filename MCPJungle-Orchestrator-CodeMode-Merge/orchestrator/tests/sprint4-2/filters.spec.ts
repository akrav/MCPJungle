import { describe, it, expect } from 'vitest';
import {
  filterTools,
  passesPriceFilter,
  passesRatingFilter,
  getFilterStats,
  DEFAULT_FILTER_OPTIONS,
} from '../../src/discovery/selection/filters';
import { ToolSummary } from '../../src/discovery/supabase/types';
import { UserPreferences } from '../../src/discovery/preferences/types';

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

// Standard test tools
const cheapGood = createTool('cheap-good', 'Cheap Good', 0.01, 4.5);
const cheapBad = createTool('cheap-bad', 'Cheap Bad', 0.01, 2.0);
const expensiveGood = createTool('expensive-good', 'Expensive Good', 5.0, 4.8);
const expensiveBad = createTool('expensive-bad', 'Expensive Bad', 5.0, 1.5);

const allTools = [cheapGood, cheapBad, expensiveGood, expensiveBad];

// Standard preferences
const createPrefs = (
  maxPriceCap: number,
  minRatingThreshold: number
): Pick<UserPreferences, 'maxPriceCap' | 'minRatingThreshold'> => ({
  maxPriceCap,
  minRatingThreshold,
});

describe('Safety Filters', () => {
  describe('passesPriceFilter', () => {
    it('returns true when price is below cap', () => {
      expect(passesPriceFilter(cheapGood, 1.0)).toBe(true);
    });

    it('returns true when price equals cap', () => {
      const tool = createTool('test', 'Test', 1.0, 4.0);
      expect(passesPriceFilter(tool, 1.0)).toBe(true);
    });

    it('returns false when price exceeds cap', () => {
      expect(passesPriceFilter(expensiveGood, 1.0)).toBe(false);
    });

    it('returns false for undefined price in strict mode', () => {
      const tool = { ...cheapGood, price_per_call: undefined as any };
      expect(passesPriceFilter(tool, 1.0, true)).toBe(false);
    });

    it('returns true for undefined price in non-strict mode', () => {
      const tool = { ...cheapGood, price_per_call: undefined as any };
      expect(passesPriceFilter(tool, 1.0, false)).toBe(true);
    });
  });

  describe('passesRatingFilter', () => {
    it('returns true when rating is above threshold', () => {
      expect(passesRatingFilter(cheapGood, 4.0)).toBe(true);
    });

    it('returns true when rating equals threshold', () => {
      const tool = createTool('test', 'Test', 0.01, 4.0);
      expect(passesRatingFilter(tool, 4.0)).toBe(true);
    });

    it('returns false when rating is below threshold', () => {
      expect(passesRatingFilter(cheapBad, 4.0)).toBe(false);
    });

    it('returns false for undefined rating in strict mode', () => {
      const tool = { ...cheapGood, average_rating: undefined as any };
      expect(passesRatingFilter(tool, 3.0, true)).toBe(false);
    });

    it('returns true for undefined rating in non-strict mode', () => {
      const tool = { ...cheapGood, average_rating: undefined as any };
      expect(passesRatingFilter(tool, 3.0, false)).toBe(true);
    });
  });

  describe('filterTools', () => {
    it('returns empty array for empty input', () => {
      const prefs = createPrefs(1.0, 3.0);
      expect(filterTools([], prefs)).toEqual([]);
    });

    it('filters out expensive tools (low price cap)', () => {
      const prefs = createPrefs(0.5, 0); // Low price cap, no rating filter

      const result = filterTools(allTools, prefs);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(['cheap-good', 'cheap-bad']);
    });

    it('filters out low-rated tools (high rating threshold)', () => {
      const prefs = createPrefs(100, 4.0); // No price filter, high rating threshold

      const result = filterTools(allTools, prefs);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(['cheap-good', 'expensive-good']);
    });

    it('filters by both constraints - only cheap good remains', () => {
      const prefs = createPrefs(0.5, 4.0); // Low price + high rating

      const result = filterTools(allTools, prefs);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cheap-good');
    });

    it('returns all tools when constraints are loose', () => {
      const prefs = createPrefs(100, 0); // Very loose constraints

      const result = filterTools(allTools, prefs);

      expect(result).toHaveLength(4);
    });

    it('returns empty array when constraints are too strict', () => {
      const prefs = createPrefs(0.001, 5.0); // Impossible constraints

      const result = filterTools(allTools, prefs);

      expect(result).toHaveLength(0);
    });

    it('preserves tool order', () => {
      const prefs = createPrefs(100, 0);
      const shuffled = [expensiveBad, cheapGood, expensiveGood, cheapBad];

      const result = filterTools(shuffled, prefs);

      expect(result.map((t) => t.id)).toEqual([
        'expensive-bad',
        'cheap-good',
        'expensive-good',
        'cheap-bad',
      ]);
    });

    it('respects non-strict options for missing values', () => {
      const toolWithMissingValues = {
        ...cheapGood,
        price_per_call: undefined as any,
        average_rating: undefined as any,
      };
      const prefs = createPrefs(1.0, 3.0);

      // Strict mode (default) - should filter out
      const strictResult = filterTools([toolWithMissingValues], prefs);
      expect(strictResult).toHaveLength(0);

      // Non-strict mode - should include
      const looseResult = filterTools([toolWithMissingValues], prefs, {
        strictPrice: false,
        strictRating: false,
      });
      expect(looseResult).toHaveLength(1);
    });
  });

  describe('getFilterStats', () => {
    it('returns zeros for empty input', () => {
      const prefs = createPrefs(1.0, 3.0);
      const stats = getFilterStats([], prefs);

      expect(stats).toEqual({
        total: 0,
        passedAll: 0,
        filteredByPrice: 0,
        filteredByRating: 0,
        filteredByBoth: 0,
      });
    });

    it('correctly categorizes filtered tools', () => {
      const prefs = createPrefs(0.5, 4.0);
      const stats = getFilterStats(allTools, prefs);

      expect(stats.total).toBe(4);
      expect(stats.passedAll).toBe(1); // cheapGood
      expect(stats.filteredByPrice).toBe(1); // expensiveGood (passes rating, fails price)
      expect(stats.filteredByRating).toBe(1); // cheapBad (passes price, fails rating)
      expect(stats.filteredByBoth).toBe(1); // expensiveBad (fails both)
    });

    it('all pass when constraints are loose', () => {
      const prefs = createPrefs(100, 0);
      const stats = getFilterStats(allTools, prefs);

      expect(stats.passedAll).toBe(4);
      expect(stats.filteredByPrice).toBe(0);
      expect(stats.filteredByRating).toBe(0);
      expect(stats.filteredByBoth).toBe(0);
    });
  });

  describe('DEFAULT_FILTER_OPTIONS', () => {
    it('has strict mode enabled by default', () => {
      expect(DEFAULT_FILTER_OPTIONS.strictRating).toBe(true);
      expect(DEFAULT_FILTER_OPTIONS.strictPrice).toBe(true);
    });
  });
});

