# Software Engineer Proposal: Polyglot Lambda MCP Adapter

**Epic:** Epic 3 - Multi-language & Multi-compression Support  
**Date:** February 15, 2026  
**Author:** Senior Software Engineer  
**Status:** Draft

---

## 1. Design Thought Process

### Objective
Extend the current Node.js-only Lambda adapter to support a wide range of programming languages (Python, Java, Go, Rust, C#, TypeScript) and compression formats, improving versatility and reliability.

### Architectural Decisions

#### A. The "Universal" Runtime Environment
To support dynamic loading of tools in different languages, the Lambda execution environment (Docker container) must provide the necessary runtimes.
*   **Node.js (Existing):** Native support.
*   **Python:** Pre-install `python3` and `pip` in the Docker image.
*   **Compiled Languages (Go, Rust):** These produce standalone binaries. No specific runtime is needed, but we must ensure the build target matches the Lambda OS (Amazon Linux 2023).
*   **Java / C#:** These require heavy runtimes (JVM, CLR).
    *   *Strategy:* We will include a headless JRE for Java. For C#, we will recommend Self-Contained deployment (Native AOT or single-file publish) to keep the base image size manageable and reduce cold start times. If .NET runtime is strictly required, we can add it, but it increases image bloat.

#### B. Manifest-Based Execution (`mcp.json`)
Relying on file heuristics (finding `node_modules` or `.bin`) is brittle across languages. We introduce an optional `mcp.json` manifest file at the root of the tool package.
*   This allows tool authors to explicitly define the `entrypoint`, `runtime`, and `args`.
*   *Fallback:* If no manifest exists, we retain the current heuristic logic for backward compatibility (Node.js) and extend it slightly for Python (looking for `main.py` or `__main__.py`).

#### C. Compression & Storage
*   **Support:** Add support for `.tar.gz` in addition to `.zip`.
*   **Logic:** Detect mime-type or file extension to select the correct extraction tool (`unzip` vs `tar`).

#### D. Reliability Improvements
*   **Process Management:** enhanced signal handling to ensure child processes are killed cleanly on timeout.
*   **Error Reporting:** Capture `stderr` more robustly and wrap execution errors in JSON-RPC error responses where possible.

---

## 2. Dynamic Loader Logic (Pseudo-code)

The core logic in `index.js` will be refactored to a `ToolLoader` class.

```javascript
class ToolLoader {
  async loadAndRun(toolName, version, requestPayload) {
    // 1. Check Cache
    if (!isCached(toolName, version)) {
      await this.downloadAndExtract(toolName, version);
    }

    // 2. Resolve Runtime Configuration
    const config = this.resolveRuntimeConfig(toolName, version);
    
    // 3. Spawn Process
    const child = spawn(config.executable, config.args, {
      cwd: config.installDir,
      env: { ...process.env, ...config.env }
    });

    // 4. Stream I/O
    // ... (existing piping logic)
  }

  resolveRuntimeConfig(toolName, version) {
    const installDir = path.join(BASE_PATH, `${toolName}-${version}`);
    const manifestPath = path.join(installDir, 'mcp.json');

    // Strategy A: Manifest (Preferred)
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath));
      return this.parseManifest(manifest, installDir);
    }

    // Strategy B: Heuristics (Fallback)
    return this.detectRuntime(installDir, toolName);
  }

  detectRuntime(installDir, toolName) {
    if (fs.existsSync(path.join(installDir, 'package.json'))) {
      return { runtime: 'node', executable: 'node', args: [ /* entrypoint */ ] };
    }
    if (fs.existsSync(path.join(installDir, 'requirements.txt')) || fs.existsSync(path.join(installDir, 'main.py'))) {
      return { runtime: 'python', executable: 'python3', args: ['main.py'] };
    }
    // Check for binary
    const binPath = findBinary(installDir, toolName);
    if (binPath) return { runtime: 'binary', executable: binPath, args: [] };

    throw new Error("Could not detect tool runtime");
  }
}
```

---

## 3. Practical Implementation Details

### A. Manifest Schema (`mcp.json`)
This simple JSON file allows developers to configure how their tool runs.

```json
{
  "specVersion": "1.0",
  "runtime": "python", 
  "executable": "src/main.py",
  "env": {
    "LOG_LEVEL": "debug"
  },
  "installCommands": [
    "pip install -r requirements.txt -t ."
  ]
}
```
*   `runtime`: `node`, `python`, `java`, `binary` (default).
*   `executable`: Path to the script or binary relative to package root.

### B. Dockerfile Updates
We need to add Python and potentially Java to the base image.

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# Install System Dependencies
# - unzip: for .zip files
# - tar, gzip: for .tar.gz files
# - python3, pip: for Python tools
# - java-21-amazon-corretto-headless: for Java tools (optional, increases size)
RUN dnf install -y \
    unzip \
    tar \
    gzip \
    python3 \
    python3-pip \
    java-21-amazon-corretto-headless \
    && dnf clean all \
    && rm -rf /var/cache/dnf

# ... rest of Dockerfile ...
```

### C. Node.js `downloadAndExtract` Update
Handling multiple compression formats.

```javascript
const { execSync } = require('child_process');

async function downloadAndExtract(bucket, key, installDir) {
  // ... download logic ...
  const filename = path.basename(key);
  const localPath = path.join(BASE_PATH, filename);

  if (filename.endsWith('.zip')) {
    execSync(`unzip -o -q "${localPath}" -d "${installDir}"`);
  } else if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) {
    fs.mkdirSync(installDir, { recursive: true });
    execSync(`tar -xzf "${localPath}" -C "${installDir}"`);
  } else {
    throw new Error(`Unsupported file extension: ${filename}`);
  }
}
```

### D. Python Runtime Handling
For Python, we might need to handle dependencies dynamically if they aren't pre-packaged (vendored) in the zip.
*   *Recommendation:* Enforce that tools bundle their `site-packages` in the uploaded artifact to avoid running `pip install` at runtime (which is slow and requires write access/internet).
*   *Env Setup:* `PYTHONPATH` must include the current directory and any bundled `site-packages`.

```javascript
function getPythonConfig(installDir, entrypoint) {
  return {
    executable: 'python3',
    args: [path.join(installDir, entrypoint)],
    env: {
      PYTHONPATH: `${installDir}:${path.join(installDir, 'site-packages')}`
    }
  };
}
```

### E. Compiled Binaries (Go, Rust)
For Go and Rust, the "executable" is just the binary itself.
*   Ensure `chmod +x` is applied to the binary after extraction.

## 4. Security Considerations
1.  **Input Validation:** Strictly validate `tool` and `version` to prevent path traversal, though S3 keys are generally safe if constructed carefully.
2.  **Resource Limits:** The Lambda has memory/timeout limits. Child processes inherit these but we should enforce a `kill` if they hang.
3.  **Read-Only Filesystem:** Lambda's `/var/task` is read-only. We only write to `/tmp`. Ensure tools know they can only write to `/tmp`.

## 5. Next Steps
1.  Update `Dockerfile` with new runtimes.
2.  Refactor `index.js` to implement the `ToolLoader` class and Manifest parsing.
3.  Create sample "Hello World" MCP tools in Python and Go to verify the flow.
