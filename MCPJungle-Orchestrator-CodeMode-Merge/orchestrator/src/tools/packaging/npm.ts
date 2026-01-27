/**
 * NPM Package Handler
 *
 * Handles creating Lambda-deployable packages from NPM packages.
 * Uses a Docker container to ensure consistent, reproducible builds.
 *
 * @module tools/packaging/npm
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, promises as fs } from 'fs';
import { join, basename } from 'path';
import { log } from '../../obs/log.js';
import { createHash } from 'crypto';
import archiver from 'archiver';

const execAsync = promisify(exec);

// ==============================================================================
// Types
// ==============================================================================

/**
 * Options for packaging a tool
 */
export interface PackageOptions {
  /** NPM package name (e.g., '@upstash/context7-mcp') */
  npmPackage: string;
  /** Package version (default: 'latest') */
  version?: string;
  /** Output directory for the zip file */
  outputDir?: string;
  /** Tool name for the zip file (default: derived from package) */
  toolName?: string;
  /** Use Docker for consistent builds (default: true) */
  useDocker?: boolean;
  /** Node.js version for Docker (default: '20') */
  nodeVersion?: string;
  /** Timeout for npm install in milliseconds (default: 120000) */
  installTimeoutMs?: number;
}

/**
 * Result of packaging a tool
 */
