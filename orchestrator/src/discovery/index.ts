/**
 * Discovery Module
 *
 * Exports for the tool discovery system that integrates with Supabase
 * for finding and managing MCP tools.
 *
 * @module discovery
 */

// Supabase client
export {
  initializeSupabaseClient,
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClient,
  SupabaseConfig,
  SupabaseConfigError,
} from './supabase/client.js';

// Supabase types
export {
  Tool,
  ToolSummary,
  ToolWithScore,
  ListingStatus,
} from './supabase/types.js';

// Supabase service
export {
  getAllTools,
  getActiveTools,
  getToolById,
  getToolsByName,
  SupabaseServiceError,
} from './supabase/service.js';

// User preferences types
export {
  UserPreferences,
  UserPreferencesUpdate,
  DiscoveryMode,
  SortStrategy,
  DEFAULT_USER_PREFERENCES,
} from './preferences/types.js';

// User preferences store
export {
  getUserPreferences,
  setUserPreferences,
  updateUserPreferences,
  deleteUserPreferences,
  hasCustomPreferences,
  PreferencesStoreError,
} from './preferences/store.js';

// Search service (vector search, query expansion, embeddings)
export {
  // Main search functions
  searchTools,
  searchToolsByEmbedding,
  getSearchServiceStatus,
  SearchServiceError,
  // Embedding functions
  generateEmbedding,
  generateEmbeddings,
  isEmbeddingConfigured,
  EmbeddingError,
  EMBEDDING_DIMENSION,
  DEFAULT_MODEL,
  // Query expansion functions
  expandQuery,
  isQueryExpansionConfigured,
  QueryExpansionError,
  EXPANSION_SYSTEM_PROMPT,
  // Vector store functions
  findSimilarTools,
  hasEmbeddings,
  storeToolEmbedding,
  getEmbeddingCount,
  VectorSearchError,
  VECTOR_SEARCH_DEFAULTS,
} from './search/index.js';

// Selection service (filtering and ranking)
export {
  // Main selection functions
  selectBestTool,
  getAutoSelectedTool,
  getManualCandidates,
  hasViableCandidates,
  describeFiltering,
  SelectionResult,
  SelectionOptions,
  SelectableTool,
  // Filter functions
  filterTools,
  passesPriceFilter,
  passesRatingFilter,
  getFilterStats,
  FilterOptions,
  FilterableTool,
  DEFAULT_FILTER_OPTIONS,
  // Ranking functions
  rankTools,
  getBestTool,
  getTopRanked,
  getComparator,
  compareByPriceAsc,
  compareByRatingDesc,
  compareByBalancedScore,
  calculateBalancedScore,
  RankableTool,
} from './selection/index.js';

// Provisioning service (tool installation)
export {
  installTool,
  persistToolConfig,
  uninstallTool,
  getUserTool,
  getUserTools,
  isToolInstalled,
  generateCanonicalName,
  onToolInstalled,
  clearRefreshCallbacks,
  refreshRuntime,
  InstallerError,
  InstallResult,
  UserToolRecord,
  InstallableTool,
} from './provisioning/index.js';

// Interaction service (manual mode)
export {
  // Pending state management
  storePendingChoices,
  getPendingChoices,
  clearPendingChoices,
  getPendingChoicesForUser,
  hasPendingChoices,
  getPendingCount,
  clearAllPendingChoices,
  generateRequestId,
  configurePendingState,
  resetPendingStateConfig,
  PendingSelection,
  PendingTool,
  // User prompts
  requestUserSelection,
  formatToolTable,
  configurePrompt,
  resetPromptConfig,
  notifySelectionMade,
  notifySelectionRejected,
  notifySelectionExpired,
  PromptResult,
} from './interaction/index.js';

// =============================================================================
// AUTO-INSTALL FLOW - Main Entry Point
// =============================================================================

import { searchTools } from './search/index.js';
import { selectBestTool, SelectionResult } from './selection/index.js';
import { getUserPreferences } from './preferences/store.js';
import { installTool, InstallResult } from './provisioning/index.js';
import { ToolWithScore } from './supabase/types.js';
import { UserPreferences } from './preferences/types.js';
import { log } from '../obs/log.js';
import {
  storePendingChoices,
  generateRequestId,
  requestUserSelection,
} from './interaction/index.js';

/**
 * Result of the auto-install resolution process
 */
