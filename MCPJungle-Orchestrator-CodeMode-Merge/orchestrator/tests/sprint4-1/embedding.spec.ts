import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateEmbedding,
  generateEmbeddings,
  isEmbeddingConfigured,
  EmbeddingError,
  EMBEDDING_DIMENSION,
  DEFAULT_MODEL,
} from '../../src/discovery/search/embedding';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock environment
const originalEnv = process.env;

describe('Embedding Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      JUNGLE_URL: 'http://localhost:9000',
      OPENAI_API_KEY: 'test-openai-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('generateEmbedding', () => {
    it('returns embedding vector for valid text', async () => {
      const mockEmbedding = Array(EMBEDDING_DIMENSION).fill(0.1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: DEFAULT_MODEL,
          usage: { prompt_tokens: 10, total_tokens: 10 },
        }),
      });

      const result = await generateEmbedding('test query');

      expect(result).toHaveLength(EMBEDDING_DIMENSION);
      expect(result).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-openai-key',
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            input: 'test query',
          }),
        })
      );
    });

    it('returns array of numbers with correct dimension', async () => {
      const mockEmbedding = Array(EMBEDDING_DIMENSION)
        .fill(0)
        .map((_, i) => Math.sin(i / 100));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: DEFAULT_MODEL,
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      const result = await generateEmbedding('hello world');

      expect(Array.isArray(result)).toBe(true);
      expect(result.every((n) => typeof n === 'number')).toBe(true);
      expect(result.length).toBe(EMBEDDING_DIMENSION);
    });

    it('throws EmbeddingError on API 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const error = await generateEmbedding('test').catch((e) => e);
      expect(error).toBeInstanceOf(EmbeddingError);
      expect(error.message).toContain('401');
      expect(error.statusCode).toBe(401);
    });

    it('throws EmbeddingError on API 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      const error = await generateEmbedding('test').catch((e) => e);
      expect(error).toBeInstanceOf(EmbeddingError);
      expect(error.message).toContain('500');
      expect(error.statusCode).toBe(500);
    });

    it('throws EmbeddingError on API 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      const error = await generateEmbedding('test').catch((e) => e);
      expect(error).toBeInstanceOf(EmbeddingError);
      expect(error.message).toContain('429');
      expect(error.statusCode).toBe(429);
    });

    it('throws EmbeddingError on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(generateEmbedding('test')).rejects.toThrow(EmbeddingError);
      await expect(generateEmbedding('test')).rejects.toThrow(
        'Failed to generate embedding'
      );
    });

    it('throws EmbeddingError for empty text', async () => {
      await expect(generateEmbedding('')).rejects.toThrow(EmbeddingError);
      await expect(generateEmbedding('   ')).rejects.toThrow(EmbeddingError);
    });

    it('throws EmbeddingError when OPENAI_API_KEY not set', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateEmbedding('test')).rejects.toThrow(EmbeddingError);
      await expect(generateEmbedding('test')).rejects.toThrow(
        'OPENAI_API_KEY is required'
      );
    });

    it('trims whitespace from input text', async () => {
      const mockEmbedding = Array(EMBEDDING_DIMENSION).fill(0.1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0 }],
          model: DEFAULT_MODEL,
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      await generateEmbedding('  test query  ');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            input: 'test query',
          }),
        })
      );
    });
  });

  describe('generateEmbeddings (batch)', () => {
    it('returns multiple embeddings in order', async () => {
      const mockEmbeddings = [
        Array(EMBEDDING_DIMENSION).fill(0.1),
        Array(EMBEDDING_DIMENSION).fill(0.2),
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: mockEmbeddings[0], index: 0 },
            { embedding: mockEmbeddings[1], index: 1 },
          ],
          model: DEFAULT_MODEL,
          usage: { prompt_tokens: 10, total_tokens: 10 },
        }),
      });

      const result = await generateEmbeddings(['first', 'second']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockEmbeddings[0]);
      expect(result[1]).toEqual(mockEmbeddings[1]);
    });

    it('returns empty array for empty input', async () => {
      const result = await generateEmbeddings([]);
      expect(result).toEqual([]);
    });

    it('sorts results by index', async () => {
      const mockEmbeddings = [
        Array(EMBEDDING_DIMENSION).fill(0.1),
        Array(EMBEDDING_DIMENSION).fill(0.2),
      ];
      // Return in reverse order
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { embedding: mockEmbeddings[1], index: 1 },
            { embedding: mockEmbeddings[0], index: 0 },
          ],
          model: DEFAULT_MODEL,
          usage: { prompt_tokens: 10, total_tokens: 10 },
        }),
      });

      const result = await generateEmbeddings(['first', 'second']);

      expect(result[0]).toEqual(mockEmbeddings[0]);
      expect(result[1]).toEqual(mockEmbeddings[1]);
    });
  });

  describe('isEmbeddingConfigured', () => {
    it('returns true when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(isEmbeddingConfigured()).toBe(true);
    });

    it('returns false when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(isEmbeddingConfigured()).toBe(false);
    });
  });

  describe('Constants', () => {
    it('has correct embedding dimension', () => {
      expect(EMBEDDING_DIMENSION).toBe(1536);
    });

    it('uses correct default model', () => {
      expect(DEFAULT_MODEL).toBe('text-embedding-3-small');
    });
  });
});

