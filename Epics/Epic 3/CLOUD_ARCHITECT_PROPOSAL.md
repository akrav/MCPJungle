# Multi-Language & Multi-Compression Support for Lambda MCP Adapter

## 1. Design Thought Process

### Current Limitations
The current implementation is tightly coupled to Node.js:
- **Runtime**: Relies on `node_modules/.bin` conventions for execution.
- **Packaging**: Only supports `.zip` files.
- **Environment**: Based on `public.ecr.aws/lambda/nodejs:20`, which lacks runtimes for Python, Java, or .NET by default.

### Architectural Strategy
To support a polyglot environment (TypeScript, Python, Java, Go, Rust, C#) without creating a massive "kitchen sink" image or managing complex layer dependencies dynamically, we propose a **tiered runtime approach**:

1.  **Core Runtime (Node.js)**: The orchestrator logic remains in Node.js for its excellent async I/O and stream handling capabilities.
2.  **Extended Runtimes (Python, Java)**: Add popular interpreted/bytecode runtimes to the base Docker image. These have negligible cold start impact compared to dynamic installation.
3.  **Binary Compatibility (Go, Rust, C#)**: Treat compiled languages as self-contained executables. The adapter's role is simply to `exec` them.

### Key Decisions
1.  **Manifest-Driven Execution**: Introduce an optional `mcp.json` manifest file in the tool package. This decouples the adapter from language-specific heuristics and allows developers to specify the exact entry point (e.g., `java -jar tool.jar` or `./my-binary`).
2.  **Universal Compression Support**: Detect file types by extension or magic numbers and use appropriate tools (`tar`, `unzip`) available in the Amazon Linux base.
3.  **Dependency Isolation**:
    - **Python**: Recommend shipping a virtual environment (`venv`) or using a self-contained executable (e.g., PyInstaller) to avoid dependency hell.
    - **Node/TS**: Continue supporting `node_modules`.
    - **Java**: Uber-JARs.
    - **Go/Rust**: Statically linked binaries.

---

## 2. Updated Architecture & Pseudo-Code

### Infrastructure Changes (Dockerfile)
We need to extend the base image to include necessary runtimes and utilities.

**Dockerfile (Conceptual):**
```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# Install system dependencies and additional runtimes
RUN dnf install -y \
    python3 \
    python3-pip \
    java-17-amazon-corretto-headless \
    tar \
    gzip \
    unzip \
    && dnf clean all

# ... rest of the setup
```

### Handler Logic Updates (Pseudo-code)

The `index.js` handler needs two major updates:
1.  **Decompression Logic**: Switch on file extension.
2.  **Execution Logic**: Check for `mcp.json` first, then fall back to heuristics.

**Pseudo-code for `index.js`:**

```javascript
// New Helper: Decompress
async function extractPackage(filePath, destination) {
  if (filePath.endsWith('.zip')) {
    execSync(`unzip -o -q "${filePath}" -d "${destination}"`);
  } else if (filePath.endsWith('.tar.gz') || filePath.endsWith('.tgz')) {
    // Ensure destination exists
    execSync(`mkdir -p "${destination}"`);
    execSync(`tar -xzf "${filePath}" -C "${destination}"`);
  } else {
    throw new Error('Unsupported compression format');
  }
}

// New Helper: Determine Execution Command
function getExecutionCommand(installDir, toolName) {
  const manifestPath = path.join(installDir, 'mcp.json');
  
  // 1. Manifest Priority
  if (fs.existsSync(manifestPath)) {
    const config = JSON.parse(fs.readFileSync(manifestPath));
    // Validates that command exists and is safe
    return {
      command: config.executable, // e.g., "python3", "java", "./bin/tool"
      args: config.args || []     // e.g., ["main.py"], ["-jar", "tool.jar"]
    };
  }

  // 2. Heuristics Fallback
  // Python
  if (fs.existsSync(path.join(installDir, 'main.py'))) {
    return { command: 'python3', args: ['main.py'] };
  }
  if (fs.existsSync(path.join(installDir, 'requirements.txt'))) {
     // Warning: Dependencies might not be installed
     // Check for venv/bin/python
  }

  // Node.js (Existing logic)
  const binary = findBinaryPath(installDir, toolName);
  if (binary) {
    return { command: binary, args: [] };
  }

  // Java
  const jarFiles = glob.sync('*.jar', { cwd: installDir });
  if (jarFiles.length === 1) {
    return { command: 'java', args: ['-jar', jarFiles[0]] };
  }

  throw new Error('Could not determine entry point');
}

// ... inside handler ...
// Replace downloadAndExtract call with new logic
await downloadAndExtract(..., extractPackage); 

// Replace spawn logic
const { command, args } = getExecutionCommand(installDir, toolName);
const child = spawn(command, args, { cwd: installDir, ... });
```

---

## 3. Practical Implementation Details

### A. Dockerfile Updates

We will use `dnf` (Dandified YUM) which is standard in Amazon Linux 2023 (the base for `nodejs:20`).

```dockerfile
# infrastructure/lambda/Dockerfile

FROM public.ecr.aws/lambda/nodejs:20

WORKDIR /var/task

# Install extended language support and tools
# - python3: For Python scripts
# - java-17...: For Java tools
# - tar/gzip: For .tar.gz support
# - unzip: For .zip support (already there)
RUN dnf install -y \
    python3 \
    java-17-amazon-corretto-headless \
    tar \
    gzip \
    unzip \
    shadow-utils \
    && dnf clean all \
    && rm -rf /var/cache/dnf

# Copy package.json and install Node deps
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src/index.js ./index.js

CMD [ "index.handler" ]
```

### B. Manifest Specification (`mcp.json`)

To support C#, Go, and Rust reliably, we should encourage tool authors to include a simple manifest.

**Example `mcp.json` for a Python tool:**
```json
{
  "runtime": "python",
  "executable": "python3",
  "args": ["src/main.py"],
  "env": {
    "PYTHONPATH": "./src"
  }
}
```

**Example `mcp.json` for a Go/Rust binary:**
```json
{
  "runtime": "binary",
  "executable": "./my-tool-linux-amd64",
  "args": []
}
```

### C. Updated `index.js` Snippets

Here is the specific logic to add to `src/index.js` to support the new requirements.

**1. Enhanced Extraction:**

```javascript
// In src/index.js

async function downloadAndExtract(toolName, version, installDir) {
  // ... (setup paths) ...
  
  // Detect extension from Key or Content-Type (S3) could be useful, 
  // but for now let's assume we look at the file signature or just try standard extensions.
  // Ideally, the S3 key should preserve the extension.
  
  const keyBase = `packages/${toolName}/${version}`;
  // We might need to check which file exists if extension is variable
  // Or passing the extension in query params.
  // For MVP, we can try .zip then .tar.gz
  
  // ... (download logic) ...

  // Extraction
  if (downloadPath.endsWith('.tar.gz') || downloadPath.endsWith('.tgz')) {
      execSync(`tar -xzf "${downloadPath}" -C "${installDir}"`);
  } else {
      execSync(`unzip -o -q "${downloadPath}" -d "${installDir}"`);
  }
}
```

**2. Polyglot Execution:**

```javascript
function getRunConfig(installDir, toolName) {
  const manifestPath = path.join(installDir, 'mcp.json');
  
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return {
        command: manifest.executable,
        args: manifest.args || [],
        env: manifest.env || {}
      };
    } catch (e) {
      log('WARN', 'Failed to parse mcp.json', { error: e.message });
    }
  }

  // Heuristics for backward compatibility and simple tools
  
  // 1. Python (look for main.py or __main__.py)
  if (fs.existsSync(path.join(installDir, 'main.py'))) {
    return { command: 'python3', args: ['main.py'] };
  }

  // 2. Node.js (Standard binary)
  const nodeBin = findBinaryPath(installDir, toolName);
  if (nodeBin) {
    return { command: nodeBin, args: [] };
  }
  
  // 3. Java (Simple jar detection)
  // ...

  throw new Error(`No execution entry point found for ${toolName}`);
}
```

### D. Recommendations for Compiled Languages (Go, Rust, C#)

Since Lambda runs on Linux (usually AMD64 or ARM64), developers must compile their tools for the correct target architecture.

*   **Go**: `GOOS=linux GOARCH=amd64 go build -o my-tool`
*   **Rust**: `cargo build --release --target x86_64-unknown-linux-gnu`
*   **C#**: `dotnet publish -c Release -r linux-x64 --self-contained` (produces a single binary) or rely on the .NET runtime if we decide to install it (adds ~100MB to image). **Recommendation:** Use self-contained binaries for C# to keep the Lambda image lean, or add .NET runtime if many C# tools are expected.

### Reliability & Security
*   **Timeouts**: Different languages have different startup times (JVM vs Node vs Native). The `POST_TIMEOUT_MS` might need dynamic adjustment or a generous default (current 120s is good).
*   **Disk Space**: Clean up `/tmp` aggressively. `tar` and `unzip` can fill up space.
*   **Permissions**: Ensure `chmod +x` is run on the detected executable defined in `mcp.json`.
