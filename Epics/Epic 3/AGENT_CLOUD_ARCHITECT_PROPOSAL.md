# generalized AWS Lambda MCP Adapter: Infrastructure Proposal

## 1. "Mega-Image" Design: Multi-Runtime Dockerfile Strategy

To support multiple languages (TypeScript, Python, JavaScript, and potentially Java/others) within a single Lambda function while minimizing cold start latency and image size, we propose a **Multi-Stage Build Strategy** culminating in a highly optimized runtime image.

### Base Image Strategy
We will use `public.ecr.aws/lambda/provided:al2023` as the base. This provides a clean Amazon Linux 2023 environment, allowing us to install custom runtimes (Node.js, Python, Java) while maintaining compatibility with AWS Lambda's execution environment.

### Dockerfile Architecture

The Dockerfile will use multi-stage builds to:
1.  **Build/Install Runtimes**: Separate stages to download and verify Node.js, Python, and Java versions.
2.  **Build Application**: A stage to install dependencies and build the TypeScript/Python application code.
3.  **Final Assembly**: Copy only the necessary artifacts (runtimes + app code) to the final image.

#### Proposed Dockerfile

```dockerfile
# Stage 1: Node.js Builder
FROM public.ecr.aws/lambda/nodejs:20 as node_builder
# (Using the official image to extract the binary or just installing in the main builder)
# Alternatively, install via yum/dnf in the main builder for control

# Stage 2: Python Builder
FROM public.ecr.aws/lambda/python:3.12 as python_builder

# Stage 3: Java Builder (if needed immediately, or placeholder)
FROM public.ecr.aws/amazoncorretto/amazoncorretto:21 as java_builder

# Stage 4: Final Runtime Assembly
FROM public.ecr.aws/lambda/provided:al2023

# Install basic dependencies
RUN dnf install -y \
    ca-certificates \
    unzip \
    tar \
    gzip \
    && dnf clean all

# Copy Node.js runtime
COPY --from=node_builder /var/lang /var/lang/node
ENV PATH="/var/lang/node/bin:${PATH}"

# Copy Python runtime
COPY --from=python_builder /var/lang /var/lang/python
ENV PATH="/var/lang/python/bin:${PATH}"
ENV LD_LIBRARY_PATH="/var/lang/python/lib:${LD_LIBRARY_PATH}"

# Copy Application Code
COPY --from=build-image /app/dist ${LAMBDA_TASK_ROOT}
COPY --from=build-image /app/node_modules ${LAMBDA_TASK_ROOT}/node_modules

# Set the entrypoint to a custom bootstrap or the Node.js handler if using the node runtime interface
# For a generalized adapter, we might use a custom bootstrap script written in Go or Rust (the "Adapter") 
# that invokes the correct language runtime based on the request.
ENTRYPOINT [ "/var/lang/node/bin/node", "/var/runtime/index.js" ]
CMD [ "handler.handler" ]
```

### Minimizing Cold Starts
1.  **Lazy Loading**: Ensure that the code only loads the necessary language runtime libraries when a specific language handler is invoked, rather than loading everything at startup.
2.  **Code Splitting**: Separate the core "Adapter" logic from the language-specific execution paths.
3.  **Optimize Imports**: Use dynamic imports in Node.js and Python to load modules only when needed.

## 2. Reliability Strategy

To ensure high reliability across different runtimes:

### Memory Settings
-   **Dynamic Allocation**: Start with a baseline of **1024 MB**. This provides full vCPU access.
-   **Performance Tuning**: Monitor `MaxMemoryUsed` via CloudWatch and adjust. Python and Node.js are generally memory-efficient, but Java will require more heap.
-   **Strategy**: If Java is detected/enabled, we might leverage a specific alias or separate function configuration with higher memory (e.g., 2048 MB) if strict isolation is needed, but for a single generalized adapter, we should target the highest common denominator or use **AWS Lambda Power Tuning** to find the sweet spot.

### Timeouts
-   **Standard**: Set to **30 seconds** for standard MCP tool execution.
-   **Long-running**: For complex tasks, allow up to **15 minutes** (900s), but enforce internal timeouts within the adapter (e.g., 60s default) to prevent stuck processes from consuming all compute time.

### Ephemeral Storage (/tmp)
-   **Size**: Increase `/tmp` to **2 GB** (or up to 10GB if needed). This allows:
    -   Python virtual environments to be created/cached if necessary.
    -   Temporary file processing for data-heavy tools.
    -   Cloning git repositories for analysis tools.

