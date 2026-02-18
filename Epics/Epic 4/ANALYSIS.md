# Epic 4: MCP Scraper & Lambda Adapter Integration Analysis

## Executive Summary

This document analyzes the `mcp_scraper` codebase and its compatibility with the Lambda adapter developed in Epic 3. The two systems are designed to work in tandem:

1. **MCP Scraper**: Discovers and downloads MCP servers from the official registry to S3
2. **Lambda Adapter**: Loads MCP packages from S3 and serves them via Lambda endpoints

**Current Status**: These systems are **incompatible** due to differences in S3 path structure, packaging format, and versioning approach.

---

## Architecture Overview

### MCP Scraper Flow (Current)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  MCP Registry   │───▶│  Git Clone      │───▶│  S3 Upload      │
│  (API)          │    │  (Full Repo)    │    │  (Uncompressed) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
   registry.modelcontextprotocol.io     /tmp/repo/     mcps/{owner}/{name}/*
```

### Lambda Adapter Flow (Expected)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  User Request   │───▶│  Download from  │───▶│  Extract &      │
│  (tool name)    │    │  S3 (archive)   │    │  Execute        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
   ?tool=context7    packages/context7/latest.zip    /tmp/context7/
```

---

## Critical Incompatibilities

### 1. S3 Path Structure

| Component | MCP Scraper (Current) | Lambda Adapter (Expected) |
|-----------|----------------------|---------------------------|
| Pattern | `mcps/{owner}/{name}/*` | `packages/{tool_name}/{version}.{ext}` |
| Example | `mcps/upstash/context7-mcp/README.md` | `packages/context7/latest.zip` |
| Files | Individual files (uncompressed) | Single archive file |

**Impact**: Lambda cannot find packages because it looks for `packages/{name}/{version}.zip` but MCP Scraper uploads to `mcps/{owner}/{name}/`.

### 2. Packaging Format

| Component | MCP Scraper (Current) | Lambda Adapter (Expected) |
|-----------|----------------------|---------------------------|
| Format | Individual files | Compressed archive |
| Extensions | N/A | `.zip`, `.tar.gz`, `.tgz`, `.mcpb` |
| Extraction | Not needed | Required before execution |

**Impact**: Lambda expects a single downloadable archive but MCP Scraper uploads hundreds of individual files.

### 3. Versioning

| Component | MCP Scraper (Current) | Lambda Adapter (Expected) |
|-----------|----------------------|---------------------------|
| Approach | Single version (latest only) | Version-specific archives |
| Path | `mcps/owner/name/` | `packages/tool/1.0.0.zip`, `packages/tool/latest.zip` |
| History | None | Supports multiple versions |

**Impact**: Lambda looks for `{version}.zip` but MCP Scraper doesn't create versioned archives.

### 4. Tool Naming/Namespacing

| Component | MCP Scraper (Current) | Lambda Adapter (Expected) |
|-----------|----------------------|---------------------------|
| Namespace | `{owner}/{name}` | `{tool_name}` (flat) |
| Example | `upstash/context7-mcp` | `context7` |
| Collision | Handled by owner prefix | Requires unique names |

**Impact**: Different naming conventions require mapping or standardization.

### 5. Runtime Detection

| Component | MCP Scraper (Current) | Lambda Adapter (Expected) |
|-----------|----------------------|---------------------------|
| Manifest | Not created | `manifest.json` or `mcp.json` |
| Detection | None | Heuristic fallback (Python/Node) |
| Metadata | SQLite DB only | In-package manifest |

**Impact**: Lambda relies on manifest files that MCP Scraper doesn't generate.

---

## Current Code Analysis

### repository_downloader.py - Key Issues

```python
# Lines 168-196: Uploads files individually to S3
for root, dirs, files in os.walk(repo_clone_path):
    for file in files:
        file_path = os.path.join(root, file)
        rel_path = os.path.relpath(file_path, repo_clone_path)
        s3_object_path = f"{s3_base_path}/{rel_path}"  # Individual files!
        self.s3_client.upload_file(file_path, s3_object_path)

s3_uri = f"s3://{self.s3_client.bucket_name}/{s3_base_path}"
# Result: s3://bucket/mcps/owner/name/file1, file2, file3...
```

**Problem**: This creates a directory structure in S3, not a single archive.

### Lambda Adapter index.js - What It Expects

```javascript
// Lines 120-165: Looks for archive files with specific extensions
const extensions = ['.zip', '.tar.gz', '.tgz', '.mcpb'];
for (const ext of extensions) {
  const key = s3Path.replace('s3://' + bucket + '/', '') + ext;
  // Tries: packages/tool/version.zip, packages/tool/version.tar.gz, etc.
}
```

**Problem**: Lambda looks for `{path}.zip` but MCP Scraper uploads to `{path}/` (directory).

---

## Database Schema (MCP Scraper)

```sql
-- MCPRepository table
CREATE TABLE mcp_repositories (
    id INTEGER PRIMARY KEY,
    repository_url TEXT UNIQUE NOT NULL,  -- https://github.com/owner/repo
    repo_name TEXT NOT NULL,               -- repo
    repo_owner TEXT NOT NULL,              -- owner
    s3_path TEXT,                          -- s3://bucket/mcps/owner/repo
    is_active BOOLEAN DEFAULT TRUE,
    first_discovered DATETIME,
    last_updated DATETIME
);

-- MCPMetadata table  
CREATE TABLE mcp_metadata (
    id INTEGER PRIMARY KEY,
    mcp_id INTEGER REFERENCES mcp_repositories(id),
    content_hash TEXT NOT NULL,            -- sha256:...
    file_count INTEGER,
    compressed_size INTEGER,
    deduplication_group_id INTEGER
);
```

**Note**: The `s3_path` currently stores paths like `s3://bucket/mcps/owner/name` (directory), not archive files.

---

## Proposed Solution Overview

To make these systems compatible, we need to modify the **MCP Scraper** to:

1. **Package repos as archives** (`.zip` or `.tar.gz`)
2. **Use Lambda-compatible S3 paths** (`packages/{tool}/latest.zip`)
3. **Generate manifest files** (`manifest.json`) during packaging
4. **Support versioning** (extract from `package.json`, `pyproject.toml`, or Git tags)

See `PROPOSED_CHANGES.md` for detailed implementation plan.

---

## File-by-File Impact Assessment

| File | Changes Required | Complexity |
|------|-----------------|------------|
| `repository_downloader.py` | Major rewrite - archive creation + new S3 paths | High |
| `s3_storage_manager.py` | Update S3 path handling, archive uploads | Medium |
| `models.py` | Add version field, archive_path field | Low |
| `config.py` | Add S3 path prefix configuration | Low |
| `metadata_extractor.py` | Extract version from package files | Medium |
| `decompressor.py` | Reverse into compressor for packaging | Medium |

---

## Risks and Considerations

1. **Existing Data Migration**: MCPs already uploaded in old format need re-processing
2. **Registry API Changes**: MCP Registry API format may change over time
3. **Large Repositories**: Some repos may be too large for Lambda's `/tmp` (10GB limit)
4. **npm dependencies**: Node.js packages need `npm install` before packaging
5. **Python dependencies**: Python packages may need `pip install` for dependencies

---

## Next Steps

1. Review `PROPOSED_CHANGES.md` for detailed implementation plan
2. Review `COMPATIBILITY_MATRIX.md` for feature comparison
3. Review `MIGRATION_STRATEGY.md` for transitioning existing data
4. Begin implementation with `Sprint_1.md` tasks
