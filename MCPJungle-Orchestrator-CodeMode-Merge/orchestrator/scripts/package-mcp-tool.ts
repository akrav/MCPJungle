#!/usr/bin/env npx ts-node
/**
 * MCP Tool Packaging CLI
 *
 * Packages NPM-based MCP tools for Lambda deployment.
 *
 * Usage:
 *   npx ts-node scripts/package-mcp-tool.ts --name context7 --package @upstash/context7-mcp
 *   npx ts-node scripts/package-mcp-tool.ts --name filesystem --package @modelcontextprotocol/server-filesystem --upload
 *
 * Options:
 *   --name        Tool name (used for S3 key and Lambda parameters)
 *   --package     NPM package name
 *   --version     Package version (default: latest)
 *   --output      Output directory (default: ./packages)
 *   --upload      Upload to S3 after packaging
 *   --no-docker   Don't use Docker for packaging
 *   --verify      Verify package after creation
 *   --help        Show help
 *
 * @module scripts/package-mcp-tool
 */

import { parseArgs } from 'util';

// ==============================================================================
// CLI Argument Parsing
// ==============================================================================

interface CLIOptions {
  name?: string;
  package?: string;
  version?: string;
  output?: string;
  upload?: boolean;
  noDocker?: boolean;
  verify?: boolean;
  help?: boolean;
}

