# Agent Deployment Engineer Proposal: Generalized MCP Lambda Adapter

## 1. Compression & Packaging Strategy

To support a wide range of MCP tools and developer workflows, we must move beyond the rigidity of ZIP files. We will implement a robust package handling layer that supports common archive formats.

### Supported Formats & Trade-offs

| Format | Extension | Benefits | Trade-offs | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **ZIP** | `.zip` | Ubiquitous, random access, standard for AWS Lambda. | Compression ratio often lower than `.tar.gz`. Metadata handling can be inconsistent across OS. | **Primary Support** (Default) |
| **Gzipped Tar** | `.tar.gz` / `.tgz` | Excellent compression for text/code. Preserves Linux permissions/attributes reliably. Standard in container/Linux worlds. | Requires reading the entire stream to extract (no random access). | **Primary Support** (Recommended for larger tools) |
| **Tar** | `.tar` | Low overhead, fast to read/write. | No compression (large file size). | **Secondary Support** (Internal/Intermediate use) |

### Format Detection Strategy

Relying solely on file extensions is fragile and prone to user error (e.g., renaming a `.zip` to `.tar`). We will implement a two-step detection strategy:

1.  **Magic Bytes (Signature) Inspection**:
    *   Read the first few bytes of the downloaded stream/file.
    *   **ZIP**: Starts with `PK\x03\x04`
    *   **GZIP**: Starts with `\x1f\x8b`
    *   **TAR**: Look for `ustar` at offset 257 (standard tar) or simple structure check.
2.  **Extension Fallback**: Use file extension only if magic bytes are inconclusive or for logging/metadata purposes.

### Implementation Plan
- Use a dedicated library or system tools (`file`, `libmagic`) within the Lambda runtime.
- Stream-based extraction where possible to minimize memory footprint, though for Lambda `/tmp` is usually sufficient (512MB-10GB ephemeral storage).
- **Security Note**: Implement checks against "Zip Bombs" (decompression bombs) by limiting extraction size and file count.

## 2. `mcp.json` Specification

The `mcp.json` file is the contract between the tool developer and the MCP Lambda runtime. It must be located at the root of the package.

### Schema Specification (v1.0)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spec": {
      "type": "string",
      "enum": ["1.0"],
      "description": "Version of the mcp.json specification."
    },
    "runtime": {
      "type": "string",
      "enum": ["nodejs20", "python3.11", "binary", "java17"],
      "description": "The required runtime environment."
    },
    "command": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "The command and arguments to execute the MCP server."
    },
    "env": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "Environment variables required by the tool."
    },
    "dependencies": {
      "type": "object",
      "properties": {
        "system": {
          "type": "array",
          "items": { "type": "string" },
          "description": "System-level packages (apk/apt) required (Future scope)."
        }
      }
    }
  },
  "required": ["spec", "runtime", "command"]
}
```

### Examples

**Python Example:**
```json
{
  "spec": "1.0",
  "runtime": "python3.11",
  "command": ["python", "main.py"],
  "env": {
    "LOG_LEVEL": "debug",
    "PYTHONUNBUFFERED": "1"
  }
}
```

**Node.js Example:**
```json
{
  "spec": "1.0",
  "runtime": "nodejs20",
  "command": ["node", "dist/index.js"]
}
```

**Compiled Binary (Go/Rust) Example:**
```json
{
  "spec": "1.0",
  "runtime": "binary",
  "command": ["./my-mcp-server"]
}
```

## 3. Build Guidelines for Users

To ensure compatibility with the "Mega-Runtime" Lambda environment, users should follow these packaging guidelines.

### Python
*   **Dependencies**: Packages must be installed directly into the project root or a directory (e.g., `vendor`) available in `PYTHONPATH`.
    *   *Recommended*: `pip install -r requirements.txt -t .`
*   **Virtualenvs**: Do **not** package full virtual environments (`venv/`). They are not portable due to absolute paths in scripts.
*   **System Deps**: If your package relies on C-extensions (numpy, pandas), ensure they are compiled for **Amazon Linux 2023** (many-linux compliant).

### TypeScript / Node.js
*   **Compilation**: Pre-compile TypeScript to JavaScript (`tsc` or `esbuild`). Do not rely on `ts-node` or `tsx` in production to reduce cold start time.
*   **Dependencies**: Include `node_modules` in the package.
    *   *Optimization*: Run `npm prune --production` before packaging to remove dev dependencies.
*   **Bundling**: Using a bundler (Webpack, Rollup, Esbuild) to produce a single `.js` file is highly recommended for faster startup and smaller size.

### Go / Rust (Compiled Binaries)
*   **Architecture**: Compile for the Lambda's architecture. We generally target **x86_64** (AMD64) or **arm64** (Graviton). *Recommendation: Standardize on one (likely x86_64 for compatibility or arm64 for cost/performance).*
*   **Linking**: Statically link libraries where possible (e.g., `CGO_ENABLED=0` for Go) to avoid missing shared library issues on Amazon Linux.
*   **Permissions**: Ensure the binary has execution permissions (`chmod +x`).

## 4. CI/CD & Release Strategy

### Testing the Adapter Pipeline
1.  **Local Simulation**:
    *   Create a Docker Compose setup that runs the "Mega-Runtime" image locally.
    *   Mount test packages (zip/tar) to simulate S3 downloads.
    *   Verify `mcp.json` parsing and execution for each supported runtime (Node, Python, Binary).
2.  **Integration Tests**:
    *   Maintain a repository of "Reference MCP Tools" (Hello World in Python, Node, Go).
    *   CI pipeline builds the Adapter image, deploys it to a Staging Lambda.
    *   CI invokes the Lambda with each Reference Tool and asserts the output (MCP capability negotiation).

### Versioning
*   **Semantic Versioning**: The Adapter image should be versioned (e.g., `v1.2.0`).
*   **Immutable Tags**:
    *   `latest`: Points to the most recent stable build.
    *   `v1`: Points to the latest `v1.x.x`.
    *   Specific Git SHA tags for rollback capability.
*   **Release Process**:
    1.  PR merged to `main`.
    2.  CI builds Docker image.
    3.  Runs Integration Tests.
    4.  If successful, pushes to ECR with `sha-tag` and `latest`.
    5.  Updates Lambda function configuration to point to the new image (Deployment).

