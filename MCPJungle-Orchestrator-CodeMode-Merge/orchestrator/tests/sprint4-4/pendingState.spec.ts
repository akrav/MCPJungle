import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  storePendingChoices,
  getPendingChoices,
  clearPendingChoices,
  getPendingChoicesForUser,
  hasPendingChoices,
  getPendingCount,
  clearAllPendingChoices,
  cleanupExpired,
  generateRequestId,
  configurePendingState,
  resetPendingStateConfig,
  getPendingStateConfig,
  startCleanupInterval,
  stopCleanupInterval,
  isCleanupRunning,
  PendingSelection,
  PendingTool,
} from '../../src/discovery/interaction/pendingState';

vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

const createMockTool = (id: string, name: string): PendingTool => ({
  id,
  name,
  description: `${name} description`,
  endpoint_url: `https://api.example.com/${id}`,
  price_per_call: 0.01,
  average_rating: 4.5,
  listing_status: 'ACTIVE',
});

describe('Pending State Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllPendingChoices();
    resetPendingStateConfig();
    stopCleanupInterval();
  });

  afterEach(() => {
    clearAllPendingChoices();
    stopCleanupInterval();
  });

  describe('generateRequestId', () => {
    it('generates unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('storePendingChoices', () => {
    it('stores choices and returns result', () => {
      const candidates = [
        createMockTool('tool-1', 'Tool 1'),
        createMockTool('tool-2', 'Tool 2'),
      ];

      const result = storePendingChoices('req-123', 'user-456', 'get weather', candidates);

      expect(result.requestId).toBe('req-123');
      expect(result.candidateCount).toBe(2);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('stores multiple selections independently', () => {
      const candidates1 = [createMockTool('tool-1', 'Tool 1')];
      const candidates2 = [createMockTool('tool-2', 'Tool 2')];

      storePendingChoices('req-1', 'user-1', 'query 1', candidates1);
      storePendingChoices('req-2', 'user-2', 'query 2', candidates2);

      const selection1 = getPendingChoices('req-1');
      const selection2 = getPendingChoices('req-2');

      expect(selection1?.candidates[0].id).toBe('tool-1');
      expect(selection2?.candidates[0].id).toBe('tool-2');
    });

    it('increments pending count', () => {
      expect(getPendingCount()).toBe(0);

      storePendingChoices('req-1', 'user-1', 'q1', []);
      expect(getPendingCount()).toBe(1);

      storePendingChoices('req-2', 'user-1', 'q2', []);
      expect(getPendingCount()).toBe(2);
    });
  });

  describe('getPendingChoices', () => {
    it('retrieves stored selection', () => {
      const candidates = [createMockTool('tool-1', 'Tool 1')];
      storePendingChoices('req-123', 'user-456', 'get weather', candidates);

      const selection = getPendingChoices('req-123');

      expect(selection).toBeDefined();
      expect(selection?.requestId).toBe('req-123');
      expect(selection?.userId).toBe('user-456');
      expect(selection?.query).toBe('get weather');
      expect(selection?.candidates).toEqual(candidates);
    });

    it('returns undefined for non-existent request', () => {
      const selection = getPendingChoices('non-existent');
      expect(selection).toBeUndefined();
    });

    it('returns undefined for expired selection', () => {
      configurePendingState({ expirationMs: 1 }); // 1ms expiration
      storePendingChoices('req-123', 'user-456', 'query', []);

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const selection = getPendingChoices('req-123');
          expect(selection).toBeUndefined();
          resolve();
        }, 10);
      });
    });
  });

  describe('clearPendingChoices', () => {
    it('clears stored selection', () => {
      storePendingChoices('req-123', 'user-456', 'query', []);
      expect(hasPendingChoices('req-123')).toBe(true);

      const cleared = clearPendingChoices('req-123');

      expect(cleared).toBe(true);
      expect(hasPendingChoices('req-123')).toBe(false);
    });

    it('returns false for non-existent request', () => {
      const cleared = clearPendingChoices('non-existent');
      expect(cleared).toBe(false);
    });

    it('decrements pending count', () => {
      storePendingChoices('req-1', 'user-1', 'q1', []);
      storePendingChoices('req-2', 'user-1', 'q2', []);
      expect(getPendingCount()).toBe(2);

      clearPendingChoices('req-1');
      expect(getPendingCount()).toBe(1);
    });
  });

  describe('getPendingChoicesForUser', () => {
    it('returns all pending selections for a user', () => {
      storePendingChoices('req-1', 'user-A', 'q1', [createMockTool('t1', 'T1')]);
      storePendingChoices('req-2', 'user-A', 'q2', [createMockTool('t2', 'T2')]);
      storePendingChoices('req-3', 'user-B', 'q3', [createMockTool('t3', 'T3')]);

      const userASelections = getPendingChoicesForUser('user-A');
      const userBSelections = getPendingChoicesForUser('user-B');

      expect(userASelections).toHaveLength(2);
      expect(userBSelections).toHaveLength(1);
    });

    it('returns empty array for user with no pending selections', () => {
      const selections = getPendingChoicesForUser('no-such-user');
      expect(selections).toEqual([]);
    });
  });

  describe('hasPendingChoices', () => {
    it('returns true for existing selection', () => {
      storePendingChoices('req-123', 'user-456', 'query', []);
      expect(hasPendingChoices('req-123')).toBe(true);
    });

    it('returns false for non-existent selection', () => {
      expect(hasPendingChoices('non-existent')).toBe(false);
    });
  });

  describe('clearAllPendingChoices', () => {
    it('clears all selections', () => {
      storePendingChoices('req-1', 'user-1', 'q1', []);
      storePendingChoices('req-2', 'user-2', 'q2', []);
      expect(getPendingCount()).toBe(2);

      clearAllPendingChoices();

      expect(getPendingCount()).toBe(0);
    });
  });

  describe('cleanupExpired', () => {
    it('removes expired selections', async () => {
      configurePendingState({ expirationMs: 10 }); // 10ms expiration
      storePendingChoices('req-1', 'user-1', 'q1', []);
      storePendingChoices('req-2', 'user-1', 'q2', []);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20));

      const cleaned = cleanupExpired();

      expect(cleaned).toBe(2);
      expect(getPendingCount()).toBe(0);
    });

    it('keeps non-expired selections', async () => {
      configurePendingState({ expirationMs: 10000 }); // 10s expiration
      storePendingChoices('req-1', 'user-1', 'q1', []);

      const cleaned = cleanupExpired();

      expect(cleaned).toBe(0);
      expect(getPendingCount()).toBe(1);
    });
  });

  describe('configuration', () => {
    it('uses custom expiration time', () => {
      configurePendingState({ expirationMs: 60000 }); // 1 minute
      const config = getPendingStateConfig();
      expect(config.expirationMs).toBe(60000);
    });

    it('resetPendingStateConfig restores defaults', () => {
      configurePendingState({ expirationMs: 1000 });
      resetPendingStateConfig();
      const config = getPendingStateConfig();
      expect(config.expirationMs).toBe(5 * 60 * 1000); // Default: 5 minutes
    });
  });

  describe('cleanup interval', () => {
    it('starts and stops interval', () => {
      expect(isCleanupRunning()).toBe(false);

      startCleanupInterval();
      expect(isCleanupRunning()).toBe(true);

      stopCleanupInterval();
      expect(isCleanupRunning()).toBe(false);
    });

    it('does not start duplicate intervals', () => {
      startCleanupInterval();
      startCleanupInterval(); // Should not throw or create duplicate
      expect(isCleanupRunning()).toBe(true);

      stopCleanupInterval();
    });
  });

  describe('capacity limits', () => {
    it('removes oldest entries when at capacity', () => {
      configurePendingState({ maxPendingSelections: 3 });

      storePendingChoices('req-1', 'user-1', 'q1', []);
      storePendingChoices('req-2', 'user-1', 'q2', []);
      storePendingChoices('req-3', 'user-1', 'q3', []);

      // This should trigger cleanup of oldest
      storePendingChoices('req-4', 'user-1', 'q4', []);

      // Should have removed at least one old entry
      expect(getPendingCount()).toBeLessThanOrEqual(3);
    });
  });

  describe('data integrity', () => {
    it('preserves all tool data', () => {
      const tool = createMockTool('tool-123', 'Test Tool');
      storePendingChoices('req-1', 'user-1', 'query', [tool]);

      const selection = getPendingChoices('req-1');

      expect(selection?.candidates[0]).toEqual(tool);
      expect(selection?.candidates[0].id).toBe('tool-123');
      expect(selection?.candidates[0].name).toBe('Test Tool');
      expect(selection?.candidates[0].price_per_call).toBe(0.01);
    });

    it('stores timestamp correctly', () => {
      const before = Date.now();
      storePendingChoices('req-1', 'user-1', 'query', []);
      const after = Date.now();

      const selection = getPendingChoices('req-1');

      expect(selection?.timestamp).toBeGreaterThanOrEqual(before);
      expect(selection?.timestamp).toBeLessThanOrEqual(after);
    });
  });
});

