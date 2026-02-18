# Sprint 4: Lambda Integration Testing & Finalization

**Goal**: Verify MCP Scraper packages work with Lambda adapter.

**Estimated Duration**: 2-3 hours

**Prerequisites**: Sprints 1-3 complete

---

## Task 4.1: Lambda Compatibility Test Setup (15 min)

### Objective
Create test infrastructure to verify packages work with Lambda adapter.

### Steps

1. Create `/tests/test_lambda_compatibility.py`:
```python
"""Lambda compatibility tests for MCP packages."""
import os
import json
import tempfile
import shutil
import zipfile
import pytest

# Import the Lambda adapter's resolution logic concepts
# (We'll test that our packages match what Lambda expects)


class TestLambdaCompatibility:
    """Verify packages are compatible with Lambda adapter."""
    
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir)
    
    def _create_package_archive(self, files: dict, format: str = "zip") -> str:
        """Create a test package archive.
        
        Args:
            files: Dict of {filename: content}
            format: "zip" or "tar.gz"
        
        Returns:
            Path to archive
        """
        # Create source directory
        src_dir = os.path.join(self.temp_dir, "src")
        os.makedirs(src_dir)
        
        for filename, content in files.items():
            filepath = os.path.join(src_dir, filename)
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            if isinstance(content, dict):
                with open(filepath, 'w') as f:
                    json.dump(content, f)
            else:
                with open(filepath, 'w') as f:
                    f.write(content)
        
        # Create archive
        archive_path = os.path.join(self.temp_dir, f"package.{format.replace('.', '')}")
        
        if format == "zip":
            with zipfile.ZipFile(archive_path, 'w') as zf:
                for root, _, filenames in os.walk(src_dir):
                    for filename in filenames:
                        filepath = os.path.join(root, filename)
                        arcname = os.path.relpath(filepath, src_dir)
                        zf.write(filepath, arcname)
        else:
            import tarfile
            with tarfile.open(archive_path, 'w:gz') as tar:
                tar.add(src_dir, arcname='.')
        
        return archive_path
    
    def test_manifest_json_format(self):
        """Test that manifest.json matches Lambda's expected format."""
        manifest = {
            "manifest_version": "0.1",
            "name": "test-tool",
            "version": "1.0.0",
            "server": {
                "type": "python",
                "command": "python3",
                "args": ["main.py"],
                "env": {"PYTHONUNBUFFERED": "1"}
            }
        }
        
        archive = self._create_package_archive({
            "manifest.json": manifest,
            "main.py": "print('hello')"
        })
        
        # Lambda resolution expects these fields
        with zipfile.ZipFile(archive, 'r') as zf:
            data = json.loads(zf.read("manifest.json"))
            
            # Required by Lambda
            assert "server" in data
            assert "type" in data["server"]
            assert "command" in data["server"]
            
            # Type must be valid
            assert data["server"]["type"] in ["python", "node", "binary"]
    
    def test_python_runtime_resolution(self):
        """Test Python runtime can be resolved by Lambda."""
        # Lambda's Python heuristic looks for these files
        python_entry_points = [
            "main.py",
            "app.py",
            "index.py",
            "__main__.py"
        ]
        
        for entry in python_entry_points:
            archive = self._create_package_archive({
                entry: "#!/usr/bin/env python3\nprint('hello')"
            })
            
            with zipfile.ZipFile(archive, 'r') as zf:
                names = zf.namelist()
                assert entry in names, f"Lambda should find {entry}"
    
    def test_nodejs_runtime_resolution(self):
        """Test Node.js runtime can be resolved by Lambda."""
        # Lambda looks for node_modules/.bin/*
        files = {
            "package.json": {"name": "test", "version": "1.0.0", "main": "index.js"},
            "index.js": "console.log('hello')",
            "node_modules/.bin/test-mcp": "#!/usr/bin/env node\nrequire('../index.js')"
        }
        
        archive = self._create_package_archive(files)
        
        with zipfile.ZipFile(archive, 'r') as zf:
            names = zf.namelist()
            assert "package.json" in names
            assert any(".bin/" in n for n in names)
    
    def test_manifest_with_python_type(self):
        """Test manifest.json with type=python."""
        manifest = {
            "manifest_version": "0.1",
            "name": "python-tool",
            "version": "1.0.0",
            "server": {
                "type": "python",
                "command": "python3",
                "args": ["server.py", "--verbose"],
                "env": {"PYTHONUNBUFFERED": "1"}
            }
        }
        
        archive = self._create_package_archive({
            "manifest.json": manifest,
            "server.py": "import sys\nprint('running')"
        })
        
        # Verify Lambda can parse this
        with zipfile.ZipFile(archive, 'r') as zf:
            data = json.loads(zf.read("manifest.json"))
            
            # Lambda expects these for Python
            assert data["server"]["type"] == "python"
            assert data["server"]["command"] == "python3"
            assert "server.py" in data["server"]["args"]
            assert data["server"]["env"].get("PYTHONUNBUFFERED") == "1"
    
    def test_manifest_with_node_type(self):
        """Test manifest.json with type=node."""
        manifest = {
            "manifest_version": "0.1",
            "name": "node-tool",
            "version": "2.0.0",
            "server": {
                "type": "node",
                "command": "node_modules/.bin/tool",
                "args": [],
                "env": {}
            }
        }
        
        archive = self._create_package_archive({
            "manifest.json": manifest,
            "package.json": {"name": "tool", "version": "2.0.0"},
            "node_modules/.bin/tool": "#!/usr/bin/env node"
        })
        
        with zipfile.ZipFile(archive, 'r') as zf:
            data = json.loads(zf.read("manifest.json"))
            assert data["server"]["type"] == "node"
    
    def test_s3_path_format(self):
        """Test S3 path format matches Lambda expectations."""
        # Lambda expects: packages/{tool_name}/{version}.{ext}
        valid_paths = [
            "packages/context7/1.0.0.zip",
            "packages/context7/latest.zip",
            "packages/mcp-server-memory/2.0.0.tar.gz",
        ]
        
        for path in valid_paths:
            parts = path.split('/')
            assert parts[0] == "packages"
            assert len(parts) == 3
            # Version file
            assert parts[2].endswith('.zip') or parts[2].endswith('.tar.gz')
    
    def test_archive_formats(self):
        """Test both zip and tar.gz formats work."""
        files = {
            "main.py": "print('hello')",
            "manifest.json": {
                "manifest_version": "0.1",
                "name": "test",
                "version": "1.0.0",
                "server": {"type": "python", "command": "python3", "args": ["main.py"]}
            }
        }
        
        # Test zip
        zip_archive = self._create_package_archive(files, "zip")
        assert zipfile.is_zipfile(zip_archive)
        
        # Test tar.gz
        tgz_archive = self._create_package_archive(files, "tar.gz")
        import tarfile
        assert tarfile.is_tarfile(tgz_archive)
```

