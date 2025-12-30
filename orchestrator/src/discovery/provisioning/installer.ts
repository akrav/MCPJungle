/**
 * Tool Installer
 *
 * Handles persisting installed tools to the database and refreshing
 * the runtime configuration to make tools immediately available.
 *
 * @module discovery/provisioning/installer
 */

import { getSupabaseClient } from '../supabase/client.js';
import { Tool, ToolSummary, ToolWithScore } from '../supabase/types.js';
import { log } from '../../obs/log.js';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Error thrown when tool installation fails
 */
export class InstallerError extends Error {
  constructor(
    message: string,
    public readonly phase: 'persist' | 'refresh' | 'validation',
    public readonly originalError?: Error | PostgrestError
  ) {
    super(`InstallerError [${phase}]: ${message}`);
    this.name = 'InstallerError';
  }
}

/**
 * A tool type that can be installed
 */
export type InstallableTool = Tool | ToolSummary | ToolWithScore;

/**
 * Record of an installed tool for a user
 */
export interface UserToolRecord {
  id: string;
  user_id: string;
  tool_id: string;
  canonical_name: string;
  installed_at: string;
  is_active: boolean;
}

/**
 * Result of an installation operation
 */
export interface InstallResult {
  success: boolean;
  toolId: string;
  canonicalName: string;
  message: string;
  isNewInstall: boolean;
}

const TABLE_NAME = 'user_tools_orchestrator';

/**
 * Generates a canonical name for a tool
 *
 * Format: {tool_name}__{short_id}
 * Example: "Weather_API__a1b2c3d4"
 *
 * @param tool - The tool to generate a name for
 * @returns The canonical name
 */
export function generateCanonicalName(tool: InstallableTool): string {
  const sanitizedName = tool.name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const shortId = tool.id.slice(0, 8);
  return `${sanitizedName}__${shortId}`;
}

/**
 * Persists a tool to the user's installed tools
 *
 * This saves the tool record to the database so it persists across restarts.
 *
 * @param userId - The user's ID
 * @param tool - The tool to install
 * @returns The created/updated record
 * @throws InstallerError if the database operation fails
 */
export async function persistToolConfig(
  userId: string,
  tool: InstallableTool
): Promise<UserToolRecord> {
  const supabase = getSupabaseClient();
  const canonicalName = generateCanonicalName(tool);

  log('info', 'installer_persist_start', {
    userId,
    toolId: tool.id,
    toolName: tool.name,
    canonicalName,
  });

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(
        {
          user_id: userId,
          tool_id: tool.id,
          canonical_name: canonicalName,
          is_active: true,
          installed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tool_id' }
      )
      .select('*')
      .single();

    if (error) {
      log('error', 'installer_persist_error', {
        userId,
        toolId: tool.id,
        error: error.message,
      });
      throw new InstallerError(
        `Failed to persist tool: ${error.message}`,
        'persist',
        error
      );
    }

    log('info', 'installer_persist_success', {
      userId,
      toolId: tool.id,
      canonicalName,
    });

    return data as UserToolRecord;
  } catch (err) {
    if (err instanceof InstallerError) {
      throw err;
    }
    throw new InstallerError(
      `Unexpected error persisting tool: ${(err as Error).message}`,
      'persist',
      err as Error
    );
  }
}

/**
 * Callback type for runtime refresh notifications
 */
export type RefreshCallback = (userId: string, toolId: string) => Promise<void> | void;

/**
 * Registry of refresh callbacks
 */
const refreshCallbacks: RefreshCallback[] = [];

/**
 * Registers a callback to be called when a tool is installed
 *
 * @param callback - The callback to register
 */
export function onToolInstalled(callback: RefreshCallback): void {
  refreshCallbacks.push(callback);
}

/**
 * Clears all registered refresh callbacks (useful for testing)
 */
export function clearRefreshCallbacks(): void {
  refreshCallbacks.length = 0;
}

/**
 * Notifies the runtime that a tool has been installed
 *
 * This triggers any registered refresh callbacks to update caches,
 * reload configurations, etc.
 *
 * @param userId - The user's ID
 * @param toolId - The installed tool's ID
 */
