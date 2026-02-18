# Sprint 2: Manifest Generation & Runtime Detection

**Goal**: Create manifest generation and runtime detection capabilities.

**Estimated Duration**: 2-3 hours

**Prerequisites**: Sprint 1 complete

---

## Task 2.1: Create Runtime Detector (20 min)

### Objective
Create module to detect MCP server runtime (Node.js, Python, etc.)

### Steps

1. Create `/src/mcp_scraper/runtime_detector.py`:
```python
"""Runtime detection for MCP servers."""
import json
import logging
import os
from dataclasses import dataclass
from typing import Dict, List, Optional, Literal

logger = logging.getLogger(__name__)

RuntimeType = Literal["node", "python", "binary", "unknown"]


@dataclass
class ServerConfig:
    """Server configuration for manifest."""
    runtime_type: RuntimeType
    command: str
    args: List[str]
    env: Dict[str, str]
    entry_point: Optional[str] = None


def detect_runtime(repo_path: str) -> ServerConfig:
    """Detect runtime and generate server configuration.
    
    Priority:
    1. Existing manifest.json
    2. Existing mcp.json
    3. package.json (Node.js)
    4. Python entry points
    5. Unknown
    """
    # Check for existing manifest
    config = _from_manifest_json(repo_path)
    if config:
        logger.info(f"Detected runtime from manifest.json: {config.runtime_type}")
        return config
    
    config = _from_mcp_json(repo_path)
    if config:
        logger.info(f"Detected runtime from mcp.json: {config.runtime_type}")
        return config
    
    # Check for Node.js
    config = _detect_nodejs(repo_path)
    if config:
        logger.info(f"Detected Node.js runtime")
        return config
    
    # Check for Python
    config = _detect_python(repo_path)
    if config:
        logger.info(f"Detected Python runtime")
        return config
    
    logger.warning(f"Could not detect runtime for {repo_path}")
    return ServerConfig(
        runtime_type="unknown",
        command="",
        args=[],
        env={}
    )


def _from_manifest_json(repo_path: str) -> Optional[ServerConfig]:
    """Extract config from existing manifest.json."""
    manifest_path = os.path.join(repo_path, "manifest.json")
    if not os.path.exists(manifest_path):
        return None
    
    try:
        with open(manifest_path) as f:
            data = json.load(f)
        
        server = data.get("server", {})
        if not server:
            return None
        
        runtime_type = server.get("type", "unknown")
        if runtime_type not in ("node", "python", "binary"):
            runtime_type = "unknown"
        
        return ServerConfig(
            runtime_type=runtime_type,
            command=server.get("command", ""),
            args=server.get("args", []),
            env=server.get("env", {}),
            entry_point=server.get("entry_point")
        )
    except Exception as e:
        logger.warning(f"Failed to parse manifest.json: {e}")
        return None


def _from_mcp_json(repo_path: str) -> Optional[ServerConfig]:
    """Extract config from existing mcp.json (custom format)."""
    mcp_path = os.path.join(repo_path, "mcp.json")
    if not os.path.exists(mcp_path):
        return None
    
    try:
        with open(mcp_path) as f:
            data = json.load(f)
        
        runtime = data.get("runtime", "unknown")
        if runtime == "python":
            return ServerConfig(
                runtime_type="python",
                command="python3",
                args=[data.get("executable", "main.py")] + data.get("args", []),
                env=data.get("env", {"PYTHONUNBUFFERED": "1"})
            )
        elif runtime in ("node", "nodejs"):
            return ServerConfig(
                runtime_type="node",
                command=data.get("executable", "node"),
                args=data.get("args", []),
                env=data.get("env", {})
            )
        else:
            return ServerConfig(
                runtime_type="binary",
                command=data.get("executable", ""),
                args=data.get("args", []),
                env=data.get("env", {})
            )
    except Exception as e:
        logger.warning(f"Failed to parse mcp.json: {e}")
        return None


def _detect_nodejs(repo_path: str) -> Optional[ServerConfig]:
    """Detect Node.js runtime from package.json."""
    pkg_path = os.path.join(repo_path, "package.json")
    if not os.path.exists(pkg_path):
        return None
    
    try:
        with open(pkg_path) as f:
            pkg = json.load(f)
        
        # Find entry point
        bin_config = pkg.get("bin", {})
        
        if isinstance(bin_config, str):
            entry = bin_config
        elif isinstance(bin_config, dict) and bin_config:
            # Use first binary
            entry = list(bin_config.values())[0]
        else:
            entry = pkg.get("main", "index.js")
        
        # Check if node_modules/.bin exists
        bin_dir = os.path.join(repo_path, "node_modules", ".bin")
        if os.path.exists(bin_dir):
            bins = os.listdir(bin_dir)
            if bins:
                # Prefer bin that matches package name
                pkg_name = pkg.get("name", "").split("/")[-1]
                for name in [pkg_name, f"{pkg_name}-mcp", f"mcp-{pkg_name}"]:
                    if name in bins:
                        return ServerConfig(
                            runtime_type="node",
                            command=f"node_modules/.bin/{name}",
                            args=[],
                            env={}
                        )
                # Fall back to first bin
                return ServerConfig(
                    runtime_type="node",
                    command=f"node_modules/.bin/{bins[0]}",
                    args=[],
                    env={}
                )
        
        return ServerConfig(
            runtime_type="node",
            command="node",
            args=[entry],
            env={}
        )
    except Exception as e:
        logger.warning(f"Failed to detect Node.js: {e}")
        return None


def _detect_python(repo_path: str) -> Optional[ServerConfig]:
    """Detect Python runtime from common entry points."""
    python_entries = [
        "main.py",
        "app.py", 
        "server.py",
        "__main__.py",
        "src/main.py",
        "src/server.py",
    ]
    
    for entry in python_entries:
        entry_path = os.path.join(repo_path, entry)
        if os.path.exists(entry_path):
            return ServerConfig(
                runtime_type="python",
                command="python3",
                args=[entry],
                env={"PYTHONUNBUFFERED": "1"}
            )
    
    # Check for pyproject.toml with scripts
    pyproject = os.path.join(repo_path, "pyproject.toml")
    if os.path.exists(pyproject):
        try:
            with open(pyproject) as f:
                content = f.read()
            # Look for entry point definition
            if "[project.scripts]" in content or "[tool.poetry.scripts]" in content:
                # Has scripts, but we can't easily determine which without full toml parsing
                # Default to looking for common files
                pass
        except Exception:
            pass
    
    return None
```