function parseCliArgs(): CLIOptions {
  try {
    const { values } = parseArgs({
      options: {
        name: { type: 'string', short: 'n' },
        package: { type: 'string', short: 'p' },
        version: { type: 'string', short: 'v' },
        output: { type: 'string', short: 'o' },
        upload: { type: 'boolean', short: 'u' },
        'no-docker': { type: 'boolean' },
        verify: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
    });

    return {
      name: values.name,
      package: values.package,
      version: values.version,
      output: values.output,
      upload: values.upload,
      noDocker: values['no-docker'],
      verify: values.verify,
      help: values.help,
    };
  } catch (error) {
    console.error('Error parsing arguments:', (error as Error).message);
    showHelp();
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`
MCP Tool Packaging CLI
======================

Packages NPM-based MCP tools for Lambda deployment.

Usage:
  npx ts-node scripts/package-mcp-tool.ts [options]

Required Options:
  --name, -n      Tool name (used for S3 key and Lambda parameters)
  --package, -p   NPM package name (e.g., @upstash/context7-mcp)

Optional:
  --version, -v   Package version (default: latest)
  --output, -o    Output directory (default: ./packages)
  --upload, -u    Upload to S3 after packaging
  --no-docker     Don't use Docker for packaging (uses local npm)
  --verify        Verify package after creation
  --help, -h      Show this help message

Examples:
  # Package context7 MCP tool
  npx ts-node scripts/package-mcp-tool.ts \\
    --name context7 \\
    --package @upstash/context7-mcp

  # Package and upload to S3
  npx ts-node scripts/package-mcp-tool.ts \\
    --name filesystem \\
    --package @modelcontextprotocol/server-filesystem \\
    --upload

  # Package specific version without Docker
  npx ts-node scripts/package-mcp-tool.ts \\
    --name sqlite \\
    --package @anthropic/mcp-server-sqlite \\
    --version 1.0.0 \\
    --no-docker

Environment Variables:
  AWS_REGION              AWS region for S3 (default: us-east-1)
  AWS_LAMBDA_S3_BUCKET    S3 bucket for package storage
`);
}

// ==============================================================================
// Main Function
// ==============================================================================

async function main(): Promise<void> {
  const options = parseCliArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.name || !options.package) {
    console.error('Error: --name and --package are required\n');
    showHelp();
    process.exit(1);
  }

  const { promises: fs } = await import('fs');
  const { join } = await import('path');

  // Ensure output directory exists
  const outputDir = options.output || './packages';
  await fs.mkdir(outputDir, { recursive: true });

  console.log('\n📦 MCP Tool Packaging');
  console.log('====================\n');
  console.log(`Tool Name:   ${options.name}`);
  console.log(`NPM Package: ${options.package}`);
  console.log(`Version:     ${options.version || 'latest'}`);
  console.log(`Output:      ${outputDir}`);
  console.log(`Docker:      ${options.noDocker ? 'No' : 'Yes'}`);
  console.log(`Upload:      ${options.upload ? 'Yes' : 'No'}`);
  console.log('');

  // Step 1: Package the tool
  console.log('📥 Step 1: Packaging...');
  
  const { packageTool } = await import('../src/tools/packaging/npm.js');
  
  const packageResult = await packageTool({
    npmPackage: options.package,
    version: options.version || 'latest',
    outputDir,
    toolName: options.name,
    useDocker: !options.noDocker,
  });

  if (!packageResult.success) {
    console.error(`\n❌ Packaging failed: ${packageResult.error}`);
    process.exit(1);
  }

  console.log(`   ✅ Created: ${packageResult.zipPath}`);
  console.log(`   📊 Size: ${formatBytes(packageResult.sizeBytes)}`);
  console.log(`   🔐 Hash: ${packageResult.hash.slice(0, 16)}...`);
  console.log(`   ⏱️  Duration: ${packageResult.durationMs}ms\n`);

  // Step 2: Verify package (optional)
  if (options.verify) {
    console.log('🔍 Step 2: Verifying package...');
    
    const { verifyPackage } = await import('../src/tools/packaging/verify.js');
    
    const verifyResult = await verifyPackage(packageResult.zipPath, options.name);

    if (verifyResult.valid) {
      console.log('   ✅ Package is valid');
      console.log(`   📂 Binaries: ${verifyResult.binaries.join(', ')}\n`);
    } else {
      console.error('   ❌ Package verification failed:');
      for (const error of verifyResult.errors) {
        console.error(`      - ${error}`);
      }
      if (!options.upload) {
        process.exit(1);
      }
      console.log('   ⚠️  Continuing with upload despite verification issues...\n');
    }
  }

  // Step 3: Upload to S3 (optional)
  if (options.upload) {
    console.log('☁️  Step 3: Uploading to S3...');
    
    // Check if S3 is configured
    if (!process.env.AWS_LAMBDA_S3_BUCKET) {
      console.error('   ❌ AWS_LAMBDA_S3_BUCKET not set');
      console.error('   Set this environment variable to enable S3 upload');
      process.exit(1);
    }

    const { uploadToS3 } = await import('../src/tools/packaging/s3.js');
    
    const uploadResult = await uploadToS3({
      filePath: packageResult.zipPath,
      toolName: options.name,
      version: options.version || 'latest',
      metadata: {
        'npm-package': options.package,
        'packaged-with': 'package-mcp-tool.ts',
      },
    });

    if (!uploadResult.success) {
      console.error(`   ❌ Upload failed: ${uploadResult.error}`);
      process.exit(1);
    }

    console.log(`   ✅ Uploaded to: ${uploadResult.uri}`);
    console.log(`   🏷️  ETag: ${uploadResult.etag}\n`);
  }

  // Summary
  console.log('✨ Done!\n');
  console.log('Next steps:');
  
  if (!options.upload) {
    console.log(`  1. Upload to S3: aws s3 cp ${packageResult.zipPath} s3://YOUR_BUCKET/packages/${options.name}/${options.version || 'latest'}.zip`);
    console.log(`  2. Or run again with --upload flag`);
  } else {
    console.log(`  1. Register the tool with MCPJungle:`);
    console.log(`     mcpjungle register --transport lambda --name ${options.name} --function-url \$LAMBDA_URL`);
    console.log(`  2. Test the tool:`);
    console.log(`     curl "\$LAMBDA_URL?tool=${options.name}&version=${options.version || 'latest'}" -X POST -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`);
  }
  console.log('');
}

// ==============================================================================
// Utility Functions
// ==============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// ==============================================================================
// Entry Point
// ==============================================================================

main().catch((error) => {
  console.error('\n❌ Unexpected error:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});
