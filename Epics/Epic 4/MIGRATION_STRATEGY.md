# Epic 4: Migration Strategy

## Overview

This document outlines the strategy for migrating existing MCP Scraper data and infrastructure to be compatible with the Lambda adapter.

---

## Current State Assessment

### Database (SQLite)
- **File**: `mcp_scraper.db`
- **Tables**: `mcp_repositories`, `mcp_metadata`, `download_logs`
- **Records**: Varies (depends on sync history)

### S3 Storage
- **Bucket**: `mcp-library` (or configured bucket)
- **Structure**: `mcps/{owner}/{name}/*` (individual files)
- **Size**: Varies per repository

### Code
- **Repository**: `mcp_scraper` 
- **Entry point**: `main.py`
- **Dependencies**: Poetry-managed

---

## Migration Phases

### Phase 1: Database Schema Migration

**Goal**: Add new fields while preserving existing data.

#### Step 1.1: Create Migration Script

```python
# migrations/001_add_packaging_fields.py
import sqlite3
from datetime import datetime

def upgrade(db_path: str):
    """Add new fields for packaging support."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Add new columns to mcp_repositories
    migrations = [
        "ALTER TABLE mcp_repositories ADD COLUMN tool_name VARCHAR(255)",
        "ALTER TABLE mcp_repositories ADD COLUMN current_version VARCHAR(50)",
        "ALTER TABLE mcp_repositories ADD COLUMN archive_format VARCHAR(10) DEFAULT 'zip'",
        "ALTER TABLE mcp_repositories ADD COLUMN runtime_type VARCHAR(20)",
        "ALTER TABLE mcp_repositories ADD COLUMN archive_s3_path VARCHAR(2048)",
    ]
    
    for sql in migrations:
        try:
            cursor.execute(sql)
            print(f"Executed: {sql[:50]}...")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"Skipped (exists): {sql[:50]}...")
            else:
                raise
    
    # Create index for tool_name
    try:
        cursor.execute("CREATE INDEX idx_tool_name ON mcp_repositories(tool_name)")
    except sqlite3.OperationalError:
        pass  # Index exists
    
    conn.commit()
    conn.close()
    print("Migration complete!")


def downgrade(db_path: str):
    """Remove new fields (SQLite doesn't support DROP COLUMN easily)."""
    # For SQLite, we'd need to recreate the table
    # In practice, just leave the columns
    pass
```

#### Step 1.2: Run Migration

```bash
# Backup first!
cp mcp_scraper.db mcp_scraper.db.backup.$(date +%Y%m%d)

# Run migration
python -c "from migrations.add_packaging_fields import upgrade; upgrade('mcp_scraper.db')"
```

---

### Phase 2: Generate Tool Names for Existing Records

**Goal**: Populate `tool_name` field for all existing repositories.

```python
# migrations/002_populate_tool_names.py
import sqlite3
import re

def generate_tool_name(repo_owner: str, repo_name: str) -> str:
    """Generate unique tool name from owner/repo."""
    name = repo_name.lower()
    
    # Remove common suffixes
    for suffix in ['-mcp', '-server', '-mcp-server', '_mcp', '_server']:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
            break
    
    # If name is generic, include owner
    generic_names = ['server', 'mcp', 'tool', 'client', 'api']
    if name in generic_names or len(name) < 3:
        name = f"{repo_owner.lower()}-{name}"
    
    # Sanitize
    name = re.sub(r'[^a-z0-9-]', '-', name)
    name = re.sub(r'-+', '-', name).strip('-')
    
    return name


def populate_tool_names(db_path: str):
    """Generate tool_name for all repositories."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all repos without tool_name
    cursor.execute("""
        SELECT id, repo_owner, repo_name 
        FROM mcp_repositories 
        WHERE tool_name IS NULL OR tool_name = ''
    """)
    rows = cursor.fetchall()
    
    # Track used names for uniqueness
    cursor.execute("SELECT tool_name FROM mcp_repositories WHERE tool_name IS NOT NULL")
    used_names = {row[0] for row in cursor.fetchall()}
    
    updated = 0
    for repo_id, owner, name in rows:
        tool_name = generate_tool_name(owner, name)
        
        # Ensure uniqueness
        base_name = tool_name
        counter = 1
        while tool_name in used_names:
            tool_name = f"{base_name}-{counter}"
            counter += 1
        
        used_names.add(tool_name)
        
        cursor.execute(
            "UPDATE mcp_repositories SET tool_name = ? WHERE id = ?",
            (tool_name, repo_id)
        )
        updated += 1
        print(f"Set tool_name for {owner}/{name}: {tool_name}")
    
    conn.commit()
    conn.close()
    print(f"Updated {updated} repositories with tool names")
```

