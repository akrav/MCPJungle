# Epic 3: Polyglot Lambda MCP Adapter - Project Guide

**Status:** Final | **Epic:** Epic 3 | **Date:** February 15, 2026

## 1. Executive Summary

The goal of Epic 3 is to minimally extend the existing working Node.js Lambda adapter to support **Python, TypeScript, and JavaScript** servers, handle **multiple compression formats** (.zip, .tar.gz), and **prepare infrastructure** for compiled languages (Rust, Go, C#).

We will strictly follow the "minimal change" principle, modifying the existing `src/index.js` and `Dockerfile` only as necessary to support these new capabilities without rewriting the entire core logic.

## 2. Technical Architecture

### 2.1. Infrastructure (The "Mega-Image")
We will extend the current `public.ecr.aws/lambda/nodejs:20` image.
*   **Additions**: `python3`, `pip`, `tar`, `gzip`.
*   **Justification**: This enables Python execution and tarball extraction while keeping the existing Node.js environment stable. Rust, Go, and C# (self-contained) can run natively on the underlying Linux OS without additional runtimes.

### 2.2. The Manifest (`manifest.json` / `.mcpb`)
To align with the **MCP Bundle** standard, we support a `manifest.json` file at the root of the package.
*   **Location**: Root of the tool package.
*   **Behavior**:
    1.  **Standard**: Checks for `manifest.json` (MCP Bundle format).
    2.  **Legacy/Custom**: Checks for `mcp.json` (Simplified format).
    3.  **Heuristic**: Falls back to file detection.

**Schema (Standard `manifest.json`):**
```json
{
  "manifest_version": "0.1",
  "name": "my-server",
  "version": "1.0.0",
  "server": {
    "type": "python",
    "command": "python3", 
    "args": ["main.py", "--verbose"],
    "env": {
      "PYTHONUNBUFFERED": "1"
    }
  }
}
```

---

## 3. Implementation Plan

### 3.1. Update `Dockerfile`
**File:** `orchestrator/infrastructure/lambda/Dockerfile`

**Changes:**
1.  Keep base image `public.ecr.aws/lambda/nodejs:20`.
2.  Add `dnf install -y python3 python3-pip tar gzip`.
3.  Ensure `unzip` remains installed.

### 3.2. Refactor `src/index.js`
**File:** `orchestrator/infrastructure/lambda/src/index.js`

**Changes:**

#### A. Download Logic (File Extensions)
*   **Current**: Hardcoded `key = ... + '.zip'`.
*   **New**: Implement a retry strategy.
    1.  Check `HEAD` for `.zip`. If exists, download.
    2.  If not, check `HEAD` for `.tar.gz`. If exists, download.
    3.  If neither, throw error.

#### B. Extraction Logic
*   **Current**: Hardcoded `unzip`.
*   **New**: Switch based on detected extension.
    *   `.zip`: `unzip -o -q ...` (Existing)
    *   `.tar.gz` / `.tgz`: `tar -xzf ... -C ...`

#### C. Execution Logic (Tool Loading)
*   **Current**: `findBinaryPath` scans `node_modules/.bin`.
*   **New**:
    1.  **Check for `mcp.json`**:
        *   If found, parse it.
        *   Construct command: `executable` + `args`.
        *   If `runtime` is python, ensure `python3` is used.
    2.  **Fallback (No Manifest)**:
        *   **Python Heuristic**: Check for `main.py`, `app.py`, or `index.py`. If found, Run `python3 <file>`.
        *   **Node Heuristic**: Use existing `findBinaryPath` logic.
    3.  **Permissions**: For binary/script execution, ensure `chmod +x` is applied to the target executable.

#### D. Environment Variables
*   Ensure `PYTHONUNBUFFERED=1` is set in the `spawn` env options to guarantee SSE streaming works for Python tools.

---

## 4. Packaging Guidelines for Developers

### 🐍 Python
*   **Structure**:
    ```
    /
    ├── mcp.json
    ├── main.py
    └── requirements.txt (Dependencies must be pre-installed/vendored if using pure Lambda)
    ```
*   **Note**: For optimal cold-start performance, users should vendor dependencies into a subfolder and set `PYTHONPATH` in `mcp.json` (or we append `cwd` to `PYTHONPATH` by default).

### 🟢 Node.js / TypeScript
*   **Structure**: Standard `package.json` with `node_modules` (existing workflow).
*   **TypeScript**: Pre-compile to JS or use `tsx` (if we decide to add `tsx` to Dockerfile, otherwise standard `node`). *Minimal change decision: Expect pre-compiled JS for now.*

### 🦀 Go / Rust / C# (Compiled)
*   **Structure**:
    ```
    /
    ├── mcp.json (executable: "./my-binary")
    └── my-binary (Compiled for Linux AMD64)
    ```
*   **Infrastructure Prep**: The updated Dockerfile's Linux environment can natively execute these binaries. No specific runtime installation is needed for the adapter.

---

## 5. Task List

- [ ] **Step 1**: Modify `Dockerfile` to install Python 3, `tar`, `gzip`.
- [ ] **Step 2**: Update `src/index.js`:
    - [ ] Update `downloadAndExtract` to handle `.zip` and `.tar.gz`.
    - [ ] Update execution logic to check `mcp.json` -> Python Heuristic -> Node Heuristic.
    - [ ] Add `PYTHONUNBUFFERED=1` to spawn env.
- [ ] **Step 3**: Re-deploy using `./scripts/deploy.sh`.
- [ ] **Step 4**: Verify with a test Python tool (upload to S3 and invoke).
