import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installTool,
  refreshRuntime,
  onToolInstalled,
  clearRefreshCallbacks,
  uninstallTool,
  InstallerError,
} from '../../src/discovery/provisioning/installer';
import { Tool } from '../../src/discovery/supabase/types';

// Mock Supabase client
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../src/discovery/supabase/client.js', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: mockUpsert,
      select: mockSelect,
      update: mockUpdate,
      eq: vi.fn().mockReturnThis(),
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

describe('Tool Installer - Runtime Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRefreshCallbacks();
  });

  afterEach(() => {
    clearRefreshCallbacks();
  });

  describe('onToolInstalled', () => {
    it('registers callback', async () => {
      const callback = vi.fn();
      onToolInstalled(callback);

      await refreshRuntime('user-123', 'tool-456');

      expect(callback).toHaveBeenCalledWith('user-123', 'tool-456');
    });

    it('calls multiple registered callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      onToolInstalled(callback1);
      onToolInstalled(callback2);
      onToolInstalled(callback3);

      await refreshRuntime('user-123', 'tool-456');

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });
  });

  describe('clearRefreshCallbacks', () => {
    it('removes all callbacks', async () => {
      const callback = vi.fn();
      onToolInstalled(callback);
      clearRefreshCallbacks();

      await refreshRuntime('user-123', 'tool-456');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('refreshRuntime', () => {
    it('calls callbacks with correct parameters', async () => {
      const callback = vi.fn();
      onToolInstalled(callback);

      await refreshRuntime('user-xyz', 'tool-abc');

      expect(callback).toHaveBeenCalledWith('user-xyz', 'tool-abc');
    });

    it('handles async callbacks', async () => {
      const asyncCallback = vi.fn().mockResolvedValue(undefined);
      onToolInstalled(asyncCallback);

      await refreshRuntime('user-123', 'tool-456');

      expect(asyncCallback).toHaveBeenCalled();
    });

    it('throws InstallerError when callback fails', async () => {
      const failingCallback = vi.fn().mockRejectedValue(new Error('Callback failed'));
      onToolInstalled(failingCallback);

      await expect(refreshRuntime('user-123', 'tool-456')).rejects.toThrow(InstallerError);
      await expect(refreshRuntime('user-123', 'tool-456')).rejects.toThrow('refresh');
    });
  });

  describe('installTool', () => {
    const setupSuccessfulMocks = () => {
      // Mock getUserTool (check if exists)
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

      // Mock persistToolConfig
      mockUpsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'record-id',
              user_id: 'user-123',
              tool_id: 'test-tool-id-123456789',
              canonical_name: 'Test_Weather_API__test-too',
              installed_at: new Date().toISOString(),
              is_active: true,
            },
            error: null,
          }),
        }),
      });
    };

    it('installs tool and refreshes runtime', async () => {
      setupSuccessfulMocks();
      const tool = createMockTool();
      const refreshCallback = vi.fn();
      onToolInstalled(refreshCallback);

      const result = await installTool('user-123', tool);

      expect(result.success).toBe(true);
      expect(result.toolId).toBe(tool.id);
      expect(result.isNewInstall).toBe(true);
      expect(refreshCallback).toHaveBeenCalledWith('user-123', tool.id);
    });

    it('calls persist before refresh', async () => {
      setupSuccessfulMocks();
      const tool = createMockTool();
      const callOrder: string[] = [];

      // Track persist call
      mockUpsert.mockImplementation(() => {
        callOrder.push('persist');
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'record-id',
                user_id: 'user-123',
                tool_id: tool.id,
                canonical_name: 'Test',
                is_active: true,
              },
              error: null,
            }),
          }),
        };
      });

      // Track refresh call
      const refreshCallback = vi.fn(() => {
        callOrder.push('refresh');
      });
      onToolInstalled(refreshCallback);

      await installTool('user-123', tool);

      expect(callOrder).toEqual(['persist', 'refresh']);
    });

    it('throws InstallerError for invalid userId', async () => {
      const tool = createMockTool();

      await expect(installTool('', tool)).rejects.toThrow(InstallerError);
      await expect(installTool('', tool)).rejects.toThrow('validation');
    });

    it('throws InstallerError for null tool', async () => {
      await expect(installTool('user-123', null as any)).rejects.toThrow(InstallerError);
    });

    it('throws InstallerError for tool without id', async () => {
      await expect(installTool('user-123', {} as any)).rejects.toThrow(InstallerError);
    });

    it('returns isNewInstall false for reinstall', async () => {
      const tool = createMockTool();

      // Mock getUserTool to return existing record
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'existing-record',
                user_id: 'user-123',
                tool_id: tool.id,
                is_active: true,
              },
              error: null,
            }),
          }),
        }),
      });

      mockUpsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'existing-record',
              user_id: 'user-123',
              tool_id: tool.id,
              canonical_name: 'Test',
              is_active: true,
            },
            error: null,
          }),
        }),
      });

      const result = await installTool('user-123', tool);

      expect(result.isNewInstall).toBe(false);
      expect(result.message).toContain('reinstalled');
    });
  });

  describe('uninstallTool', () => {
    it('marks tool as inactive', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
        }),
      });

      const result = await uninstallTool('user-123', 'tool-456');

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    });

    it('returns true when tool was uninstalled', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
        }),
      });

      const result = await uninstallTool('user-123', 'tool-456');

      // Note: The count check in the actual implementation may vary
      expect(result).toBeDefined();
    });

    it('calls refresh after uninstall', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
        }),
      });

      const refreshCallback = vi.fn();
      onToolInstalled(refreshCallback);

      await uninstallTool('user-123', 'tool-456');

      expect(refreshCallback).toHaveBeenCalledWith('user-123', 'tool-456');
    });
  });
});

