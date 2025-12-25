/**
 * Integration Smoke Tests for Search Service
 *
 * These tests verify the full search pipeline with real/mocked external services.
 * Tests are skipped if required credentials are not set.
 *
 * To run with real services:
 *   export OPENAI_API_KEY=your-key
 *   export SUPABASE_URL=https://your-project.supabase.co
 *   export SUPABASE_KEY=your-service-role-key
 *   npm run test -- tests/sprint4-1/integrationSearch.spec.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  searchTools,
  getSearchServiceStatus,
  hasEmbeddings,
  storeToolEmbedding,
  generateEmbedding,
  SearchServiceError,
} from '../../src/discovery/search';
import {
  initializeSupabaseClient,
  resetSupabaseClient,
  isSupabaseConfigured,
} from '../../src/discovery/supabase/client';
import { getAllTools } from '../../src/discovery/supabase/service';

// Check if credentials are available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const hasOpenAIKey = Boolean(OPENAI_API_KEY);
const hasSupabaseCredentials = Boolean(SUPABASE_URL && SUPABASE_KEY);
const hasAllCredentials = hasOpenAIKey && hasSupabaseCredentials;

describe.skipIf(!hasAllCredentials)(
  'Search Service Integration (Live)',
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

    it('search service reports ready status', () => {
      const status = getSearchServiceStatus();

      expect(status.embedding).toBe(true);
      expect(status.queryExpansion).toBe(true);
      expect(status.ready).toBe(true);
    });

    it('generates embedding for test text', async () => {
      const embedding = await generateEmbedding('weather forecast');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
      expect(embedding.every((n) => typeof n === 'number')).toBe(true);
    });

    it('searchTools returns SearchResult structure', async () => {
      // This may return empty results if no tool embeddings exist
      const result = await searchTools('weather', {
        skipExpansion: true, // Skip to save API calls
        matchThreshold: 0.3, // Lower threshold for testing
      });

      expect(result).toHaveProperty('originalQuery');
      expect(result).toHaveProperty('tools');
      expect(result).toHaveProperty('timing');
      expect(result.originalQuery).toBe('weather');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(typeof result.timing.total).toBe('number');
    });

    it('searchTools with expansion generates expanded query', async () => {
      const result = await searchTools('check the weather', {
        matchThreshold: 0.3,
      });

      expect(result.expandedQuery).toBeDefined();
      expect(result.expandedQuery!.length).toBeGreaterThan(20);
      expect(result.timing.expansion).toBeGreaterThan(0);
    });
  }
);

// Tests that run without real credentials
describe('Search Service Integration (Mocked)', () => {
  it('skips live tests when credentials not available', () => {
    if (!hasAllCredentials) {
      console.log(
        'Live integration tests skipped. Missing credentials:',
        {
          OPENAI_API_KEY: hasOpenAIKey ? '✓' : '✗',
          SUPABASE_URL: Boolean(SUPABASE_URL) ? '✓' : '✗',
          SUPABASE_KEY: Boolean(SUPABASE_KEY) ? '✓' : '✗',
        }
      );
    }
    expect(true).toBe(true);
  });

  it('getSearchServiceStatus returns correct structure', () => {
    const status = getSearchServiceStatus();

    expect(status).toHaveProperty('embedding');
    expect(status).toHaveProperty('queryExpansion');
    expect(status).toHaveProperty('ready');
    expect(typeof status.embedding).toBe('boolean');
    expect(typeof status.queryExpansion).toBe('boolean');
    expect(typeof status.ready).toBe('boolean');
  });

  it('exports all expected functions', async () => {
    const searchModule = await import('../../src/discovery/search');

    // Facade functions
    expect(typeof searchModule.searchTools).toBe('function');
    expect(typeof searchModule.searchToolsByEmbedding).toBe('function');
    expect(typeof searchModule.getSearchServiceStatus).toBe('function');

    // Embedding functions
    expect(typeof searchModule.generateEmbedding).toBe('function');
    expect(typeof searchModule.isEmbeddingConfigured).toBe('function');

    // Query expansion functions
    expect(typeof searchModule.expandQuery).toBe('function');
    expect(typeof searchModule.isQueryExpansionConfigured).toBe('function');

    // Vector store functions
    expect(typeof searchModule.findSimilarTools).toBe('function');
    expect(typeof searchModule.hasEmbeddings).toBe('function');
    expect(typeof searchModule.storeToolEmbedding).toBe('function');

    // Error classes
    expect(searchModule.SearchServiceError).toBeDefined();
    expect(searchModule.EmbeddingError).toBeDefined();
    expect(searchModule.QueryExpansionError).toBeDefined();
    expect(searchModule.VectorSearchError).toBeDefined();

    // Constants
    expect(searchModule.EMBEDDING_DIMENSION).toBe(1536);
    expect(searchModule.DEFAULT_MODEL).toBe('text-embedding-3-small');
  });

  it('SearchServiceError includes step information', () => {
    const error = new SearchServiceError('Test error', null, 'embedding');

    expect(error.name).toBe('SearchServiceError');
    expect(error.message).toBe('Test error');
    expect(error.step).toBe('embedding');
  });
});

// Setup helper for seeding embeddings (useful for manual testing)
describe.skipIf(!hasAllCredentials)(
  'Embedding Seeding Helper',
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

    it('can seed tool embeddings from existing tools', async () => {
      // Get existing tools
      const tools = await getAllTools();

      if (tools.length === 0) {
        console.log('No tools found in database - skipping embedding seed');
        return;
      }

      // Check if embeddings already exist
      const hasExisting = await hasEmbeddings();

      if (hasExisting) {
        console.log('Embeddings already exist - skipping seed');
        return;
      }

      // Seed first tool only (to save API calls)
      const tool = tools[0];
      console.log(`Seeding embedding for tool: ${tool.name}`);

      const embedding = await generateEmbedding(tool.description);
      await storeToolEmbedding(tool.id, embedding);

      console.log(`Seeded embedding for ${tool.name}`);

      // Verify
      const hasNew = await hasEmbeddings();
      expect(hasNew).toBe(true);
    });
  }
);

