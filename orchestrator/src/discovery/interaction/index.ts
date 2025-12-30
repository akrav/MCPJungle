/**
 * Interaction Module
 *
 * Handles user interaction for manual tool selection.
 * Provides state management and prompting for human-in-the-loop workflows.
 *
 * @module discovery/interaction
 */

// Pending state management
export {
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
  StorePendingResult,
  PendingStateConfig,
  DEFAULT_PENDING_STATE_CONFIG,
} from './pendingState.js';

// User prompts
export {
  requestUserSelection,
  formatPrice,
  formatRating,
  formatSimilarity,
  formatTool,
  formatToolTable,
  generateCurlCommand,
  generateRejectCommand,
  configurePrompt,
  resetPromptConfig,
  getPromptConfig,
  notifySelectionMade,
  notifySelectionRejected,
  notifySelectionExpired,
  PromptableTool,
  FormattedTool,
  PromptConfig,
  PromptResult,
  DEFAULT_PROMPT_CONFIG,
} from './prompt.js';

