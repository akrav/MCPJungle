# Sprint 3: Repository Downloader Overhaul

**Goal**: Update repository_downloader.py to create archives compatible with Lambda adapter.

**Estimated Duration**: 2-3 hours

**Prerequisites**: Sprint 1 and Sprint 2 complete

---

## Task 3.1: Refactor Repository Downloader (30 min)

### Objective
Replace individual file uploads with archive-based workflow.

### Steps

1. Backup existing file:
```bash
cp /Users/adam/Documents/GitHub/mcp_scraper/src/mcp_scraper/repository_downloader.py \
   /Users/adam/Documents/GitHub/mcp_scraper/src/mcp_scraper/repository_downloader.py.backup
```

2. Rewrite `/src/mcp_scraper/repository_downloader.py`:
```python
"""Repository downloader module for cloning MCPs and uploading to S3."""

import hashlib
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from .aws_client import S3Client, S3OperationError, get_s3_client
from .archive_creator import ArchiveCreator
from .manifest_generator import ManifestGenerator
from .runtime_detector import detect_runtime
from .tool_naming import generate_tool_name
from .version_extractor import extract_version
from .node_installer import install_node_dependencies, check_node_available

logger = logging.getLogger(__name__)


class RepositoryDownloadError(Exception):
    """Base exception for repository download errors."""
    pass


class GitNotAvailableError(RepositoryDownloadError):
    """Raised when git command is not available on the system."""
    pass


class GitCloneError(RepositoryDownloadError):
    """Raised when git clone operation fails."""
    pass


class S3UploadError(RepositoryDownloadError):
    """Raised when S3 upload operation fails."""
    pass


class PackagingError(RepositoryDownloadError):
    """Raised when packaging fails."""
    pass


class RepositoryDownloader:
    """Download and package MCP repositories for Lambda adapter."""

    # S3 path prefix for packages
    S3_PREFIX = "packages"
    
    # Default archive format
    DEFAULT_FORMAT = "zip"

    def __init__(
        self,
        temp_dir: Optional[str] = None,
        s3_client: Optional[S3Client] = None,
        install_node_deps: bool = True,
        generate_manifest: bool = True,
    ):
        """Initialize repository downloader.

        Args:
            temp_dir: Optional custom temporary directory
            s3_client: Optional S3Client instance
            install_node_deps: Whether to install Node.js dependencies
            generate_manifest: Whether to generate manifest.json
        """
        self.temp_dir = temp_dir or tempfile.gettempdir()
        self.s3_client = s3_client or get_s3_client()
        self.install_node_deps = install_node_deps
        self.generate_manifest = generate_manifest

    def verify_git_available(self) -> bool:
        """Check if git command is available."""
        try:
            result = subprocess.run(
                ["git", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.returncode == 0
        except Exception:
            return False

    def calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of a file."""
        try:
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    sha256_hash.update(chunk)
            return f"sha256:{sha256_hash.hexdigest()}"
        except Exception as e:
            raise RepositoryDownloadError(f"Failed to calculate hash: {e}") from e

    def download_and_package(
        self,
        repository_url: str,
        mcp_name: str,
        repo_owner: str,
        version: Optional[str] = None,
        archive_format: str = None,
    ) -> dict:
        """Download repository, package it, and upload to S3.

        Complete workflow:
        1. Clone repository with git
        2. Remove .git directory
        3. Detect runtime and generate tool name
        4. Install dependencies (Node.js only)
        5. Generate manifest.json if needed
        6. Create compressed archive
        7. Upload to S3 as packages/{tool_name}/{version}.zip
        8. Also upload as packages/{tool_name}/latest.zip

        Args:
            repository_url: Git HTTPS URL to clone
            mcp_name: Name of the MCP repository
            repo_owner: Owner/organization of the repository
            version: Optional version (auto-detected if not provided)
            archive_format: Archive format (zip or tar.gz)

        Returns:
            Dictionary with keys:
            - s3_path: S3 base path (s3://bucket/packages/tool_name)
            - version: Package version
            - tool_name: Generated tool name
            - content_hash: SHA256 hash of archive
            - size_bytes: Archive size in bytes
            - runtime_type: Detected runtime type

        Raises:
            GitNotAvailableError: If git is not available
            GitCloneError: If git clone fails
            PackagingError: If packaging fails
            S3UploadError: If S3 upload fails
        """
        if not self.verify_git_available():
            raise GitNotAvailableError("Git command is not available")

        archive_format = archive_format or self.DEFAULT_FORMAT
        download_dir = None

        try:
            # Create working directory
            download_dir = tempfile.mkdtemp(dir=self.temp_dir)
            repo_path = os.path.join(download_dir, "repo")

            # Clone repository
            logger.info(f"Cloning {repository_url}")
            result = subprocess.run(
                ["git", "clone", "--depth", "1", repository_url, repo_path],
                capture_output=True,
                text=True,
                timeout=300,
            )

            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown error"
                logger.error(f"Git clone failed: {error_msg}")
                raise GitCloneError(f"Clone failed: {error_msg}")

            # Remove .git directory
            git_dir = os.path.join(repo_path, ".git")
            if os.path.exists(git_dir):
                shutil.rmtree(git_dir)
                logger.debug("Removed .git directory")

            # Generate tool name
            tool_name = generate_tool_name(repo_owner, mcp_name)
            logger.info(f"Generated tool name: {tool_name}")

            # Extract version
            if version is None:
                version = extract_version(repo_path)
            logger.info(f"Package version: {version}")

            # Detect runtime
            runtime_config = detect_runtime(repo_path)
            runtime_type = runtime_config.runtime_type
            logger.info(f"Detected runtime: {runtime_type}")

            # Install Node.js dependencies if needed
            if self.install_node_deps and runtime_type == "node":
                if check_node_available():
                    logger.info("Installing Node.js dependencies...")
                    success, error = install_node_dependencies(repo_path)
                    if not success:
                        logger.warning(f"Node.js dependency install failed: {error}")
                else:
                    logger.warning("Node.js not available, skipping dependency install")

            # Generate manifest.json if needed
            if self.generate_manifest:
                manifest_path = os.path.join(repo_path, "manifest.json")
                if not os.path.exists(manifest_path):
                    logger.info("Generating manifest.json...")
                    ManifestGenerator.generate_and_write(
                        repo_path,
                        tool_name,
                        repository_url,
                        version
                    )

            # Create archive
            logger.info(f"Creating {archive_format} archive...")
            archive_base = os.path.join(download_dir, tool_name)
            archive_path = ArchiveCreator.create_archive(
                repo_path, archive_base, archive_format
            )

            # Calculate hash and size
            content_hash = self.calculate_file_hash(archive_path)
            size_bytes = os.path.getsize(archive_path)
            logger.info(f"Archive created: {size_bytes / (1024*1024):.2f} MB")

            # Determine file extension
            ext = ".zip" if archive_format == "zip" else ".tar.gz"

            # Upload versioned archive
            s3_key_versioned = f"{self.S3_PREFIX}/{tool_name}/{version}{ext}"
            logger.info(f"Uploading to {s3_key_versioned}")
            try:
                self.s3_client.upload_file(archive_path, s3_key_versioned)
            except S3OperationError as e:
                raise S3UploadError(f"Failed to upload versioned archive: {e}") from e

            # Upload latest archive
            s3_key_latest = f"{self.S3_PREFIX}/{tool_name}/latest{ext}"
            logger.info(f"Uploading to {s3_key_latest}")
            try:
                self.s3_client.upload_file(archive_path, s3_key_latest)
            except S3OperationError as e:
                raise S3UploadError(f"Failed to upload latest archive: {e}") from e

            s3_path = f"s3://{self.s3_client.bucket_name}/{self.S3_PREFIX}/{tool_name}"
            logger.info(f"Upload complete: {s3_path}")

            return {
                "s3_path": s3_path,
                "version": version,
                "tool_name": tool_name,
                "content_hash": content_hash,
                "size_bytes": size_bytes,
                "runtime_type": runtime_type,
                "archive_format": archive_format,
            }

        except (GitNotAvailableError, GitCloneError, S3UploadError):
            raise
        except Exception as e:
            logger.error(f"Packaging failed: {e}")
            raise PackagingError(f"Packaging failed: {e}") from e
        finally:
            # Clean up
            if download_dir and os.path.exists(download_dir):
                try:
                    shutil.rmtree(download_dir)
                    logger.debug(f"Cleaned up: {download_dir}")
                except Exception as e:
                    logger.warning(f"Cleanup failed: {e}")

    # Legacy method for backwards compatibility
    def download_and_upload(
        self,
        repository_url: str,
        mcp_name: str,
        repo_owner: str,
    ) -> dict:
        """Legacy method - wraps download_and_package for compatibility.
        
        Note: This method returns a slightly different format than before.
        The s3_path now points to the package directory, not individual files.
        """
        result = self.download_and_package(
            repository_url=repository_url,
            mcp_name=mcp_name,
            repo_owner=repo_owner,
        )
        
        # Return in legacy format
        return {
            "s3_path": result["s3_path"],
            "size_bytes": result["size_bytes"],
            "content_hash": result["content_hash"],
            # Legacy field name
            "file_count": 1,  # Now a single archive file
        }


__all__ = [
    "RepositoryDownloader",
    "RepositoryDownloadError",
    "GitNotAvailableError",
    "GitCloneError",
    "S3UploadError",
    "PackagingError",
]
```

