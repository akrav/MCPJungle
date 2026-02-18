# MCP Lambda Generalization Plan

## Current Architecture Analysis

The existing Lambda infrastructure is designed specifically for **Node.js-based MCP tools** packaged as ZIP files.

### How it currently works:
1.  **Trigger**: The Lambda is invoked with `?tool=<name>&version=<version>`.
2.  **Download**: It blindly downloads `s3://<bucket>/packages/<name>/<version>.zip`.
3.  **Extraction**: It assumes the package is a ZIP file and uses the system `unzip` utility to extract it to `/tmp`.
4.  **Discovery**: It has hardcoded logic to find the executable. It specifically looks in `node_modules/.bin/` for files named `<tool>-mcp`, `<tool>`, or `mcp-<tool>`.
5.  **Execution**: It spawns the found binary. Since the environment is `nodejs:20`, this works well for Node.js scripts linked in `.bin`.
6.  **IO**: It pipes JSON-RPC via `stdin` and streams `stdout` back as Server-Sent Events (SSE).

### Limitations:
*   **Language Lock-in**: It implicitly assumes Node.js structure (`node_modules`). It won't know how to run a Python script (`python main.py`) or a compiled binary in the root.
*   **Runtime Dependencies**: The Docker image only provides Node.js 20. Python, Ruby, or other interpreters are missing.
*   **Compression Rigidity**: It only supports `.zip`.
*   **Entry Point Ambiguity**: It relies on guessing the binary name, which is fragile.

---

## Generalization Strategy

To support 90% of use cases (Node.js, Python, Compiled Binaries) and flexible packaging, we need to decouple the *fetching* mechanism from the *execution* mechanism.

### 1. Unified Configuration ( The "Manifest" )

We need a standardized way to tell the Lambda how to run the tool. We shouldn't rely on guessing file paths.

**Proposal: `mcp.json`**
Every MCP package should include a `mcp.json` at its root.

```json
{
  "spec": "1.0",
  "runtime": "python3.11", // or "nodejs20", "binary"
  "command": ["python", "main.py"], // or ["./my-binary"]
  "env": {
    "PYTHONUNBUFFERED": "1"
  }
}
```

If this file is missing, we can fall back to the current auto-discovery logic for backward compatibility.

### 2. The "Mega-Runtime" Docker Image

To run tools in different languages, the Lambda environment must have the necessary interpreters installed.

**Proposal**: Update the `Dockerfile` to include common runtimes.
*   **Base**: Amazon Linux 2023 (or similar).
*   **Install**:
    *   Node.js (v20/v22)
    *   Python (v3.11/v3.12) + `pip`
    *   (Optional) Java / Go runtimes if needed (Go/Rust usually compile to standalone binaries, so they just need libc/musl compatibility).
    *   Utilities: `unzip`, `tar`, `gzip`, `bzip2`.

*Trade-off*: This increases the image size. However, Lambda supports container images up to 10GB, so a Node+Python combo is well within limits (likely <1GB).

### 3. Flexible Decompression

The code should detect the file format and extract accordingly.

**Proposal**:
*   Check file extension (e.g., `.zip`, `.tar.gz`, `.tgz`).
*   Or use `file` command/magic bytes to detect type.
*   Switch extraction command:
    *   ZIP: `unzip -o ...`
    *   Tarball: `tar -xzf ...`

### 4. Code Structure Refactor

Refactor `src/index.js` into modular components:

*   `PackageManager`: Handles downloading (S3) and extracting (Zip/Tar).
*   `RuntimeDetector`: Reads `mcp.json` or heuristics to determine the command.
*   `ProcessManager`: Spawns the process and handles IO streaming.

---

## Plan of Attack (Step-by-Step)

### Phase 1: Environment Upgrade (The "Mega-Image")
**Goal**: Enable the Lambda to physically run Python and other binaries.
1.  Modify `orchestrator/infrastructure/lambda/Dockerfile`.
2.  Switch base image or add `dnf install python3 python3-pip`.
3.  Add `tar` and `gzip` for broader compression support.

### Phase 2: Configuration & Discovery
**Goal**: Explicitly define how to run a tool.
1.  Define the `mcp.json` schema.
2.  Update `src/index.js` to look for this file after extraction.
3.  If found, use the `command` specified in the JSON.
4.  If not found, keep the existing `node_modules/.bin` lookup as a fallback.

### Phase 3: Compression Support
**Goal**: Support `.tar.gz` and uncompressed files.
1.  Update the S3 retrieval logic.
    *   Current: `packages/<tool>/<version>.zip`
    *   New: Check metadata or try multiple extensions? Or simply support whatever extension is passed/stored.
    *   *Better approach*: The Orchestrator (or the caller) should probably tell Lambda what the filename is, OR Lambda lists the S3 prefix to find the artifact.
2.  Implement `extractPackage(filePath, targetDir)` helper that chooses `unzip` or `tar`.

### Phase 4: Testing & Verification
1.  Create a **Python MCP** (simple "hello world").
2.  Package it with `mcp.json`.
3.  Upload to S3.
4.  Invoke Lambda and verify it runs using the Python interpreter.

---

## Alternative Options Considered

### Option B: Multiple Specialized Lambdas
Instead of one "Mega-Lambda", have `mcp-node-runner`, `mcp-python-runner`, etc.
*   **Pros**: Smaller images, cleaner isolation.
*   **Cons**: The Orchestrator needs to know *which* Lambda to call for each tool. This adds complexity to the registry/database (must store "runtime type" along with the tool URL).
*   *Verdict*: Too complex for now. The "Mega-Image" is simpler to orchestrate.

### Option C: On-the-fly Installation
Install Python/Node inside the Lambda at runtime (in `/tmp`).
*   **Pros**: Small base image.
*   **Cons**: extremely slow cold starts.
*   *Verdict*: Rejected.

### Option D: Lambda Layers
Use AWS Lambda Layers for Python/Node runtimes.
*   **Pros**: Modular.
*   **Cons**: Still essentially the same as Option A (just composed differently), but harder to test locally with Docker.
*   *Verdict*: Stick to Dockerfile for easier local reproducibility.
