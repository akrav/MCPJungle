import type {
  CodemodeOptions,
  CodemodeRequest,
  CodemodeResponse,
  SecurityPolicy,
} from "../types/index.js";
import { TypeGenerator } from "./TypeGenerator.js";
import { ToolRegistry } from "./ToolRegistry.js";
import { IsolatedExecutor } from "../execution/IsolatedExecutor.js";
import { SecurityPolicyManager } from "../execution/SecurityPolicy.js";

/**
 * Main orchestrator for the codemode system
 * Coordinates type generation, code generation, and execution
 */
export class CodemodeEngine {
  private typeGenerator: TypeGenerator;
  private toolRegistry: ToolRegistry;
  private securityPolicy: SecurityPolicyManager;
  private generateCodeFn: (prompt: string) => Promise<string>;
  private verbose: boolean;

  private cachedTypeDefinitions?: string;

  constructor(options: CodemodeOptions) {
    this.typeGenerator = new TypeGenerator();
    this.toolRegistry = new ToolRegistry(options.tools);
    this.securityPolicy = new SecurityPolicyManager(options.securityPolicy);
    this.generateCodeFn = options.generateCode;
    this.verbose = options.verbose ?? false;
  }

  /**
   * Process a codemode request: generate code and execute it
   */
  async execute<T = any>(request: CodemodeRequest): Promise<CodemodeResponse<T>> {
    this.log("Starting codemode execution...");

    // Step 1: Generate type definitions for tools
    const typeDefinitions = await this.getTypeDefinitions();
    this.log("Generated type definitions");

    // Step 2: Build the prompt for the LLM
    const prompt = this.buildPrompt(request, typeDefinitions);
    this.log("Built LLM prompt");

    // Step 3: Generate code using the LLM
    const generatedCode = await this.generateCodeFn(prompt);
    this.log(`Generated code:\n${generatedCode}`);

    // Step 4: Execute the generated code
    const executor = new IsolatedExecutor(this.toolRegistry, this.securityPolicy);
    
    // Validate code before execution
    const validation = executor.validateCode(generatedCode);
    if (!validation.valid) {
      return {
        code: generatedCode,
        typeDefinitions,
        result: {
          success: false,
          error: {
            message: `Code validation failed: ${validation.reason}`,
          },
          executionTime: 0,
        },
      };
    }

    const result = await executor.execute<T>(generatedCode);
    this.log(`Execution completed in ${result.executionTime}ms`);

    return {
      code: generatedCode,
      result,
      typeDefinitions,
    };
  }

  /**
   * Get type definitions (cached after first generation)
   */
  private async getTypeDefinitions(): Promise<string> {
    if (!this.cachedTypeDefinitions) {
      this.cachedTypeDefinitions = await this.typeGenerator.generateTypeDefinitions(
        this.toolRegistry.getAllTools()
      );
    }
    return this.cachedTypeDefinitions;
  }

  /**
   * Build the prompt for the LLM
   */
  private buildPrompt(request: CodemodeRequest, typeDefinitions: string): string {
    const toolDescriptions = this.typeGenerator.generateToolDescriptions(
      this.toolRegistry.getAllTools()
    );

    return `You are a code-generating AI. Your task is to generate JavaScript code that accomplishes the user's request.

AVAILABLE TOOLS:
${toolDescriptions}

TYPE DEFINITIONS:
${typeDefinitions}

RULES:
1. You have access to a 'tools' object with the functions defined above
2. Your code should be pure JavaScript (ES2022)
3. Do NOT wrap your code in a function - just write the statements
4. Do NOT include any markdown formatting or code blocks
5. Return the final result using 'return' statement
6. You can use async/await
7. All tool calls return Promises
8. Do NOT use require(), import, or any Node.js built-ins

${request.context ? `ADDITIONAL CONTEXT:\n${request.context}\n` : ""}

USER REQUEST:
${request.userRequest}

Generate JavaScript code to accomplish this task:`;
  }

  /**
   * Add new tools to the registry
   */
  addTools(tools: Record<string, any>): void {
    this.toolRegistry.registerTools(tools);
    // Invalidate cached type definitions
    this.cachedTypeDefinitions = undefined;
  }

  /**
   * Remove a tool from the registry
   */
  removeTool(name: string): void {
    this.toolRegistry.unregisterTool(name);
    // Invalidate cached type definitions
    this.cachedTypeDefinitions = undefined;
  }

  /**
   * Update the security policy
   */
  updateSecurityPolicy(policy: Partial<SecurityPolicy>): void {
    this.securityPolicy.updatePolicy(policy);
  }

  /**
   * Get current security policy
   */
  getSecurityPolicy(): SecurityPolicy {
    return this.securityPolicy.getPolicy();
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[CodemodeEngine] ${message}`);
    }
  }
}






