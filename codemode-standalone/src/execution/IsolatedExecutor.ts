import ivm from "isolated-vm";
import type { ExecutionResult } from "../types/index.js";
import { ExecutionContext } from "./ExecutionContext.js";
import { SecurityPolicyManager } from "./SecurityPolicy.js";
import type { ToolRegistry } from "../core/ToolRegistry.js";

/**
 * Executes generated code in an isolated V8 context
 * Uses isolated-vm for security and resource control
 */
export class IsolatedExecutor {
  private securityPolicy: SecurityPolicyManager;
  private executionContext: ExecutionContext;

  constructor(
    toolRegistry: ToolRegistry,
    securityPolicy: SecurityPolicyManager
  ) {
    this.securityPolicy = securityPolicy;
    this.executionContext = new ExecutionContext(toolRegistry);
  }

  /**
   * Execute code in an isolated environment
   */
  async execute<T = any>(code: string): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    let isolate: ivm.Isolate | null = null;

    try {
      // Create a new isolate with memory limits
      isolate = new ivm.Isolate({
        memoryLimit: this.securityPolicy.getPolicy().maxMemoryMB,
      });

      // Create a context within the isolate
      const context = await isolate.createContext();

      // Set up timeout
      const timeoutMs = this.securityPolicy.getMaxExecutionTime();

      // Create a tool proxy that bridges calls back to our process
      const toolsProxy = this.executionContext.createToolProxy();

      // Inject the tools object into the isolate
      const jail = context.global;
      await jail.set("global", jail.derefInto());

      // Create a callback function that will be called from the isolate
      // This bridges tool calls from the isolate back to the host
      const toolCallbackRef = new ivm.Reference(
        async (toolName: string, argsJson: string) => {
          try {
            const args = JSON.parse(argsJson);
            const result = await toolsProxy[toolName](args);
            return JSON.stringify(result);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(errorMessage);
          }
        }
      );

      await jail.set("__executeToolNative", toolCallbackRef);

      // Inject the tools proxy setup code
      const proxySetupCode = `
        const tools = new Proxy({}, {
          get: (target, prop) => {
            return async (args) => {
              const argsJson = JSON.stringify(args);
              const resultJson = await __executeToolNative.apply(
                undefined,
                [prop, argsJson],
                { arguments: { copy: true }, result: { copy: true, promise: true } }
              );
              return JSON.parse(resultJson);
            };
          }
        });
      `;

      await context.eval(proxySetupCode);

      // Wrap the generated code
      const wrappedCode = this.executionContext.generateWrapperCode(code);

      // Compile and execute the code
      const script = await isolate.compileScript(wrappedCode);
      const result = await script.run(context, {
        timeout: timeoutMs,
        promise: true,
      });

      // Get the result - it should be a JSON string
      let finalResult: any;
      
      // The result should be a string containing JSON
      const resultStr = typeof result === 'string' ? result : String(result);
      
      try {
        finalResult = JSON.parse(resultStr);
      } catch (e) {
        // If parsing fails, the result itself is the value
        finalResult = result;
      }

      const executionTime = Date.now() - startTime;

      // Check if the result indicates an error
      if (
        finalResult &&
        typeof finalResult === "object" &&
        finalResult.__error
      ) {
        return {
          success: false,
          error: {
            message: finalResult.message,
            stack: finalResult.stack,
          },
          executionTime,
        };
      }

      return {
        success: true,
        result: finalResult as T,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      let errorMessage = "Unknown error";
      let errorStack: string | undefined;

      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
      } else {
        errorMessage = String(error);
      }

      return {
        success: false,
        error: {
          message: errorMessage,
          stack: errorStack,
        },
        executionTime,
      };
    } finally {
      // Clean up the isolate
      if (isolate) {
        isolate.dispose();
      }
    }
  }

  /**
   * Validate that the generated code doesn't contain dangerous patterns
   * This is a basic check - the isolate provides the real security
   */
  validateCode(code: string): { valid: boolean; reason?: string } {
    // List of potentially dangerous patterns
    const dangerousPatterns = [
      { pattern: /require\s*\(/, reason: "require() is not allowed" },
      { pattern: /import\s+.*\s+from/, reason: "import statements are not allowed" },
      { pattern: /process\./, reason: "process access is not allowed" },
      { pattern: /__dirname/, reason: "__dirname is not allowed" },
      { pattern: /__filename/, reason: "__filename is not allowed" },
    ];

    for (const { pattern, reason } of dangerousPatterns) {
      if (pattern.test(code)) {
        return { valid: false, reason };
      }
    }

    return { valid: true };
  }
}

