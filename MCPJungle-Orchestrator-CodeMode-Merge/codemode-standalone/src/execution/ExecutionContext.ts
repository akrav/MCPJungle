import type { ToolRegistry } from "../core/ToolRegistry.js";

/**
 * Represents the execution context for generated code
 * This is injected into the isolated environment
 */
export class ExecutionContext {
  constructor(private toolRegistry: ToolRegistry) {}

  /**
   * Creates a proxy object that intercepts tool calls
   * This is what gets injected as the 'tools' object in generated code
   */
  createToolProxy(): any {
    return new Proxy(
      {},
      {
        get: (target, prop: string) => {
          // Return a function that executes the tool
          return async (args: any) => {
            return this.toolRegistry.executeTool(prop, args);
          };
        },
        has: (target, prop: string) => {
          // Check if tool exists
          return this.toolRegistry.hasTool(prop);
        },
        ownKeys: () => {
          // Return list of available tools
          return this.toolRegistry.getToolNames();
        },
      }
    );
  }

  /**
   * Generates the wrapper code that will be executed in the isolate
   * This sets up the tools proxy and executes the generated code
   */
  generateWrapperCode(generatedCode: string): string {
    return `
(async function() {
  try {
    // The 'tools' proxy is injected by the native context
    // It intercepts all property accesses and routes them to tool execution
    
    const userFunction = async function() {
      ${generatedCode}
    };
    
    const result = await userFunction();
    // Return the result as a JSON string for safe transfer
    return JSON.stringify(result);
  } catch (error) {
    // Return error as JSON string
    return JSON.stringify({
      __error: true,
      message: error.message,
      stack: error.stack
    });
  }
})();
    `.trim();
  }

  /**
   * Serializes a value for transfer between isolates
   */
  serializeValue(value: any): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      throw new Error(
        `Failed to serialize value: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Deserializes a value received from an isolate
   */
  deserializeValue(serialized: string): any {
    try {
      return JSON.parse(serialized);
    } catch (error) {
      throw new Error(
        `Failed to deserialize value: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