---

### Phase 3: Re-process Existing Repositories

**Goal**: Create archives for repositories already cloned.

#### Option A: Re-download All (Recommended for clean start)

```python
# migrations/003_reprocess_repositories.py
def reprocess_all(db_path: str, dry_run: bool = True):
    """Re-download and package all repositories."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all repositories
    cursor.execute("""
        SELECT id, repository_url, repo_owner, repo_name, tool_name
        FROM mcp_repositories
        WHERE is_active = 1
    """)
    repos = cursor.fetchall()
    
    print(f"Found {len(repos)} repositories to reprocess")
    
    if dry_run:
        print("DRY RUN - no changes will be made")
        for repo_id, url, owner, name, tool_name in repos:
            print(f"  Would reprocess: {owner}/{name} -> {tool_name}")
        return
    
    # Use the new downloader
    from mcp_scraper.repository_downloader import RepositoryDownloader
    downloader = RepositoryDownloader()
    
    success = 0
    failed = 0
    
    for repo_id, url, owner, name, tool_name in repos:
        try:
            result = downloader.download_and_package(
                repository_url=url,
                mcp_name=name,
                repo_owner=owner
            )
            
            # Update database
            cursor.execute("""
                UPDATE mcp_repositories 
                SET archive_s3_path = ?, 
                    current_version = ?,
                    runtime_type = ?
                WHERE id = ?
            """, (
                result['s3_path'],
                result['version'],
                result.get('runtime_type'),
                repo_id
            ))
            conn.commit()
            
            success += 1
            print(f"Reprocessed: {owner}/{name} -> {result['s3_path']}")
            
        except Exception as e:
            failed += 1
            print(f"Failed: {owner}/{name} - {e}")
    
    print(f"\nReprocessing complete: {success} success, {failed} failed")
    conn.close()
```

#### Option B: Incremental Migration (During normal operation)

Add flag to scraper to migrate on next download:

```python
# In repository_downloader.py
def store_mcp(self, mcp_record: dict) -> dict:
    """Store MCP with new packaging format."""
    # Use new download_and_package method
    result = self.download_and_package(
        repository_url=mcp_record['repository_url'],
        mcp_name=mcp_record['repo_name'],
        repo_owner=mcp_record['repo_owner']
    )
    
    # Update database with new format
    # ...
```

---

### Phase 4: S3 Bucket Alignment

**Goal**: Ensure both systems use the same S3 bucket and path structure.

#### Step 4.1: Verify Bucket Configuration

```bash
# MCP Scraper config
grep AWS_BUCKET_NAME .env
# Expected: mcp-tools-20260105013158332400000001 (or similar)

# Lambda config (from Terraform)
aws lambda get-function-configuration --function-name mcp-adapter \
  --query 'Environment.Variables.S3_BUCKET'
```

#### Step 4.2: Update MCP Scraper Config

```bash
# .env
AWS_BUCKET_NAME=mcp-tools-20260105013158332400000001
S3_PATH_PREFIX=packages
```

#### Step 4.3: IAM Permissions