---

## Task 3.2: Update S3 Storage Manager (20 min)

### Objective
Update S3StorageManager to use new downloader and track new fields.

### Steps

1. Update `/src/mcp_scraper/s3_storage_manager.py`:
```python
"""S3 storage manager for organizing, uploading, and tracking MCP repositories."""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.exc import IntegrityError

from .aws_client import S3Client, get_s3_client
from .db import get_session
from .models import MCPMetadata, MCPRepository
from .repository_downloader import (
    RepositoryDownloadError,
    RepositoryDownloader,
)

logger = logging.getLogger(__name__)


class StorageError(Exception):
    """Base exception for storage operations."""
    pass


class StorageNotFoundError(StorageError):
    """Raised when a stored MCP is not found."""
    pass


class StorageDatabaseError(StorageError):
    """Raised when database operations fail."""
    pass


class S3StorageManager:
    """Manage S3 storage for MCP repositories with database tracking."""

    def __init__(
        self,
        repository_downloader: Optional[RepositoryDownloader] = None,
        s3_client: Optional[S3Client] = None,
    ):
        """Initialize S3 storage manager."""
        self.repository_downloader = repository_downloader or RepositoryDownloader()
        self.s3_client = s3_client or get_s3_client()

    def store_mcp(self, mcp_record: dict) -> dict:
        """Store an MCP in S3 and track metadata in database.

        Uses new archive-based workflow:
        1. Check if MCP already stored (skip if exists with archive)
        2. Download, package, and upload via repository_downloader
        3. Update database with new fields (tool_name, version, etc.)

        Args:
            mcp_record: Normalized MCP record with:
                - repository_url: Git HTTPS URL
                - repo_name: Name of repository
                - repo_owner: Owner/organization

        Returns:
            Dictionary with keys:
            - repository_url: The URL of the repository
            - s3_path: S3 URI where MCP package is stored
            - tool_name: Generated tool name
            - version: Package version
            - status: "stored" or "skipped"
        """
        repository_url = mcp_record.get("repository_url")
        repo_name = mcp_record.get("repo_name")
        repo_owner = mcp_record.get("repo_owner")

        if not repository_url or not repo_name or not repo_owner:
            raise StorageError(
                "MCP record missing required fields: repository_url, repo_name, repo_owner"
            )

        # Check if already stored with archive
        with get_session() as session:
            existing = session.query(MCPRepository).filter_by(
                repository_url=repository_url
            ).first()
            
            # Check for archive_s3_path (new field) or s3_path with /packages/ prefix
            if existing:
                archive_path = getattr(existing, 'archive_s3_path', None) or existing.s3_path
                if archive_path and '/packages/' in str(archive_path):
                    logger.info(f"MCP {repo_name} already stored at {archive_path}")
                    return {
                        "repository_url": repository_url,
                        "s3_path": archive_path,
                        "tool_name": getattr(existing, 'tool_name', None),
                        "version": getattr(existing, 'current_version', None),
                        "status": "skipped",
                    }

        # Download, package, and upload
        try:
            logger.info(f"Processing MCP: {repo_owner}/{repo_name}")
            download_result = self.repository_downloader.download_and_package(
                repository_url=repository_url,
                mcp_name=repo_name,
                repo_owner=repo_owner,
            )
        except RepositoryDownloadError as e:
            logger.error(f"Failed to process MCP {repo_name}: {e}")
            raise StorageError(f"Failed to process MCP: {e}") from e

        s3_path = download_result["s3_path"]
        tool_name = download_result["tool_name"]
        version = download_result["version"]
        content_hash = download_result["content_hash"]
        size_bytes = download_result["size_bytes"]
        runtime_type = download_result.get("runtime_type")

        # Store metadata in database
        try:
            with get_session() as session:
                repo = session.query(MCPRepository).filter_by(
                    repository_url=repository_url
                ).first()

                if repo is None:
                    repo = MCPRepository(
                        repository_url=repository_url,
                        repo_name=repo_name,
                        repo_owner=repo_owner,
                        s3_path=s3_path,
                        last_updated=datetime.utcnow(),
                    )
                    session.add(repo)
                else:
                    repo.s3_path = s3_path
                    repo.last_updated = datetime.utcnow()

                # Update new fields (check if they exist in model)
                if hasattr(repo, 'tool_name'):
                    repo.tool_name = tool_name
                if hasattr(repo, 'current_version'):
                    repo.current_version = version
                if hasattr(repo, 'runtime_type'):
                    repo.runtime_type = runtime_type
                if hasattr(repo, 'archive_s3_path'):
                    repo.archive_s3_path = s3_path

                session.flush()

                # Create metadata record
                metadata = MCPMetadata(
                    mcp_id=repo.id,
                    content_hash=content_hash,
                    file_count=1,  # Single archive file
                    compressed_size=size_bytes,
                )
                session.add(metadata)

                session.commit()
                logger.info(f"Stored MCP {repo_name} ({tool_name} v{version}) at {s3_path}")

        except IntegrityError as e:
            logger.error(f"Database constraint error for {repo_name}: {e}")
            raise StorageDatabaseError(f"Database constraint error: {e}") from e
        except Exception as e:
            logger.error(f"Failed to store MCP metadata for {repo_name}: {e}")
            raise StorageDatabaseError(f"Failed to store metadata: {e}") from e

        return {
            "repository_url": repository_url,
            "s3_path": s3_path,
            "tool_name": tool_name,
            "version": version,
            "status": "stored",
        }

    # Keep other methods (get_mcp_storage_info, list_stored_mcps, batch_store_mcps)
    # ... existing code ...
```

