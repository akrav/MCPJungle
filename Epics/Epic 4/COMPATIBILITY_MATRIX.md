# Epic 4: Compatibility Matrix

## System Comparison

This document provides a detailed comparison between the MCP Scraper and Lambda Adapter systems to ensure complete compatibility.

---

## S3 Structure Compatibility

| Feature | MCP Scraper (Current) | Lambda Adapter | Compatible? | Fix Required |
|---------|----------------------|----------------|-------------|--------------|
| Path prefix | `mcps/` | `packages/` | No | Change prefix |
| File structure | Directory of files | Single archive | No | Create archives |
| Versioning | None | `{version}.zip` | No | Add versioning |
| Latest pointer | N/A | `latest.zip` | No | Create latest |
| Tool naming | `{owner}/{name}` | `{tool_name}` | No | Generate names |

---

## Archive Format Compatibility

| Format | MCP Scraper | Lambda Adapter | Notes |
|--------|-------------|----------------|-------|
| `.zip` | Not used | Supported | Primary format |
| `.tar.gz` | Not used | Supported | Alternative |
| `.tgz` | Not used | Supported | Alias for tar.gz |
| `.mcpb` | Not used | Supported | MCP Bundle format |
| Uncompressed | Used | Not supported | Must change |

---

## Runtime Detection Compatibility

| Runtime | MCP Scraper Detection | Lambda Adapter Detection | Compatible? |
|---------|----------------------|--------------------------|-------------|
| Node.js | No detection | `package.json`, `node_modules/.bin/*` | Needs manifest |
| Python | No detection | `main.py`, `app.py`, `__main__.py` | Needs manifest |
| Binary | No detection | `manifest.json` with path | Needs manifest |
| Go | Not supported | Future (via manifest) | N/A |
| Rust | Not supported | Future (via manifest) | N/A |
| C# | Not supported | Future (via manifest) | N/A |

---

## Manifest File Compatibility

| Manifest Type | MCP Scraper | Lambda Adapter | Priority |
|---------------|-------------|----------------|----------|
| `manifest.json` | Not created | Primary (MCP Bundle) | 1 |
| `mcp.json` | Not created | Fallback (custom) | 2 |
| Heuristic | Not used | Fallback | 3 |

### manifest.json Requirements

```json
{
    "manifest_version": "0.1",       // Required
    "name": "tool-name",             // Required
    "version": "1.0.0",              // Required
    "server": {                      // Required
        "type": "python|node|binary",
        "command": "python3",        // Required
        "args": ["main.py"],         // Optional
        "env": {}                    // Optional
    }
}
```

---

## Data Flow Compatibility

### Current Flow (Broken)

```
MCP Registry → mcp_scraper → S3 (files) → Lambda (can't find)
     ↓              ↓             ↓              ↓
  API data     git clone     individual      expects
               rm .git        files         archive
```

### Target Flow (Compatible)

```
MCP Registry → mcp_scraper → S3 (archive) → Lambda (works!)
     ↓              ↓              ↓              ↓
  API data     git clone       .zip with      downloads
               npm install     manifest       extracts
               create archive                 executes
```

---

## Database Field Mapping

| Scraper Field | Lambda Usage | Compatible? | Notes |
|---------------|--------------|-------------|-------|
| `repository_url` | Not used | - | For tracking only |
| `repo_name` | Part of S3 path | Partial | Need tool_name |
| `repo_owner` | Part of S3 path | Partial | Need tool_name |
| `s3_path` | Used to download | No | Path format wrong |
| `content_hash` | Not used | - | For dedup |

### Required New Fields

| Field | Purpose | Lambda Usage |
|-------|---------|--------------|
| `tool_name` | Unique identifier | S3 path key |
| `current_version` | Latest version | Version in path |
| `runtime_type` | python/node/binary | For manifest |
| `archive_format` | zip/tar.gz | File extension |

---

## API Contract

### S3 Path Contract