Ensure MCP Scraper has permissions to write to Lambda's bucket:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::mcp-tools-*",
                "arn:aws:s3:::mcp-tools-*/*"
            ]
        }
    ]
}
```

---

### Phase 5: Cleanup Old Data (Optional)

**Goal**: Remove deprecated S3 structure after migration verified.

```python
# migrations/005_cleanup_old_s3.py (RUN AFTER VERIFICATION)
def cleanup_old_structure(bucket_name: str, dry_run: bool = True):
    """Remove old mcps/ prefix from S3."""
    import boto3
    
    s3 = boto3.client('s3')
    
    # List objects under old prefix
    paginator = s3.get_paginator('list_objects_v2')
    old_objects = []
    
    for page in paginator.paginate(Bucket=bucket_name, Prefix='mcps/'):
        for obj in page.get('Contents', []):
            old_objects.append(obj['Key'])
    
    print(f"Found {len(old_objects)} objects under mcps/ prefix")
    
    if dry_run:
        print("DRY RUN - no deletions")
        for key in old_objects[:10]:
            print(f"  Would delete: {key}")
        if len(old_objects) > 10:
            print(f"  ... and {len(old_objects) - 10} more")
        return
    
    # Delete in batches of 1000
    for i in range(0, len(old_objects), 1000):
        batch = old_objects[i:i+1000]
        delete_request = {
            'Objects': [{'Key': key} for key in batch]
        }
        s3.delete_objects(Bucket=bucket_name, Delete=delete_request)
        print(f"Deleted batch {i//1000 + 1}")
    
    print("Cleanup complete!")
```

---

## Migration Checklist

### Pre-Migration
- [ ] Backup database: `cp mcp_scraper.db mcp_scraper.db.backup`
- [ ] Note current S3 bucket contents
- [ ] Verify AWS credentials work for both systems
- [ ] Review bucket permissions

### Database Migration
- [ ] Run schema migration (Phase 1)
- [ ] Verify new columns exist
- [ ] Populate tool_names (Phase 2)
- [ ] Verify unique tool names

### Code Updates
- [ ] Update `repository_downloader.py`
- [ ] Add manifest generation
- [ ] Add archive creation
- [ ] Update S3 paths
- [ ] Run unit tests

### Data Migration
- [ ] Choose Option A or B for reprocessing
- [ ] Reprocess subset (10 repos) as test
- [ ] Verify Lambda can load test packages
- [ ] Reprocess all repositories
- [ ] Verify all packages load correctly

### Integration Verification
- [ ] Lambda can download from new paths
- [ ] Lambda can extract new archives
- [ ] Lambda detects runtime correctly
- [ ] End-to-end test passes

### Post-Migration
- [ ] Monitor Lambda for errors
- [ ] (Optional) Clean up old S3 structure
- [ ] Update documentation
- [ ] Archive migration scripts

---

## Rollback Plan

### If Database Migration Fails
```bash
# Restore from backup
cp mcp_scraper.db.backup mcp_scraper.db
```

### If S3 Migration Fails
- Old data preserved at `mcps/` prefix
- New data at `packages/` prefix
- Can revert Lambda config to use old paths (not recommended)

### If Lambda Breaks
```bash
# Check Lambda logs
aws logs tail /aws/lambda/mcp-adapter --follow

# Rollback Lambda code if needed
# (Keep previous Docker image tagged)
```

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1 | 1 hour | Schema migration |
| Phase 2 | 1 hour | Tool name generation |
| Phase 3 | 4-8 hours | Repository reprocessing (depends on count) |
| Phase 4 | 1 hour | Bucket alignment |
| Phase 5 | 1 hour | Cleanup (optional) |
| Testing | 2-4 hours | Integration verification |

**Total**: 1-2 days for complete migration

---

## Verification Queries

### Check Migration Status
```sql
-- Count migrated vs pending
SELECT 
    COUNT(*) as total,
    COUNT(tool_name) as has_tool_name,
    COUNT(archive_s3_path) as has_archive,
    COUNT(*) - COUNT(archive_s3_path) as pending
FROM mcp_repositories
WHERE is_active = 1;
```

### Check for Duplicate Tool Names
```sql
SELECT tool_name, COUNT(*) as count
FROM mcp_repositories
WHERE tool_name IS NOT NULL
GROUP BY tool_name
HAVING COUNT(*) > 1;
```

### Verify S3 Structure
```bash
# List new package structure
aws s3 ls s3://mcp-tools-xxx/packages/ --recursive | head -20

# Count packages
aws s3 ls s3://mcp-tools-xxx/packages/ | wc -l
```