2. Add tests in `/tests/test_runtime_detector.py`:
```python
"""Tests for runtime detector."""
import os
import json
import tempfile
import pytest
from mcp_scraper.runtime_detector import detect_runtime, ServerConfig


class TestRuntimeDetector:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_detect_from_manifest_json(self):
        manifest = {
            "manifest_version": "0.1",
            "name": "test",
            "server": {
                "type": "python",
                "command": "python3",
                "args": ["server.py"],
                "env": {"DEBUG": "1"}
            }
        }
        with open(os.path.join(self.temp_dir, "manifest.json"), "w") as f:
            json.dump(manifest, f)
        
        config = detect_runtime(self.temp_dir)
        assert config.runtime_type == "python"
        assert config.command == "python3"
        assert "server.py" in config.args
    
    def test_detect_nodejs_from_package_json(self):
        pkg = {"name": "test-mcp", "main": "dist/index.js"}
        with open(os.path.join(self.temp_dir, "package.json"), "w") as f:
            json.dump(pkg, f)
        
        config = detect_runtime(self.temp_dir)
        assert config.runtime_type == "node"
        assert "dist/index.js" in config.args
    
    def test_detect_python_from_main_py(self):
        with open(os.path.join(self.temp_dir, "main.py"), "w") as f:
            f.write("print('hello')")
        
        config = detect_runtime(self.temp_dir)
        assert config.runtime_type == "python"
        assert "main.py" in config.args
        assert config.env.get("PYTHONUNBUFFERED") == "1"
    
    def test_unknown_runtime(self):
        # Empty directory
        config = detect_runtime(self.temp_dir)
        assert config.runtime_type == "unknown"
```

---

## Task 2.2: Create Manifest Generator (25 min)

### Objective
Create module to generate manifest.json files for MCP packages.

### Steps

