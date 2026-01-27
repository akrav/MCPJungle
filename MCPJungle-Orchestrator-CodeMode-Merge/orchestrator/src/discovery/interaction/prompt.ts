/**
 * User Prompt Interface
 *
 * Outputs structured prompts to help users make manual tool selections.
 * Uses logging to communicate with users running the server.
 *
 * @module discovery/interaction/prompt
 */

import { ToolWithScore, ToolSummary } from '../supabase/types.js';
import { log } from '../../obs/log.js';

/**
 * A tool that can be prompted for selection
 */
export type PromptableTool = ToolWithScore | ToolSummary;

/**
 * Formatted tool for display
 */
export interface FormattedTool {
  index: number;
  id: string;
  name: string;
  price: string;
  rating: string;
  similarity?: string;
}

/**
 * Configuration for prompt formatting
 */
export interface PromptConfig {
  /** The port the admin API is running on */
  adminPort: number;
  /** The host for the admin API */
  adminHost: string;
  /** Whether to include curl examples */
  includeCurlExamples: boolean;
}

/**
 * Default prompt configuration
 */
export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  adminPort: 8080,
  adminHost: 'localhost',
  includeCurlExamples: true,
};

/**
 * Current configuration
 */
let currentConfig: PromptConfig = { ...DEFAULT_PROMPT_CONFIG };

/**
 * Configures the prompt system
 */
export function configurePrompt(config: Partial<PromptConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Gets the current prompt configuration
 */
export function getPromptConfig(): PromptConfig {
  return { ...currentConfig };
}

/**
 * Resets prompt configuration to defaults
 */
export function resetPromptConfig(): void {
  currentConfig = { ...DEFAULT_PROMPT_CONFIG };
}

/**
 * Formats a price for display
 */
export function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null) {
    return 'N/A';
  }
  if (price === 0) {
    return 'Free';
  }
  return `$${price.toFixed(4)}`;
}

/**
 * Formats a rating for display
 */
export function formatRating(rating: number | undefined): string {
  if (rating === undefined || rating === null) {
    return 'N/A';
  }
  return `${rating.toFixed(1)}★`;
}

/**
 * Formats a similarity score for display
 */
export function formatSimilarity(score: number | undefined): string {
  if (score === undefined || score === null) {
    return '';
  }
  return `${(score * 100).toFixed(0)}%`;
}

/**
 * Formats a tool for display
 */
export function formatTool(tool: PromptableTool, index: number): FormattedTool {
  return {
    index: index + 1, // 1-based for user display
    id: tool.id,
    name: tool.name,
    price: formatPrice(tool.price_per_call),
    rating: formatRating(tool.average_rating),
    similarity: 'similarity_score' in tool
      ? formatSimilarity(tool.similarity_score)
      : undefined,
  };
}

/**
 * Formats tools as a simple table string
 */
export function formatToolTable(tools: PromptableTool[]): string {
  const formatted = tools.map((t, i) => formatTool(t, i));

  // Calculate column widths
  const nameWidth = Math.max(4, ...formatted.map((t) => t.name.length));
  const priceWidth = Math.max(5, ...formatted.map((t) => t.price.length));
  const ratingWidth = 6;

  // Build header
  const header = [
    '#'.padEnd(3),
    'Name'.padEnd(nameWidth),
    'Price'.padEnd(priceWidth),
    'Rating'.padEnd(ratingWidth),
    'ID',
  ].join(' | ');

  const separator = '-'.repeat(header.length);

  // Build rows
  const rows = formatted.map((t) =>
    [
      String(t.index).padEnd(3),
      t.name.padEnd(nameWidth),
      t.price.padEnd(priceWidth),
      t.rating.padEnd(ratingWidth),
      t.id,
    ].join(' | ')
  );

  return [header, separator, ...rows].join('\n');
}

/**
 * Generates curl command for selecting a tool
 */
export function generateCurlCommand(requestId: string, toolId: string): string {
  const { adminHost, adminPort } = currentConfig;
  const payload = JSON.stringify({ requestId, toolId, action: 'select' });
  return `curl -X POST http://${adminHost}:${adminPort}/admin/select-tool -H "Content-Type: application/json" -d '${payload}'`;
}

/**
 * Generates curl command for rejecting all tools
 */
export function generateRejectCommand(requestId: string): string {
  const { adminHost, adminPort } = currentConfig;
  const payload = JSON.stringify({ requestId, action: 'reject' });
  return `curl -X POST http://${adminHost}:${adminPort}/admin/select-tool -H "Content-Type: application/json" -d '${payload}'`;
}

/**
 * Result of requesting user selection
 */
export interface PromptResult {
  requestId: string;
  candidateCount: number;
  message: string;
}

/**
 * Requests user selection by outputting a formatted prompt
 *
 * @param requestId - The request ID for this pending selection
 * @param candidates - The candidate tools to choose from
 * @param query - The original query that triggered this
 * @returns Prompt result with formatted message
 */
export function requestUserSelection(
  requestId: string,
  candidates: PromptableTool[],
  query?: string
): PromptResult {
  const table = formatToolTable(candidates);

  // Build the message
  const lines: string[] = [
    '',
    '╔══════════════════════════════════════════════════════════════════════════════╗',
    '║  ACTION REQUIRED: Manual Tool Selection                                       ║',
    '╚══════════════════════════════════════════════════════════════════════════════╝',
    '',
    `Request ID: ${requestId}`,
  ];

  if (query) {
    lines.push(`Query: "${query}"`);
  }

  lines.push('');
  lines.push('Available tools:');
  lines.push('');
  lines.push(table);
  lines.push('');

  if (currentConfig.includeCurlExamples) {
    lines.push('To select a tool, run one of the following commands:');
    lines.push('');

    // Show example for first few tools
    const exampleCount = Math.min(3, candidates.length);
    for (let i = 0; i < exampleCount; i++) {
      lines.push(`  # Select "${candidates[i].name}":`);
      lines.push(`  ${generateCurlCommand(requestId, candidates[i].id)}`);
      lines.push('');
    }

    lines.push('To reject all options:');
    lines.push(`  ${generateRejectCommand(requestId)}`);
    lines.push('');
  }

  lines.push('This request will expire in 5 minutes.');
  lines.push('');

  const message = lines.join('\n');

  // Log to both the logger and console.warn for visibility
  log('warn', 'manual_selection_required', {
    requestId,
    candidateCount: candidates.length,
    query,
    toolIds: candidates.map((c) => c.id),
  });

  // Also output to console.warn for immediate visibility
  console.warn(message);

  return {
    requestId,
    candidateCount: candidates.length,
    message,
  };
}

/**
 * Notifies that a selection was made
 */
export function notifySelectionMade(
  requestId: string,
  selectedToolId: string,
  toolName: string
): void {
  const message = `✓ Tool selected for request ${requestId}: ${toolName} (${selectedToolId})`;

  log('info', 'manual_selection_complete', {
    requestId,
    selectedToolId,
    toolName,
  });

  console.log(message);
}

/**
 * Notifies that a selection was rejected
 */
export function notifySelectionRejected(requestId: string): void {
  const message = `✗ All tools rejected for request ${requestId}`;

  log('info', 'manual_selection_rejected', { requestId });

  console.log(message);
}

/**
 * Notifies that a selection expired
 */
export function notifySelectionExpired(requestId: string): void {
  const message = `⏱ Selection expired for request ${requestId}`;

  log('warn', 'manual_selection_expired', { requestId });

  console.warn(message);
}

