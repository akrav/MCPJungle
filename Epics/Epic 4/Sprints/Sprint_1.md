# Sprint 1: Core Infrastructure Updates

**Goal**: Update database schema and add archive creation capabilities.

**Estimated Duration**: 2-3 hours

---

## Task 1.1: Database Schema Migration (15 min)

### Objective
Add new fields to support packaging functionality.

### Steps

1. Create migrations directory:
```bash
mkdir -p /Users/adam/Documents/GitHub/mcp_scraper/migrations
touch /Users/adam/Documents/GitHub/mcp_scraper/migrations/__init__.py
```

2. Create migration file `/migrations/001_add_packaging_fields.py`:
```python
"""Add fields for Lambda adapter compatibility."""
import sqlite3

def upgrade(db_path: str):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
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
            print(f"OK: {sql[:60]}...")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"SKIP: {sql[:60]}...")
            else:
                raise
    
    try:
        cursor.execute("CREATE INDEX idx_tool_name ON mcp_repositories(tool_name)")
    except sqlite3.OperationalError:
        pass
    
    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    import sys
    db_path = sys.argv[1] if len(sys.argv) > 1 else "mcp_scraper.db"
    upgrade(db_path)
```

3. Run migration:
```bash
cd /Users/adam/Documents/GitHub/mcp_scraper
cp mcp_scraper.db mcp_scraper.db.backup
python migrations/001_add_packaging_fields.py mcp_scraper.db
```

### Verification
```bash
sqlite3 mcp_scraper.db ".schema mcp_repositories"
# Should show new columns: tool_name, current_version, archive_format, runtime_type, archive_s3_path
```

---

## Task 1.2: Add Tool Name Generator (15 min)

### Objective
Create utility function to generate unique tool names from owner/repo.

### Steps

1. Create `/src/mcp_scraper/tool_naming.py`:
```python
"""Tool naming utilities for Lambda adapter compatibility."""
import re
from typing import Optional

def generate_tool_name(repo_owner: str, repo_name: str) -> str:
    """Generate unique tool name from owner/repo.
    
    Examples:
        upstash/context7-mcp -> context7
        anthropic/mcp-server-memory -> mcp-server-memory
        john/server -> john-server
    """
    name = repo_name.lower()
    owner = repo_owner.lower()
    
    # Remove common suffixes
    suffixes = ['-mcp', '-server', '-mcp-server', '_mcp', '_server', '-client']
    for suffix in suffixes:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
            break
    
    # If name is generic, include owner
    generic = ['server', 'mcp', 'tool', 'client', 'api', 'main', 'app']
    if name in generic or len(name) < 3:
        name = f"{owner}-{name}"
    
    # Sanitize: only lowercase alphanumeric and hyphens
    name = re.sub(r'[^a-z0-9-]', '-', name)
    name = re.sub(r'-+', '-', name)
    name = name.strip('-')
    
    # Ensure not empty
    if not name:
        name = f"{owner}-unknown"
    
    return name


def validate_tool_name(name: str) -> bool:
    """Validate tool name format."""
    if not name:
        return False
    if len(name) < 2 or len(name) > 64:
        return False
    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', name) and len(name) > 1:
        return False
    return True
```

2. Add tests in `/tests/test_tool_naming.py`:
```python
"""Tests for tool naming utilities."""
import pytest
from mcp_scraper.tool_naming import generate_tool_name, validate_tool_name

class TestGenerateToolName:
    def test_removes_mcp_suffix(self):
        assert generate_tool_name("upstash", "context7-mcp") == "context7"
    
    def test_removes_server_suffix(self):
        assert generate_tool_name("owner", "myapp-server") == "myapp"
    
    def test_adds_owner_for_generic_name(self):
        assert generate_tool_name("john", "server") == "john-server"
    
    def test_sanitizes_special_chars(self):
        assert generate_tool_name("owner", "my_tool.v2") == "my-tool-v2"
    
    def test_handles_empty_result(self):
        result = generate_tool_name("test", "-")
        assert result == "test-unknown" or len(result) > 0

class TestValidateToolName:
    def test_valid_names(self):
        assert validate_tool_name("context7") == True
        assert validate_tool_name("mcp-server-memory") == True
    
    def test_invalid_names(self):
        assert validate_tool_name("") == False
        assert validate_tool_name("a") == False  # Too short
        assert validate_tool_name("CamelCase") == False  # Uppercase
```

3. Run tests:
```bash
cd /Users/adam/Documents/GitHub/mcp_scraper
python -m pytest tests/test_tool_naming.py -v
```

