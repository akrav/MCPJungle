# Generalized AWS Lambda MCP Adapter - Polyglot Implementation Proposal

## 1. Code Architecture

To support multiple languages and runtimes while maintaining reliability and performance, we will refactor the monolithic `index.js` into a modular class-based architecture.

### Class Structure

1.  **`LambdaAdapter`**: The main entry point. Orchestrates the request lifecycle:
    *   Validates input (tool, version).
    *   Delegates to `PackageManager` to ensure tool availability.
    *   Delegates to `RuntimeDetector` to identify execution strategy.
    *   Delegates to `ProcessExecutor` to run the tool and stream results.

2.  **`PackageManager`**:
    *   Handles S3 operations (check, download).
    *   Manages local filesystem (extraction, caching, cleanup).
    *   Ensures `chmod +x` on binaries.

3.  **`RuntimeDetector`**:
    *   Analyzes the installed package (file structure, `package.json`, `requirements.txt`, etc.).
    *   Selects the appropriate `RuntimeHandler`.

4.  **`RuntimeHandler` (Strategy Pattern)**:
    *   Abstract base class or interface.
    *   Implementations: `NodeHandler`, `PythonHandler`, `JavaHandler`, `BinaryHandler` (Go/Rust).
    *   Methods:
        *   `getCommand(installDir): { command, args }`
        *   `getEnvironment(installDir): Object`

5.  **`ProcessExecutor`**:
    *   Wraps `child_process.spawn`.
    *   Manages `stdin`/`stdout`/`stderr` streams.
    *   Handles timeouts and zombie process cleanup (SIGTERM/SIGKILL).
    *   Formats output as Server-Sent Events (SSE).

### Pseudo-code

```javascript
// main.js
exports.handler = streamifyResponse(async (event, responseStream, context) => {
  const adapter = new LambdaAdapter(event, responseStream, context);
  await adapter.run();
});

class LambdaAdapter {
  async run() {
    try {
      const { tool, version } = this.parseParams();
      const installDir = await this.packageManager.ensurePackage(tool, version);
      
      const runtime = RuntimeDetector.detect(installDir);
      const executor = new ProcessExecutor(runtime, this.responseStream);
      
      if (this.isPost()) {
        await executor.writeInput(this.getBody());
      }
      
      await executor.spawnAndStream();
    } catch (error) {
      this.handleError(error);
    }
  }
}
```

---

## 2. Language-Specific Handlers

Each handler is responsible for constructing the correct spawn command and environment.

### Node.js / TypeScript (`NodeHandler`)
*   **Detection**: Presence of `package.json`.
*   **Strategy**:
    1.  **Modern**: If `package.json` has `scripts.start`, use `npm run start`.
    2.  **Legacy/Simple**: Look for `dist/index.js`, `src/index.ts` (if `tsx` available), or `index.js`.
    3.  **Binaries**: Look for `.bin` executables as fallback.
*   **TypeScript**: If `tsconfig.json` is present and no build script, try running with `tsx` (bundled in Lambda layer) or `node -r ts-node/register`.

### Python (`PythonHandler`)
*   **Detection**: Presence of `requirements.txt`, `pyproject.toml`, or `*.py` files.
*   **Strategy**:
    *   Command: `python3 -u` (Force unbuffered binary stdout is critical for real-time SSE).
    *   Entry Point: Search for `main.py`, `app.py`, `__main__.py`, or fallback to `index.py`.
    *   **Virtualenv**: If a `venv` or `.venv` directory exists (pre-packaged), update `PATH` and `PYTHONPATH` to use it.
    *   **Dependencies**: If no venv, assume dependencies are vendored or layer-provided.

### Java (`JavaHandler`)
*   **Detection**: Presence of `pom.xml`, `build.gradle`, or `*.jar` files.
*   **Strategy**:
    *   Command: `java`.
    *   Args: `['-jar', '/path/to/tool.jar']`.
    *   **Memory**: Set `-Xmx` to match Lambda memory limit (minus overhead).

### Go / Rust / Native (`BinaryHandler`)
*   **Detection**: Presence of binary file (ELF header check or naming convention like `tool-name_linux_amd64`).
*   **Strategy**:
    *   Command: Direct path to binary.
    *   **Permissions**: Ensure `chmod +x` is applied by `PackageManager`.

---

## 3. Streaming & IO