export interface PackageResult {
  /** Whether packaging was successful */
  success: boolean;
  /** Path to the output zip file */
  zipPath: string;
  /** Size of the zip file in bytes */
  sizeBytes: number;
  /** SHA-256 hash of the zip file */
  hash: string;
  /** Tool name used */
  toolName: string;
  /** Version packaged */
  version: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Error thrown during packaging
 */
export class PackageError extends Error {
  constructor(
    message: string,
    public readonly phase: 'init' | 'install' | 'zip' | 'cleanup',
    public readonly originalError?: Error
  ) {
    super(`PackageError [${phase}]: ${message}`);
    this.name = 'PackageError';
  }
}

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Derives a tool name from an NPM package name
 * @example '@upstash/context7-mcp' -> 'context7'
 * @example 'mcp-server-filesystem' -> 'filesystem'
 */
export function deriveToolName(npmPackage: string): string {
  // Remove scope
  const withoutScope = npmPackage.replace(/^@[^/]+\//, '');
  
  // Remove common prefixes/suffixes
  return withoutScope
    .replace(/^mcp-server-/, '')
    .replace(/^mcp-/, '')
    .replace(/-mcp$/, '')
    .replace(/-server$/, '');
}

/**
 * Creates a temporary directory for packaging
 */
async function createTempDir(): Promise<string> {
  const tmpBase = process.env.TMPDIR || '/tmp';
  const dirName = `mcp-package-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpDir = join(tmpBase, dirName);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

/**
 * Cleans up a temporary directory
 */
async function cleanupDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    log('warn', 'package_cleanup_failed', { dir, error: (err as Error).message });
  }
}

/**
 * Calculates SHA-256 hash of a file
 */
async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

// ==============================================================================
// Main Packaging Function
// ==============================================================================

/**
 * Packages an NPM package for Lambda deployment
 *
 * This function:
 * 1. Creates a temporary directory
 * 2. Runs npm install (optionally in Docker)
 * 3. Creates a zip archive preserving symlinks
 * 4. Returns the path and metadata
 *
 * @param options - Packaging options
 * @returns Package result with zip path and metadata
 */
export async function packageTool(options: PackageOptions): Promise<PackageResult> {
  const {
    npmPackage,
    version = 'latest',
    outputDir = process.cwd(),
    toolName = deriveToolName(npmPackage),
    useDocker = true,
    nodeVersion = '20',
    installTimeoutMs = 120000,
  } = options;

  const startTime = Date.now();
  const zipFileName = `${toolName}-${version}.zip`;
  const zipPath = join(outputDir, zipFileName);

  log('info', 'package_start', {
    npmPackage,
    version,
    toolName,
    useDocker,
    outputDir,
  });

  let tmpDir: string | undefined;

  try {
    // 1. Create temporary directory
    tmpDir = await createTempDir();
    log('debug', 'package_tmpdir_created', { tmpDir });

    // 2. Install NPM package
    await installPackage(tmpDir, npmPackage, version, useDocker, nodeVersion, installTimeoutMs);

    // 3. Create zip archive
    await createZipArchive(tmpDir, zipPath);

    // 4. Get file stats and hash
    const stats = await fs.stat(zipPath);
    const hash = await hashFile(zipPath);

    const durationMs = Date.now() - startTime;

    log('info', 'package_success', {
      toolName,
      version,
      zipPath,
      sizeBytes: stats.size,
      hash: hash.slice(0, 16) + '...',
      durationMs,
    });

    return {
      success: true,
      zipPath,
      sizeBytes: stats.size,
      hash,
      toolName,
      version,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const error = err as Error;

    log('error', 'package_failed', {
      npmPackage,
      version,
      error: error.message,
      durationMs,
    });

    return {
      success: false,
      zipPath,
      sizeBytes: 0,
      hash: '',
      toolName,
      version,
      durationMs,
      error: error.message,
    };
  } finally {
    // Cleanup temporary directory
    if (tmpDir) {
      await cleanupDir(tmpDir);
    }
  }
}

/**
 * Installs an NPM package in a directory
 */
async function installPackage(
  dir: string,
  npmPackage: string,
  version: string,
  useDocker: boolean,
  nodeVersion: string,
  timeoutMs: number
): Promise<void> {
  const packageSpec = version === 'latest' ? npmPackage : `${npmPackage}@${version}`;

  if (useDocker) {
    // Use Docker for consistent builds
    const dockerCmd = [
      'docker', 'run', '--rm',
      '-v', `${dir}:/app`,
      '-w', '/app',
      `node:${nodeVersion}-slim`,
      'sh', '-c',
      `npm init -y && npm install ${packageSpec} --production`,
    ].join(' ');

    log('debug', 'package_docker_install', { command: dockerCmd });

    try {
      await execAsync(dockerCmd, { timeout: timeoutMs });
    } catch (err) {
      throw new PackageError(
        `Docker npm install failed: ${(err as Error).message}`,
        'install',
        err as Error
      );
    }
  } else {
    // Use local npm
    const npmCmd = `npm init -y && npm install ${packageSpec} --production`;

    log('debug', 'package_local_install', { command: npmCmd, dir });

    try {
      await execAsync(npmCmd, { cwd: dir, timeout: timeoutMs });
    } catch (err) {
      throw new PackageError(
        `npm install failed: ${(err as Error).message}`,
        'install',
        err as Error
      );
    }
  }
}

/**
 * Creates a zip archive from a directory
 * Preserves symlinks which is crucial for node_modules/.bin
 */
async function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
      // Preserve symlinks
      forceLocalTime: true,
    });

    output.on('close', () => {
      log('debug', 'package_zip_created', {
        path: outputPath,
        bytes: archive.pointer(),
      });
      resolve();
    });

    archive.on('error', (err) => {
      reject(new PackageError(`Zip creation failed: ${err.message}`, 'zip', err));
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        log('warn', 'package_zip_warning', { error: err.message });
      } else {
        reject(new PackageError(`Zip warning: ${err.message}`, 'zip', err));
      }
    });

    archive.pipe(output);

    // Add directory contents, preserving symlinks
    archive.directory(sourceDir, false, {
      // Follow symlinks for directory entries but preserve symlinks in .bin
      mode: undefined, // Preserve original mode
    });

    archive.finalize();
  });
}

/**
 * Lists available binaries in a package directory
 */
export async function listPackageBinaries(dir: string): Promise<string[]> {
  const binDir = join(dir, 'node_modules', '.bin');
  
  try {
    const entries = await fs.readdir(binDir);
    return entries;
  } catch {
    return [];
  }
}

/**
 * Gets the expected binary name for a tool
 */
export function getExpectedBinaryNames(toolName: string): string[] {
  return [
    `${toolName}-mcp`,
    toolName,
    `mcp-${toolName}`,
    `mcp-server-${toolName}`,
  ];
}