1. Create `/src/mcp_scraper/manifest_generator.py`:
```python
"""Manifest generation for MCP packages."""
import json
import logging
import os
import re
from typing import Dict, Optional, Any

from .runtime_detector import detect_runtime, ServerConfig
from .version_extractor import extract_version

logger = logging.getLogger(__name__)


class ManifestGenerator:
    """Generate manifest.json files for MCP packages."""
    
    MANIFEST_VERSION = "0.1"
    
    @staticmethod
    def generate(
        repo_path: str,
        tool_name: str,
        repository_url: str,
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate manifest content for an MCP package.
        
        Args:
            repo_path: Path to repository
            tool_name: Unique tool identifier
            repository_url: Git repository URL
            version: Optional version (auto-detected if not provided)
        
        Returns:
            Dict containing manifest content
        """
        # Extract version if not provided
        if version is None:
            version = extract_version(repo_path)
        
        # Detect runtime configuration
        server_config = detect_runtime(repo_path)
        
        # Build manifest
        manifest = {
            "manifest_version": ManifestGenerator.MANIFEST_VERSION,
            "name": tool_name,
            "version": version,
            "repository": {
                "type": "git",
                "url": repository_url
            },
            "server": {
                "type": server_config.runtime_type,
                "command": server_config.command,
                "args": server_config.args,
                "env": server_config.env
            }
        }
        
        # Add description from README
        description = ManifestGenerator._extract_description(repo_path)
        if description:
            manifest["description"] = description
        
        # Add license if found
        license_info = ManifestGenerator._detect_license(repo_path)
        if license_info:
            manifest["license"] = license_info
        
        return manifest
    
    @staticmethod
    def generate_and_write(
        repo_path: str,
        tool_name: str,
        repository_url: str,
        version: Optional[str] = None,
        overwrite: bool = False
    ) -> str:
        """Generate and write manifest.json to repository.
        
        Args:
            repo_path: Path to repository
            tool_name: Unique tool identifier
            repository_url: Git repository URL
            version: Optional version
            overwrite: Whether to overwrite existing manifest
        
        Returns:
            Path to written manifest file
        """
        manifest_path = os.path.join(repo_path, "manifest.json")
        
        # Check if manifest already exists
        if os.path.exists(manifest_path) and not overwrite:
            logger.info(f"Manifest already exists at {manifest_path}, skipping generation")
            return manifest_path
        
        manifest = ManifestGenerator.generate(
            repo_path, tool_name, repository_url, version
        )
        
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        logger.info(f"Generated manifest.json at {manifest_path}")
        return manifest_path
    
    @staticmethod
    def _extract_description(repo_path: str) -> Optional[str]:
        """Extract description from README or package files."""
        # Try package.json description
        pkg_path = os.path.join(repo_path, "package.json")
        if os.path.exists(pkg_path):
            try:
                with open(pkg_path) as f:
                    pkg = json.load(f)
                if pkg.get("description"):
                    return pkg["description"][:500]
            except Exception:
                pass
        
        # Try README.md
        readme_files = ["README.md", "readme.md", "README.rst", "README.txt"]
        for readme_name in readme_files:
            readme_path = os.path.join(repo_path, readme_name)
            if os.path.exists(readme_path):
                try:
                    with open(readme_path, encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    # Extract first meaningful paragraph
                    paragraphs = content.split('\n\n')
                    for para in paragraphs:
                        para = para.strip()
                        # Skip headers and badges
                        if para.startswith('#') or para.startswith('[!') or para.startswith('!['):
                            continue
                        if len(para) > 20:
                            # Clean up markdown
                            clean = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', para)
                            clean = re.sub(r'[*_`]', '', clean)
                            return clean[:500]
                except Exception:
                    pass
        
        return None
    
    @staticmethod
    def _detect_license(repo_path: str) -> Optional[str]:
        """Detect license from LICENSE file or package.json."""
        # Check package.json
        pkg_path = os.path.join(repo_path, "package.json")
        if os.path.exists(pkg_path):
            try:
                with open(pkg_path) as f:
                    pkg = json.load(f)
                if pkg.get("license"):
                    return pkg["license"]
            except Exception:
                pass
        
        # Check LICENSE file
        license_files = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE"]
        for license_name in license_files:
            license_path = os.path.join(repo_path, license_name)
            if os.path.exists(license_path):
                try:
                    with open(license_path, encoding='utf-8', errors='ignore') as f:
                        content = f.read(1000)
                    
                    # Detect common licenses
                    content_lower = content.lower()
                    if "mit license" in content_lower:
                        return "MIT"
                    elif "apache license" in content_lower:
                        return "Apache-2.0"
                    elif "gnu general public" in content_lower:
                        if "version 3" in content_lower:
                            return "GPL-3.0"
                        return "GPL-2.0"
                    elif "bsd" in content_lower:
                        return "BSD"
                except Exception:
                    pass
        
        return None
    
    @staticmethod
    def validate_manifest(manifest: Dict[str, Any]) -> bool:
        """Validate manifest structure.
        
        Returns:
            True if valid, raises ValueError if invalid
        """
        required = ["manifest_version", "name", "version", "server"]
        for field in required:
            if field not in manifest:
                raise ValueError(f"Missing required field: {field}")
        
        server = manifest.get("server", {})
        if not server.get("type"):
            raise ValueError("Missing server.type")
        if not server.get("command") and server.get("type") != "unknown":
            raise ValueError("Missing server.command")
        
        return True