export async function refreshRuntime(userId: string, toolId: string): Promise<void> {
  log('info', 'installer_refresh_start', { userId, toolId });

  try {
    for (const callback of refreshCallbacks) {
      await callback(userId, toolId);
    }
    log('info', 'installer_refresh_complete', {
      userId,
      toolId,
      callbackCount: refreshCallbacks.length,
    });
  } catch (err) {
    log('error', 'installer_refresh_error', {
      userId,
      toolId,
      error: (err as Error).message,
    });
    throw new InstallerError(
      `Failed to refresh runtime: ${(err as Error).message}`,
      'refresh',
      err as Error
    );
  }
}

/**
 * Installs a tool for a user
 *
 * This is the main entry point for tool installation:
 * 1. Persists the tool to the database
 * 2. Refreshes the runtime configuration
 *
 * @param userId - The user's ID
 * @param tool - The tool to install
 * @returns Installation result
 */
export async function installTool(
  userId: string,
  tool: InstallableTool
): Promise<InstallResult> {
  // Validate inputs first
  if (!userId || typeof userId !== 'string') {
    throw new InstallerError('userId is required and must be a string', 'validation');
  }
  if (!tool) {
    throw new InstallerError('tool is required', 'validation');
  }
  if (!tool.id) {
    throw new InstallerError('tool with valid id is required', 'validation');
  }

  log('info', 'installer_install_start', {
    userId,
    toolId: tool.id,
    toolName: tool.name,
  });

  // Check if already installed
  const existing = await getUserTool(userId, tool.id);
  const isNewInstall = !existing;

  // Persist to database
  const record = await persistToolConfig(userId, tool);

  // Refresh runtime
  await refreshRuntime(userId, tool.id);

  const result: InstallResult = {
    success: true,
    toolId: tool.id,
    canonicalName: record.canonical_name,
    message: isNewInstall
      ? `Tool "${tool.name}" installed successfully`
      : `Tool "${tool.name}" reinstalled successfully`,
    isNewInstall,
  };

  log('info', 'installer_install_complete', result);

  return result;
}

/**
 * Gets a user's installed tool by tool ID
 *
 * @param userId - The user's ID
 * @param toolId - The tool's ID
 * @returns The tool record or null if not found
 */
export async function getUserTool(
  userId: string,
  toolId: string
): Promise<UserToolRecord | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .single();

  if (error && error.code === 'PGRST116') {
    return null; // Not found
  }

  if (error) {
    throw new InstallerError(
      `Failed to get user tool: ${error.message}`,
      'persist',
      error
    );
  }

  return data as UserToolRecord;
}

/**
 * Gets all installed tools for a user
 *
 * @param userId - The user's ID
 * @param activeOnly - If true, only returns active tools
 * @returns Array of installed tool records
 */
export async function getUserTools(
  userId: string,
  activeOnly = true
): Promise<UserToolRecord[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('user_id', userId);

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new InstallerError(
      `Failed to get user tools: ${error.message}`,
      'persist',
      error
    );
  }

  return (data || []) as UserToolRecord[];
}

/**
 * Checks if a tool is installed for a user
 *
 * @param userId - The user's ID
 * @param toolId - The tool's ID
 * @returns true if the tool is installed and active
 */
export async function isToolInstalled(
  userId: string,
  toolId: string
): Promise<boolean> {
  const tool = await getUserTool(userId, toolId);
  return tool !== null && tool.is_active;
}

/**
 * Uninstalls a tool for a user (soft delete - marks as inactive)
 *
 * @param userId - The user's ID
 * @param toolId - The tool's ID
 * @returns true if the tool was uninstalled
 */
export async function uninstallTool(
  userId: string,
  toolId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  log('info', 'installer_uninstall_start', { userId, toolId });

  const { error, count } = await supabase
    .from(TABLE_NAME)
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('tool_id', toolId);

  if (error) {
    throw new InstallerError(
      `Failed to uninstall tool: ${error.message}`,
      'persist',
      error
    );
  }

  const wasUninstalled = (count ?? 0) > 0;
  log('info', 'installer_uninstall_complete', { userId, toolId, wasUninstalled });

  // Refresh runtime to remove tool from cache
  await refreshRuntime(userId, toolId);

  return wasUninstalled;
}

