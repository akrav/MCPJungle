/**
 * Tool Registry Sync
 *
 * Synchronizes tool deployments between S3 packages and the Supabase registry.
 * This ensures that tools registered in Supabase have corresponding packages in S3.
 *
 * @module tools/registry/sync
 */

import { log } from '../../obs/log.js';
import { listS3Packages, type S3PackageInfo } from '../packaging/s3.js';
import { getSupabaseClient } from '../../discovery/supabase/client.js';
import type { ToolDeployment, DeploymentType } from '../../discovery/supabase/types.js';

// ==============================================================================
// Types
// ==============================================================================

/**
 * Sync status for a tool
 */
export interface ToolSyncStatus {
  /** Tool ID */
  toolId: string;
  /** Tool name */
  toolName: string;
  /** Whether the tool has a deployment record */
  hasDeployment: boolean;
  /** Whether the S3 package exists */
  hasS3Package: boolean;
  /** Deployment type if registered */
  deploymentType?: DeploymentType;
  /** S3 package info if exists */
  s3Package?: S3PackageInfo;
  /** Issues found */
  issues: string[];
}

/**
 * Full sync report
 */
export interface SyncReport {
  /** Timestamp of the sync */
  timestamp: string;
  /** Total tools checked */
  totalTools: number;
  /** Tools with both deployment and S3 package */
  synced: number;
  /** Tools missing S3 packages */
  missingPackages: number;
  /** Tools missing deployment records */
  missingDeployments: number;
  /** Orphaned S3 packages (no deployment) */
  orphanedPackages: number;
  /** Detailed status for each tool */
  tools: ToolSyncStatus[];
  /** Errors encountered */
  errors: string[];
}

/**
 * Options for syncing
 */
export interface SyncOptions {
  /** Only check, don't fix issues */
  dryRun?: boolean;
  /** Auto-create missing deployment records */
  autoCreateDeployments?: boolean;
  /** Delete orphaned S3 packages */
  deleteOrphans?: boolean;
}

// ==============================================================================
// Sync Functions
// ==============================================================================

/**
 * Generates a sync report comparing deployments and S3 packages
 *
 * @returns Sync report
 */
export async function generateSyncReport(): Promise<SyncReport> {
  const report: SyncReport = {
    timestamp: new Date().toISOString(),
    totalTools: 0,
    synced: 0,
    missingPackages: 0,
    missingDeployments: 0,
    orphanedPackages: 0,
    tools: [],
    errors: [],
  };

  log('info', 'sync_report_start');

  try {
    // Get all S3 packages
    const s3Packages = await listS3Packages();
    const s3PackageMap = new Map<string, S3PackageInfo>();
    for (const pkg of s3Packages) {
      // Key by toolName for lookup
      const key = `${pkg.toolName}:${pkg.version}`;
      s3PackageMap.set(key, pkg);
    }

    log('debug', 'sync_s3_packages_loaded', { count: s3Packages.length });

    // Get all deployment records
    const supabase = getSupabaseClient();
    const { data: deployments, error } = await supabase
      .from('tool_deployments_orchestrator')
      .select('*');

    if (error) {
      report.errors.push(`Failed to fetch deployments: ${error.message}`);
      return report;
    }

    const deploymentMap = new Map<string, ToolDeployment>();
    for (const dep of deployments || []) {
      deploymentMap.set(dep.tool_id, dep as ToolDeployment);
    }

    log('debug', 'sync_deployments_loaded', { count: deployments?.length || 0 });

    // Get all tools
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('id, name');

    if (toolsError) {
      report.errors.push(`Failed to fetch tools: ${toolsError.message}`);
      return report;
    }

    report.totalTools = tools?.length || 0;

    // Check each tool
    for (const tool of tools || []) {
      const deployment = deploymentMap.get(tool.id);
      const s3Key = `${tool.name}:latest`; // Check latest version
      const s3Package = s3PackageMap.get(s3Key);

      const status: ToolSyncStatus = {
        toolId: tool.id,
        toolName: tool.name,
        hasDeployment: !!deployment,
        hasS3Package: !!s3Package,
        deploymentType: deployment?.deployment_type,
        s3Package,
        issues: [],
      };

      if (deployment && s3Package) {
        report.synced++;
      } else if (deployment && !s3Package && deployment.deployment_type !== 'EXTERNAL') {
        status.issues.push('Missing S3 package for non-external deployment');
        report.missingPackages++;
      } else if (!deployment && s3Package) {
        status.issues.push('S3 package exists but no deployment record');
        report.missingDeployments++;
      }

      // Remove from s3PackageMap to track orphans
      s3PackageMap.delete(s3Key);

      report.tools.push(status);
    }

    // Remaining S3 packages are orphans
    for (const [, pkg] of s3PackageMap) {
      report.orphanedPackages++;
      report.tools.push({
        toolId: '',
        toolName: pkg.toolName,
        hasDeployment: false,
        hasS3Package: true,
        s3Package: pkg,
        issues: ['Orphaned S3 package - no matching tool'],
      });
    }

    log('info', 'sync_report_complete', {
      totalTools: report.totalTools,
      synced: report.synced,
      missingPackages: report.missingPackages,
      missingDeployments: report.missingDeployments,
      orphanedPackages: report.orphanedPackages,
    });

    return report;
  } catch (err) {
    report.errors.push(`Sync failed: ${(err as Error).message}`);
    log('error', 'sync_report_failed', { error: (err as Error).message });
    return report;
  }
}

