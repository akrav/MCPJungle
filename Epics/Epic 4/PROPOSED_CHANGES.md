# Epic 4: Proposed Changes to MCP Scraper

## Overview

This document details the specific code changes required to make `mcp_scraper` compatible with the Lambda adapter from Epic 3.

---

## 1. Repository Downloader Rewrite

### Current Behavior
```python
# repository_downloader.py - uploads individual files
def download_and_upload(self, repository_url, mcp_name, repo_owner):
    # Clone repo
    # Remove .git
    # Upload each file individually to S3
    # s3://bucket/mcps/{owner}/{name}/*
```

### Proposed Behavior
```python
# repository_downloader.py - creates archive and uploads single file
def download_and_package(self, repository_url, mcp_name, repo_owner, version="latest"):
    """
    New workflow:
    1. Clone repository
    2. Remove .git directory
    3. Detect runtime and create manifest.json
    4. If Node.js: run npm install --production
    5. If Python: (optionally) bundle dependencies
    6. Create compressed archive (.zip)
    7. Upload single archive to S3
    
    S3 path: packages/{tool_name}/{version}.zip
    Also create: packages/{tool_name}/latest.zip (symlink or copy)
    """
```

### New Method: `_create_manifest`
```python
def _create_manifest(self, repo_path: str, mcp_name: str, version: str) -> dict:
    """Generate manifest.json for the MCP package.
    
    Detection priority:
    1. Existing manifest.json - preserve it
    2. package.json - Node.js runtime
    3. pyproject.toml - Python runtime  
    4. requirements.txt + *.py - Python runtime
    5. go.mod - Go runtime (future)
    6. Cargo.toml - Rust runtime (future)
    """
    manifest = {
        "manifest_version": "0.1",
        "name": mcp_name,
        "version": version,
        "server": {}
    }
    
    # Detect Node.js
    package_json_path = os.path.join(repo_path, "package.json")
    if os.path.exists(package_json_path):
        with open(package_json_path) as f:
            pkg = json.load(f)
        
        manifest["version"] = pkg.get("version", version)
        manifest["description"] = pkg.get("description", "")
        
        # Find entry point
        bin_entry = pkg.get("bin", {})
        if isinstance(bin_entry, str):
            entry = bin_entry
        elif isinstance(bin_entry, dict):
            entry = list(bin_entry.values())[0] if bin_entry else None
        else:
            entry = pkg.get("main", "index.js")
        
        manifest["server"] = {
            "type": "node",
            "command": "node",
            "args": [entry] if entry else ["index.js"]
        }
        return manifest
    
    # Detect Python
    python_files = ["main.py", "app.py", "server.py", "__main__.py"]
    for py_file in python_files:
        if os.path.exists(os.path.join(repo_path, py_file)):
            manifest["server"] = {
                "type": "python",
                "command": "python3",
                "args": [py_file],
                "env": {"PYTHONUNBUFFERED": "1"}
            }
            break
    
    # Try pyproject.toml for version
    pyproject_path = os.path.join(repo_path, "pyproject.toml")
    if os.path.exists(pyproject_path):
        # Parse version from pyproject.toml
        ...
    
    return manifest
```

### New Method: `_create_archive`
```python
def _create_archive(self, source_dir: str, output_path: str, format: str = "zip") -> str:
    """Create compressed archive from source directory.
    
    Args:
        source_dir: Path to directory to archive
        output_path: Path for output archive (without extension)
        format: Archive format - "zip" or "tar.gz"
    
    Returns:
        Path to created archive
    """
    if format == "zip":
        archive_path = f"{output_path}.zip"
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    zf.write(file_path, arcname)
        return archive_path
    
    elif format == "tar.gz":
        archive_path = f"{output_path}.tar.gz"
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(source_dir, arcname=".")
        return archive_path
```

---

## 2. S3 Path Structure

### Current Structure
```
s3://bucket/
└── mcps/
    └── {owner}/
        └── {name}/
            ├── README.md
            ├── package.json
            ├── src/
            │   └── index.js
            └── ...
```

