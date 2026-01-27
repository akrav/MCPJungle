# Lambda Tool Packaging Guide

> How to package MCP tools for deployment on AWS Lambda.

---

## Overview

MCP tools must be packaged as ZIP files and uploaded to S3 before they can be invoked via Lambda. This guide covers the packaging process for NPM-based MCP tools.

---

## Quick Start

### Using the CLI

```bash
# Package and upload a tool
npx tsx scripts/package-mcp-tool.ts \
  --name context7 \
  --package @upstash/context7-mcp \
  --version latest
```

### Using the Shell Script

```bash
cd orchestrator/infrastructure/lambda

# Package a tool
./scripts/package-tool.sh @upstash/context7-mcp context7

# Upload to S3
aws s3 cp context7-latest.zip s3://your-bucket/packages/context7/latest.zip
```

---

## Package Structure

A valid Lambda tool package has this structure:

```
tool-package.zip
├── package.json          # Tool metadata
├── node_modules/
│   ├── .bin/
│   │   └── context7-mcp  # Executable binary (symlink)
│   ├── @upstash/
│   │   └── context7-mcp/
│   │       ├── dist/
│   │       │   └── index.js
│   │       └── package.json
│   └── ... (dependencies)
└── (optional files)
```

### Key Requirements

1. **Binary in `.bin/`** - The MCP tool executable must be in `node_modules/.bin/`
2. **Executable permissions** - Binary must be executable (`chmod +x`)
3. **Self-contained** - All dependencies must be bundled
4. **Size limit** - Unzipped package must be < 250MB (Lambda limit)

---

## Packaging Methods

### Method 1: CLI Tool (Recommended)

The `package-mcp-tool.ts` script handles everything:

```bash
npx tsx scripts/package-mcp-tool.ts \
  --name <tool-name> \
  --package <npm-package> \
  --version <version>
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--name` | Yes | Tool name (used in S3 path) |
| `--package` | Yes | NPM package name |
| `--version` | No | Version to install (default: `latest`) |
| `--outputDir` | No | Temp directory for packaging |
| `--skipUpload` | No | Skip S3 upload |

**Example:**

```bash
# Package filesystem server
npx tsx scripts/package-mcp-tool.ts \
  --name filesystem \
  --package @modelcontextprotocol/server-filesystem

# Package with specific version
npx tsx scripts/package-mcp-tool.ts \
  --name sqlite \
  --package @anthropic/mcp-server-sqlite \
  --version 1.2.0
```

### Method 2: Shell Script

For manual packaging:

```bash
#!/bin/bash
# package-tool.sh <npm-package> <tool-name>

NPM_PACKAGE=$1
TOOL_NAME=$2
VERSION=${3:-latest}

# Create temp directory
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

# Initialize and install
npm init -y
npm install $NPM_PACKAGE

# Create zip
zip -r ${TOOL_NAME}-${VERSION}.zip node_modules package.json

# Upload to S3
aws s3 cp ${TOOL_NAME}-${VERSION}.zip \
  s3://${BUCKET}/packages/${TOOL_NAME}/${VERSION}.zip

# Cleanup
rm -rf $TEMP_DIR
```

### Method 3: Programmatic API

```typescript
import { packageNpmTool, uploadPackageToS3 } from './tools/packaging/index.js';

// Package the tool
const { zipFilePath, sizeBytes } = await packageNpmTool({
  toolName: 'context7',
  npmPackageName: '@upstash/context7-mcp',
  version: 'latest',
});

console.log(`Packaged: ${zipFilePath} (${sizeBytes} bytes)`);

// Upload to S3
const { s3Key, s3Url } = await uploadPackageToS3({
  toolName: 'context7',
  version: 'latest',
  filePath: zipFilePath,
});

console.log(`Uploaded to: ${s3Url}`);
```

---

## S3 Package Organization

Packages are stored in S3 with this structure:

```
s3://mcpjungle-packages-{id}/
└── packages/
    ├── context7/
    │   ├── latest.zip
    │   ├── v1.0.0.zip
    │   └── v1.1.0.zip
    ├── filesystem/
    │   └── latest.zip
    └── sqlite/
        └── latest.zip
```

### Naming Conventions

- **Tool name**: Lowercase, hyphens allowed (e.g., `context7`, `weather-api`)
- **Version**: Semantic version or `latest` (e.g., `v1.0.0`, `latest`)
- **S3 Key**: `packages/{tool-name}/{version}.zip`

---

## Binary Discovery

The Lambda adapter searches for binaries in this order:

1. `node_modules/.bin/{tool-name}-mcp`
2. `node_modules/.bin/{tool-name}`
3. `node_modules/.bin/mcp-{tool-name}`
4. `node_modules/.bin/mcp-server-{tool-name}`

If your package uses a non-standard binary name, ensure the tool name derives correctly. The adapter uses these transformations:

| NPM Package | Derived Tool Name | Binary Searched |
|-------------|-------------------|-----------------|
| `@upstash/context7-mcp` | `context7` | `context7-mcp`, `context7`, ... |
| `mcp-server-filesystem` | `filesystem` | `filesystem-mcp`, `filesystem`, ... |
| `@anthropic/mcp-sqlite` | `sqlite` | `sqlite-mcp`, `sqlite`, ... |

---

## Verification

### Verify Local Package

```bash
# Check package contents
unzip -l context7-latest.zip

# Verify binary exists
unzip -p context7-latest.zip node_modules/.bin/context7-mcp | head -1

# Test locally
unzip context7-latest.zip -d /tmp/test
/tmp/test/node_modules/.bin/context7-mcp --help
```

### Verify S3 Package

```typescript
import { verifyS3Package } from './tools/packaging/verify.js';

const result = await verifyS3Package({
  toolName: 'context7',
  version: 'latest',
});

console.log(result);
// { exists: true, s3Key: 'packages/context7/latest.zip', contentLength: 12345678 }
```

### Verify End-to-End

```bash
# Call the Lambda with the tool
curl "https://your-lambda-url.lambda-url.aws?tool=context7&version=latest" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```

---

## Troubleshooting

### "Binary not found"

**Cause:** The MCP tool doesn't install a binary in `node_modules/.bin/`

**Solution:** Check the package's `package.json` for a `bin` field:

```json
{
  "bin": {
    "context7-mcp": "./dist/index.js"
  }
}
```

If missing, the package may not be designed for CLI usage.

### "Package too large"

**Cause:** Unzipped package exceeds Lambda's 250MB limit

**Solutions:**
1. Use `--production` flag during npm install
2. Exclude devDependencies
3. Consider using Lambda layers for large dependencies

### "Permission denied"

**Cause:** Binary doesn't have execute permissions

**Solution:** The packaging script should handle this, but you can fix manually:

```bash
chmod +x node_modules/.bin/*
```

### "Cannot find module"

**Cause:** Missing dependencies in the package

**Solution:** Ensure all dependencies are bundled:

```bash
npm install --production
npm dedupe
```

---

## Best Practices

1. **Always test locally** before uploading to S3
2. **Use `latest` carefully** - consider pinning versions for production
3. **Monitor package sizes** - large packages increase cold start time
4. **Automate packaging** - integrate into CI/CD pipeline
5. **Version your packages** - keep multiple versions for rollback

---

## Related Documentation

- [Lambda Setup Guide](SETUP.md)
- [API Reference](API.md)
- [Runbook](RUNBOOK.md)

---

*Last Updated: January 13, 2026*