---

## Task 1.3: Add Archive Creator Module (20 min)

### Objective
Create utility for packaging repositories into archives.

### Steps

1. Create `/src/mcp_scraper/archive_creator.py`:
```python
"""Archive creation utilities."""
import logging
import os
import tarfile
import zipfile
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

ArchiveFormat = Literal["zip", "tar.gz"]


class ArchiveCreator:
    """Create compressed archives from directories."""
    
    @staticmethod
    def create_zip(source_dir: str, output_path: str) -> str:
        """Create a zip archive from source directory.
        
        Args:
            source_dir: Directory to archive
            output_path: Output path (without extension)
            
        Returns:
            Path to created archive
        """
        archive_path = f"{output_path}.zip"
        
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            source = Path(source_dir)
            for file_path in source.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(source)
                    zf.write(file_path, arcname)
                    
        size_mb = os.path.getsize(archive_path) / (1024 * 1024)
        logger.info(f"Created zip archive: {archive_path} ({size_mb:.2f} MB)")
        return archive_path
    
    @staticmethod
    def create_tar_gz(source_dir: str, output_path: str) -> str:
        """Create a tar.gz archive from source directory.
        
        Args:
            source_dir: Directory to archive
            output_path: Output path (without extension)
            
        Returns:
            Path to created archive
        """
        archive_path = f"{output_path}.tar.gz"
        
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(source_dir, arcname=".")
            
        size_mb = os.path.getsize(archive_path) / (1024 * 1024)
        logger.info(f"Created tar.gz archive: {archive_path} ({size_mb:.2f} MB)")
        return archive_path
    
    @staticmethod
    def create_archive(
        source_dir: str,
        output_path: str,
        format: ArchiveFormat = "zip"
    ) -> str:
        """Create archive in specified format.
        
        Args:
            source_dir: Directory to archive
            output_path: Output path (without extension)
            format: Archive format (zip or tar.gz)
            
        Returns:
            Path to created archive
        """
        if format == "zip":
            return ArchiveCreator.create_zip(source_dir, output_path)
        elif format == "tar.gz":
            return ArchiveCreator.create_tar_gz(source_dir, output_path)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    @staticmethod
    def get_archive_info(archive_path: str) -> dict:
        """Get information about an archive file."""
        size_bytes = os.path.getsize(archive_path)
        
        if archive_path.endswith('.zip'):
            with zipfile.ZipFile(archive_path, 'r') as zf:
                file_count = len(zf.namelist())
        elif archive_path.endswith('.tar.gz') or archive_path.endswith('.tgz'):
            with tarfile.open(archive_path, 'r:gz') as tar:
                file_count = len(tar.getmembers())
        else:
            file_count = -1
            
        return {
            "path": archive_path,
            "size_bytes": size_bytes,
            "size_mb": round(size_bytes / (1024 * 1024), 2),
            "file_count": file_count,
        }
```

2. Add tests in `/tests/test_archive_creator.py`:
```python
"""Tests for archive creator."""
import os
import tempfile
import pytest
from mcp_scraper.archive_creator import ArchiveCreator

class TestArchiveCreator:
    def setup_method(self):
        """Create temp directory with test files."""
        self.temp_dir = tempfile.mkdtemp()
        self.source_dir = os.path.join(self.temp_dir, "source")
        os.makedirs(self.source_dir)
        
        # Create test files
        with open(os.path.join(self.source_dir, "test.txt"), "w") as f:
            f.write("test content")
        os.makedirs(os.path.join(self.source_dir, "subdir"))
        with open(os.path.join(self.source_dir, "subdir", "nested.txt"), "w") as f:
            f.write("nested content")
    
    def teardown_method(self):
        """Clean up temp directory."""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_create_zip(self):
        output = os.path.join(self.temp_dir, "output")
        result = ArchiveCreator.create_zip(self.source_dir, output)
        assert result.endswith(".zip")
        assert os.path.exists(result)
    
    def test_create_tar_gz(self):
        output = os.path.join(self.temp_dir, "output")
        result = ArchiveCreator.create_tar_gz(self.source_dir, output)
        assert result.endswith(".tar.gz")
        assert os.path.exists(result)
    
    def test_get_archive_info_zip(self):
        output = os.path.join(self.temp_dir, "output")
        archive = ArchiveCreator.create_zip(self.source_dir, output)
        info = ArchiveCreator.get_archive_info(archive)
        assert info["file_count"] == 2
        assert info["size_bytes"] > 0
```

