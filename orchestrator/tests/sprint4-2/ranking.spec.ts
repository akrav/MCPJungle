import { describe, it, expect } from 'vitest';
import {
  rankTools,
  compareByPriceAsc,
  compareByRatingDesc,
  compareByBalancedScore,
  calculateBalancedScore,
  getComparator,
  getTopRanked,
  getBestTool,
} from '../../src/discovery/selection/ranking';
import { ToolSummary } from '../../src/discovery/supabase/types';
import { SortStrategy } from '../../src/discovery/preferences/types';

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

// Create test tools with varied prices and ratings
const cheapLowRating = createTool('cheap-low', 'Cheap Low', 0.01, 2.0);
const cheapHighRating = createTool('cheap-high', 'Cheap High', 0.01, 4.5);
const expensiveLowRating = createTool('expensive-low', 'Expensive Low', 1.0, 2.0);
const expensiveHighRating = createTool('expensive-high', 'Expensive High', 1.0, 4.8);
const midPriceMidRating = createTool('mid-mid', 'Mid Mid', 0.10, 3.5);

const allTools = [
  cheapLowRating,
  cheapHighRating,
  expensiveLowRating,
  expensiveHighRating,
  midPriceMidRating,
];

describe('Ranking Strategies', () => {
  describe('compareByPriceAsc', () => {
    it('returns negative when first tool is cheaper', () => {
      expect(compareByPriceAsc(cheapLowRating, expensiveHighRating)).toBeLessThan(0);
    });

    it('returns positive when first tool is more expensive', () => {
      expect(compareByPriceAsc(expensiveHighRating, cheapLowRating)).toBeGreaterThan(0);
    });

    it('returns 0 for equal prices', () => {
      expect(compareByPriceAsc(cheapLowRating, cheapHighRating)).toBe(0);
    });

    it('handles undefined price by treating as Infinity', () => {
      const noPrice = { ...cheapLowRating, price_per_call: undefined as any };
      expect(compareByPriceAsc(noPrice, cheapLowRating)).toBeGreaterThan(0);
    });
  });

  describe('compareByRatingDesc', () => {
    it('returns negative when first tool has higher rating', () => {
      expect(compareByRatingDesc(expensiveHighRating, cheapLowRating)).toBeLessThan(0);
    });

    it('returns positive when first tool has lower rating', () => {
      expect(compareByRatingDesc(cheapLowRating, expensiveHighRating)).toBeGreaterThan(0);
    });

    it('returns 0 for equal ratings', () => {
      expect(compareByRatingDesc(cheapLowRating, expensiveLowRating)).toBe(0);
    });

    it('handles undefined rating by treating as 0', () => {
      const noRating = { ...expensiveHighRating, average_rating: undefined as any };
      expect(compareByRatingDesc(noRating, cheapLowRating)).toBeGreaterThan(0);
    });
  });

  describe('calculateBalancedScore', () => {
    it('calculates score correctly for typical tool', () => {
      // Rating 4.5, Price 0.01 -> (4.5 * 10) - (0.01 * 100) = 45 - 1 = 44
      const score = calculateBalancedScore(cheapHighRating);
      expect(score).toBeCloseTo(44, 1);
    });

    it('higher rating improves score', () => {
      const highRatingScore = calculateBalancedScore(cheapHighRating);
      const lowRatingScore = calculateBalancedScore(cheapLowRating);
      expect(highRatingScore).toBeGreaterThan(lowRatingScore);
    });

    it('higher price reduces score', () => {
      const cheapScore = calculateBalancedScore(cheapHighRating);
      const expensiveScore = calculateBalancedScore(expensiveHighRating);
      expect(cheapScore).toBeGreaterThan(expensiveScore);
    });

    it('handles undefined values as zeros', () => {
      const tool = { ...cheapLowRating, price_per_call: undefined as any, average_rating: undefined as any };
      const score = calculateBalancedScore(tool);
      expect(score).toBe(0);
    });
  });

  describe('compareByBalancedScore', () => {
    it('returns negative when first tool has higher balanced score', () => {
      // cheapHighRating should have better score than expensiveLowRating
      expect(compareByBalancedScore(cheapHighRating, expensiveLowRating)).toBeLessThan(0);
    });

    it('returns positive when first tool has lower balanced score', () => {
      expect(compareByBalancedScore(expensiveLowRating, cheapHighRating)).toBeGreaterThan(0);
    });
  });

  describe('getComparator', () => {
    it('returns price comparator for cheapest strategy', () => {
      const comparator = getComparator('cheapest');
      expect(comparator(cheapLowRating, expensiveHighRating)).toBeLessThan(0);
    });

    it('returns rating comparator for rating strategy', () => {
      const comparator = getComparator('rating');
      expect(comparator(expensiveHighRating, cheapLowRating)).toBeLessThan(0);
    });

    it('returns balanced comparator for balanced strategy', () => {
      const comparator = getComparator('balanced');
      expect(comparator(cheapHighRating, expensiveLowRating)).toBeLessThan(0);
    });

    it('throws for unknown strategy', () => {
      expect(() => getComparator('unknown' as SortStrategy)).toThrow('Unknown strategy');
    });
  });

  describe('rankTools', () => {
    it('returns empty array for empty input', () => {
      expect(rankTools([], 'cheapest')).toEqual([]);
    });

    it('does not mutate original array', () => {
      const original = [...allTools];
      rankTools(allTools, 'cheapest');
      expect(allTools).toEqual(original);
    });

    describe('cheapest strategy', () => {
      it('sorts by price ascending', () => {
        const ranked = rankTools(allTools, 'cheapest');
        const prices = ranked.map((t) => t.price_per_call);

        // First two should be cheapest (0.01), then mid (0.10), then expensive (1.0)
        expect(prices[0]).toBe(0.01);
        expect(prices[1]).toBe(0.01);
        expect(prices[2]).toBe(0.10);
        expect(prices[3]).toBe(1.0);
        expect(prices[4]).toBe(1.0);
      });
    });

    describe('rating strategy', () => {
      it('sorts by rating descending', () => {
        const ranked = rankTools(allTools, 'rating');
        const ratings = ranked.map((t) => t.average_rating);

        expect(ratings[0]).toBe(4.8); // highest
        expect(ratings[1]).toBe(4.5);
        expect(ratings[2]).toBe(3.5);
        expect(ratings[3]).toBe(2.0);
        expect(ratings[4]).toBe(2.0); // lowest
      });
    });

    describe('balanced strategy', () => {
      it('sorts by balanced score descending', () => {
        const ranked = rankTools(allTools, 'balanced');

        // cheapHighRating should be first (high rating, low price)
        expect(ranked[0].id).toBe('cheap-high');

        // expensiveLowRating should be last (low rating, high price)
        expect(ranked[ranked.length - 1].id).toBe('expensive-low');
      });

      it('prefers cheap high-rated over expensive high-rated', () => {
        const ranked = rankTools([cheapHighRating, expensiveHighRating], 'balanced');
        expect(ranked[0].id).toBe('cheap-high');
      });
    });
  });

  describe('getTopRanked', () => {
    it('returns top N tools', () => {
      const top2 = getTopRanked(allTools, 'rating', 2);

      expect(top2).toHaveLength(2);
      expect(top2[0].average_rating).toBe(4.8);
      expect(top2[1].average_rating).toBe(4.5);
    });

    it('returns all tools if limit exceeds count', () => {
      const top10 = getTopRanked(allTools, 'cheapest', 10);
      expect(top10).toHaveLength(5);
    });

    it('returns empty array for limit 0', () => {
      const top0 = getTopRanked(allTools, 'cheapest', 0);
      expect(top0).toHaveLength(0);
    });

    it('handles negative limit', () => {
      const topNeg = getTopRanked(allTools, 'cheapest', -1);
      expect(topNeg).toHaveLength(0);
    });
  });

  describe('getBestTool', () => {
    it('returns best tool for cheapest strategy', () => {
      const best = getBestTool(allTools, 'cheapest');
      expect(best?.price_per_call).toBe(0.01);
    });

    it('returns best tool for rating strategy', () => {
      const best = getBestTool(allTools, 'rating');
      expect(best?.average_rating).toBe(4.8);
    });

    it('returns best tool for balanced strategy', () => {
      const best = getBestTool(allTools, 'balanced');
      expect(best?.id).toBe('cheap-high');
    });

    it('returns null for empty array', () => {
      const best = getBestTool([], 'cheapest');
      expect(best).toBeNull();
    });
  });
});

