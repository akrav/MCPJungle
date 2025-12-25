import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAllTools,
  getActiveTools,
  getToolById,
  getToolsByName,
  SupabaseServiceError,
} from '../../src/discovery/supabase/service';
import {
  initializeSupabaseClient,
  resetSupabaseClient,
} from '../../src/discovery/supabase/client';
import { Tool, ToolSummary } from '../../src/discovery/supabase/types';

// Mock data matching the Supabase tools table schema
const mockToolRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  created_at: '2024-01-01T00:00:00Z',
  merchant_id: '987fcdeb-51a2-3c4d-e5f6-789012345678',
  name: 'Weather API',
  description: 'Get current weather data for any location',
  endpoint_url: 'https://api.example.com/weather',
  price_per_call: 0.01,
  average_rating: 4.5,
  updated_at: '2024-01-15T00:00:00Z',
  listing_status: 'ACTIVE',
};

const mockToolRow2 = {
  id: '223e4567-e89b-12d3-a456-426614174001',
  created_at: '2024-01-02T00:00:00Z',
  merchant_id: '987fcdeb-51a2-3c4d-e5f6-789012345678',
  name: 'Translation API',
  description: 'Translate text between languages',
  endpoint_url: 'https://api.example.com/translate',
  price_per_call: 0.02,
  average_rating: 4.0,
  updated_at: '2024-01-16T00:00:00Z',
  listing_status: 'INACTIVE',
};

// Note: Mock query builder removed - tests use direct mock setup instead

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(),
    })),
  };
});

describe('Supabase Tools Service', () => {
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resetSupabaseClient();
    vi.clearAllMocks();

    // Import and setup mock
    const { createClient } = await import('@supabase/supabase-js');
    mockFrom = vi.fn();
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    });

    // Initialize client
    initializeSupabaseClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
    });
  });

  afterEach(() => {
    resetSupabaseClient();
  });

  describe('getAllTools', () => {
    it('returns array of Tool objects on success', async () => {
      const mockData = [mockToolRow, mockToolRow2];
      mockFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const tools = await getAllTools();

      expect(mockFrom).toHaveBeenCalledWith('tools');
      expect(tools).toHaveLength(2);
      expect(tools[0]).toMatchObject({
        id: mockToolRow.id,
        name: mockToolRow.name,
        description: mockToolRow.description,
        price_per_call: mockToolRow.price_per_call,
        average_rating: mockToolRow.average_rating,
      });
    });

    it('returns empty array when no tools exist', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      const tools = await getAllTools();

      expect(tools).toEqual([]);
    });

    it('returns empty array when data is null', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const tools = await getAllTools();

      expect(tools).toEqual([]);
    });

    it('throws SupabaseServiceError on query error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection refused' },
        }),
      });

      await expect(getAllTools()).rejects.toThrow(SupabaseServiceError);
      await expect(getAllTools()).rejects.toThrow('Failed to fetch tools');
    });

    it('throws SupabaseServiceError when client not configured', async () => {
      resetSupabaseClient();

      await expect(getAllTools()).rejects.toThrow(SupabaseServiceError);
      await expect(getAllTools()).rejects.toThrow('not configured');
    });
  });

  describe('getActiveTools', () => {
    it('returns only active tools with summary fields', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [mockToolRow], error: null }),
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      const tools = await getActiveTools();

      expect(mockSelect).toHaveBeenCalledWith(
        'id, name, description, endpoint_url, price_per_call, average_rating, listing_status'
      );
      expect(tools).toHaveLength(1);
      // Verify it's a ToolSummary (doesn't have all Tool fields)
      expect(tools[0]).toHaveProperty('id');
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('listing_status');
    });

    it('filters by ACTIVE listing_status', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      await getActiveTools();

      expect(mockEq).toHaveBeenCalledWith('listing_status', 'ACTIVE');
    });
  });

  describe('getToolById', () => {
    it('returns tool when found', async () => {
      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: mockToolRow, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const tool = await getToolById(mockToolRow.id);

      expect(mockEq).toHaveBeenCalledWith('id', mockToolRow.id);
      expect(tool).not.toBeNull();
      expect(tool?.id).toBe(mockToolRow.id);
      expect(tool?.name).toBe(mockToolRow.name);
    });

    it('returns null when tool not found', async () => {
      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const tool = await getToolById('nonexistent-id');

      expect(tool).toBeNull();
    });

    it('throws SupabaseServiceError on query error', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(getToolById('some-id')).rejects.toThrow(SupabaseServiceError);
      await expect(getToolById('some-id')).rejects.toThrow('Failed to fetch tool by ID');
    });
  });

  describe('getToolsByName', () => {
    it('searches with ilike for partial match', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: [mockToolRow], error: null });
      const mockIlike = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = vi.fn().mockReturnValue({ ilike: mockIlike });
      mockFrom.mockReturnValue({ select: mockSelect });

      const tools = await getToolsByName('weather');

      expect(mockIlike).toHaveBeenCalledWith('name', '%weather%');
      expect(mockEq).toHaveBeenCalledWith('listing_status', 'ACTIVE');
      expect(tools).toHaveLength(1);
    });

    it('returns empty array when no matches', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockIlike = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = vi.fn().mockReturnValue({ ilike: mockIlike });
      mockFrom.mockReturnValue({ select: mockSelect });

      const tools = await getToolsByName('nonexistent');

      expect(tools).toEqual([]);
    });
  });

  describe('Type safety', () => {
    it('getAllTools returns Tool[] type', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [mockToolRow], error: null }),
      });

      const tools: Tool[] = await getAllTools();

      // TypeScript compilation verifies the type
      expect(tools[0].listing_status).toBe('ACTIVE');
      expect(tools[0].created_at).toBeDefined();
      expect(tools[0].merchant_id).toBeDefined();
    });

    it('getActiveTools returns ToolSummary[] type', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [mockToolRow], error: null }),
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      const tools: ToolSummary[] = await getActiveTools();

      // TypeScript compilation verifies the type
      expect(tools[0].id).toBeDefined();
      expect(tools[0].name).toBeDefined();
    });
  });
});