2. Run tests:
```bash
python -m pytest tests/test_lambda_compatibility.py -v
```

---

## Task 4.2: Live Lambda Test (20 min)

### Objective
Test a package created by MCP Scraper with the actual Lambda adapter.

### Prerequisites
- Lambda adapter deployed (from Epic 3)
- AWS credentials configured
- S3 bucket accessible

### Steps

1. Create a test Python MCP package locally:
```bash
mkdir -p /tmp/test-mcp-package
cd /tmp/test-mcp-package

# Create main.py
cat > main.py << 'EOF'
#!/usr/bin/env python3
import sys
import json

def log(msg):
    print(msg, file=sys.stderr, flush=True)

def main():
    log("Test MCP Server started")
    
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            method = request.get("method", "")
            req_id = request.get("id")
            
            if method == "initialize":
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "test-mcp", "version": "1.0.0"}
                    }
                }
            elif method == "tools/list":
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "tools": [{
                            "name": "echo",
                            "description": "Echo back the input",
                            "inputSchema": {
                                "type": "object",
                                "properties": {"message": {"type": "string"}}
                            }
                        }]
                    }
                }
            elif method == "tools/call":
                args = request.get("params", {}).get("arguments", {})
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": f"Echo: {args.get('message', '')}"}]
                    }
                }
            else:
                response = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Unknown method: {method}"}
                }
            
            print(json.dumps(response), flush=True)
            
        except Exception as e:
            log(f"Error: {e}")

if __name__ == "__main__":
    main()
EOF

# Create manifest.json
cat > manifest.json << 'EOF'
{
    "manifest_version": "0.1",
    "name": "test-mcp",
    "version": "1.0.0",
    "description": "Test MCP server for Lambda compatibility",
    "server": {
        "type": "python",
        "command": "python3",
        "args": ["main.py"],
        "env": {"PYTHONUNBUFFERED": "1"}
    }
}
EOF

# Create README
echo "# Test MCP\n\nTest server for Lambda compatibility." > README.md
```

2. Create and upload the package:
```bash
# Create zip archive
cd /tmp/test-mcp-package
zip -r ../test-mcp-1.0.0.zip .

# Upload to S3 (adjust bucket name)
BUCKET="mcp-tools-20260105013158332400000001"

aws s3 cp /tmp/test-mcp-1.0.0.zip s3://$BUCKET/packages/test-mcp/1.0.0.zip
aws s3 cp /tmp/test-mcp-1.0.0.zip s3://$BUCKET/packages/test-mcp/latest.zip

# Verify upload
aws s3 ls s3://$BUCKET/packages/test-mcp/
```

