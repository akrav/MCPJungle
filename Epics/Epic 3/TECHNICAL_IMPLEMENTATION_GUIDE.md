# Technical Implementation Guide: MCP Lambda Generalization

**Goal**: Transform the existing Node.js-only Lambda adapter into a "Mega-Image" capable of running MCP servers written in **TypeScript, Python, and JavaScript** with high reliability, while establishing patterns for **Java, Rust, C#, and Go**.

---

## 📂 Key Code Locations

Developers working on this epic should focus on these files:

*   **Runtime Environment (The "Mega-Image")**:
    *   `orchestrator/infrastructure/lambda/Dockerfile`: Defines the OS and installed runtimes. Currently `nodejs:20`. Needs update for Python/pip.

*   **Core Adapter Logic**:
    *   `orchestrator/infrastructure/lambda/src/index.js`: The entry point. Handles S3 download, extraction, and process spawning. Needs major refactoring to support dynamic command generation.

*   **Infrastructure Configuration**:
    *   `orchestrator/infrastructure/lambda/main.tf`: Terraform definitions. Generally stable, but monitor `memory_size` and `timeout` as we add heavier runtimes.

*   **Local Testing**:
    *   `orchestrator/infrastructure/lambda/scripts/deploy.sh`: Script to build and push the Docker image.
    *   `orchestrator/infrastructure/lambda/package.json`: Dependencies for the adapter itself.

---

## 🛠️ Implementation Strategy

### 1. The "Mega-Image" Build (Priority: High)
We will extend the Dockerfile to include runtimes for our priority languages.

*   **Base**: Keep `public.ecr.aws/lambda/nodejs:20` (Amazon Linux 2023).
*   **Python**: Install `python3` (v3.11+) and `pip`.
*   **TypeScript**: Install `tsx` globally (`npm install -g tsx`) to allow direct execution of `.ts` files without a build step, or assume `node` execution of compiled `.js`. *Recommendation: Support both via config.*
*   **Future Proofing (Java/Rust/Go)**:
    *   **Go/Rust**: These compile to native binaries. No runtime needed in the image, just `glibc` (standard) or `musl` compatibility.
    *   **Java**: Requires a JVM (e.g., `amazon-corretto`). We will add this in a later phase to keep image size optimized for now.

### 2. The `mcp.json` Manifest (Priority: High)
To generalize execution, we explicitly define how to run a tool. We will support a `mcp.json` file in the root of the compressed package.

**Schema:**
```json
{
  "spec": "1.0",
  "type": "python", // or "node", "binary", "java"
  "command": ["python3", "main.py"], 
  "args": ["--port", "stdio"],
  "env": {
    "PYTHONUNBUFFERED": "1"
  },
  "dependencies": {
    "python": "requirements.txt",
    "node": "package.json"
  }
}
```

### 3. Universal Adapter Logic (`src/index.js` Refactor)
The current monolithic script needs to be broken down into a **Strategy Pattern**:

1.  **Download & Extract**:
    *   Support `.zip` (existing), `.tar.gz`, and `.tar`.
    *   Detects `mcp.json`.
2.  **Runtime Resolution**:
    *   **If `mcp.json` exists**: Use the `command` field.
    *   **Heuristic Fallback (Legacy Support)**:
        *   If `package.json` exists -> Assume Node.js. Look for `node_modules/.bin` binaries.
        *   If `requirements.txt` / `main.py` exists -> Assume Python (future auto-detection).
        *   If `go.mod` exists -> Warn (needs compilation).
3.  **Process Execution**:
    *   Spawn the resolved command.
    *   Pipe `stdio` (universal for all MCPs).
    *   Stream output via SSE.

---

## 🧪 Testing Plan

We need to verify "Superb Quality" for the top 3 languages.

### Test Case A: JavaScript (Legacy & Modern)
*   **Input**: A standard NPM package structure.
*   **Expectation**: Adapter finds the binary in `node_modules/.bin` and runs it.
*   **Metric**: Cold start time < 3s (after download).

### Test Case B: Python (Standard)
*   **Input**: A zip with `main.py`, `mcp.json`, and `requirements.txt`.
    *   *Note*: `pip install` at runtime is SLOW.
    *   *Optimization*: The uploaded zip should essentially be a "venv" or have `site-packages` pre-installed (vendorized).
*   **Expectation**: Adapter runs `python3 main.py`.
*   **Metric**: Proper handling of `PYTHONUNBUFFERED` to ensure SSE streams flow instantly.

### Test Case C: TypeScript (Direct)
*   **Input**: A zip with `index.ts` and `mcp.json` commanding `tsx index.ts`.
*   **Expectation**: `tsx` compiles and runs on the fly.
*   **Metric**: startup overhead of `tsx`.

### Test Case D: Go (Binary)
*   **Input**: A pre-compiled Linux/AMD64 binary.
*   **Expectation**: Adapter simply executes the binary.
*   **Metric**: Fastest cold start.

---

## ⚠️ Challenges & Mitigations

1.  **Dependency Management**:
    *   *Challenge*: Python/Node tools need dependencies. Installing them at Lambda runtime (during cold start) is too slow and hits timeouts.
    *   *Solution*: **Pre-bundled Artifacts**. Users/Agents must upload "fat" zips containing `node_modules` or `site-packages`. The Lambda purely *runs* code; it does not *build* it.

2.  **Image Size**:
    *   *Challenge*: Adding too many runtimes bloats the Lambda cold start.
    *   *Solution*: Stick to Node+Python for now. Use multi-stage Docker builds to keep the layer minimal.

3.  **Process Zombieing**:
    *   *Challenge*: Spawning child processes can leave zombies if the Lambda freezes.
    *   *Solution*: Ensure the Node.js wrapper handles `SIGTERM` and kills the child process cleanly (already partially implemented, needs verification).
