import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolWithScore } from '../../src/discovery/supabase/types';
import { UserPreferences, DEFAULT_USER_PREFERENCES } from '../../src/discovery/preferences/types';

// Mock dependencies before importing the module under test
vi.mock('../../src/discovery/search/index.js', () => ({
  searchTools: vi.fn(),
  searchToolsByEmbedding: vi.fn(),
  getSearchServiceStatus: vi.fn(),
}));

vi.mock('../../src/discovery/preferences/store.js', () => ({
  getUserPreferences: vi.fn(),
}));

vi.mock('../../src/discovery/provisioning/installer.js', () => ({
  installTool: vi.fn(),
  persistToolConfig: vi.fn(),
  getUserTool: vi.fn(),
  getUserTools: vi.fn(),
  isToolInstalled: vi.fn(),
  generateCanonicalName: vi.fn(),
  onToolInstalled: vi.fn(),
  clearRefreshCallbacks: vi.fn(),
  refreshRuntime: vi.fn(),
}));

vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

// Now import the module under test
import {
  resolveMissingTool,
  tryResolveMissingTool,
  ResolveError,
} from '../../src/discovery/index';
import { searchTools } from '../../src/discovery/search/index.js';
import { getUserPreferences } from '../../src/discovery/preferences/store.js';
import { installTool } from '../../src/discovery/provisioning/installer.js';

const createMockTool = (overrides: Partial<ToolWithScore> = {}): ToolWithScore => ({
  id: 'tool-123',
  created_at: new Date().toISOString(),
  merchant_id: 'merchant-123',
  name: 'Weather API',
  description: 'Get current weather',
  endpoint_url: 'https://api.example.com/weather',
  price_per_call: 0.01,
  average_rating: 4.5,
  updated_at: new Date().toISOString(),
  listing_status: 'ACTIVE',
  similarity_score: 0.9,
  ...overrides,
});

const createMockPrefs = (overrides: Partial<UserPreferences> = {}): UserPreferences => ({
  ...DEFAULT_USER_PREFERENCES,
  userId: 'user-123',
  discoveryMode: 'auto',
  autoInstallStrategy: 'balanced',
  maxPriceCap: 1.0,
  minRatingThreshold: 3.0,
  ...overrides,
});

describe('Auto-Install Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveMissingTool', () => {
    it('resolves tool successfully in auto mode', async () => {
      const tool = createMockTool();
      const prefs = createMockPrefs({ discoveryMode: 'auto' });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: tool.id,
        canonicalName: 'Weather_API__tool-123',
        message: 'Tool installed',
        isNewInstall: true,
      });

      const result = await resolveMissingTool('user-123', 'get weather');

      expect(result.resolved).toBe(true);
      expect(result.manualMode).toBe(false);
      expect(result.selectedTool).toEqual(tool);
      expect(result.installResult).not.toBeNull();
      expect(installTool).toHaveBeenCalledWith('user-123', tool);
    });

    it('returns manualMode true when in manual mode', async () => {
      const tool = createMockTool();
      const prefs = createMockPrefs({ discoveryMode: 'manual' });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'get weather');

      expect(result.resolved).toBe(false);
      expect(result.manualMode).toBe(true);
      expect(result.candidates).toContainEqual(tool);
      expect(installTool).not.toHaveBeenCalled();
    });

    it('returns resolved false when no tools found', async () => {
      const prefs = createMockPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'nonexistent tool');

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('No matching tools');
      expect(installTool).not.toHaveBeenCalled();
    });

    it('returns resolved false when all tools filtered', async () => {
      const expensiveTool = createMockTool({ price_per_call: 100 });
      const prefs = createMockPrefs({ maxPriceCap: 0.01 });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([expensiveTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'expensive tool');

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('filtered out');
    });

    it('handles search errors gracefully', async () => {
      (searchTools as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const result = await resolveMissingTool('user-123', 'test');

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('Search failed');
    });

    it('handles preferences errors gracefully', async () => {
      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([createMockTool()]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const result = await resolveMissingTool('user-123', 'test');

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('preferences');
    });

    it('handles installation errors gracefully', async () => {
      const tool = createMockTool();
      const prefs = createMockPrefs({ discoveryMode: 'auto' });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Install failed'));

      const result = await resolveMissingTool('user-123', 'test');

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('Installation failed');
    });

    it('selects best tool based on preferences', async () => {
      const cheapTool = createMockTool({
        id: 'cheap',
        name: 'Cheap API',
        price_per_call: 0.001,
        average_rating: 3.5,
      });
      const expensiveTool = createMockTool({
        id: 'expensive',
        name: 'Premium API',
        price_per_call: 0.10,
        average_rating: 4.9,
      });
      const prefs = createMockPrefs({
        discoveryMode: 'auto',
        autoInstallStrategy: 'cheapest',
      });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([expensiveTool, cheapTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: 'cheap',
        canonicalName: 'Cheap_API',
        message: 'Installed',
        isNewInstall: true,
      });

      const result = await resolveMissingTool('user-123', 'any tool');

      expect(result.selectedTool?.id).toBe('cheap');
      expect(installTool).toHaveBeenCalledWith('user-123', expect.objectContaining({ id: 'cheap' }));
    });
  });

  describe('tryResolveMissingTool', () => {
    it('returns true when tool is resolved', async () => {
      const tool = createMockTool();
      const prefs = createMockPrefs({ discoveryMode: 'auto' });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: tool.id,
        canonicalName: 'test',
        message: 'ok',
        isNewInstall: true,
      });

      const result = await tryResolveMissingTool('user-123', 'get weather');

      expect(result).toBe(true);
    });

    it('returns false when tool is not resolved', async () => {
      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await tryResolveMissingTool('user-123', 'nonexistent');

      expect(result).toBe(false);
    });

    it('returns false in manual mode', async () => {
      const tool = createMockTool();
      const prefs = createMockPrefs({ discoveryMode: 'manual' });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await tryResolveMissingTool('user-123', 'test');

      expect(result).toBe(false);
    });
  });

  describe('ResolveError', () => {
    it('includes step in message', () => {
      const error = new ResolveError('Test error', 'search');
      expect(error.message).toContain('search');
      expect(error.step).toBe('search');
    });

    it('preserves original error', () => {
      const original = new Error('Original');
      const error = new ResolveError('Wrapped', 'install', original);
      expect(error.originalError).toBe(original);
    });
  });
});

