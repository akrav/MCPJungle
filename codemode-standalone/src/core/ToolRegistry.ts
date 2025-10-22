import type { Tool, ToolSet } from "../types/index.js";

/**
 * Manages the registry of available tools and their execution
 * Acts as a centralized manager for tool lifecycle
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(initialTools?: ToolSet) {
    if (initialTools) {
      this.registerTools(initialTools);
    }
  }

  /**
   * Register a single tool
   */
  registerTool(name: string, tool: Tool): void {
    if (this.tools.has(name)) {
      throw new Error(`Tool '${name}' is already registered`);
    }
    this.tools.set(name, tool);
  }

  /**
   * Register multiple tools at once
   */
  registerTools(tools: ToolSet): void {
    for (const [name, tool] of Object.entries(tools)) {
      this.registerTool(name, tool);
    }
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolSet {
    return Object.fromEntries(this.tools.entries());
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool by name with the given arguments
   * This is called from the isolated execution environment
   */
  async executeTool<TInput = any, TOutput = any>(
    name: string,
    args: TInput
  ): Promise<TOutput> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    try {
      const result = await tool.execute(args);
      return result as TOutput;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool execution failed for '${name}': ${message}`);
    }
  }

  /**
   * Get a list of all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get the count of registered tools
   */
  get size(): number {
    return this.tools.size;
  }
}