Lambda expects paths in this format:
```
s3://{bucket}/packages/{tool_name}/{version}.{ext}
```

Where:
- `bucket`: Configured S3 bucket name
- `tool_name`: Unique identifier (lowercase, alphanumeric + hyphens)
- `version`: Semantic version or "latest"
- `ext`: One of `zip`, `tar.gz`, `tgz`, `mcpb`

### Archive Content Contract

Lambda expects archives to contain:
```
archive.zip/
├── manifest.json        # Preferred (runtime config)
├── mcp.json             # Alternative (legacy support)
├── package.json         # For Node.js (if no manifest)
├── node_modules/        # For Node.js (installed deps)
│   └── .bin/           # Executables
├── *.py                 # For Python
└── ... other files
```

---

## Environment Variables

### MCP Scraper Environment

| Variable | Purpose | Shared? |
|----------|---------|---------|
| `AWS_REGION` | S3 region | Yes |
| `AWS_BUCKET_NAME` | S3 bucket | Yes |
| `DB_PATH` | SQLite path | No |
| `LOG_LEVEL` | Logging | No |

### Lambda Adapter Environment

| Variable | Purpose | Shared? |
|----------|---------|---------|
| `AWS_REGION` | S3 region | Yes |
| `S3_BUCKET` | S3 bucket | Yes (different name) |
| `TOOL_CACHE_TTL` | Cache duration | No |
| `MAX_TOOL_SIZE_MB` | Size limit | No |

### Bucket Name Alignment

Both systems must use the same bucket. Current configs:
- MCP Scraper: `AWS_BUCKET_NAME` (default: `mcp-library`)
- Lambda Adapter: `S3_BUCKET` (default: `mcp-tools-...`)

**Action**: Align bucket configuration between systems.

---

## Feature Gap Analysis

| Feature | MCP Scraper Has | Lambda Needs | Gap |
|---------|-----------------|--------------|-----|
| Git clone | Yes | - | OK |
| Archive creation | No | Yes | Need to add |
| manifest.json | No | Yes | Need to add |
| npm install | No | Yes | Need to add |
| Version detection | No | Yes | Need to add |
| Tool naming | No | Yes | Need to add |
| S3 upload (archive) | No | Yes | Need to add |

---

## Testing Compatibility Checklist

### Pre-Integration Tests

- [ ] MCP Scraper creates valid `.zip` archives
- [ ] Archives contain valid `manifest.json`
- [ ] S3 paths follow `packages/{tool}/{version}.zip` format
- [ ] Tool names are unique and valid
- [ ] Version detection works for Node.js and Python
- [ ] `npm install` runs successfully for Node.js packages
- [ ] `latest.zip` symlink is created/updated

### Integration Tests

- [ ] Lambda can download archives created by Scraper
- [ ] Lambda can extract archives
- [ ] Lambda detects runtime from manifest
- [ ] Lambda spawns correct process
- [ ] End-to-end: Scraper → S3 → Lambda → Response

### Regression Tests

- [ ] Existing scraper database operations work
- [ ] Existing registry sync works
- [ ] Deduplication still functions
- [ ] Error handling preserved

---

## Migration Compatibility

### Existing Data

| Data Type | Migration Needed | Approach |
|-----------|------------------|----------|
| Database records | Yes | Add new fields |
| S3 files | Yes | Re-process repos |
| Config files | Yes | Update paths |

### Backward Compatibility

| Concern | Solution |
|---------|----------|
| Old S3 paths | Keep for reference, don't delete |
| Old DB schema | Migration script with defaults |
| Old configs | Support both old and new options |

---

## Recommended Implementation Order

1. **Phase 1**: Update S3 path structure
2. **Phase 2**: Add archive creation
3. **Phase 3**: Add manifest generation
4. **Phase 4**: Add version detection
5. **Phase 5**: Add npm install for Node.js
6. **Phase 6**: Integration testing
7. **Phase 7**: Migration of existing data

See `Sprint_*.md` files for detailed tasks.