```

2. Add tests:
```python
# tests/test_manifest_generator.py
import os
import json
import tempfile
import pytest
from mcp_scraper.manifest_generator import ManifestGenerator


class TestManifestGenerator:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_generate_basic_manifest(self):
        # Create Python entry point
        with open(os.path.join(self.temp_dir, "main.py"), "w") as f:
            f.write("print('hello')")
        
        manifest = ManifestGenerator.generate(
            self.temp_dir,
            "test-tool",
            "https://github.com/owner/repo"
        )
        
        assert manifest["name"] == "test-tool"
        assert manifest["manifest_version"] == "0.1"
        assert manifest["server"]["type"] == "python"
        assert "main.py" in manifest["server"]["args"]
    
    def test_generate_with_version_from_package_json(self):
        pkg = {"name": "test", "version": "1.2.3", "main": "index.js"}
        with open(os.path.join(self.temp_dir, "package.json"), "w") as f:
            json.dump(pkg, f)
        
        manifest = ManifestGenerator.generate(
            self.temp_dir,
            "test-tool",
            "https://github.com/owner/repo"
        )
        
        assert manifest["version"] == "1.2.3"
    
    def test_generate_and_write(self):
        with open(os.path.join(self.temp_dir, "main.py"), "w") as f:
            f.write("print('hello')")
        
        manifest_path = ManifestGenerator.generate_and_write(
            self.temp_dir,
            "test-tool",
            "https://github.com/owner/repo"
        )
        
        assert os.path.exists(manifest_path)
        with open(manifest_path) as f:
            data = json.load(f)
        assert data["name"] == "test-tool"
    
    def test_extract_description_from_readme(self):
        readme = "# My Tool\n\nThis is a great tool for doing things."
        with open(os.path.join(self.temp_dir, "README.md"), "w") as f:
            f.write(readme)
        
        desc = ManifestGenerator._extract_description(self.temp_dir)
        assert "great tool" in desc
    
    def test_validate_manifest_valid(self):
        manifest = {
            "manifest_version": "0.1",
            "name": "test",
            "version": "1.0.0",
            "server": {"type": "python", "command": "python3", "args": ["main.py"]}
        }
        assert ManifestGenerator.validate_manifest(manifest) == True
    
    def test_validate_manifest_invalid(self):
        manifest = {"name": "test"}  # Missing required fields
        with pytest.raises(ValueError):
            ManifestGenerator.validate_manifest(manifest)
```

---

## Task 2.3: Add Node.js Dependency Installer (15 min)

### Objective
Create utility to install Node.js production dependencies.

### Steps

1. Create `/src/mcp_scraper/node_installer.py`:
```python
"""Node.js dependency installation utilities."""
import logging
import os
import subprocess
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class NodeInstallError(Exception):
    """Error during Node.js dependency installation."""
    pass


