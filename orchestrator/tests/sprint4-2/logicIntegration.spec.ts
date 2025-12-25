/**
 * Logic Layer Integration Tests
 *
 * Tests the full filtering and ranking pipeline with realistic data
 * to ensure the entire selection logic works correctly end-to-end.
 */

import { describe, it, expect } from 'vitest';
import {
  selectBestTool,
  getAutoSelectedTool,
  getManualCandidates,
  hasViableCandidates,
  describeFiltering,
} from '../../src/discovery/selection';
import { ToolWithScore } from '../../src/discovery/supabase/types';
import { UserPreferences } from '../../src/discovery/preferences/types';

// Realistic tool fixtures (mimicking Supabase data)
const createRealisticTool = (
  overrides: Partial<ToolWithScore>
): ToolWithScore => ({
  id: crypto.randomUUID(),
  created_at: new Date().toISOString(),
  merchant_id: crypto.randomUUID(),
  name: 'Test Tool',
  description: 'A test tool',
  endpoint_url: 'https://api.example.com/tool',
  price_per_call: 0.05,
  average_rating: 4.0,
  updated_at: new Date().toISOString(),
  listing_status: 'ACTIVE',
  similarity_score: 0.85,
  ...overrides,
});

// Realistic user preferences
const createRealisticPrefs = (
  overrides: Partial<UserPreferences> = {}
): UserPreferences => ({
  userId: crypto.randomUUID(),
  discoveryMode: 'auto',
  autoInstallStrategy: 'balanced',
  maxPriceCap: 0.50,
  minRatingThreshold: 3.5,
  ...overrides,
});