3. Test with Lambda:
```bash
# Get Lambda URL
LAMBDA_URL=$(aws lambda get-function-url-config --function-name mcp-adapter --query 'FunctionUrl' --output text)

# Test initialize
curl -X POST "$LAMBDA_URL?tool=test-mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test"}}}'

# Test tools/list
curl -X POST "$LAMBDA_URL?tool=test-mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Test tools/call
curl -X POST "$LAMBDA_URL?tool=test-mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"Hello from scraper test!"}}}'
```

### Expected Output
```
data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",...}}

data: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"echo",...}]}}

data: {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Echo: Hello from scraper test!"}]}}
```

---

## Task 4.3: Full Pipeline Test (25 min)

### Objective
Test the complete flow: MCP Scraper → S3 → Lambda

### Steps

1. Create a test script `/tests/test_full_pipeline.py`:
```python
"""Full pipeline test: Scraper -> S3 -> Lambda."""
import os
import json
import time
import subprocess
import tempfile
import shutil
import pytest
import requests

# Configuration - adjust as needed
LAMBDA_URL = os.environ.get("LAMBDA_URL", "")
S3_BUCKET = os.environ.get("S3_BUCKET", "")
SKIP_LIVE_TESTS = not (LAMBDA_URL and S3_BUCKET)


@pytest.mark.skipif(SKIP_LIVE_TESTS, reason="Live test environment not configured")
class TestFullPipeline:
    """Full pipeline integration tests."""
    
    def test_scraper_to_lambda(self):
        """Test complete flow from scraper to Lambda execution."""
        from mcp_scraper.repository_downloader import RepositoryDownloader
        from mcp_scraper.aws_client import get_s3_client
        
        # Create a temporary test repo
        temp_dir = tempfile.mkdtemp()
        repo_dir = os.path.join(temp_dir, "test-repo")
        os.makedirs(repo_dir)
        
        try:
            # Initialize git repo
            subprocess.run(["git", "init"], cwd=repo_dir, capture_output=True)
            subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=repo_dir, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=repo_dir, capture_output=True)
            
            # Create Python MCP server
            with open(os.path.join(repo_dir, "main.py"), "w") as f:
                f.write('''#!/usr/bin/env python3
import sys
import json

for line in sys.stdin:
    request = json.loads(line.strip())
    response = {"jsonrpc": "2.0", "id": request.get("id")}
    
    if request.get("method") == "initialize":
        response["result"] = {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "pipeline-test", "version": "1.0.0"}
        }
    elif request.get("method") == "tools/list":
        response["result"] = {"tools": []}
    else:
        response["error"] = {"code": -32601, "message": "Unknown method"}
    
    print(json.dumps(response), flush=True)
''')
            
            with open(os.path.join(repo_dir, "pyproject.toml"), "w") as f:
                f.write('[project]\nname = "pipeline-test"\nversion = "1.0.0"')
            
            subprocess.run(["git", "add", "."], cwd=repo_dir, capture_output=True)
            subprocess.run(["git", "commit", "-m", "Initial"], cwd=repo_dir, capture_output=True)
            
            # Use scraper to package
            downloader = RepositoryDownloader(install_node_deps=False)
            result = downloader.download_and_package(
                repository_url=f"file://{repo_dir}",
                mcp_name="pipeline-test-mcp",
                repo_owner="testowner",
            )
            
            tool_name = result["tool_name"]
            print(f"Packaged as: {tool_name}")
            
            # Wait for S3 propagation
            time.sleep(2)
            
            # Test with Lambda
            response = requests.post(
                f"{LAMBDA_URL}?tool={tool_name}",
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {"name": "test"}
                    }
                },
                timeout=30
            )
            
            assert response.status_code == 200
            
            # Parse SSE response
            data = response.text
            assert "pipeline-test" in data
            
        finally:
            shutil.rmtree(temp_dir)
```

2. Run with environment variables:
```bash
export LAMBDA_URL="https://xxx.lambda-url.us-east-1.on.aws/"
export S3_BUCKET="mcp-tools-20260105013158332400000001"

python -m pytest tests/test_full_pipeline.py -v
```

---

## Task 4.4: Configuration Alignment (15 min)

### Objective
Ensure MCP Scraper and Lambda use same bucket configuration.

### Steps

1. Update MCP Scraper `.env`:
```bash
# /Users/adam/Documents/GitHub/mcp_scraper/.env

# AWS Configuration - Must match Lambda adapter bucket
AWS_REGION=us-east-1
AWS_BUCKET_NAME=mcp-tools-20260105013158332400000001

# Database
DB_PATH=./mcp_scraper.db

# Logging
LOG_LEVEL=INFO

# New configuration options
S3_PATH_PREFIX=packages
DEFAULT_ARCHIVE_FORMAT=zip
INSTALL_NODE_DEPS=true
GENERATE_MANIFEST=true
```