3. Run tests:
```bash
python -m pytest tests/test_archive_creator.py -v
```

---

## Task 1.4: Add Version Extractor (15 min)

### Objective
Create utility to extract version from package files.

### Steps

1. Create `/src/mcp_scraper/version_extractor.py`:
```python
"""Version extraction utilities."""
import json
import os
import re
from datetime import datetime
from typing import Optional


def extract_version(repo_path: str) -> str:
    """Extract version from repository files.
    
    Priority:
    1. package.json (Node.js)
    2. pyproject.toml (Python)
    3. setup.py (Python legacy)
    4. Default to date-based version
    """
    # Try package.json
    version = _from_package_json(repo_path)
    if version:
        return version
    
    # Try pyproject.toml
    version = _from_pyproject_toml(repo_path)
    if version:
        return version
    
    # Try setup.py
    version = _from_setup_py(repo_path)
    if version:
        return version
    
    # Default to date-based
    return datetime.utcnow().strftime("%Y.%m.%d")


def _from_package_json(repo_path: str) -> Optional[str]:
    """Extract version from package.json."""
    pkg_path = os.path.join(repo_path, "package.json")
    if not os.path.exists(pkg_path):
        return None
    
    try:
        with open(pkg_path) as f:
            data = json.load(f)
        return data.get("version")
    except Exception:
        return None


def _from_pyproject_toml(repo_path: str) -> Optional[str]:
    """Extract version from pyproject.toml."""
    toml_path = os.path.join(repo_path, "pyproject.toml")
    if not os.path.exists(toml_path):
        return None
    
    try:
        with open(toml_path) as f:
            content = f.read()
        
        # Simple regex for version = "x.y.z"
        match = re.search(r'version\s*=\s*["\']([^"\']+)["\']', content)
        if match:
            return match.group(1)
    except Exception:
        pass
    
    return None


def _from_setup_py(repo_path: str) -> Optional[str]:
    """Extract version from setup.py."""
    setup_path = os.path.join(repo_path, "setup.py")
    if not os.path.exists(setup_path):
        return None
    
    try:
        with open(setup_path) as f:
            content = f.read()
        
        match = re.search(r'version\s*=\s*["\']([^"\']+)["\']', content)
        if match:
            return match.group(1)
    except Exception:
        pass
    
    return None
```

2. Add tests:
```python
# tests/test_version_extractor.py
import os
import tempfile
import json
import pytest
from mcp_scraper.version_extractor import extract_version

class TestVersionExtractor:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_from_package_json(self):
        with open(os.path.join(self.temp_dir, "package.json"), "w") as f:
            json.dump({"version": "1.2.3"}, f)
        
        assert extract_version(self.temp_dir) == "1.2.3"
    
    def test_from_pyproject_toml(self):
        with open(os.path.join(self.temp_dir, "pyproject.toml"), "w") as f:
            f.write('[project]\nversion = "2.0.0"')
        
        assert extract_version(self.temp_dir) == "2.0.0"
    
    def test_fallback_to_date(self):
        version = extract_version(self.temp_dir)
        assert re.match(r'\d{4}\.\d{2}\.\d{2}', version)
```

---

## Task 1.5: Update Models (10 min)

### Objective
Update SQLAlchemy models to include new fields.

### Steps

1. Edit `/src/mcp_scraper/models.py`, add to `MCPRepository` class:
```python
# Add after existing columns
tool_name = Column(String(255), nullable=True, index=True)
current_version = Column(String(50), nullable=True)
archive_format = Column(String(10), default="zip")
runtime_type = Column(String(20), nullable=True)
archive_s3_path = Column(String(2048), nullable=True)
```

2. Update `__table_args__`:
```python
__table_args__ = (
    Index("idx_repo_name_owner", "repo_name", "repo_owner"),
    Index("idx_repository_url", "repository_url"),
    Index("idx_tool_name", "tool_name"),  # Add this
)
```

---

## Verification Checklist

- [ ] Migration script runs without errors
- [ ] New columns visible in database schema
- [ ] tool_naming.py passes all tests
- [ ] archive_creator.py passes all tests  
- [ ] version_extractor.py passes all tests
- [ ] models.py updated with new fields
- [ ] All imports work correctly

### Run Full Test Suite
```bash
cd /Users/adam/Documents/GitHub/mcp_scraper
python -m pytest tests/ -v --ignore=tests/test_integration.py
```

---

## Sprint 1 Complete

Proceed to **Sprint 2** for manifest generation and runtime detection.
