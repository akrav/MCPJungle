/**
 * E2E Tests: Edge Cases
 *
 * Tests error scenarios and edge cases:
 * - No matching tools found
 * - All tools filtered out by safety caps
 * - Installation failures
 * - Search service failures
 * - Preferences service failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolWithScore } from '../../src/discovery/supabase/types';
import { UserPreferences, DEFAULT_USER_PREFERENCES } from '../../src/discovery/preferences/types';

// Mock external dependencies
vi.mock('../../src/discovery/search/index.js', () => ({
  searchTools: vi.fn(),
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

vi.mock('../../src/discovery/interaction/pendingState.js', () => ({
  storePendingChoices: vi.fn(),
  generateRequestId: vi.fn().mockReturnValue('test-req-id'),
  getPendingChoices: vi.fn(),
  clearPendingChoices: vi.fn(),
}));

vi.mock('../../src/discovery/interaction/prompt.js', () => ({
  requestUserSelection: vi.fn(),
  notifySelectionMade: vi.fn(),
  notifySelectionRejected: vi.fn(),
}));

vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

// Import after mocks
import {
  resolveMissingTool,
  tryResolveMissingTool,
  ResolveResult,
} from '../../src/discovery/index';
import { searchTools } from '../../src/discovery/search/index.js';
import { getUserPreferences } from '../../src/discovery/preferences/store.js';
import { installTool } from '../../src/discovery/provisioning/installer.js';
import { storePendingChoices } from '../../src/discovery/interaction/pendingState.js';
import { log } from '../../src/obs/log.js';

// Test data factories
function createMockTool(overrides: Partial<ToolWithScore> = {}): ToolWithScore {
  return {
    id: 'tool-123',
    created_at: new Date().toISOString(),
    merchant_id: 'merchant-456',
    name: 'Test Tool',
    description: 'A test tool',
    endpoint_url: 'https://api.test.com',
    price_per_call: 0.01,
    average_rating: 4.5,
    updated_at: new Date().toISOString(),
    listing_status: 'ACTIVE',
    similarity_score: 0.9,
    ...overrides,
  };
}

function createAutoPrefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    ...DEFAULT_USER_PREFERENCES,
    userId: 'user-test',
    discoveryMode: 'auto',
    autoInstallStrategy: 'balanced',
    maxPriceCap: 1.0,
    minRatingThreshold: 3.0,
    ...overrides,
  };
}

describe('Edge Cases: No Matches Found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario A: Empty Database', () => {
    it('returns graceful error when no tools exist', async () => {
      const prefs = createAutoPrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'some query');

      expect(result.resolved).toBe(false);
      expect(result.manualMode).toBe(false);
      expect(result.error).toContain('No matching tools');
      expect(result.candidates).toEqual([]);
      expect(installTool).not.toHaveBeenCalled();
    });

    it('tryResolveMissingTool returns false when no tools exist', async () => {
      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(createAutoPrefs());

      const success = await tryResolveMissingTool('user-123', 'query');

      expect(success).toBe(false);
    });

    it('does not trigger manual mode when no tools found', async () => {
      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(
        createAutoPrefs({ discoveryMode: 'manual' })
      );

      const result = await resolveMissingTool('user-123', 'query');

      expect(storePendingChoices).not.toHaveBeenCalled();
      expect(result.manualMode).toBe(false);
    });
  });

  describe('Scenario B: All Tools Filtered by Safety Caps', () => {
    it('returns error when all tools exceed price cap', async () => {
      const expensiveTool = createMockTool({
        id: 'expensive',
        name: 'Expensive Tool',
        price_per_call: 100.0, // Way over cap
      });

      const prefs = createAutoPrefs({ maxPriceCap: 0.01 });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([expensiveTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'query');

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('filtered out');
      expect(result.candidates).toEqual([]);
      expect(installTool).not.toHaveBeenCalled();
    });

    it('returns error when all tools below rating threshold', async () => {
      const lowRatedTool = createMockTool({
        id: 'low-rated',
        name: 'Low Rated Tool',
        average_rating: 1.5, // Below threshold
      });

      const prefs = createAutoPrefs({ minRatingThreshold: 4.0 });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([lowRatedTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'query');

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('filtered out');
    });

    it('filters multiple tools leaving none', async () => {
      const tools = [
        createMockTool({ id: 't1', price_per_call: 50.0, average_rating: 4.0 }),
        createMockTool({ id: 't2', price_per_call: 0.01, average_rating: 2.0 }),
        createMockTool({ id: 't3', price_per_call: 75.0, average_rating: 2.5 }),
      ];

      const prefs = createAutoPrefs({ maxPriceCap: 1.0, minRatingThreshold: 3.5 });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue(tools);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);

      const result = await resolveMissingTool('user-123', 'query');

      // All tools filtered: t1 (too expensive), t2 (low rating), t3 (both)
      expect(result.resolved).toBe(false);
      expect(result.candidates).toEqual([]);
    });
  });
});

describe('Edge Cases: Installation Failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles installation error gracefully', async () => {
    const tool = createMockTool();
    const prefs = createAutoPrefs();

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
    (installTool as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Disk Full: Cannot write config')
    );

    const result = await resolveMissingTool('user-123', 'query');

    expect(result.resolved).toBe(false);
    expect(result.error).toContain('Installation failed');
    expect(result.selectedTool).toEqual(tool); // Tool was selected but install failed
  });

  it('does not crash process on installation error', async () => {
    const tool = createMockTool();
    const prefs = createAutoPrefs();

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
    (installTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Critical Error'));

    // Should not throw - returns error in result
    const result = await resolveMissingTool('user-123', 'query');

    expect(result).toBeDefined();
    expect(result.resolved).toBe(false);
  });

  it('returns false from tryResolveMissingTool on installation error', async () => {
    const tool = createMockTool();
    const prefs = createAutoPrefs();

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
    (installTool as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Install failed'));

    const success = await tryResolveMissingTool('user-123', 'query');

    expect(success).toBe(false);
  });

  it('handles database write errors', async () => {
    const tool = createMockTool();
    const prefs = createAutoPrefs();

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
    (installTool as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('PostgrestError: duplicate key')
    );

    const result = await resolveMissingTool('user-123', 'query');

    expect(result.resolved).toBe(false);
    expect(result.error).toContain('Installation failed');
  });
});

describe('Edge Cases: Search Service Failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles search API timeout gracefully', async () => {
    (searchTools as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Request timeout after 30000ms')
    );

    const result = await resolveMissingTool('user-123', 'query');

    expect(result.resolved).toBe(false);
    expect(result.error).toContain('Search failed');
  });

  it('handles embedding API rate limit', async () => {
    (searchTools as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('OpenAI API rate limit exceeded')
    );

    const result = await resolveMissingTool('user-123', 'query');

    expect(result.resolved).toBe(false);
    expect(result.error).toContain('Search failed');
  });

  it('handles Supabase connection error', async () => {
    (searchTools as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('ECONNREFUSED: Cannot connect to database')
    );

    const result = await resolveMissingTool('user-123', 'query');

    expect(result.resolved).toBe(false);
    expect(result.error).toContain('Search failed');
  });
});

describe('Edge Cases: Preferences Service Failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles preferences fetch error', async () => {
    const tool = createMockTool();

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('User not found')
    );

    const result = await resolveMissingTool('user-123', 'query');

    expect(result.resolved).toBe(false);
    expect(result.error).toContain('preferences');
  });
});

describe('Edge Cases: Boundary Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles tool at exactly price cap', async () => {
    const tool = createMockTool({ price_per_call: 1.0 });
    const prefs = createAutoPrefs({ maxPriceCap: 1.0 });

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
    (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      toolId: tool.id,
      canonicalName: 'Test',
      message: 'ok',
      isNewInstall: true,
    });

    const result = await resolveMissingTool('user-123', 'query');

    // Tool at exactly cap should pass
    expect(result.resolved).toBe(true);
  });

  it('handles tool at exactly rating threshold', async () => {
    const tool = createMockTool({ average_rating: 3.0 });
    const prefs = createAutoPrefs({ minRatingThreshold: 3.0 });

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
    (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      toolId: tool.id,
      canonicalName: 'Test',
      message: 'ok',
      isNewInstall: true,
    });

    const result = await resolveMissingTool('user-123', 'query');

    // Tool at exactly threshold should pass
    expect(result.resolved).toBe(true);
  });

  it('handles zero price tool', async () => {
    const freeTool = createMockTool({ price_per_call: 0 });
    const prefs = createAutoPrefs();

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([freeTool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
    (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      toolId: freeTool.id,
      canonicalName: 'Test',
      message: 'ok',
      isNewInstall: true,
    });

    const result = await resolveMissingTool('user-123', 'query');

    expect(result.resolved).toBe(true);
  });

  it('handles empty query string', async () => {
    const tool = createMockTool();
    const prefs = createAutoPrefs();

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
    (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      toolId: tool.id,
      canonicalName: 'Test',
      message: 'ok',
      isNewInstall: true,
    });

    const result = await resolveMissingTool('user-123', '');

    // Empty query should still work (search might return generic results)
    expect(searchTools).toHaveBeenCalledWith('');
  });

  it('handles very long query string', async () => {
    const longQuery = 'a'.repeat(10000);

    (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(createAutoPrefs());

    const result = await resolveMissingTool('user-123', longQuery);

    expect(searchTools).toHaveBeenCalledWith(longQuery);
    expect(result.resolved).toBe(false);
  });
});

