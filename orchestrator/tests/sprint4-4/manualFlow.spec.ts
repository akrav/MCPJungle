import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolWithScore } from '../../src/discovery/supabase/types';
import { UserPreferences, DEFAULT_USER_PREFERENCES } from '../../src/discovery/preferences/types';

// Mock dependencies before importing the module under test
vi.mock('../../src/discovery/search/index.js', () => ({
  searchTools: vi.fn(),
}));

vi.mock('../../src/discovery/preferences/store.js', () => ({
  getUserPreferences: vi.fn(),
}));

vi.mock('../../src/discovery/provisioning/installer.js', () => ({
  installTool: vi.fn(),
}));

vi.mock('../../src/discovery/interaction/pendingState.js', () => ({
  storePendingChoices: vi.fn().mockReturnValue({
    requestId: 'mock-req-id',
    candidateCount: 1,
    expiresAt: Date.now() + 300000,
  }),
  generateRequestId: vi.fn().mockReturnValue('mock-req-id'),
  getPendingChoices: vi.fn(),
  clearPendingChoices: vi.fn(),
}));

vi.mock('../../src/discovery/interaction/prompt.js', () => ({
  requestUserSelection: vi.fn().mockReturnValue({
    requestId: 'mock-req-id',
    candidateCount: 1,
    message: 'Mock prompt',
  }),
}));

vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

// Now import the module under test
import { resolveMissingTool, tryResolveMissingTool } from '../../src/discovery/index';
import { searchTools } from '../../src/discovery/search/index.js';
import { getUserPreferences } from '../../src/discovery/preferences/store.js';
import { installTool } from '../../src/discovery/provisioning/installer.js';
import { storePendingChoices, generateRequestId } from '../../src/discovery/interaction/pendingState.js';
import { requestUserSelection } from '../../src/discovery/interaction/prompt.js';

const createMockTool = (id: string, name: string): ToolWithScore => ({
  id,
  created_at: new Date().toISOString(),
  merchant_id: 'merchant-123',
  name,
  description: `${name} description`,
  endpoint_url: `https://api.example.com/${id}`,
  price_per_call: 0.01,
  average_rating: 4.5,
  updated_at: new Date().toISOString(),
  listing_status: 'ACTIVE',
  similarity_score: 0.9,
});

const createAutoPrefs = (): UserPreferences => ({
  ...DEFAULT_USER_PREFERENCES,
  userId: 'user-123',
  discoveryMode: 'auto',
  maxPriceCap: 1.0,
  minRatingThreshold: 3.0,
});

const createManualPrefs = (): UserPreferences => ({
  ...DEFAULT_USER_PREFERENCES,
  userId: 'user-123',
  discoveryMode: 'manual',
  maxPriceCap: 1.0,
  minRatingThreshold: 3.0,
});

describe('Manual Mode Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveMissingTool with manual mode', () => {
    it('stores pending choices in manual mode', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createManualPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'test query');

      expect(storePendingChoices).toHaveBeenCalledWith(
        'mock-req-id',
        'user-123',
        'test query',
        [tool]
      );
    });

    it('requests user selection in manual mode', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createManualPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      await resolveMissingTool('user-123', 'test query');

      expect(requestUserSelection).toHaveBeenCalledWith(
        'mock-req-id',
        [tool],
        'test query'
      );
    });

    it('returns manualMode=true and requestId in manual mode', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createManualPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'test query');

      expect(result.manualMode).toBe(true);
      expect(result.requestId).toBe('mock-req-id');
      expect(result.resolved).toBe(false);
    });

    it('does NOT install tool in manual mode', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createManualPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      await resolveMissingTool('user-123', 'test query');

      expect(installTool).not.toHaveBeenCalled();
    });

    it('includes candidates in result for manual mode', async () => {
      const tools = [
        createMockTool('tool-1', 'Tool 1'),
        createMockTool('tool-2', 'Tool 2'),
      ];
      const prefs = createManualPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue(tools);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'test query');

      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].id).toBe('tool-1');
      expect(result.candidates[1].id).toBe('tool-2');
    });
  });

  describe('resolveMissingTool with auto mode', () => {
    it('installs tool automatically in auto mode', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createAutoPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: 'tool-1',
        canonicalName: 'Test_Tool',
        message: 'Installed',
        isNewInstall: true,
      });

      const result = await resolveMissingTool('user-123', 'test query');

      expect(result.resolved).toBe(true);
      expect(result.manualMode).toBe(false);
      expect(installTool).toHaveBeenCalled();
    });

    it('does NOT store pending choices in auto mode', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createAutoPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: 'tool-1',
        canonicalName: 'Test_Tool',
        message: 'Installed',
        isNewInstall: true,
      });

      await resolveMissingTool('user-123', 'test query');

      expect(storePendingChoices).not.toHaveBeenCalled();
      expect(requestUserSelection).not.toHaveBeenCalled();
    });
  });

  describe('tryResolveMissingTool', () => {
    it('returns false in manual mode', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createManualPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await tryResolveMissingTool('user-123', 'test');

      expect(result).toBe(false);
    });

    it('returns true in auto mode when resolved', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createAutoPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: 'tool-1',
        canonicalName: 'Test_Tool',
        message: 'Installed',
        isNewInstall: true,
      });

      const result = await tryResolveMissingTool('user-123', 'test');

      expect(result).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('handles empty candidates in manual mode', async () => {
      const tool = createMockTool('tool-1', 'Expensive Tool');
      tool.price_per_call = 100; // Too expensive

      const prefs = createManualPrefs();
      prefs.maxPriceCap = 0.01;

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'test');

      // Should return early with error, not trigger manual flow
      expect(result.resolved).toBe(false);
      expect(result.manualMode).toBe(false);
      expect(result.error).toContain('filtered out');
      expect(storePendingChoices).not.toHaveBeenCalled();
    });

    it('generates unique request IDs', async () => {
      const tool = createMockTool('tool-1', 'Test Tool');
      const prefs = createManualPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      await resolveMissingTool('user-123', 'test');

      expect(generateRequestId).toHaveBeenCalled();
    });
  });
});

