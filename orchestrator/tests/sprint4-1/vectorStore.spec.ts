import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  findSimilarTools,
  hasEmbeddings,
  storeToolEmbedding,
  getEmbeddingCount,
  VectorSearchError,
  VECTOR_SEARCH_DEFAULTS,
} from '../../src/discovery/search/vectorStore';
import {
  initializeSupabaseClient,
  resetSupabaseClient,
} from '../../src/discovery/supabase/client';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(),
  })),
}));

// Mock environment
const originalEnv = process.env;

describe('Vector Store', () => {
  let mockRpc: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resetSupabaseClient();
    vi.clearAllMocks();

    process.env = {
      ...originalEnv,
      JUNGLE_URL: 'http://localhost:9000',
    };

    const { createClient } = await import('@supabase/supabase-js');
    mockRpc = vi.fn();
    mockFrom = vi.fn();
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: mockRpc,
      from: mockFrom,
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

  describe('findSimilarTools', () => {
    const mockEmbedding = Array(1536).fill(0.1);

    const mockToolResults = [
      {
        id: 'tool-1',
        name: 'Weather API',
        description: 'Get weather data',
        endpoint_url: 'https://api.weather.com',
        price_per_call: 0.01,
        average_rating: 4.5,
        listing_status: 'ACTIVE',
        similarity: 0.95,
      },
      {
        id: 'tool-2',
        name: 'Forecast API',
        description: 'Get forecasts',
        endpoint_url: 'https://api.forecast.com',
        price_per_call: 0.02,
        average_rating: 4.0,
        listing_status: 'ACTIVE',
        similarity: 0.85,
      },
    ];

    it('returns tools sorted by similarity', async () => {
      mockRpc.mockResolvedValueOnce({ data: mockToolResults, error: null });

      const results = await findSimilarTools(mockEmbedding);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('tool-1');
      expect(results[0].similarity).toBe(0.95);
      expect(results[1].id).toBe('tool-2');
      expect(results[1].similarity).toBe(0.85);
    });

    it('calls RPC with correct parameters', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await findSimilarTools(mockEmbedding, {
        matchThreshold: 0.7,
        matchCount: 5,
      });

      expect(mockRpc).toHaveBeenCalledWith('match_tools_orchestrator', {
        query_embedding: mockEmbedding,
        match_threshold: 0.7,
        match_count: 5,
      });
    });

    it('uses default threshold and count', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      await findSimilarTools(mockEmbedding);

      expect(mockRpc).toHaveBeenCalledWith('match_tools_orchestrator', {
        query_embedding: mockEmbedding,
        match_threshold: VECTOR_SEARCH_DEFAULTS.matchThreshold,
        match_count: VECTOR_SEARCH_DEFAULTS.matchCount,
      });
    });

    it('returns empty array when no matches', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const results = await findSimilarTools(mockEmbedding);

      expect(results).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const results = await findSimilarTools(mockEmbedding);

      expect(results).toEqual([]);
    });

    it('throws VectorSearchError on RPC error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });

      const error = await findSimilarTools(mockEmbedding).catch((e) => e);
      expect(error).toBeInstanceOf(VectorSearchError);
      expect(error.message).toContain('RPC');
    });

    it('throws VectorSearchError for empty embedding', async () => {
      await expect(findSimilarTools([])).rejects.toThrow(VectorSearchError);
      await expect(findSimilarTools([])).rejects.toThrow('empty');
    });

    it('throws VectorSearchError when Supabase not configured', async () => {
      resetSupabaseClient();

      await expect(findSimilarTools(mockEmbedding)).rejects.toThrow(
        VectorSearchError
      );
      await expect(findSimilarTools(mockEmbedding)).rejects.toThrow(
        'not configured'
      );
    });

    it('maps result to ToolWithScore correctly', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [mockToolResults[0]],
        error: null,
      });

      const results = await findSimilarTools(mockEmbedding);

      expect(results[0]).toEqual({
        id: 'tool-1',
        name: 'Weather API',
        description: 'Get weather data',
        endpoint_url: 'https://api.weather.com',
        price_per_call: 0.01,
        average_rating: 4.5,
        listing_status: 'ACTIVE',
        similarity: 0.95,
      });
    });
  });

  describe('hasEmbeddings', () => {
    it('returns true when embeddings exist', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ count: 5, error: null });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasEmbeddings();

      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('tool_embeddings_orchestrator');
    });

    it('returns false when no embeddings', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ count: 0, error: null });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasEmbeddings();

      expect(result).toBe(false);
    });

    it('returns false when Supabase not configured', async () => {
      resetSupabaseClient();

      const result = await hasEmbeddings();

      expect(result).toBe(false);
    });
  });

  describe('storeToolEmbedding', () => {
    const mockEmbedding = Array(1536).fill(0.1);

    it('upserts embedding correctly', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      await storeToolEmbedding('tool-123', mockEmbedding);

      expect(mockFrom).toHaveBeenCalledWith('tool_embeddings_orchestrator');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_id: 'tool-123',
          description_embedding: mockEmbedding,
        }),
        { onConflict: 'tool_id' }
      );
    });

    it('throws VectorSearchError on upsert failure', async () => {
      const mockUpsert = vi
        .fn()
        .mockResolvedValue({ error: { message: 'Upsert failed' } });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      await expect(
        storeToolEmbedding('tool-123', mockEmbedding)
      ).rejects.toThrow(VectorSearchError);
    });

    it('throws VectorSearchError when not configured', async () => {
      resetSupabaseClient();

      await expect(
        storeToolEmbedding('tool-123', mockEmbedding)
      ).rejects.toThrow('not configured');
    });
  });

  describe('getEmbeddingCount', () => {
    it('returns count of embeddings', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ count: 42, error: null });
      mockFrom.mockReturnValue({ select: mockSelect });

      const count = await getEmbeddingCount();

      expect(count).toBe(42);
    });

    it('returns 0 when not configured', async () => {
      resetSupabaseClient();

      const count = await getEmbeddingCount();

      expect(count).toBe(0);
    });
  });

  describe('VECTOR_SEARCH_DEFAULTS', () => {
    it('has sensible default values', () => {
      expect(VECTOR_SEARCH_DEFAULTS.matchThreshold).toBe(0.5);
      expect(VECTOR_SEARCH_DEFAULTS.matchCount).toBe(10);
    });
  });
});