---

## Task 3.3: Update Tests for Repository Downloader (20 min)

### Objective
Update tests to reflect new archive-based workflow.

### Steps

1. Update `/tests/test_repository_downloader.py`:
```python
"""Tests for repository downloader."""
import os
import json
import tempfile
import shutil
import pytest
from unittest.mock import Mock, patch, MagicMock

from mcp_scraper.repository_downloader import (
    RepositoryDownloader,
    GitNotAvailableError,
    GitCloneError,
    S3UploadError,
    PackagingError,
)


class TestRepositoryDownloader:
    """Tests for RepositoryDownloader class."""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.mock_s3 = Mock()
        self.mock_s3.bucket_name = "test-bucket"
        self.mock_s3.upload_file = Mock(return_value=None)
        
        self.downloader = RepositoryDownloader(
            temp_dir=self.temp_dir,
            s3_client=self.mock_s3,
            install_node_deps=False,  # Don't try to install in tests
        )

    def teardown_method(self):
        shutil.rmtree(self.temp_dir)

    def test_verify_git_available(self):
        """Test git availability check."""
        # This depends on system having git installed
        result = self.downloader.verify_git_available()
        assert isinstance(result, bool)

    def test_calculate_file_hash(self):
        """Test file hash calculation."""
        test_file = os.path.join(self.temp_dir, "test.txt")
        with open(test_file, "w") as f:
            f.write("test content")
        
        hash_result = self.downloader.calculate_file_hash(test_file)
        assert hash_result.startswith("sha256:")
        assert len(hash_result) == 71  # sha256: + 64 hex chars

    @patch('subprocess.run')
    def test_git_not_available(self, mock_run):
        """Test error when git is not available."""
        mock_run.return_value = Mock(returncode=1)
        
        downloader = RepositoryDownloader(
            temp_dir=self.temp_dir,
            s3_client=self.mock_s3
        )
        
        with pytest.raises(GitNotAvailableError):
            downloader.download_and_package(
                "https://github.com/test/repo",
                "repo",
                "test"
            )

    @patch('subprocess.run')
    def test_git_clone_failure(self, mock_run):
        """Test error when git clone fails."""
        # First call succeeds (git --version), second fails (clone)
        mock_run.side_effect = [
            Mock(returncode=0),  # git --version
            Mock(returncode=1, stderr="Clone failed", stdout=""),  # git clone
        ]
        
        downloader = RepositoryDownloader(
            temp_dir=self.temp_dir,
            s3_client=self.mock_s3
        )
        
        with pytest.raises(GitCloneError) as exc_info:
            downloader.download_and_package(
                "https://github.com/test/repo",
                "repo",
                "test"
            )
        assert "Clone failed" in str(exc_info.value)

    def test_s3_path_format(self):
        """Test that S3 paths use correct format."""
        assert RepositoryDownloader.S3_PREFIX == "packages"

    @patch('subprocess.run')
    def test_successful_download_and_package(self, mock_run):
        """Test successful download and package workflow."""
        # Create a fake cloned repo
        repo_path = os.path.join(self.temp_dir, "fake_clone")
        os.makedirs(repo_path)
        
        # Create main.py to trigger Python runtime detection
        with open(os.path.join(repo_path, "main.py"), "w") as f:
            f.write("print('hello')")
        
        # Mock git commands
        def run_side_effect(cmd, **kwargs):
            if cmd[0] == "git" and cmd[1] == "--version":
                return Mock(returncode=0)
            elif cmd[0] == "git" and cmd[1] == "clone":
                # Simulate clone by creating files
                clone_path = cmd[-1]
                os.makedirs(clone_path, exist_ok=True)
                os.makedirs(os.path.join(clone_path, ".git"))
                with open(os.path.join(clone_path, "main.py"), "w") as f:
                    f.write("print('hello')")
                return Mock(returncode=0)
            return Mock(returncode=0)
        
        mock_run.side_effect = run_side_effect
        
        result = self.downloader.download_and_package(
            "https://github.com/test/my-mcp",
            "my-mcp",
            "test"
        )
        
        # Verify result structure
        assert "s3_path" in result
        assert "version" in result
        assert "tool_name" in result
        assert "content_hash" in result
        assert "runtime_type" in result
        
        # Verify S3 path format
        assert result["s3_path"].startswith("s3://test-bucket/packages/")
        
        # Verify S3 upload calls (versioned + latest)
        assert self.mock_s3.upload_file.call_count == 2

    def test_legacy_download_and_upload(self):
        """Test legacy method returns compatible format."""
        with patch.object(self.downloader, 'download_and_package') as mock:
            mock.return_value = {
                "s3_path": "s3://bucket/packages/tool",
                "version": "1.0.0",
                "tool_name": "tool",
                "content_hash": "sha256:abc",
                "size_bytes": 1000,
                "runtime_type": "python",
            }
            
            result = self.downloader.download_and_upload(
                "https://github.com/test/repo",
                "repo",
                "test"
            )
            
            # Legacy format check
            assert "s3_path" in result
            assert "size_bytes" in result
            assert "content_hash" in result
            assert "file_count" in result
```

