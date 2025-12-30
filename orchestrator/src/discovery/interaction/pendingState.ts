/**
 * Pending Choice State Manager
 *
 * Manages the temporary state for manual tool selection.
 * Stores candidate tools while waiting for user input.
 *
 * @module discovery/interaction/pendingState
 */

import { ToolWithScore, ToolSummary } from '../supabase/types.js';
import { log } from '../../obs/log.js';

/**
 * A tool that can be presented as a pending choice
 */
export type PendingTool = ToolWithScore | ToolSummary;

/**
 * Represents a pending selection waiting for user input
 */
export interface PendingSelection {
  /** Unique identifier for this pending selection */
  requestId: string;
  /** User who initiated the request */
  userId: string;
  /** Original query/intent that triggered the search */
  query: string;
  /** Candidate tools to choose from */
  candidates: PendingTool[];
  /** When this selection was created */
  timestamp: number;
  /** When this selection expires (auto-cleanup) */
  expiresAt: number;
}

/**
 * Result of storing a pending selection
 */
export interface StorePendingResult {
  requestId: string;
  candidateCount: number;
  expiresAt: number;
}

/**
 * Configuration for the pending state manager
 */
export interface PendingStateConfig {
  /** Time in milliseconds before a pending selection expires (default: 5 minutes) */
  expirationMs: number;
  /** Interval in milliseconds for cleanup of expired selections (default: 1 minute) */
  cleanupIntervalMs: number;
  /** Maximum number of pending selections to store (default: 1000) */
  maxPendingSelections: number;
}

/**
 * Default configuration
 */
export const DEFAULT_PENDING_STATE_CONFIG: PendingStateConfig = {
  expirationMs: 5 * 60 * 1000, // 5 minutes
  cleanupIntervalMs: 60 * 1000, // 1 minute
  maxPendingSelections: 1000,
};

/**
 * The in-memory store for pending selections
 */
const pendingSelections = new Map<string, PendingSelection>();

/**
 * Current configuration
 */
let currentConfig: PendingStateConfig = { ...DEFAULT_PENDING_STATE_CONFIG };

/**
 * Cleanup interval handle
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Configures the pending state manager
 *
 * @param config - Partial configuration to merge with defaults
 */
export function configurePendingState(config: Partial<PendingStateConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Gets the current configuration
 */
export function getPendingStateConfig(): PendingStateConfig {
  return { ...currentConfig };
}

/**
 * Resets configuration to defaults
 */
export function resetPendingStateConfig(): void {
  currentConfig = { ...DEFAULT_PENDING_STATE_CONFIG };
}

/**
 * Generates a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Stores a pending selection for later retrieval
 *
 * @param requestId - Unique identifier for this request
 * @param userId - User who initiated the request
 * @param query - Original query/intent
 * @param candidates - Candidate tools to choose from
 * @returns Result with request ID and expiration info
 */
export function storePendingChoices(
  requestId: string,
  userId: string,
  query: string,
  candidates: PendingTool[]
): StorePendingResult {
  // Check capacity
  if (pendingSelections.size >= currentConfig.maxPendingSelections) {
    log('warn', 'pending_state_capacity_warning', {
      current: pendingSelections.size,
      max: currentConfig.maxPendingSelections,
    });
    // Remove oldest entries
    cleanupOldest(Math.ceil(currentConfig.maxPendingSelections * 0.1));
  }

  const now = Date.now();
  const expiresAt = now + currentConfig.expirationMs;

  const selection: PendingSelection = {
    requestId,
    userId,
    query,
    candidates,
    timestamp: now,
    expiresAt,
  };

  pendingSelections.set(requestId, selection);

  log('info', 'pending_state_stored', {
    requestId,
    userId,
    candidateCount: candidates.length,
    expiresAt: new Date(expiresAt).toISOString(),
  });

  return {
    requestId,
    candidateCount: candidates.length,
    expiresAt,
  };
}

/**
 * Retrieves a pending selection by request ID
 *
 * @param requestId - The request ID to look up
 * @returns The pending selection or undefined if not found/expired
 */
export function getPendingChoices(requestId: string): PendingSelection | undefined {
  const selection = pendingSelections.get(requestId);

  if (!selection) {
    return undefined;
  }

  // Check if expired
  if (Date.now() > selection.expiresAt) {
    pendingSelections.delete(requestId);
    log('info', 'pending_state_expired', { requestId });
    return undefined;
  }

  return selection;
}

/**
 * Clears a pending selection
 *
 * @param requestId - The request ID to clear
 * @returns true if a selection was cleared
 */
export function clearPendingChoices(requestId: string): boolean {
  const existed = pendingSelections.has(requestId);
  pendingSelections.delete(requestId);

  if (existed) {
    log('info', 'pending_state_cleared', { requestId });
  }

  return existed;
}

/**
 * Gets all pending selections for a user
 *
 * @param userId - The user ID to look up
 * @returns Array of pending selections for this user
 */
export function getPendingChoicesForUser(userId: string): PendingSelection[] {
  const now = Date.now();
  const results: PendingSelection[] = [];

  for (const selection of pendingSelections.values()) {
    if (selection.userId === userId && selection.expiresAt > now) {
      results.push(selection);
    }
  }

  return results;
}

/**
 * Checks if a request has pending choices
 *
 * @param requestId - The request ID to check
 * @returns true if there are pending choices for this request
 */
export function hasPendingChoices(requestId: string): boolean {
  return getPendingChoices(requestId) !== undefined;
}

/**
 * Gets the count of pending selections
 */
export function getPendingCount(): number {
  return pendingSelections.size;
}

/**
 * Clears all pending selections (for testing)
 */
export function clearAllPendingChoices(): void {
  pendingSelections.clear();
  log('info', 'pending_state_cleared_all');
}

/**
 * Cleans up expired selections
 *
 * @returns Number of selections cleaned up
 */
export function cleanupExpired(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [requestId, selection] of pendingSelections.entries()) {
    if (selection.expiresAt <= now) {
      pendingSelections.delete(requestId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    log('info', 'pending_state_cleanup', { cleaned });
  }

  return cleaned;
}

/**
 * Cleans up the oldest entries to make room
 *
 * @param count - Number of entries to remove
 */
function cleanupOldest(count: number): void {
  const sorted = [...pendingSelections.entries()].sort(
    ([, a], [, b]) => a.timestamp - b.timestamp
  );

  for (let i = 0; i < Math.min(count, sorted.length); i++) {
    pendingSelections.delete(sorted[i][0]);
  }

  log('info', 'pending_state_cleanup_oldest', { count });
}

/**
 * Starts the automatic cleanup interval
 */
export function startCleanupInterval(): void {
  if (cleanupInterval) {
    return; // Already running
  }

  cleanupInterval = setInterval(cleanupExpired, currentConfig.cleanupIntervalMs);
  log('info', 'pending_state_cleanup_started', {
    intervalMs: currentConfig.cleanupIntervalMs,
  });
}

/**
 * Stops the automatic cleanup interval
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    log('info', 'pending_state_cleanup_stopped');
  }
}

/**
 * Checks if cleanup interval is running
 */
export function isCleanupRunning(): boolean {
  return cleanupInterval !== null;
}