/**
 * Creates a deployment record for a tool
 *
 * @param toolId - Tool ID
 * @param toolName - Tool name
 * @param deploymentType - Deployment type
 * @returns Created deployment record
 */
export async function createDeploymentRecord(
  toolId: string,
  toolName: string,
  deploymentType: DeploymentType = 'PUBLIC'
): Promise<ToolDeployment | null> {
  const supabase = getSupabaseClient();

  log('info', 'sync_create_deployment', { toolId, toolName, deploymentType });

  const { data, error } = await supabase
    .from('tool_deployments_orchestrator')
    .insert({
      tool_id: toolId,
      deployment_type: deploymentType,
      s3_package_key: `packages/${toolName}/latest.zip`,
      package_version: 'latest',
    })
    .select('*')
    .single();

  if (error) {
    log('error', 'sync_create_deployment_failed', {
      toolId,
      error: error.message,
    });
    return null;
  }

  return data as ToolDeployment;
}

/**
 * Updates a deployment record with S3 package info
 *
 * @param toolId - Tool ID
 * @param s3Package - S3 package info
 * @returns Updated deployment record
 */
export async function updateDeploymentFromS3(
  toolId: string,
  s3Package: S3PackageInfo
): Promise<ToolDeployment | null> {
  const supabase = getSupabaseClient();

  log('info', 'sync_update_deployment', { toolId, s3Key: s3Package.key });

  const { data, error } = await supabase
    .from('tool_deployments_orchestrator')
    .update({
      s3_package_key: s3Package.key,
      package_version: s3Package.version,
      package_size_bytes: s3Package.sizeBytes,
    })
    .eq('tool_id', toolId)
    .select('*')
    .single();

  if (error) {
    log('error', 'sync_update_deployment_failed', {
      toolId,
      error: error.message,
    });
    return null;
  }

  return data as ToolDeployment;
}

/**
 * Runs a full sync with optional auto-fix
 *
 * @param options - Sync options
 * @returns Sync report with any actions taken
 */
export async function runSync(options: SyncOptions = {}): Promise<SyncReport> {
  const { dryRun = true, autoCreateDeployments = false } = options;

  log('info', 'sync_run_start', { dryRun, autoCreateDeployments });

  const report = await generateSyncReport();

  if (dryRun) {
    log('info', 'sync_dry_run_complete');
    return report;
  }

  // Auto-create missing deployments
  if (autoCreateDeployments) {
    for (const tool of report.tools) {
      if (tool.hasS3Package && !tool.hasDeployment && tool.toolId) {
        const created = await createDeploymentRecord(
          tool.toolId,
          tool.toolName,
          'PUBLIC'
        );
        if (created) {
          tool.hasDeployment = true;
          tool.deploymentType = 'PUBLIC';
          tool.issues = tool.issues.filter(
            (i) => !i.includes('no deployment record')
          );
        }
      }
    }
  }

  log('info', 'sync_run_complete');

  return report;
}

/**
 * Gets the deployment for a specific tool
 *
 * @param toolId - Tool ID
 * @returns Deployment record or null
 */
export async function getToolDeployment(
  toolId: string
): Promise<ToolDeployment | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tool_deployments_orchestrator')
    .select('*')
    .eq('tool_id', toolId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    log('error', 'sync_get_deployment_failed', { toolId, error: error.message });
    return null;
  }

  return data as ToolDeployment;
}

/**
 * Gets all deployments for Lambda-backed tools
 *
 * @returns Array of deployment records
 */
export async function getLambdaDeployments(): Promise<ToolDeployment[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('tool_deployments_orchestrator')
    .select('*')
    .in('deployment_type', ['PUBLIC', 'PRIVATE']);

  if (error) {
    log('error', 'sync_get_lambda_deployments_failed', { error: error.message });
    return [];
  }

  return (data || []) as ToolDeployment[];
}
