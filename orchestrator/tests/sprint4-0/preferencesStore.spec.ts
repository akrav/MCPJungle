import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getUserPreferences,
  setUserPreferences,
  updateUserPreferences,
  deleteUserPreferences,
  hasCustomPreferences,
  PreferencesStoreError,
} from '../../src/discovery/preferences/store';
import {
  initializeSupabaseClient,
  resetSupabaseClient,
} from '../../src/discovery/supabase/client';
import { DEFAULT_USER_PREFERENCES } from '../../src/discovery/preferences/types';

// Mock preference row from database
const mockPreferencesRow = {
  user_id: 'user-123',
  discovery_mode: 'auto',
  auto_install_strategy: 'cheapest',
  max_price_cap: 0.5,
  min_rating_threshold: 4.0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
};

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

describe('User Preferences Store', () => {
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resetSupabaseClient();
    vi.clearAllMocks();

    const { createClient } = await import('@supabase/supabase-js');
    mockFrom = vi.fn();
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: mockFrom,
    });

    initializeSupabaseClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
    });
  });

  afterEach(() => {
    resetSupabaseClient();
  });

  describe('getUserPreferences', () => {
    it('returns preferences when found', async () => {
      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: mockPreferencesRow, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const prefs = await getUserPreferences('user-123');

      expect(mockFrom).toHaveBeenCalledWith('user_preferences_orchestrator');
      expect(prefs.userId).toBe('user-123');
      expect(prefs.discoveryMode).toBe('auto');
      expect(prefs.autoInstallStrategy).toBe('cheapest');
      expect(prefs.maxPriceCap).toBe(0.5);
      expect(prefs.minRatingThreshold).toBe(4.0);
    });

    it('returns defaults when no preferences found', async () => {
      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const prefs = await getUserPreferences('new-user');

      expect(prefs.userId).toBe('new-user');
      expect(prefs.discoveryMode).toBe(DEFAULT_USER_PREFERENCES.discoveryMode);
      expect(prefs.autoInstallStrategy).toBe(DEFAULT_USER_PREFERENCES.autoInstallStrategy);
      expect(prefs.maxPriceCap).toBe(DEFAULT_USER_PREFERENCES.maxPriceCap);
      expect(prefs.minRatingThreshold).toBe(DEFAULT_USER_PREFERENCES.minRatingThreshold);
    });

    it('returns defaults when Supabase not configured', async () => {
      resetSupabaseClient();

      const prefs = await getUserPreferences('any-user');

      expect(prefs.userId).toBe('any-user');
      expect(prefs.discoveryMode).toBe(DEFAULT_USER_PREFERENCES.discoveryMode);
    });

    it('throws PreferencesStoreError on query error', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(getUserPreferences('user-123')).rejects.toThrow(
        PreferencesStoreError
      );
      await expect(getUserPreferences('user-123')).rejects.toThrow(
        'Failed to fetch user preferences'
      );
    });
  });

  describe('setUserPreferences', () => {
    it('upserts preferences and returns updated data', async () => {
      const mockSingle = vi
        .fn()
        .mockResolvedValue({ data: mockPreferencesRow, error: null });
      const mockSelectAfterUpsert = vi.fn().mockReturnValue({ single: mockSingle });
      const mockUpsert = vi
        .fn()
        .mockReturnValue({ select: mockSelectAfterUpsert });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      const prefs = await setUserPreferences('user-123', {
        discoveryMode: 'auto',
        maxPriceCap: 0.5,
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          discovery_mode: 'auto',
          max_price_cap: 0.5,
          updated_at: expect.any(String),
        }),
        { onConflict: 'user_id' }
      );
      expect(prefs.discoveryMode).toBe('auto');
    });

    it('throws PreferencesStoreError when not configured', async () => {
      resetSupabaseClient();

      await expect(
        setUserPreferences('user-123', { discoveryMode: 'auto' })
      ).rejects.toThrow(PreferencesStoreError);
      await expect(
        setUserPreferences('user-123', { discoveryMode: 'auto' })
      ).rejects.toThrow('not configured');
    });

    it('throws PreferencesStoreError on upsert error', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Constraint violation' },
      });
      const mockSelectAfterUpsert = vi.fn().mockReturnValue({ single: mockSingle });
      const mockUpsert = vi
        .fn()
        .mockReturnValue({ select: mockSelectAfterUpsert });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      await expect(
        setUserPreferences('user-123', { discoveryMode: 'auto' })
      ).rejects.toThrow(PreferencesStoreError);
    });

    it('only includes provided fields in upsert payload', async () => {
      const mockSingle = vi
        .fn()
        .mockResolvedValue({ data: mockPreferencesRow, error: null });
      const mockSelectAfterUpsert = vi.fn().mockReturnValue({ single: mockSingle });
      const mockUpsert = vi
        .fn()
        .mockReturnValue({ select: mockSelectAfterUpsert });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      await setUserPreferences('user-123', {
        maxPriceCap: 2.0,
      });

      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.user_id).toBe('user-123');
      expect(upsertCall.max_price_cap).toBe(2.0);
      expect(upsertCall.discovery_mode).toBeUndefined();
      expect(upsertCall.auto_install_strategy).toBeUndefined();
    });
  });

  describe('updateUserPreferences', () => {
    it('delegates to setUserPreferences', async () => {
      const mockSingle = vi
        .fn()
        .mockResolvedValue({ data: mockPreferencesRow, error: null });
      const mockSelectAfterUpsert = vi.fn().mockReturnValue({ single: mockSingle });
      const mockUpsert = vi
        .fn()
        .mockReturnValue({ select: mockSelectAfterUpsert });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      const prefs = await updateUserPreferences({
        userId: 'user-123',
        minRatingThreshold: 4.5,
      });

      expect(mockUpsert).toHaveBeenCalled();
      expect(prefs).toBeDefined();
    });
  });

  describe('deleteUserPreferences', () => {
    it('deletes preferences by user_id', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockReturnValue({ delete: mockDelete });

      await deleteUserPreferences('user-123');

      expect(mockFrom).toHaveBeenCalledWith('user_preferences_orchestrator');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('no-ops when Supabase not configured', async () => {
      resetSupabaseClient();

      // Should not throw
      await expect(deleteUserPreferences('user-123')).resolves.toBeUndefined();
    });

    it('throws PreferencesStoreError on delete error', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      });
      mockFrom.mockReturnValue({ delete: mockDelete });

      await expect(deleteUserPreferences('user-123')).rejects.toThrow(
        PreferencesStoreError
      );
    });
  });

  describe('hasCustomPreferences', () => {
    it('returns true when preferences exist', async () => {
      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: { user_id: 'user-123' }, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasCustomPreferences('user-123');

      expect(result).toBe(true);
    });

    it('returns false when preferences do not exist', async () => {
      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasCustomPreferences('new-user');

      expect(result).toBe(false);
    });

    it('returns false when Supabase not configured', async () => {
      resetSupabaseClient();

      const result = await hasCustomPreferences('any-user');

      expect(result).toBe(false);
    });
  });

  describe('Default values', () => {
    it('DEFAULT_USER_PREFERENCES has expected values', () => {
      expect(DEFAULT_USER_PREFERENCES.discoveryMode).toBe('manual');
      expect(DEFAULT_USER_PREFERENCES.autoInstallStrategy).toBe('balanced');
      expect(DEFAULT_USER_PREFERENCES.maxPriceCap).toBe(1.0);
      expect(DEFAULT_USER_PREFERENCES.minRatingThreshold).toBe(3.0);
    });
  });
});