Robust I/O handling is the core of this adapter.

### Standard Output (Tool -> SSE)
We pipe the tool's `stdout` directly to the Lambda `responseStream`, wrapping each line in SSE format.

*   **Buffering**: Default Node `spawn` buffers. We must ensure the tool flushes `stdout` aggressively (e.g., `python -u`).
*   **Protocol**:
    *   `stdout` lines -> `event: message\ndata: <line>\n\n`
    *   `stderr` lines -> `event: log\ndata: <line>\n\n` (Optional, or log to CloudWatch).

### Standard Input (POST -> Tool)
For JSON-RPC requests (POST), the body is written to the tool's `stdin`.

*   **Newline**: Always append `\n` to the input body to ensure the tool's stdin reader triggers.
*   **Encoding**: UTF-8.

### Error Handling & Cleanup
*   **Stderr**: Capture and log to CloudWatch. If the process crashes, send the last N lines of stderr as an SSE `error` event.
*   **Zombies**:
    *   On timeout or error, send `SIGTERM`.
    *   Wait 500ms, then `SIGKILL`.
    *   Use `tree-kill` or similar logic if the tool spawns its own subprocesses.

---

## 4. Practical Code Snippets

### `ProcessExecutor.spawnAndStream` Implementation

```javascript
const { spawn } = require('child_process');

class ProcessExecutor {
  constructor(runtimeHandler, responseStream) {
    this.runtime = runtimeHandler;
    this.stream = responseStream;
    this.child = null;
  }

  async spawnAndStream(installDir) {
    const { command, args } = this.runtime.getCommand(installDir);
    const env = { 
      ...process.env, 
      ...this.runtime.getEnvironment(installDir),
      PYTHONUNBUFFERED: '1', // Critical for Python
      NO_COLOR: '1'          // Cleaner logs
    };

    console.log(`Spawning: ${command} ${args.join(' ')}`);

    this.child = spawn(command, args, {
      cwd: installDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
    });

    // Pipe stdout to SSE
    this.child.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          this.stream.write(`event: message\ndata: ${line}\n\n`);
        }
      }
    });

    // Log stderr
    this.child.stderr.on('data', (chunk) => {
      console.log(`[STDERR]: ${chunk.toString().trim()}`);
      // Optional: Stream stderr to client as logs
      // this.stream.write(`event: log\ndata: ${chunk.toString()}\n\n`);
    });

    return new Promise((resolve, reject) => {
      this.child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Send error event before closing stream
          this.stream.write(`event: error\ndata: Process exited with code ${code}\n\n`);
          resolve(); // Resolve to allow clean stream end
        }
      });
      
      this.child.on('error', (err) => {
        console.error('Spawn error:', err);
        this.stream.write(`event: error\ndata: Failed to spawn process: ${err.message}\n\n`);
        resolve();
      });
    });
  }

  async writeInput(data) {
    if (this.child && this.child.stdin) {
      // Ensure newline for line-buffered readers
      const input = typeof data === 'string' ? data : JSON.stringify(data);
      this.child.stdin.write(input + '\n');
      this.child.stdin.end(); // Or keep open? Usually end for single request if not persistent
    }
  }

  kill() {
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');
      setTimeout(() => {
        if (this.child && !this.child.killed) {
          this.child.kill('SIGKILL');
        }
      }, 500); // Force kill after 500ms
    }
  }
}
```

### `RuntimeDetector` Snippet

```javascript
const fs = require('fs');
const path = require('path');

class RuntimeDetector {
  static detect(installDir) {
    const files = fs.readdirSync(installDir);

    // 1. Python Detection
    if (files.includes('requirements.txt') || files.some(f => f.endsWith('.py'))) {
      const entry = files.find(f => ['main.py', 'app.py', 'index.py'].includes(f)) || files.find(f => f.endsWith('.py'));
      return new PythonHandler(entry);
    }

    // 2. Node Detection
    if (files.includes('package.json')) {
      return new NodeHandler();
    }

    // 3. Go/Binary Detection
    // Simplistic check for now - executable file with same name as directory?
    // Or look for specific binary naming convention
    const binFile = files.find(f => !f.includes('.') && fs.statSync(path.join(installDir, f)).mode & 0o111);
    if (binFile) {
      return new BinaryHandler(binFile);
    }

    throw new Error('Unknown runtime type');
  }
}
```
