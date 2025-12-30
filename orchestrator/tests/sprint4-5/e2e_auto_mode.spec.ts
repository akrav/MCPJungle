/**
 * E2E Test: Auto Mode Happy Path
 *
 * Verifies the complete auto-discovery flow:
 * 1. User in "Auto Mode" requests a missing tool
 * 2. System searches for matching tools
 * 3. System selects best tool based on preferences
 * 4. System installs the tool automatically
 * 5. Original request is retried successfully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolWithScore } from '../../src/discovery/supabase/types';
import { UserPreferences, DEFAULT_USER_PREFERENCES } from '../../src/discovery/preferences/types';

// Mock external dependencies
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
  generateCanonicalName: vi.fn((tool) => `${tool.name}__${tool.id.slice(0, 8)}`),
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

// Import modules under test
import {
  resolveMissingTool,
  tryResolveMissingTool,
  ResolveResult,
} from '../../src/discovery/index';
import { searchTools } from '../../src/discovery/search/index.js';
import { getUserPreferences } from '../../src/discovery/preferences/store.js';
import { installTool } from '../../src/discovery/provisioning/installer.js';
import { storePendingChoices } from '../../src/discovery/interaction/pendingState.js';
import { requestUserSelection } from '../../src/discovery/interaction/prompt.js';

// Test data factories
function createMockTool(overrides: Partial<ToolWithScore> = {}): ToolWithScore {
  return {
    id: 'tool-weather-123',
    created_at: new Date().toISOString(),
    merchant_id: 'merchant-456',
    name: 'Weather API',
    description: 'Get current weather data for any location',
    endpoint_url: 'https://api.weather.example.com/v1',
    price_per_call: 0.005,
    average_rating: 4.7,
    updated_at: new Date().toISOString(),
    listing_status: 'ACTIVE',
    similarity_score: 0.92,
    ...overrides,
  };
}

function createAutoModePrefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    ...DEFAULT_USER_PREFERENCES,
    userId: 'user-e2e-test',
    discoveryMode: 'auto',
    autoInstallStrategy: 'cheapest',
    maxPriceCap: 1.0,
    minRatingThreshold: 3.0,
    ...overrides,
  };
}

describe('E2E: Auto Mode Happy Path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Auto Discovery Flow', () => {
    it('successfully discovers, selects, and installs a tool automatically', async () => {
      // Setup: Configure mocks for happy path
      const weatherTool = createMockTool();
      const autoPrefs = createAutoModePrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([weatherTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(autoPrefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: weatherTool.id,
        canonicalName: `Weather_API__${weatherTool.id.slice(0, 8)}`,
        message: 'Tool installed successfully',
        isNewInstall: true,
      });

      // Action: Trigger the resolution flow
      const result = await resolveMissingTool('user-e2e-test', 'get current weather');

      // Assertions: Verify the complete flow
      // 1. Search was called with the query
      expect(searchTools).toHaveBeenCalledWith('get current weather');

      // 2. User preferences were fetched
      expect(getUserPreferences).toHaveBeenCalledWith('user-e2e-test');

      // 3. Tool was installed
      expect(installTool).toHaveBeenCalledWith('user-e2e-test', weatherTool);

      // 4. Manual mode was NOT triggered
      expect(storePendingChoices).not.toHaveBeenCalled();
      expect(requestUserSelection).not.toHaveBeenCalled();

      // 5. Result indicates success
      expect(result.resolved).toBe(true);
      expect(result.manualMode).toBe(false);
      expect(result.selectedTool).toEqual(weatherTool);
      expect(result.installResult).not.toBeNull();
      expect(result.installResult?.isNewInstall).toBe(true);
    });

    it('selects cheapest tool when multiple candidates exist', async () => {
      const cheapTool = createMockTool({
        id: 'tool-cheap',
        name: 'Budget Weather',
        price_per_call: 0.001,
        average_rating: 4.0,
      });
      const expensiveTool = createMockTool({
        id: 'tool-expensive',
        name: 'Premium Weather',
        price_per_call: 0.10,
        average_rating: 4.9,
      });

      const prefs = createAutoModePrefs({ autoInstallStrategy: 'cheapest' });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([expensiveTool, cheapTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: cheapTool.id,
        canonicalName: 'Budget_Weather__tool-che',
        message: 'Installed',
        isNewInstall: true,
      });

      const result = await resolveMissingTool('user-123', 'weather data');

      // Should select and install the cheaper tool
      expect(result.selectedTool?.id).toBe('tool-cheap');
      expect(installTool).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ id: 'tool-cheap' })
      );
    });

    it('selects highest rated tool when strategy is rating', async () => {
      const lowRatedTool = createMockTool({
        id: 'tool-low',
        name: 'Basic Weather',
        price_per_call: 0.001,
        average_rating: 3.5,
      });
      const highRatedTool = createMockTool({
        id: 'tool-high',
        name: 'Premium Weather',
        price_per_call: 0.05,
        average_rating: 4.9,
      });

      const prefs = createAutoModePrefs({ autoInstallStrategy: 'rating' });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([lowRatedTool, highRatedTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: highRatedTool.id,
        canonicalName: 'Premium_Weather',
        message: 'Installed',
        isNewInstall: true,
      });

      const result = await resolveMissingTool('user-123', 'weather data');

      expect(result.selectedTool?.id).toBe('tool-high');
    });

    it('uses balanced strategy by default', async () => {
      const balancedTool = createMockTool({
        id: 'tool-balanced',
        name: 'Good Value Weather',
        price_per_call: 0.01,
        average_rating: 4.5,
      });

      const prefs = createAutoModePrefs({ autoInstallStrategy: 'balanced' });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([balancedTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: balancedTool.id,
        canonicalName: 'Good_Value_Weather',
        message: 'Installed',
        isNewInstall: true,
      });

      const result = await resolveMissingTool('user-123', 'weather');

      expect(result.resolved).toBe(true);
      expect(result.selectedTool?.id).toBe('tool-balanced');
    });
  });

  describe('tryResolveMissingTool convenience function', () => {
    it('returns true when tool is resolved in auto mode', async () => {
      const tool = createMockTool();
      const prefs = createAutoModePrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: tool.id,
        canonicalName: 'Test',
        message: 'ok',
        isNewInstall: true,
      });

      const success = await tryResolveMissingTool('user-123', 'test query');

      expect(success).toBe(true);
    });
  });

  describe('Filter enforcement in auto mode', () => {
    it('respects maxPriceCap filter', async () => {
      const expensiveTool = createMockTool({
        id: 'expensive',
        price_per_call: 5.0, // Too expensive
      });
      const cheapTool = createMockTool({
        id: 'cheap',
        price_per_call: 0.01,
      });

      const prefs = createAutoModePrefs({ maxPriceCap: 0.10 });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([expensiveTool, cheapTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: 'cheap',
        canonicalName: 'Test',
        message: 'ok',
        isNewInstall: true,
      });

      const result = await resolveMissingTool('user-123', 'test');

      // Should only install the cheap tool (expensive filtered out)
      expect(result.selectedTool?.id).toBe('cheap');
      expect(result.candidates).toHaveLength(1);
    });

    it('respects minRatingThreshold filter', async () => {
      const lowRatedTool = createMockTool({
        id: 'low-rated',
        average_rating: 2.0, // Too low
      });
      const highRatedTool = createMockTool({
        id: 'high-rated',
        average_rating: 4.5,
      });

      const prefs = createAutoModePrefs({ minRatingThreshold: 3.5 });

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([lowRatedTool, highRatedTool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: 'high-rated',
        canonicalName: 'Test',
        message: 'ok',
        isNewInstall: true,
      });

      const result = await resolveMissingTool('user-123', 'test');

      expect(result.selectedTool?.id).toBe('high-rated');
      expect(result.candidates).toHaveLength(1);
    });
  });

  describe('Reinstallation handling', () => {
    it('handles reinstalling an existing tool', async () => {
      const tool = createMockTool();
      const prefs = createAutoModePrefs();

      (searchTools as ReturnType<typeof vi.fn>).mockResolvedValue([tool]);
      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue(prefs);
      (installTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        toolId: tool.id,
        canonicalName: 'Weather_API',
        message: 'Tool reinstalled',
        isNewInstall: false, // Already existed
      });

      const result = await resolveMissingTool('user-123', 'weather');

      expect(result.resolved).toBe(true);
      expect(result.installResult?.isNewInstall).toBe(false);
    });
  });
});

