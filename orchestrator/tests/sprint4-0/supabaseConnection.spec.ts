import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  initializeSupabaseClient,
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClient,
  SupabaseConfigError,
} from '../../src/discovery/supabase/client';
import { loadConfig } from '../../src/config/load';

// Mock the Supabase client module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
  })),
}));

describe('Supabase Client Setup', () => {
  beforeEach(() => {
    // Reset singleton before each test
    resetSupabaseClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetSupabaseClient();
  });

  describe('initializeSupabaseClient', () => {
    it('creates client with valid config', async () => {
      const { createClient } = await import('@supabase/supabase-js');

      const client = initializeSupabaseClient({
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'test-key-12345',
      });

      expect(createClient).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'test-key-12345',
        expect.objectContaining({
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      );
      expect(client).toBeDefined();
      expect(client.from).toBeDefined();
    });

    it('throws SupabaseConfigError when SUPABASE_URL is missing', () => {
      expect(() =>
        initializeSupabaseClient({
          supabaseKey: 'test-key-12345',
        })
      ).toThrow(SupabaseConfigError);
      expect(() =>
        initializeSupabaseClient({
          supabaseKey: 'test-key-12345',
        })
      ).toThrow('SUPABASE_URL is required');
    });

    it('throws SupabaseConfigError when SUPABASE_KEY is missing', () => {
      expect(() =>
        initializeSupabaseClient({
          supabaseUrl: 'https://example.supabase.co',
        })
      ).toThrow(SupabaseConfigError);
      expect(() =>
        initializeSupabaseClient({
          supabaseUrl: 'https://example.supabase.co',
        })
      ).toThrow('SUPABASE_KEY is required');
    });

    it('throws SupabaseConfigError when both are missing', () => {
      expect(() => initializeSupabaseClient({})).toThrow(SupabaseConfigError);
    });
  });

  describe('getSupabaseClient', () => {
    it('returns initialized client', () => {
      initializeSupabaseClient({
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'test-key-12345',
      });

      const client = getSupabaseClient();
      expect(client).toBeDefined();
      expect(client.from).toBeDefined();
    });

    it('throws SupabaseConfigError when not initialized', () => {
      expect(() => getSupabaseClient()).toThrow(SupabaseConfigError);
      expect(() => getSupabaseClient()).toThrow('not initialized');
    });
  });

  describe('isSupabaseConfigured', () => {
    it('returns false before initialization', () => {
      expect(isSupabaseConfigured()).toBe(false);
    });

    it('returns true after initialization', () => {
      initializeSupabaseClient({
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'test-key-12345',
      });

      expect(isSupabaseConfigured()).toBe(true);
    });

    it('returns false after reset', () => {
      initializeSupabaseClient({
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'test-key-12345',
      });

      resetSupabaseClient();

      expect(isSupabaseConfigured()).toBe(false);
    });
  });
});

describe('Config Schema - Supabase fields', () => {
  it('parses config without Supabase (optional)', () => {
    const cfg = loadConfig({
      JUNGLE_URL: 'http://localhost:9000',
    } as NodeJS.ProcessEnv);

    expect(cfg.supabaseUrl).toBeUndefined();
    expect(cfg.supabaseKey).toBeUndefined();
  });

  it('parses config with valid Supabase credentials', () => {
    const cfg = loadConfig({
      JUNGLE_URL: 'http://localhost:9000',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_KEY: 'service-role-key-12345',
    } as NodeJS.ProcessEnv);

    expect(cfg.supabaseUrl).toBe('https://project.supabase.co');
    expect(cfg.supabaseKey).toBe('service-role-key-12345');
  });

  it('throws on invalid SUPABASE_URL', () => {
    expect(() =>
      loadConfig({
        JUNGLE_URL: 'http://localhost:9000',
        SUPABASE_URL: 'not-a-valid-url',
      } as NodeJS.ProcessEnv)
    ).toThrow(/SUPABASE_URL/);
  });
});