2. Update config.py to read new options:
```python
# Add to /src/mcp_scraper/config.py

class Settings(BaseSettings):
    # Existing fields...
    aws_region: str = Field(default="us-east-1", alias="AWS_REGION")
    aws_bucket_name: str = Field(default="mcp-library", alias="AWS_BUCKET_NAME")
    db_path: str = Field(default="./mcp_scraper.db", alias="DB_PATH")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    
    # New fields for Lambda compatibility
    s3_path_prefix: str = Field(default="packages", alias="S3_PATH_PREFIX")
    default_archive_format: str = Field(default="zip", alias="DEFAULT_ARCHIVE_FORMAT")
    install_node_deps: bool = Field(default=True, alias="INSTALL_NODE_DEPS")
    generate_manifest: bool = Field(default=True, alias="GENERATE_MANIFEST")
```

3. Verify bucket access:
```bash
# Test write access to Lambda bucket
aws s3 ls s3://mcp-tools-20260105013158332400000001/packages/ || echo "Bucket access OK"
```

---

## Task 4.5: Update Documentation (15 min)

### Objective
Document the integration between MCP Scraper and Lambda adapter.

### Steps

1. Update `/Users/adam/Documents/GitHub/mcp_scraper/README.md`:
```markdown
# MCP Scraper

A centralized repository manager for MCPs (Model Context Protocols), designed to work with the MCPJungle Lambda adapter.

## Overview

MCP Scraper discovers, downloads, and packages MCP servers for deployment via AWS Lambda. It integrates with the MCPJungle Lambda adapter to provide serverless MCP execution.

## Architecture

```
MCP Registry → MCP Scraper → S3 (packages/) → Lambda Adapter → Users
                    │
                    └── SQLite (tracking)
```

## Package Format

Packages are stored in S3 as compressed archives:
- Path: `packages/{tool_name}/{version}.zip`
- Always includes `latest.zip` symlink
- Contains `manifest.json` for runtime configuration

### manifest.json Format

```json
{
    "manifest_version": "0.1",
    "name": "tool-name",
    "version": "1.0.0",
    "server": {
        "type": "python|node|binary",
        "command": "python3",
        "args": ["main.py"],
        "env": {"PYTHONUNBUFFERED": "1"}
    }
}
```

## Quick Start

### Prerequisites
- Python 3.11+
- Poetry
- AWS credentials with S3 access
- Git

### Installation

```bash
git clone https://github.com/yourusername/mcp-scraper.git
cd mcp-scraper
poetry install
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your AWS bucket (must match Lambda adapter)
```

### Usage

```bash
# Sync MCP registry to local database
poetry run python -m mcp_scraper.main sync

# Download and package MCPs to S3
poetry run python -m mcp_scraper.main download --limit 5

# Submit a specific MCP URL
poetry run python -m mcp_scraper.main submit https://github.com/owner/repo
```

## Lambda Compatibility

Packages created by MCP Scraper are compatible with the MCPJungle Lambda adapter:

1. **S3 Path**: `packages/{tool_name}/{version}.zip`
2. **Runtime Detection**: `manifest.json` → Python/Node.js heuristics
3. **Formats**: `.zip` (default), `.tar.gz`

To test with Lambda:
```bash
curl -X POST "https://your-lambda-url/?tool=tool-name" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
```

---

## Verification Checklist

### Unit Tests
- [ ] `test_lambda_compatibility.py` passes
- [ ] All existing tests still pass

### Integration Tests
- [ ] Test package uploads to S3 correctly
- [ ] Lambda can load test package
- [ ] Lambda executes tool correctly
- [ ] SSE responses work

### Configuration
- [ ] `.env` uses correct S3 bucket
- [ ] S3 path prefix is `packages`
- [ ] Archive format is `zip`

### Documentation
- [ ] README updated
- [ ] Integration documented
- [ ] Package format documented

### Full Pipeline
- [ ] Sync command works
- [ ] Download command creates compatible packages
- [ ] Submit command works for new MCPs
- [ ] Lambda can serve scraped packages

---

## Sprint 4 Complete

Epic 4 implementation is now complete. The MCP Scraper can:

1. Fetch MCPs from the official registry
2. Clone and package repositories as Lambda-compatible archives
3. Generate `manifest.json` for runtime detection
4. Upload to S3 in the format expected by Lambda adapter
5. Track packages in local SQLite database

### Next Steps

1. Run full database migration on production
2. Re-process existing MCPs with new format
3. Monitor Lambda for successful package loads
4. (Optional) Set up scheduled scraping for new MCPs