### Proposed Structure
```
s3://bucket/
└── packages/
    └── {tool_name}/
        ├── latest.zip          # Always points to newest version
        ├── 1.0.0.zip           # Versioned archives
        ├── 1.0.1.zip
        └── metadata.json       # Tool metadata (optional)
```

### Tool Naming Convention
Transform `{owner}/{repo}` to a unique tool name:

```python
def generate_tool_name(repo_owner: str, repo_name: str) -> str:
    """Generate unique tool name from owner/repo.
    
    Strategy:
    1. If repo_name already contains 'mcp', use cleaned repo_name
    2. Otherwise, use owner_repo format
    3. Lowercase and replace special chars with hyphens
    
    Examples:
    - upstash/context7-mcp -> context7
    - anthropic/mcp-server-memory -> mcp-server-memory
    - john/my-tool -> john-my-tool
    """
    # Remove common suffixes
    name = repo_name.lower()
    for suffix in ['-mcp', '-server', '-mcp-server']:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    
    # If name is generic, include owner
    generic_names = ['server', 'mcp', 'tool', 'client']
    if name in generic_names:
        name = f"{repo_owner.lower()}-{name}"
    
    # Sanitize
    name = re.sub(r'[^a-z0-9-]', '-', name)
    name = re.sub(r'-+', '-', name).strip('-')
    
    return name
```

---

## 3. Version Detection

### Sources for Version Information

```python
def extract_version(repo_path: str) -> str:
    """Extract version from repository files.
    
    Priority:
    1. package.json (Node.js)
    2. pyproject.toml (Python)
    3. setup.py (Python legacy)
    4. Git tags (if available)
    5. Default to timestamp-based version
    """
    # Try package.json
    package_json = os.path.join(repo_path, "package.json")
    if os.path.exists(package_json):
        with open(package_json) as f:
            data = json.load(f)
            if "version" in data:
                return data["version"]
    
    # Try pyproject.toml
    pyproject = os.path.join(repo_path, "pyproject.toml")
    if os.path.exists(pyproject):
        with open(pyproject) as f:
            content = f.read()
            match = re.search(r'version\s*=\s*["\']([^"\']+)["\']', content)
            if match:
                return match.group(1)
    
    # Default to date-based version
    return datetime.utcnow().strftime("%Y.%m.%d")
```

---

## 4. Manifest Generation

### Standard manifest.json Format (MCP Bundle)

```json
{
    "manifest_version": "0.1",
    "name": "context7",
    "version": "1.0.0",
    "description": "Context7 MCP server for documentation",
    "repository": {
        "type": "git",
        "url": "https://github.com/upstash/context7-mcp"
    },
    "server": {
        "type": "node",
        "command": "node",
        "args": ["dist/index.js"],
        "env": {}
    },
    "tools": [
        {
            "name": "resolve-library-id",
            "description": "Resolve a package name to Context7 library ID"
        }
    ]
}
```

### Generation Logic