## 3. Patterns for Compiled Languages (Go, Rust, C#)

### Strategy: Pre-Compiled Binaries
For compiled languages, we strictly avoid runtime compilation (i.e., running `go build` or `cargo build` inside Lambda) due to time and size constraints.

1.  **Build Process**: The CI/CD pipeline compiles the user's Go/Rust/C# code into a static binary targeting `linux/amd64` (or `arm64`).
2.  **Artifact Handling**: The binary is zipped and uploaded/layered.
3.  **Execution**: The "Adapter" simply `exec`s the binary. This is the fastest and most reliable method.

### Interface
-   The binary must accept JSON input via STDIN (or arguments) and output JSON to STDOUT.
-   This decouples the Lambda runtime from the specific language version of the tool.

## 4. Java/JVM Strategy

Java on Lambda traditionally suffers from slow cold starts.

### Mitigation: AWS Lambda SnapStart
-   **Enable SnapStart**: Required for Java 11/17/21+. This caches the initialized memory state.
-   **Implication**: SnapStart only works if the *main* handler is Java. Since our "Mega-Image" might be Node-centric, this poses a conflict.
-   **Alternative**: If Java support is critical and high-performance, **Java should run in a separate Lambda function** specialized for JVM, invoked by the orchestrator.
-   **In-Adapter Strategy**: If running within the Mega-Image (e.g., executing a `.jar`), we accept the cold start penalty (3-5s) but optimize the JVM flags:
    -   `-XX:+TieredCompilation`
    -   `-XX:TieredStopAtLevel=1` (Client compiler only, faster startup)
    -   `-Xmx` set to 80% of Lambda memory.

## 5. Security

### IAM Permissions
-   **Least Privilege**: The Lambda role should specifically *only* allow:
    -   `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
    -   Read-only access to specific S3 buckets (if used for code storage).
    -   KMS Decrypt (if secrets are involved).
-   **No Wildcards**: Avoid `*` in Resource fields.

### File System Isolation
-   **Read-Only Root**: The Lambda filesystem is read-only except for `/tmp`.
-   **User Isolation**: If executing user-provided scripts, we rely on the Lambda sandbox. For stronger isolation (e.g., running untrusted code), we would need **Firecracker** (which Lambda uses) but we must ensure our "Adapter" doesn't allow escaping the process context (e.g., `subprocess.run` with restrictive environments).
-   **Env Vars**: Sanitize environment variables passed to sub-processes.

## 6. Infrastructure as Code (Terraform) Updates

We need to update `main.tf` to support the ECR image and the generalized configuration.

### `main.tf` Updates

1.  **ECR Repository**:
    ```hcl
    resource "aws_ecr_repository" "mcp_adapter" {
      name                 = "mcp-jungle/lambda-adapter"
      image_tag_mutability = "MUTABLE"
      image_scanning_configuration {
        scan_on_push = true
      }
    }
    ```

2.  **Lambda Function Update**:
    Change `filename` (zip) to `image_uri`.

    ```hcl
    resource "aws_lambda_function" "mcp_adapter" {
      function_name = "mcp-adapter-generalized"
      role          = aws_iam_role.lambda_exec.arn
      package_type  = "Image"
      image_uri     = "${aws_ecr_repository.mcp_adapter.repository_url}:latest"
      
      memory_size   = 1024
      timeout       = 300
      
      ephemeral_storage {
        size = 2048 # 2GB
      }

      environment {
        variables = {
          NODE_ENV = "production"
          # ... other vars
        }
      }
    }
    ```

3.  **Build Trigger (Null Resource)**:
    Add a trigger to build and push the Docker image when the Dockerfile changes.

    ```hcl
    resource "null_resource" "docker_build_push" {
      triggers = {
        docker_file = md5(file("${path.module}/Dockerfile"))
      }
      provisioner "local-exec" {
        command = <<EOF
          aws ecr get-login-password --region ${var.region} | docker login --username AWS --password-stdin ${aws_ecr_repository.mcp_adapter.repository_url}
          docker build -t ${aws_ecr_repository.mcp_adapter.repository_url}:latest .
          docker push ${aws_ecr_repository.mcp_adapter.repository_url}:latest
        EOF
      }
    }
    ```
