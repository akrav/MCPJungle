import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  persistToolConfig,
  generateCanonicalName,
  getUserTool,
  getUserTools,
  isToolInstalled,
  InstallerError,
} from '../../src/discovery/provisioning/installer';
import { Tool } from '../../src/discovery/supabase/types';

// Mock Supabase client
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../../src/discovery/supabase/client.js', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: mockUpsert,
      select: mockSelect,
      eq: mockEq,
    })),
  })),
}));

vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

const createMockTool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 'test-tool-id-123456789',
  created_at: new Date().toISOString(),
  merchant_id: 'merchant-123',
  name: 'Test Weather API',
  description: 'A weather API for testing',
  endpoint_url: 'https://api.example.com/weather',
  price_per_call: 0.01,
  average_rating: 4.5,
  updated_at: new Date().toISOString(),
  listing_status: 'ACTIVE',
  ...overrides,
});

describe('Tool Installer - Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCanonicalName', () => {
    it('generates correct canonical name', () => {
      const tool = createMockTool({ id: 'abc12345-6789-0def-ghij-klmnopqrstuv', name: 'Weather API' });
      const name = generateCanonicalName(tool);
      expect(name).toBe('Weather_API__abc12345');
    });

    it('sanitizes special characters', () => {
      const tool = createMockTool({ id: 'abc12345', name: 'Weather-API (v2.0)' });
      const name = generateCanonicalName(tool);
      expect(name).toBe('Weather_API_v2_0__abc12345');
    });

    it('handles names with multiple spaces/underscores', () => {
      const tool = createMockTool({ id: 'xyz98765', name: '  My___Tool  Name  ' });
      const name = generateCanonicalName(tool);
      expect(name).toBe('My_Tool_Name__xyz98765');
    });

    it('handles single word names', () => {
      const tool = createMockTool({ id: 'simple123', name: 'Stripe' });
      const name = generateCanonicalName(tool);
      expect(name).toBe('Stripe__simple12');
    });
  });

  describe('persistToolConfig', () => {
    it('persists tool config to database', async () => {
      const tool = createMockTool();
      const userId = 'user-123';
      const expectedRecord = {
        id: 'record-id',
        user_id: userId,
        tool_id: tool.id,
        canonical_name: generateCanonicalName(tool),
        installed_at: new Date().toISOString(),
        is_active: true,
      };

      // Chain the mock calls correctly
      mockUpsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: expectedRecord, error: null }),
        }),
      });

      const result = await persistToolConfig(userId, tool);

      expect(result).toEqual(expectedRecord);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          tool_id: tool.id,
          canonical_name: expect.any(String),
          is_active: true,
        }),
        { onConflict: 'user_id,tool_id' }
      );
    });

    it('throws InstallerError on database error', async () => {
      const tool = createMockTool();
      const userId = 'user-123';

      mockUpsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error', code: 'PGRST123' },
          }),
        }),
      });

      await expect(persistToolConfig(userId, tool)).rejects.toThrow(InstallerError);
      await expect(persistToolConfig(userId, tool)).rejects.toThrow('persist');
    });
  });

  describe('getUserTool', () => {
    it('returns tool record when found', async () => {
      const expectedRecord = {
        id: 'record-id',
        user_id: 'user-123',
        tool_id: 'tool-456',
        canonical_name: 'Test_Tool__tool-456',
        installed_at: new Date().toISOString(),
        is_active: true,
      };

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: expectedRecord, error: null }),
          }),
        }),
      });

      const result = await getUserTool('user-123', 'tool-456');
      expect(result).toEqual(expectedRecord);
    });

    it('returns null when not found', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await getUserTool('user-123', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getUserTools', () => {
    it('returns all active tools for user', async () => {
      const tools = [
        { id: '1', user_id: 'user-123', tool_id: 'tool-1', canonical_name: 'Tool_1', is_active: true },
        { id: '2', user_id: 'user-123', tool_id: 'tool-2', canonical_name: 'Tool_2', is_active: true },
      ];

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: tools, error: null }),
        }),
      });

      const result = await getUserTools('user-123');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no tools installed', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await getUserTools('user-123');
      expect(result).toEqual([]);
    });
  });

  describe('isToolInstalled', () => {
    it('returns true when tool is installed and active', async () => {
      const record = {
        id: 'record-id',
        user_id: 'user-123',
        tool_id: 'tool-456',
        is_active: true,
      };

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: record, error: null }),
          }),
        }),
      });

      const result = await isToolInstalled('user-123', 'tool-456');
      expect(result).toBe(true);
    });

    it('returns false when tool is not installed', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await isToolInstalled('user-123', 'nonexistent');
      expect(result).toBe(false);
    });

    it('returns false when tool is inactive', async () => {
      const record = {
        id: 'record-id',
        user_id: 'user-123',
        tool_id: 'tool-456',
        is_active: false,
      };

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: record, error: null }),
          }),
        }),
      });

      const result = await isToolInstalled('user-123', 'tool-456');
      expect(result).toBe(false);
    });
  });

  describe('InstallerError', () => {
    it('includes phase in error message', () => {
      const error = new InstallerError('Test error', 'persist');
      expect(error.message).toContain('persist');
      expect(error.phase).toBe('persist');
    });

    it('includes original error', () => {
      const originalError = new Error('Original');
      const error = new InstallerError('Test error', 'refresh', originalError);
      expect(error.originalError).toBe(originalError);
    });
  });
});