---

## Task 3.4: Create End-to-End Test (15 min)

### Objective
Create a test that validates the full workflow from clone to S3.

### Steps

Create `/tests/test_e2e_packaging.py`:
```python
"""End-to-end tests for packaging workflow."""
import os
import tempfile
import shutil
import subprocess
import pytest
from unittest.mock import Mock

from mcp_scraper.repository_downloader import RepositoryDownloader


@pytest.fixture
def mock_s3_client():
    """Create mock S3 client that stores uploads in memory."""
    client = Mock()
    client.bucket_name = "test-bucket"
    client.uploads = {}
    
    def upload_file(local_path, s3_key):
        with open(local_path, 'rb') as f:
            client.uploads[s3_key] = f.read()
    
    client.upload_file = upload_file
    return client


@pytest.fixture
def temp_git_repo():
    """Create a temporary Git repository for testing."""
    temp_dir = tempfile.mkdtemp()
    repo_dir = os.path.join(temp_dir, "test-repo")
    os.makedirs(repo_dir)
    
    # Initialize git repo
    subprocess.run(["git", "init"], cwd=repo_dir, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=repo_dir, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=repo_dir, capture_output=True)
    
    # Create Python project files
    with open(os.path.join(repo_dir, "main.py"), "w") as f:
        f.write('''#!/usr/bin/env python3
import sys
import json

def main():
    for line in sys.stdin:
        request = json.loads(line)
        response = {"jsonrpc": "2.0", "id": request.get("id")}
        print(json.dumps(response), flush=True)

if __name__ == "__main__":
    main()
''')
    
    with open(os.path.join(repo_dir, "pyproject.toml"), "w") as f:
        f.write('''[project]
name = "test-mcp"
version = "1.0.0"
description = "Test MCP server"
''')
    
    with open(os.path.join(repo_dir, "README.md"), "w") as f:
        f.write("# Test MCP\n\nA test MCP server for e2e testing.")
    
    # Commit files
    subprocess.run(["git", "add", "."], cwd=repo_dir, capture_output=True)
    subprocess.run(["git", "commit", "-m", "Initial"], cwd=repo_dir, capture_output=True)
    
    yield repo_dir
    
    # Cleanup
    shutil.rmtree(temp_dir)


@pytest.mark.skipif(
    subprocess.run(["git", "--version"], capture_output=True).returncode != 0,
    reason="Git not available"
)
class TestE2EPackaging:
    """End-to-end packaging tests."""

    def test_full_workflow_with_local_repo(self, mock_s3_client, temp_git_repo):
        """Test full workflow with a local Git repository."""
        downloader = RepositoryDownloader(
            s3_client=mock_s3_client,
            install_node_deps=False,
        )
        
        # Use file:// URL for local repo
        repo_url = f"file://{temp_git_repo}"
        
        result = downloader.download_and_package(
            repository_url=repo_url,
            mcp_name="test-mcp",
            repo_owner="testowner",
        )
        
        # Verify result
        assert result["tool_name"] == "test"  # test-mcp -> test
        assert result["version"] == "1.0.0"
        assert result["runtime_type"] == "python"
        assert "sha256:" in result["content_hash"]
        
        # Verify S3 uploads
        assert len(mock_s3_client.uploads) == 2
        
        # Check for versioned and latest uploads
        keys = list(mock_s3_client.uploads.keys())
        assert any("1.0.0.zip" in k for k in keys)
        assert any("latest.zip" in k for k in keys)
        
        # Verify archive contains manifest.json
        import zipfile
        import io
        
        archive_data = list(mock_s3_client.uploads.values())[0]
        with zipfile.ZipFile(io.BytesIO(archive_data), 'r') as zf:
            names = zf.namelist()
            assert "manifest.json" in names
            assert "main.py" in names
            
            # Verify manifest content
            manifest_data = zf.read("manifest.json")
            import json
            manifest = json.loads(manifest_data)
            assert manifest["name"] == "test"
            assert manifest["version"] == "1.0.0"
            assert manifest["server"]["type"] == "python"

    def test_manifest_preserved_if_exists(self, mock_s3_client, temp_git_repo):
        """Test that existing manifest.json is preserved."""
        # Create existing manifest
        existing_manifest = {
            "manifest_version": "0.1",
            "name": "custom-name",
            "version": "2.0.0",
            "server": {
                "type": "python",
                "command": "python3",
                "args": ["custom_entry.py"]
            }
        }
        import json
        with open(os.path.join(temp_git_repo, "manifest.json"), "w") as f:
            json.dump(existing_manifest, f)
        
        # Commit the manifest
        subprocess.run(["git", "add", "."], cwd=temp_git_repo, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Add manifest"], cwd=temp_git_repo, capture_output=True)
        
        downloader = RepositoryDownloader(
            s3_client=mock_s3_client,
            install_node_deps=False,
        )
        
        repo_url = f"file://{temp_git_repo}"
        result = downloader.download_and_package(
            repository_url=repo_url,
            mcp_name="test-mcp",
            repo_owner="testowner",
        )
        
        # Verify archive contains original manifest
        import zipfile
        import io
        
        archive_data = list(mock_s3_client.uploads.values())[0]
        with zipfile.ZipFile(io.BytesIO(archive_data), 'r') as zf:
            manifest_data = zf.read("manifest.json")
            manifest = json.loads(manifest_data)
            # Original manifest should be preserved
            assert manifest["name"] == "custom-name"
```

---

## Verification Checklist

- [ ] Repository downloader creates archives (not individual files)
- [ ] S3 paths follow `packages/{tool}/{version}.zip` format
- [ ] Both versioned and latest archives are uploaded
- [ ] Manifest.json is generated if not present
- [ ] Existing manifest.json is preserved
- [ ] Runtime is correctly detected
- [ ] Database is updated with new fields
- [ ] All tests pass

### Run Tests
```bash
cd /Users/adam/Documents/GitHub/mcp_scraper
python -m pytest tests/test_repository_downloader.py tests/test_e2e_packaging.py -v
```

---

## Sprint 3 Complete

Proceed to **Sprint 4** for integration testing and finalization.
