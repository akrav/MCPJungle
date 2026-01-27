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
  installToolWithLambda,
  isLambdaInstallAvailable,
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
  LambdaInstallResult,
  LambdaInstallOptions,
  UserToolRecord,
  InstallableTool,
} from './installer.js';

// Re-export Lambda tool provisioner functions
export {
  provisionToolLambda,
  getProvisionedTool,
  getUserProvisionedTools,
  deprovisionToolLambda,
  clearProvisionedToolsCache,
  verifyS3Package,
  sanitizeToolName,
  isLambdaCompatible,
  getLambdaConfigStatus,
  LambdaToolProvisionError,
  LambdaToolProvisionResult,
  LambdaToolConfig,
} from './lambdaTool.js';

// Re-export Lambda client functions
export {
  LambdaMcpClient,
  LambdaClientError,
  createLambdaClient,
  createLambdaClientFromUrl,
  isLambdaHealthy,
  measureColdStart,
  parseSSEResponse,
  extractJsonRpcResponses,
  JsonRpcRequest,
  JsonRpcResponse,
  LambdaInvokeOptions,
  LambdaInvokeResult,
} from './lambdaClient.js';
