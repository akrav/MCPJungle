/**
 * Provisioning Module
 *
 * Handles the installation and management of tools for users.
 * This module provides the interface between tool discovery and the
 * user's running orchestrator instance.
 *
 * @module discovery/provisioning
 */

// Re-export installer functions
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
} from './installer.js';