```python
def generate_manifest(repo_path: str, mcp_name: str, repo_url: str) -> dict:
    """Generate manifest.json for MCP package.
    
    Returns:
        dict: Manifest content ready to be written as JSON
    """
    manifest = {
        "manifest_version": "0.1",
        "name": mcp_name,
        "version": extract_version(repo_path),
        "repository": {
            "type": "git",
            "url": repo_url
        },
        "server": detect_server_config(repo_path)
    }
    
    # Try to extract description
    readme_path = os.path.join(repo_path, "README.md")
    if os.path.exists(readme_path):
        with open(readme_path) as f:
            content = f.read()
            # Extract first paragraph as description
            lines = content.split('\n\n')
            for line in lines:
                if line.strip() and not line.startswith('#'):
                    manifest["description"] = line.strip()[:500]
                    break
    
    return manifest


def detect_server_config(repo_path: str) -> dict:
    """Detect server configuration from repo structure.
    
    Returns:
        dict: Server configuration with type, command, args, env
    """
    # Check for existing manifest.json
    existing = os.path.join(repo_path, "manifest.json")
    if os.path.exists(existing):
        with open(existing) as f:
            data = json.load(f)
            if "server" in data:
                return data["server"]
    
    # Check for package.json (Node.js)
    pkg_json = os.path.join(repo_path, "package.json")
    if os.path.exists(pkg_json):
        with open(pkg_json) as f:
            pkg = json.load(f)
        
        # Find binary entry point
        bin_config = pkg.get("bin", {})
        if isinstance(bin_config, str):
            entry = bin_config
        elif isinstance(bin_config, dict) and bin_config:
            entry = list(bin_config.values())[0]
        else:
            entry = pkg.get("main", "index.js")
        
        # Check if we need to run from node_modules/.bin
        if os.path.exists(os.path.join(repo_path, "node_modules", ".bin")):
            bin_dir = os.path.join(repo_path, "node_modules", ".bin")
            candidates = os.listdir(bin_dir)
            if candidates:
                return {
                    "type": "node",
                    "command": f"node_modules/.bin/{candidates[0]}",
                    "args": [],
                    "env": {}
                }
        
        return {
            "type": "node",
            "command": "node",
            "args": [entry],
            "env": {}
        }
    
    # Check for Python entry points
    python_entries = ["main.py", "app.py", "server.py", "__main__.py", "src/main.py"]
    for entry in python_entries:
        if os.path.exists(os.path.join(repo_path, entry)):
            return {
                "type": "python",
                "command": "python3",
                "args": [entry],
                "env": {"PYTHONUNBUFFERED": "1"}
            }
    
    raise RuntimeError(f"Could not detect server configuration for {repo_path}")
```

---

## 5. Node.js Dependency Installation

For Node.js packages, dependencies must be installed before packaging:

```python
def install_node_dependencies(repo_path: str) -> bool:
    """Install Node.js production dependencies.
    
    Args:
        repo_path: Path to repository with package.json
        
    Returns:
        bool: True if installation successful
    """
    package_json = os.path.join(repo_path, "package.json")
    if not os.path.exists(package_json):
        return False
    
    try:
        # Use npm ci for deterministic installs if lock file exists
        lock_file = os.path.join(repo_path, "package-lock.json")
        if os.path.exists(lock_file):
            cmd = ["npm", "ci", "--production", "--ignore-scripts"]
        else:
            cmd = ["npm", "install", "--production", "--ignore-scripts"]
        
        result = subprocess.run(
            cmd,
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes
        )
        
        if result.returncode != 0:
            logger.error(f"npm install failed: {result.stderr}")
            return False
        
        logger.info(f"Installed Node.js dependencies for {repo_path}")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error(f"npm install timed out for {repo_path}")
        return False
    except Exception as e:
        logger.error(f"npm install error: {e}")
        return False
```

---

## 6. Complete New Workflow

