import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  searchTools,
  searchToolsByEmbedding,
  getSearchServiceStatus,
  SearchServiceError,
} from '../../src/discovery/search';
import {
  initializeSupabaseClient,
  resetSupabaseClient,
} from '../../src/discovery/supabase/client';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(),
  })),
}));

// Mock environment
const originalEnv = process.env;

describe('Search Service Facade', () => {
  let mockRpc: ReturnType<typeof vi.fn>;

  const mockEmbedding = Array(1536).fill(0.1);
  const mockExpandedQuery =
    'An MCP tool that provides weather information including current temperature, humidity, and forecasts.';
  const mockToolResults = [
    {
      id: 'tool-weather',
      name: 'Weather API',
      description: 'Get weather data',
      endpoint_url: 'https://api.weather.com',
      price_per_call: 0.01,
      average_rating: 4.5,
      listing_status: 'ACTIVE',
      similarity: 0.92,
    },
  ];

  beforeEach(async () => {
    resetSupabaseClient();
    vi.clearAllMocks();

    process.env = {
      ...originalEnv,
      JUNGLE_URL: 'http://localhost:9000',
      OPENAI_API_KEY: 'test-openai-key',
    };

    const { createClient } = await import('@supabase/supabase-js');
    mockRpc = vi.fn();
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: mockRpc,
      from: vi.fn(),
    });

    initializeSupabaseClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
    });
  });

  afterEach(() => {
    resetSupabaseClient();
    process.env = originalEnv;
  });

  describe('searchTools', () => {
    it('executes full pipeline: expansion -> embedding -> search', async () => {
      // Mock query expansion (Chat Completion)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockExpandedQuery }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
        }),
      });

      // Mock embedding generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 20, total_tokens: 20 },
        }),
      });

      // Mock vector search
      mockRpc.mockResolvedValueOnce({ data: mockToolResults, error: null });

      const result = await searchTools('weather');

      expect(result.originalQuery).toBe('weather');
      expect(result.expandedQuery).toBe(mockExpandedQuery);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('Weather API');
      expect(result.timing.expansion).toBeGreaterThanOrEqual(0);
      expect(result.timing.embedding).toBeGreaterThanOrEqual(0);
      expect(result.timing.search).toBeGreaterThanOrEqual(0);
      expect(result.timing.total).toBeGreaterThanOrEqual(0);
    });

    it('skips expansion when skipExpansion is true', async () => {
      // Mock embedding generation only (no expansion)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      // Mock vector search
      mockRpc.mockResolvedValueOnce({ data: mockToolResults, error: null });

      const result = await searchTools('weather', { skipExpansion: true });

      expect(result.expandedQuery).toBeUndefined();
      expect(result.timing.expansion).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only embedding, no expansion
    });

    it('returns empty tools array when no matches found', async () => {
      // Mock expansion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Some tool' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
      });

      // Mock embedding
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      // Mock empty search results
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await searchTools('nonexistent tool');

      expect(result.tools).toEqual([]);
    });

    it('throws SearchServiceError for empty query', async () => {
      await expect(searchTools('')).rejects.toThrow(SearchServiceError);
      await expect(searchTools('   ')).rejects.toThrow(SearchServiceError);
    });

    it('throws SearchServiceError with step=expansion on expansion failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'Error',
      });

      const error = await searchTools('test').catch((e) => e);
      expect(error).toBeInstanceOf(SearchServiceError);
      expect(error.step).toBe('expansion');
    });

    it('throws SearchServiceError with step=embedding on embedding failure', async () => {
      // Mock successful expansion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Some tool' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
      });

      // Mock embedding failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid key',
      });

      const error = await searchTools('test').catch((e) => e);
      expect(error).toBeInstanceOf(SearchServiceError);
      expect(error.step).toBe('embedding');
    });

    it('throws SearchServiceError with step=search on search failure', async () => {
      // Mock successful expansion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Some tool' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
      });

      // Mock successful embedding
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      // Mock search failure
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const error = await searchTools('test').catch((e) => e);
      expect(error).toBeInstanceOf(SearchServiceError);
      expect(error.step).toBe('search');
    });

    it('respects custom matchThreshold and matchCount', async () => {
      // Mock expansion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Tool' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      // Mock embedding
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      // Mock search
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await searchTools('test', {
        matchThreshold: 0.8,
        matchCount: 5,
      });

      expect(mockRpc).toHaveBeenCalledWith('match_tools_orchestrator', {
        query_embedding: mockEmbedding,
        match_threshold: 0.8,
        match_count: 5,
      });
    });
  });

  describe('searchToolsByEmbedding', () => {
    it('searches with pre-computed embedding', async () => {
      mockRpc.mockResolvedValueOnce({ data: mockToolResults, error: null });

      const results = await searchToolsByEmbedding(mockEmbedding);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Weather API');
      expect(mockFetch).not.toHaveBeenCalled(); // No expansion or embedding calls
    });
  });

  describe('getSearchServiceStatus', () => {
    it('returns status with all components configured', () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const status = getSearchServiceStatus();

      expect(status.embedding).toBe(true);
      expect(status.queryExpansion).toBe(true);
      expect(status.ready).toBe(true);
    });

    it('returns not ready when OpenAI key missing', () => {
      delete process.env.OPENAI_API_KEY;

      const status = getSearchServiceStatus();

      expect(status.embedding).toBe(false);
      expect(status.queryExpansion).toBe(false);
      expect(status.ready).toBe(false);
    });
  });
});

