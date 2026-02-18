# Deployment Engineer Proposal: Universal Lambda MCP Adapter

## 1. Design Thought Process

### Problem Analysis
The current implementation of the Lambda MCP Adapter is optimized for Node.js environments. It relies on `npm` conventions (symlinks in `.bin`) and supports only `.zip` compression. To support a polyglot ecosystem (TypeScript, Python, Java, Rust, C#, Go), we need to address three main challenges:

1.  **Runtime Availability**: The Lambda environment must have the necessary runtimes (Python interpreter, JVM, .NET Runtime) or the ability to execute standalone binaries (Rust, Go).
2.  **Execution Contract**: The adapter cannot guess how to run a tool (e.g., `python main.py` vs `java -jar tool.jar`). We need an explicit contract.
3.  **Packaging Flexibility**: Different ecosystems prefer different archives (e.g., `.tar.gz` for Linux-heavy workflows, `.zip` for Windows/General).

### Proposed Architecture

We propose moving from an **implicit discovery model** (scanning directories for binaries) to an **explicit manifest-based model**.

#### Key Design Decisions:
*   **Universal Docker Image**: We will extend the base Lambda image to include common runtimes (Python, Java, .NET). While this increases image size, it provides the most flexibility for a "Universal Adapter".
*   **The `mcp.json` Manifest**: Every tool package must include a manifest file in its root. This file tells the adapter which runtime to use and the entry point script/binary.
*   **Format Agnostic Extraction**: The adapter will detect file signatures or extensions to determine whether to use `unzip` or `tar`.

## 2. Implementation Strategy (Pseudo-code)

### The Manifest Schema (`mcp.json`)
```json
{
  "mcpVersion": "1.0",
  "name": "weather-tool",
  "version": "1.0.0",
  "runtime": "python", 
  "executable": "src/main.py",
  "args": ["--verbose"],
  "env": {
    "API_KEY_ENV": "WEATHER_API_KEY"
  }
}
```
*Supported runtimes:* `node`, `python`, `java`, `dotnet`, `binary` (for Rust/Go).

### Deployment Pipeline Logic
1.  **Build Stage**: Compile/bundle code based on language.
2.  **Manifest Generation**: Create `mcp.json` automatically if possible, or validate user-provided one.
3.  **Packaging**: Compress into `.zip` or `.tar.gz`.
4.  **Upload**: Push to S3 `packages/{tool}/{version}.{ext}`.

### Adapter Execution Logic (Pseudo-code)
```javascript
function handleRequest(tool, version) {
    // 1. Download
    file = downloadFromS3(tool, version)
    
    // 2. Extract
    if file.endsWith('.zip') -> unzip(file, targetDir)
    if file.endsWith('.tar.gz') -> tar_extract(file, targetDir)
    
    // 3. Resolve Execution Command
    manifest = readJson(targetDir + "/mcp.json")
    
    cmd = ""
    args = []
    
    switch (manifest.runtime) {
        case "python":
            cmd = "python3"
            args = [targetDir + "/" + manifest.executable]
            break
        case "java":
            cmd = "java"
            args = ["-jar", targetDir + "/" + manifest.executable]
            break
        case "node":
            cmd = "node" // or full path to node
            args = [targetDir + "/" + manifest.executable]
            break
        case "binary":
            cmd = targetDir + "/" + manifest.executable
            makeExecutable(cmd)
            break
    }
    
    // 4. Spawn & Stream
    process = spawn(cmd, args, env=manifest.env)
    pipeStdio(process)
}
```

## 3. Practical Code Snippets

### A. Dockerfile Updates (Adding Runtimes)
We need to install the necessary runtimes in the Lambda environment.

```dockerfile
# MCPJungle-Orchestrator-CodeMode-Merge/orchestrator/infrastructure/lambda/Dockerfile

FROM public.ecr.aws/lambda/nodejs:20

# Install dependencies for polyglot support
RUN dnf update -y && \
    dnf install -y \
    unzip \
    tar \
    gzip \
    python3 \
    python3-pip \
    java-17-amazon-corretto-headless \
    # Install minimal .NET Runtime dependencies (ICU, krb5, etc if needed) or the runtime itself
    # Note: For .NET, self-contained single-file publish is preferred to keep image small,
    # but for full support we can install the runtime via Microsoft repository if needed.
    && dnf clean all

# Ensure Python pip is up to date
RUN python3 -m pip install --upgrade pip

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src/index.js ./index.js

CMD [ "index.handler" ]
```

### B. Updated `index.js` Extraction & Execution Logic

```javascript
// Function to determine extraction method
async function extractPackage(filePath, installDir) {
  if (filePath.endsWith('.zip')) {
     execSync(`unzip -o -q "${filePath}" -d "${installDir}"`);
  } else if (filePath.endsWith('.tar.gz') || filePath.endsWith('.tgz')) {
     // Create dir if not exists
     fs.mkdirSync(installDir, { recursive: true });
     execSync(`tar -xzf "${filePath}" -C "${installDir}"`);
  } else {
     throw new Error("Unsupported file format");
  }
}

// Function to resolve command from manifest
function resolveCommand(installDir) {
  const manifestPath = path.join(installDir, 'mcp.json');
  
  // Legacy Fallback (Node.js/Binary detection)
  if (!fs.existsSync(manifestPath)) {
      const binPath = findBinaryPath(installDir); // Existing logic
      if (binPath) return { cmd: binPath, args: [] };
      // Default to trying index.js if it exists
      if (fs.existsSync(path.join(installDir, 'index.js'))) {
          return { cmd: 'node', args: [path.join(installDir, 'index.js')] };
      }
      throw new Error("No mcp.json found and no binary detected");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const executable = path.join(installDir, manifest.executable);

  switch (manifest.runtime) {
      case 'python':
          return { cmd: 'python3', args: [executable, ...(manifest.args || [])] };
      case 'java':
          return { cmd: 'java', args: ['-jar', executable, ...(manifest.args || [])] };
      case 'dotnet':
          // Assuming portable executable or dll
          if (executable.endsWith('.dll')) {
             return { cmd: 'dotnet', args: [executable, ...(manifest.args || [])] };
          }
          return { cmd: executable, args: manifest.args || [] };
      case 'node':
          return { cmd: 'node', args: [executable, ...(manifest.args || [])] };
      case 'binary':
      default:
          fs.chmodSync(executable, '755');
          return { cmd: executable, args: manifest.args || [] };
  }
}
```

### C. Build Script Patterns (`package-tool.sh` extension)

**Python Build Pattern:**
```bash
# setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt --target ./dist

# copy code
cp -r src/* ./dist/

# create manifest
cat <<EOF > ./dist/mcp.json
{
  "name": "$TOOL_NAME",
  "version": "$VERSION",
  "runtime": "python",
  "executable": "main.py"
}
EOF

# tar it
tar -czf "$TOOL_NAME-$VERSION.tar.gz" -C dist .
```

**Go Build Pattern:**
```bash
# cross-compile for Lambda (Linux AMD64)
GOOS=linux GOARCH=amd64 go build -o dist/tool-binary main.go

# create manifest
cat <<EOF > dist/mcp.json
{
  "name": "$TOOL_NAME",
  "version": "$VERSION",
  "runtime": "binary",
  "executable": "tool-binary"
}
EOF

# zip it
cd dist && zip -r ../"$TOOL_NAME-$VERSION.zip" .
```