export interface ResolveResult {
  /** Whether a tool was found and installed */
  resolved: boolean;
  /** Whether the system is in manual mode (requires user selection) */
  manualMode: boolean;
  /** The selected tool (if found) */
  selectedTool: ToolWithScore | null;
  /** All candidate tools that passed filters */
  candidates: ToolWithScore[];
  /** Installation result (if installed) */
  installResult: InstallResult | null;
  /** Request ID for manual mode (used to reference pending selection) */
  requestId?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Error thrown during the resolution process
 */
export class ResolveError extends Error {
  constructor(
    message: string,
    public readonly step: 'search' | 'preferences' | 'selection' | 'install',
    public readonly originalError?: Error
  ) {
    super(`ResolveError [${step}]: ${message}`);
    this.name = 'ResolveError';
  }
}

/**
 * Resolves a missing tool by searching, selecting, and optionally installing it.
 *
 * This is the main orchestration function that connects:
 * - Search (Sprint 1) - Find relevant tools
 * - Selection (Sprint 2) - Filter and rank based on user preferences
 * - Installation (Sprint 3) - Persist and refresh the tool
 *
 * @param userId - The user's ID
 * @param query - The search query or intent (e.g., "get weather")
 * @returns Resolution result indicating success/failure and details
 */
export async function resolveMissingTool(
  userId: string,
  query: string
): Promise<ResolveResult> {
  log('info', 'resolve_missing_tool_start', { userId, query });

  const result: ResolveResult = {
    resolved: false,
    manualMode: false,
    selectedTool: null,
    candidates: [],
    installResult: null,
  };

  try {
    // Step 1: Search for relevant tools
    log('info', 'resolve_step_search', { userId, query });
    let tools: ToolWithScore[];
    try {
      tools = await searchTools(query);
    } catch (err) {
      throw new ResolveError(
        `Search failed: ${(err as Error).message}`,
        'search',
        err as Error
      );
    }

    if (tools.length === 0) {
      log('info', 'resolve_no_tools_found', { userId, query });
      result.error = 'No matching tools found in registry';
      return result;
    }

    log('info', 'resolve_tools_found', { userId, count: tools.length });

    // Step 2: Get user preferences
    log('info', 'resolve_step_preferences', { userId });
    let prefs: UserPreferences;
    try {
      prefs = await getUserPreferences(userId);
    } catch (err) {
      throw new ResolveError(
        `Failed to get preferences: ${(err as Error).message}`,
        'preferences',
        err as Error
      );
    }

    // Step 3: Select the best tool based on preferences
    log('info', 'resolve_step_selection', { userId, mode: prefs.discoveryMode });
    let selection: SelectionResult<ToolWithScore>;
    try {
      selection = selectBestTool(tools, prefs);
    } catch (err) {
      throw new ResolveError(
        `Selection failed: ${(err as Error).message}`,
        'selection',
        err as Error
      );
    }

    result.candidates = selection.candidates;

    // Check if all tools were filtered out
    if (selection.candidates.length === 0) {
      log('info', 'resolve_all_filtered', { userId, stats: selection.stats });
      result.error = 'All tools were filtered out by user preferences';
      return result;
    }

    // Check if manual mode
    if (selection.mode === 'manual') {
      const requestId = generateRequestId();

      log('info', 'resolve_manual_mode', {
        userId,
        requestId,
        candidateCount: selection.candidates.length,
      });

      // Store pending choices for later selection
      storePendingChoices(requestId, userId, query, selection.candidates);

      // Output prompt to user
      requestUserSelection(requestId, selection.candidates, query);

      result.manualMode = true;
      result.requestId = requestId;
      result.error = `Manual mode: User selection required. Request ID: ${requestId}`;
      return result;
    }

    // Auto mode - check if we have a selection
    if (!selection.autoSelected) {
      log('warn', 'resolve_no_auto_selection', { userId });
      result.error = 'Auto mode but no tool was auto-selected';
      return result;
    }

    result.selectedTool = selection.autoSelected;

    // Step 4: Install the selected tool
    log('info', 'resolve_step_install', {
      userId,
      toolId: selection.autoSelected.id,
      toolName: selection.autoSelected.name,
    });

    try {
      result.installResult = await installTool(userId, selection.autoSelected);
    } catch (err) {
      throw new ResolveError(
        `Installation failed: ${(err as Error).message}`,
        'install',
        err as Error
      );
    }

    result.resolved = true;
    log('info', 'resolve_missing_tool_success', {
      userId,
      toolId: selection.autoSelected.id,
      toolName: selection.autoSelected.name,
    });

    return result;
  } catch (err) {
    if (err instanceof ResolveError) {
      log('error', 'resolve_missing_tool_error', {
        userId,
        step: err.step,
        error: err.message,
      });
      result.error = err.message;
    } else {
      log('error', 'resolve_missing_tool_unexpected', {
        userId,
        error: (err as Error).message,
      });
      result.error = `Unexpected error: ${(err as Error).message}`;
    }
    return result;
  }
}

/**
 * Simplified version of resolveMissingTool that returns a boolean.
 *
 * Used by the interceptor for quick success/failure checks.
 *
 * @param userId - The user's ID
 * @param query - The search query or intent
 * @returns true if a tool was found and installed
 */
export async function tryResolveMissingTool(
  userId: string,
  query: string
): Promise<boolean> {
  const result = await resolveMissingTool(userId, query);
  return result.resolved;
}