def install_node_dependencies(
    repo_path: str,
    timeout: int = 300,
    production_only: bool = True
) -> Tuple[bool, Optional[str]]:
    """Install Node.js dependencies for a repository.
    
    Args:
        repo_path: Path to repository with package.json
        timeout: Timeout in seconds
        production_only: Only install production dependencies
    
    Returns:
        Tuple of (success: bool, error_message: Optional[str])
    """
    package_json = os.path.join(repo_path, "package.json")
    if not os.path.exists(package_json):
        return False, "No package.json found"
    
    # Determine command
    lock_file = os.path.join(repo_path, "package-lock.json")
    yarn_lock = os.path.join(repo_path, "yarn.lock")
    
    if os.path.exists(yarn_lock):
        cmd = ["yarn", "install"]
        if production_only:
            cmd.append("--production")
    elif os.path.exists(lock_file):
        cmd = ["npm", "ci"]
        if production_only:
            cmd.append("--production")
    else:
        cmd = ["npm", "install"]
        if production_only:
            cmd.append("--production")
    
    # Add flags to avoid issues
    if cmd[0] == "npm":
        cmd.extend(["--ignore-scripts", "--no-audit", "--no-fund"])
    
    logger.info(f"Running: {' '.join(cmd)} in {repo_path}")
    
    try:
        result = subprocess.run(
            cmd,
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or "Unknown error"
            logger.error(f"npm install failed: {error_msg[:500]}")
            return False, error_msg[:500]
        
        logger.info(f"Successfully installed Node.js dependencies")
        return True, None
        
    except subprocess.TimeoutExpired:
        error_msg = f"npm install timed out after {timeout}s"
        logger.error(error_msg)
        return False, error_msg
    except FileNotFoundError:
        error_msg = "npm/yarn not found on system"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = str(e)
        logger.error(f"npm install error: {error_msg}")
        return False, error_msg


def check_node_available() -> bool:
    """Check if Node.js and npm are available."""
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            timeout=5
        )
        if result.returncode != 0:
            return False
        
        result = subprocess.run(
            ["npm", "--version"],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False
```

2. Add basic tests (actual npm tests may be skipped in CI):
```python
# tests/test_node_installer.py
import os
import json
import tempfile
import pytest
from mcp_scraper.node_installer import install_node_dependencies, check_node_available


class TestNodeInstaller:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_no_package_json(self):
        success, error = install_node_dependencies(self.temp_dir)
        assert success == False
        assert "No package.json" in error
    
    @pytest.mark.skipif(not check_node_available(), reason="Node.js not available")
    def test_simple_package(self):
        # Create minimal package.json
        pkg = {"name": "test", "version": "1.0.0", "dependencies": {}}
        with open(os.path.join(self.temp_dir, "package.json"), "w") as f:
            json.dump(pkg, f)
        
        success, error = install_node_dependencies(self.temp_dir)
        assert success == True
        assert error is None
```

---

## Task 2.4: Integration Test for New Modules (15 min)

### Objective
Create integration test that uses all new modules together.

### Steps

Create `/tests/test_packaging_integration.py`:
```python
"""Integration tests for packaging modules."""
import os
import json
import tempfile
import shutil
import pytest

from mcp_scraper.tool_naming import generate_tool_name
from mcp_scraper.version_extractor import extract_version
from mcp_scraper.runtime_detector import detect_runtime
from mcp_scraper.manifest_generator import ManifestGenerator
from mcp_scraper.archive_creator import ArchiveCreator


class TestPackagingIntegration:
    """Integration tests for the full packaging workflow."""
    
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.repo_dir = os.path.join(self.temp_dir, "repo")
        os.makedirs(self.repo_dir)
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir)
    
    def _create_python_project(self):
        """Create a minimal Python MCP project."""
        # Create main.py
        main_py = '''#!/usr/bin/env python3
import sys
import json

def main():
    print("Python MCP Server")

if __name__ == "__main__":
    main()
'''
        with open(os.path.join(self.repo_dir, "main.py"), "w") as f:
            f.write(main_py)
        
        # Create pyproject.toml
        pyproject = '''[project]
name = "test-mcp"
version = "1.0.0"
'''
        with open(os.path.join(self.repo_dir, "pyproject.toml"), "w") as f:
            f.write(pyproject)
        
        # Create README
        with open(os.path.join(self.repo_dir, "README.md"), "w") as f:
            f.write("# Test MCP\n\nA test MCP server for integration testing.")
    
    def _create_nodejs_project(self):
        """Create a minimal Node.js MCP project."""
        # Create package.json
        pkg = {
            "name": "@owner/test-mcp",
            "version": "2.0.0",
            "description": "A test Node.js MCP server",
            "main": "index.js",
            "bin": {"test-mcp": "./index.js"}
        }
        with open(os.path.join(self.repo_dir, "package.json"), "w") as f:
            json.dump(pkg, f)
        
        # Create index.js
        index_js = '''#!/usr/bin/env node
console.log("Node.js MCP Server");
'''
        with open(os.path.join(self.repo_dir, "index.js"), "w") as f:
            f.write(index_js)
    
    def test_full_python_workflow(self):
        """Test full workflow for Python project."""
        self._create_python_project()
        
        # 1. Generate tool name
        tool_name = generate_tool_name("owner", "test-mcp-server")
        assert tool_name == "test"
        
        # 2. Extract version
        version = extract_version(self.repo_dir)
        assert version == "1.0.0"
        
        # 3. Detect runtime
        runtime = detect_runtime(self.repo_dir)
        assert runtime.runtime_type == "python"
        assert runtime.command == "python3"
        
        # 4. Generate manifest
        manifest = ManifestGenerator.generate(
            self.repo_dir,
            tool_name,
            "https://github.com/owner/test-mcp-server",
            version
        )
        assert manifest["name"] == tool_name
        assert manifest["version"] == "1.0.0"
        assert manifest["server"]["type"] == "python"
        
        # 5. Write manifest
        manifest_path = ManifestGenerator.generate_and_write(
            self.repo_dir,
            tool_name,
            "https://github.com/owner/test-mcp-server",
            version
        )
        assert os.path.exists(manifest_path)
        
        # 6. Create archive
        archive_path = ArchiveCreator.create_zip(
            self.repo_dir,
            os.path.join(self.temp_dir, tool_name)
        )
        assert archive_path.endswith(".zip")
        assert os.path.exists(archive_path)
        
        # 7. Verify archive contains manifest
        import zipfile
        with zipfile.ZipFile(archive_path, 'r') as zf:
            names = zf.namelist()
            assert "manifest.json" in names
            assert "main.py" in names
    
    def test_full_nodejs_workflow(self):
        """Test full workflow for Node.js project."""
        self._create_nodejs_project()
        
        # 1. Generate tool name
        tool_name = generate_tool_name("owner", "test-mcp")
        assert tool_name == "test"
        
        # 2. Extract version
        version = extract_version(self.repo_dir)
        assert version == "2.0.0"
        
        # 3. Detect runtime
        runtime = detect_runtime(self.repo_dir)
        assert runtime.runtime_type == "node"
        
        # 4. Generate and write manifest
        ManifestGenerator.generate_and_write(
            self.repo_dir,
            tool_name,
            "https://github.com/owner/test-mcp",
            version
        )
        
        # 5. Create archive
        archive_path = ArchiveCreator.create_tar_gz(
            self.repo_dir,
            os.path.join(self.temp_dir, tool_name)
        )
        assert archive_path.endswith(".tar.gz")
        
        # 6. Verify archive info
        info = ArchiveCreator.get_archive_info(archive_path)
        assert info["file_count"] >= 3  # package.json, index.js, manifest.json
```

Run integration tests:
```bash
cd /Users/adam/Documents/GitHub/mcp_scraper
python -m pytest tests/test_packaging_integration.py -v
```

---

## Verification Checklist

- [ ] runtime_detector.py detects Python and Node.js correctly
- [ ] manifest_generator.py creates valid manifests
- [ ] node_installer.py can install dependencies (if Node available)
- [ ] Integration test passes for both Python and Node.js workflows
- [ ] All unit tests pass

### Run Full Test Suite
```bash
python -m pytest tests/test_runtime_detector.py tests/test_manifest_generator.py tests/test_packaging_integration.py -v
```

---

## Sprint 2 Complete

Proceed to **Sprint 3** for repository downloader updates.
