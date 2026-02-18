# Epic 4: MCP Scraper Integration Summary

## Overview

This epic documents the integration work required to make `mcp_scraper` compatible with the Lambda adapter developed in Epic 3.

## Problem Statement

The MCP Scraper and Lambda Adapter were developed independently with incompatible assumptions:

| Aspect | MCP Scraper (Before) | Lambda Adapter (Expects) |
|--------|---------------------|--------------------------|
| S3 Path | `mcps/{owner}/{name}/*` | `packages/{tool}/{version}.zip` |
| Format | Individual files | Single archive |
| Manifest | Not created | Required for runtime |
| Versioning | None | Version-based |

## Solution

Update MCP Scraper to produce packages compatible with Lambda adapter:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   MCP Registry   │────▶│   MCP Scraper    │────▶│   AWS Lambda     │
│   (Discovery)    │     │   (Packaging)    │     │   (Execution)    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                  │
                         ┌────────┴────────┐
                         │                 │
                    ┌────▼────┐       ┌────▼────┐
                    │  S3     │       │ SQLite  │
                    │packages/│       │  DB     │
                    └─────────┘       └─────────┘
```

## Documents Created

| Document | Purpose |
|----------|---------|
| `ANALYSIS.md` | Deep dive into compatibility issues |
| `PROPOSED_CHANGES.md` | Detailed code change proposals |
| `COMPATIBILITY_MATRIX.md` | Feature comparison table |
| `MIGRATION_STRATEGY.md` | Data migration plan |
| `Sprints/Sprint_1.md` | Database & utilities setup |
| `Sprints/Sprint_2.md` | Manifest generation |
| `Sprints/Sprint_3.md` | Downloader overhaul |
| `Sprints/Sprint_4.md` | Integration testing |

## Key Changes Required

### 1. New Modules
- `tool_naming.py` - Generate unique tool names
- `version_extractor.py` - Extract versions from packages
- `runtime_detector.py` - Detect Python/Node.js/Binary
- `manifest_generator.py` - Create manifest.json
- `archive_creator.py` - Package as .zip/.tar.gz
- `node_installer.py` - Install npm dependencies

### 2. Database Schema
```sql
ALTER TABLE mcp_repositories ADD COLUMN tool_name VARCHAR(255);
ALTER TABLE mcp_repositories ADD COLUMN current_version VARCHAR(50);
ALTER TABLE mcp_repositories ADD COLUMN archive_format VARCHAR(10);
ALTER TABLE mcp_repositories ADD COLUMN runtime_type VARCHAR(20);
ALTER TABLE mcp_repositories ADD COLUMN archive_s3_path VARCHAR(2048);
```

### 3. Repository Downloader
**Before**: Upload individual files to `mcps/{owner}/{name}/*`
**After**: Create archive and upload to `packages/{tool}/{version}.zip`

### 4. S3 Path Structure
```
s3://bucket/packages/
├── context7/
│   ├── 1.0.0.zip
│   └── latest.zip
├── mcp-server-memory/
│   ├── 2.0.0.zip
│   └── latest.zip
└── ...
```

## Estimated Timeline

| Sprint | Duration | Focus |
|--------|----------|-------|
| Sprint 1 | 2-3 hours | Database & utilities |
| Sprint 2 | 2-3 hours | Manifest generation |
| Sprint 3 | 2-3 hours | Downloader rewrite |
| Sprint 4 | 2-3 hours | Integration testing |
| **Total** | **8-12 hours** | **Full implementation** |

## Success Criteria

1. MCP Scraper creates `.zip` archives
2. Archives contain valid `manifest.json`
3. S3 paths follow `packages/{tool}/{version}.zip`
4. Lambda can download and execute packages
5. Full pipeline: Registry → Scraper → S3 → Lambda → User

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing data incompatible | High | Migration script, re-process |
| Large repos timeout | Medium | Increase Lambda timeout |
| npm install fails | Medium | Skip deps, log warning |
| Runtime detection fails | Medium | Fallback to heuristics |

## Next Steps

1. Backup existing database and S3 data
2. Implement Sprint 1 (database + utilities)
3. Implement Sprint 2 (manifest generation)
4. Implement Sprint 3 (downloader rewrite)
5. Implement Sprint 4 (integration testing)
6. Run migration on existing data
7. Monitor Lambda for compatibility

## Related Epics

- **Epic 3**: Lambda adapter development (prerequisite)
- **Epic 5** (Future): Scheduled scraping automation
- **Epic 6** (Future): MCP discovery dashboard