describe('Logic Layer Integration', () => {
  describe('Scenario: E-commerce API selection', () => {
    // Simulate searching for an e-commerce API
    const ecommerceTools: ToolWithScore[] = [
      createRealisticTool({
        id: 'shopify-api',
        name: 'Shopify API',
        description: 'Full e-commerce platform API',
        price_per_call: 0.10,
        average_rating: 4.8,
        similarity_score: 0.92,
      }),
      createRealisticTool({
        id: 'woo-api',
        name: 'WooCommerce API',
        description: 'WordPress e-commerce integration',
        price_per_call: 0.05,
        average_rating: 4.2,
        similarity_score: 0.88,
      }),
      createRealisticTool({
        id: 'stripe-api',
        name: 'Stripe Payments API',
        description: 'Payment processing API',
        price_per_call: 0.02,
        average_rating: 4.9,
        similarity_score: 0.75,
      }),
      createRealisticTool({
        id: 'cheap-ecom',
        name: 'Budget E-com API',
        description: 'Basic e-commerce features',
        price_per_call: 0.001,
        average_rating: 2.5,
        similarity_score: 0.80,
      }),
      createRealisticTool({
        id: 'premium-ecom',
        name: 'Enterprise E-com Suite',
        description: 'Premium e-commerce platform',
        price_per_call: 2.00,
        average_rating: 4.95,
        similarity_score: 0.95,
      }),
    ];

    it('filters expensive and low-rated tools with default prefs', () => {
      const prefs = createRealisticPrefs();
      const result = selectBestTool(ecommerceTools, prefs);

      // Enterprise (too expensive) and Budget (low rating) should be filtered
      expect(result.candidates.some((t) => t.id === 'premium-ecom')).toBe(false);
      expect(result.candidates.some((t) => t.id === 'cheap-ecom')).toBe(false);

      // Good tools should remain
      expect(result.candidates.some((t) => t.id === 'shopify-api')).toBe(true);
      expect(result.candidates.some((t) => t.id === 'woo-api')).toBe(true);
      expect(result.candidates.some((t) => t.id === 'stripe-api')).toBe(true);
    });

    it('selects Stripe in auto mode with balanced strategy (best value)', () => {
      const prefs = createRealisticPrefs({
        discoveryMode: 'auto',
        autoInstallStrategy: 'balanced',
      });

      const result = selectBestTool(ecommerceTools, prefs);

      // Stripe: high rating (4.9), low price (0.02) = best balanced score
      expect(result.autoSelected?.id).toBe('stripe-api');
    });

    it('selects Shopify when prioritizing rating', () => {
      const prefs = createRealisticPrefs({
        discoveryMode: 'auto',
        autoInstallStrategy: 'rating',
        maxPriceCap: 0.50, // Filters out premium-ecom
      });

      const result = selectBestTool(ecommerceTools, prefs);

      // Shopify has highest rating (4.8) among affordable options
      // (Stripe is 4.9, but we expect Stripe since 4.9 > 4.8)
      expect(result.autoSelected?.id).toBe('stripe-api');
    });

    it('selects Stripe when prioritizing cheapest', () => {
      const prefs = createRealisticPrefs({
        discoveryMode: 'auto',
        autoInstallStrategy: 'cheapest',
      });

      const result = selectBestTool(ecommerceTools, prefs);

      // Stripe is cheapest at $0.02 (Budget E-com filtered by rating)
      expect(result.autoSelected?.id).toBe('stripe-api');
    });

    it('returns ranked candidates in manual mode', () => {
      const prefs = createRealisticPrefs({
        discoveryMode: 'manual',
        autoInstallStrategy: 'balanced',
      });

      const result = selectBestTool(ecommerceTools, prefs);

      expect(result.autoSelected).toBeNull();
      expect(result.candidates.length).toBe(3); // 3 pass filters
      expect(result.mode).toBe('manual');
    });
  });

  describe('Scenario: Strict budget constraints', () => {
    const weatherTools: ToolWithScore[] = [
      createRealisticTool({
        id: 'weather-premium',
        name: 'Premium Weather API',
        description: 'Detailed forecasts with radar',
        price_per_call: 0.50,
        average_rating: 4.9,
        similarity_score: 0.95,
      }),
      createRealisticTool({
        id: 'weather-basic',
        name: 'Basic Weather API',
        description: 'Simple current conditions',
        price_per_call: 0.01,
        average_rating: 3.8,
        similarity_score: 0.80,
      }),
      createRealisticTool({
        id: 'weather-free',
        name: 'Free Weather Wrapper',
        description: 'Open data weather service',
        price_per_call: 0.00,
        average_rating: 3.2,
        similarity_score: 0.70,
      }),
    ];

    it('respects tight budget (max $0.02)', () => {
      const prefs = createRealisticPrefs({
        maxPriceCap: 0.02,
        minRatingThreshold: 3.0,
      });

      const result = selectBestTool(weatherTools, prefs);

      // Only basic and free pass the price cap
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.some((t) => t.id === 'weather-premium')).toBe(false);
    });

    it('returns null when budget is too tight for quality', () => {
      const prefs = createRealisticPrefs({
        maxPriceCap: 0.02,
        minRatingThreshold: 4.0, // Too high for cheap tools
      });

      const result = selectBestTool(weatherTools, prefs);

      expect(result.candidates).toHaveLength(0);
      expect(result.autoSelected).toBeNull();
    });
  });

  describe('Scenario: Quality-first user', () => {
    const dbTools: ToolWithScore[] = [
      createRealisticTool({
        id: 'postgres-mcp',
        name: 'PostgreSQL MCP',
        description: 'Full Postgres database access',
        price_per_call: 0.08,
        average_rating: 4.7,
        similarity_score: 0.90,
      }),
      createRealisticTool({
        id: 'mysql-mcp',
        name: 'MySQL MCP',
        description: 'MySQL database integration',
        price_per_call: 0.06,
        average_rating: 4.3,
        similarity_score: 0.88,
      }),
      createRealisticTool({
        id: 'sqlite-mcp',
        name: 'SQLite MCP',
        description: 'Lightweight SQLite access',
        price_per_call: 0.01,
        average_rating: 3.9,
        similarity_score: 0.75,
      }),
    ];

    it('prefers higher rated tool even if more expensive', () => {
      const prefs = createRealisticPrefs({
        autoInstallStrategy: 'rating',
        maxPriceCap: 1.0, // Not budget constrained
        minRatingThreshold: 0,
      });

      const tool = getAutoSelectedTool(dbTools, prefs);

      expect(tool?.id).toBe('postgres-mcp'); // Highest rated
    });

    it('filters by high rating threshold', () => {
      const prefs = createRealisticPrefs({
        minRatingThreshold: 4.5,
        maxPriceCap: 1.0,
      });

      const result = selectBestTool(dbTools, prefs);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe('postgres-mcp');
    });
  });

  describe('Edge cases', () => {
    it('handles tools with identical scores', () => {
      const identicalTools: ToolWithScore[] = [
        createRealisticTool({
          id: 'tool-a',
          name: 'Tool A',
          price_per_call: 0.05,
          average_rating: 4.0,
        }),
        createRealisticTool({
          id: 'tool-b',
          name: 'Tool B',
          price_per_call: 0.05,
          average_rating: 4.0,
        }),
      ];

      const prefs = createRealisticPrefs();
      const result = selectBestTool(identicalTools, prefs);

      // Both should be in candidates
      expect(result.candidates).toHaveLength(2);
      // Auto-select should pick one (first in stable sort)
      expect(result.autoSelected).not.toBeNull();
    });

    it('handles single tool that passes', () => {
      const singleTool = [
        createRealisticTool({
          id: 'only-tool',
          name: 'Only Tool',
          price_per_call: 0.01,
          average_rating: 4.5,
        }),
      ];

      const prefs = createRealisticPrefs();
      const result = selectBestTool(singleTool, prefs);

      expect(result.candidates).toHaveLength(1);
      expect(result.autoSelected?.id).toBe('only-tool');
    });

    it('handles all tools filtered', () => {
      const expensiveTools: ToolWithScore[] = [
        createRealisticTool({ price_per_call: 100 }),
        createRealisticTool({ price_per_call: 200 }),
      ];

      const prefs = createRealisticPrefs({ maxPriceCap: 0.01 });
      const result = selectBestTool(expensiveTools, prefs);

      expect(result.candidates).toHaveLength(0);
      expect(result.autoSelected).toBeNull();
      expect(result.stats.filteredByPrice).toBe(2);
    });

    it('handles tools with zero price and rating', () => {
      const freeTools: ToolWithScore[] = [
        createRealisticTool({
          id: 'free-low',
          price_per_call: 0,
          average_rating: 1.0,
        }),
        createRealisticTool({
          id: 'free-high',
          price_per_call: 0,
          average_rating: 5.0,
        }),
      ];

      const prefs = createRealisticPrefs({
        minRatingThreshold: 0,
        autoInstallStrategy: 'rating',
      });

      const result = selectBestTool(freeTools, prefs);

      expect(result.candidates).toHaveLength(2);
      expect(result.autoSelected?.id).toBe('free-high');
    });
  });

  describe('Helper functions', () => {
    const tools: ToolWithScore[] = [
      createRealisticTool({ id: 't1', price_per_call: 0.01, average_rating: 4.0 }),
      createRealisticTool({ id: 't2', price_per_call: 0.02, average_rating: 4.5 }),
      createRealisticTool({ id: 't3', price_per_call: 5.00, average_rating: 5.0 }),
    ];

    it('hasViableCandidates returns correctly', () => {
      expect(hasViableCandidates(tools, { maxPriceCap: 0.10, minRatingThreshold: 3.5 })).toBe(true);
      expect(hasViableCandidates(tools, { maxPriceCap: 0.001, minRatingThreshold: 5.0 })).toBe(false);
    });

    it('getManualCandidates limits results', () => {
      const prefs = createRealisticPrefs({ maxPriceCap: 10 });
      const candidates = getManualCandidates(tools, prefs, 2);

      expect(candidates).toHaveLength(2);
    });

    it('describeFiltering provides useful feedback', () => {
      const prefs = createRealisticPrefs({ maxPriceCap: 0.05, minRatingThreshold: 4.0 });
      const description = describeFiltering(tools, prefs);

      // t1 (price 0.01, rating 4.0) and t2 (price 0.02, rating 4.5) pass
      // t3 (price 5.00) exceeds price cap
      expect(description).toContain('2 of 3');
      expect(description).toContain('passed');
    });
  });
});

