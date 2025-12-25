import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  expandQuery,
  isQueryExpansionConfigured,
  QueryExpansionError,
  EXPANSION_SYSTEM_PROMPT,
} from '../../src/discovery/search/queryExpansion';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock environment
const originalEnv = process.env;

describe('Query Expansion', () => {
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

  describe('expandQuery', () => {
    it('expands "weather" query with relevant terms', async () => {
      const mockResponse =
        'An MCP tool that provides weather information. It accepts a city name or coordinates as input and returns current temperature, humidity, wind speed, and weather conditions. It also provides forecasts for upcoming days including precipitation probability.';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: mockResponse, role: 'assistant' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 60, total_tokens: 110 },
        }),
      });

      const result = await expandQuery('weather');

      expect(result).toContain('temperature');
      expect(result.toLowerCase()).toContain('weather');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-openai-key',
          },
        })
      );
    });

    it('expands "calculate sum" query with math-related terms', async () => {
      const mockResponse =
        'A calculator MCP tool that performs arithmetic operations. It accepts numbers and operation types (add, subtract, multiply, divide) and returns computed results. Supports sum calculations, averages, and basic mathematical functions.';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: mockResponse, role: 'assistant' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
        }),
      });

      const result = await expandQuery('calculate sum');

      expect(result.toLowerCase()).toContain('calculator');
      expect(result).toContain('sum');
    });

    it('sends correct prompt structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Test response', role: 'assistant' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        }),
      });

      await expandQuery('test query');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toBe(EXPANSION_SYSTEM_PROMPT);
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toContain('test query');
    });

    it('uses gpt-4.1-nano model by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Test', role: 'assistant' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await expandQuery('test');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-4.1-nano-2025-04-14');
    });

    it('sets low temperature for focused output', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'Test', role: 'assistant' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      await expandQuery('test');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.3);
    });

    it('throws QueryExpansionError on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      const error = await expandQuery('test').catch((e) => e);
      expect(error).toBeInstanceOf(QueryExpansionError);
      expect(error.message).toContain('500');
      expect(error.statusCode).toBe(500);
    });

    it('throws QueryExpansionError for empty query', async () => {
      await expect(expandQuery('')).rejects.toThrow(QueryExpansionError);
      await expect(expandQuery('   ')).rejects.toThrow(QueryExpansionError);
    });

    it('throws QueryExpansionError when API key not set', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(expandQuery('test')).rejects.toThrow(QueryExpansionError);
      await expect(expandQuery('test')).rejects.toThrow('OPENAI_API_KEY is required');
    });

    it('throws QueryExpansionError on empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: '', role: 'assistant' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
      });

      const error = await expandQuery('test').catch((e) => e);
      expect(error).toBeInstanceOf(QueryExpansionError);
      expect(error.message).toContain('Empty response');
    });

    it('throws QueryExpansionError on no choices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
      });

      await expect(expandQuery('test')).rejects.toThrow(QueryExpansionError);
    });

    it('trims whitespace from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: '  Test response with whitespace  ', role: 'assistant' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const result = await expandQuery('test');
      expect(result).toBe('Test response with whitespace');
    });
  });

  describe('isQueryExpansionConfigured', () => {
    it('returns true when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      expect(isQueryExpansionConfigured()).toBe(true);
    });

    it('returns false when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(isQueryExpansionConfigured()).toBe(false);
    });
  });

  describe('EXPANSION_SYSTEM_PROMPT', () => {
    it('contains key instructions', () => {
      expect(EXPANSION_SYSTEM_PROMPT).toContain('MCP');
      expect(EXPANSION_SYSTEM_PROMPT).toContain('tool');
      expect(EXPANSION_SYSTEM_PROMPT).toContain('inputs');
      expect(EXPANSION_SYSTEM_PROMPT).toContain('outputs');
    });
  });
});