```python
def download_and_package(
    self,
    repository_url: str,
    mcp_name: str,
    repo_owner: str,
    version: str = None
) -> dict:
    """Complete workflow: clone, process, package, upload.
    
    Returns:
        dict with s3_path, version, content_hash, size_bytes
    """
    download_dir = None
    
    try:
        # 1. Clone repository
        download_dir = tempfile.mkdtemp()
        repo_path = os.path.join(download_dir, "repo")
        
        result = subprocess.run(
            ["git", "clone", "--depth", "1", repository_url, repo_path],
            capture_output=True,
            text=True,
            timeout=300
        )
        if result.returncode != 0:
            raise GitCloneError(f"Clone failed: {result.stderr}")
        
        # 2. Remove .git directory
        git_dir = os.path.join(repo_path, ".git")
        if os.path.exists(git_dir):
            shutil.rmtree(git_dir)
        
        # 3. Extract version
        if version is None:
            version = extract_version(repo_path)
        
        # 4. Generate tool name
        tool_name = generate_tool_name(repo_owner, mcp_name)
        
        # 5. Detect runtime and install dependencies
        server_config = detect_server_config(repo_path)
        
        if server_config.get("type") == "node":
            install_node_dependencies(repo_path)
        
        # 6. Generate manifest.json (if not exists)
        manifest_path = os.path.join(repo_path, "manifest.json")
        if not os.path.exists(manifest_path):
            manifest = generate_manifest(repo_path, tool_name, repository_url)
            with open(manifest_path, 'w') as f:
                json.dump(manifest, f, indent=2)
        
        # 7. Create archive
        archive_path = os.path.join(download_dir, f"{tool_name}")
        archive_file = self._create_archive(repo_path, archive_path, format="zip")
        
        # 8. Calculate hash
        content_hash = self.calculate_file_hash(archive_file)
        size_bytes = os.path.getsize(archive_file)
        
        # 9. Upload to S3
        # Upload versioned archive
        s3_key_versioned = f"packages/{tool_name}/{version}.zip"
        self.s3_client.upload_file(archive_file, s3_key_versioned)
        
        # Upload/update latest
        s3_key_latest = f"packages/{tool_name}/latest.zip"
        self.s3_client.upload_file(archive_file, s3_key_latest)
        
        s3_path = f"s3://{self.s3_client.bucket_name}/packages/{tool_name}"
        
        logger.info(f"Uploaded {tool_name} v{version} to {s3_path}")
        
        return {
            "s3_path": s3_path,
            "version": version,
            "tool_name": tool_name,
            "content_hash": content_hash,
            "size_bytes": size_bytes,
            "archive_format": "zip"
        }
        
    finally:
        if download_dir and os.path.exists(download_dir):
            shutil.rmtree(download_dir)
```

---

## 7. Database Schema Updates

### New Fields for MCPRepository

```python
class MCPRepository(Base):
    __tablename__ = "mcp_repositories"
    
    # Existing fields...
    
    # New fields
    tool_name = Column(String(255), nullable=True, index=True)  # Unique tool identifier
    current_version = Column(String(50), nullable=True)         # Latest version
    archive_format = Column(String(10), default="zip")          # zip, tar.gz
    runtime_type = Column(String(20), nullable=True)            # node, python, binary
```

### Migration SQL

```sql
ALTER TABLE mcp_repositories ADD COLUMN tool_name VARCHAR(255);
ALTER TABLE mcp_repositories ADD COLUMN current_version VARCHAR(50);
ALTER TABLE mcp_repositories ADD COLUMN archive_format VARCHAR(10) DEFAULT 'zip';
ALTER TABLE mcp_repositories ADD COLUMN runtime_type VARCHAR(20);

CREATE INDEX idx_tool_name ON mcp_repositories(tool_name);
```

---

## 8. Configuration Updates

### New config options

```python
class Settings(BaseSettings):
    # Existing...
    
    # New options
    s3_path_prefix: str = Field(default="packages", alias="S3_PATH_PREFIX")
    default_archive_format: str = Field(default="zip", alias="DEFAULT_ARCHIVE_FORMAT")
    install_node_deps: bool = Field(default=True, alias="INSTALL_NODE_DEPS")
    generate_manifest: bool = Field(default=True, alias="GENERATE_MANIFEST")
```

---

## Summary of Changes

| File | Type | Description |
|------|------|-------------|
| `repository_downloader.py` | Major | New archive workflow, manifest generation |
| `s3_storage_manager.py` | Medium | Updated path handling |
| `models.py` | Small | New fields for versioning |
| `config.py` | Small | New configuration options |
| `metadata_extractor.py` | Medium | Version extraction from package files |
| **New**: `manifest_generator.py` | New | Dedicated manifest generation |
| **New**: `package_builder.py` | New | Archive creation utilities |

---

## Testing Strategy

1. **Unit Tests**: Test each new function in isolation
2. **Integration Tests**: Test full download → package → upload flow
3. **Lambda Compatibility Tests**: Verify Lambda can load packages
4. **Regression Tests**: Ensure existing functionality preserved

See `Sprint_1.md` through `Sprint_4.md` for detailed implementation tasks.
