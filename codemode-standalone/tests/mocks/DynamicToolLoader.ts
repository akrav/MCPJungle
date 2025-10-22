/**
 * Dynamic Tool Loader
 * 
 * Emulates the Vercel-style hot-reload pattern where tool implementations
 * can be modified and automatically reloaded into the MCP server
 * 
 * This allows agents to:
 * 1. Modify tool implementation code
 * 2. Have it automatically reload in the MCP server
 * 3. Test the modified tool immediately
 */

import { watch, type FSWatcher } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { MockMCPServer, MockToolDefinition } from "./MockMCPServer.js";

export interface DynamicToolConfig {
  /** Directory containing tool implementation files */
  toolsDir: string;
  /** Pattern to match tool files (default: *.tool.js) */
  pattern?: RegExp;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Dynamic Tool Loader with file watching and hot-reload
 */
export class DynamicToolLoader {
  private watcher: FSWatcher | null = null;
  private verbose: boolean;
  private toolsDir: string;
  private pattern: RegExp;
  private loadedTools: Map<string, string> = new Map(); // filename -> tool name

  constructor(
    private server: MockMCPServer,
    config: DynamicToolConfig
  ) {
    this.toolsDir = config.toolsDir;
    this.pattern = config.pattern || /\.tool\.(js|ts)$/;
    this.verbose = config.verbose || false;
  }

  /**
   * Start watching for tool file changes
   */
  async startWatching(): Promise<void> {
    if (this.watcher) {
      throw new Error("Already watching");
    }

    // Load all tools initially
    await this.loadAllTools();

    // Watch for changes
    this.watcher = watch(
      this.toolsDir,
      { recursive: true },
      async (eventType, filename) => {
        if (!filename || !this.pattern.test(filename)) {
          return;
        }

        if (this.verbose) {
          console.log(`📂 File ${eventType}: ${filename}`);
        }

        if (eventType === "change" || eventType === "rename") {
          await this.reloadTool(filename);
        }
      }
    );

    if (this.verbose) {
      console.log(`👀 Watching ${this.toolsDir} for tool changes`);
    }
  }

  /**
   * Stop watching
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      if (this.verbose) {
        console.log("👋 Stopped watching for tool changes");
      }
    }
  }

  /**
   * Load all tools from the tools directory
   */
  private async loadAllTools(): Promise<void> {
    // This is a simplified version - in a real implementation,
    // you'd use fs.readdir to find all matching files
    if (this.verbose) {
      console.log(`📚 Loading tools from ${this.toolsDir}`);
    }
  }

  /**
   * Reload a specific tool file
   */
  private async reloadTool(filename: string): Promise<void> {
    try {
      const filePath = join(this.toolsDir, filename);
      
      // In a real implementation with dynamic import:
      // const module = await import(filePath);
      // const toolDef = module.default as MockToolDefinition;
      
      if (this.verbose) {
        console.log(`♻️  Reloaded tool from ${filename}`);
      }
    } catch (error) {
      console.error(`Failed to reload tool from ${filename}:`, error);
    }
  }

  /**
   * Programmatically update a tool (for testing without files)
   */
  async updateTool(toolDef: MockToolDefinition): Promise<void> {
    this.server.registerTool(toolDef);
    if (this.verbose) {
      console.log(`✨ Updated tool: ${toolDef.name}`);
    }
  }

  /**
   * Create a tool file and register it
   * This simulates an agent writing new tool code
   */
  async createToolFile(filename: string, toolCode: string): Promise<void> {
    const filePath = join(this.toolsDir, filename);
    await writeFile(filePath, toolCode, "utf-8");
    if (this.verbose) {
      console.log(`📝 Created tool file: ${filename}`);
    }
  }
}

/**
 * Utility to demonstrate the hot-reload pattern
 */
export class HotReloadDemo {
  /**
   * Simulate an agent modifying and testing a tool
   */
  static async simulateAgentWorkflow(
    server: MockMCPServer,
    loader: DynamicToolLoader
  ): Promise<void> {
    console.log("\n🤖 Simulating Agent Workflow with Hot Reload\n");

    // Step 1: Agent creates a new tool
    console.log("1️⃣ Agent creates a new 'calculate' tool");
    await loader.updateTool({
      name: "calculate",
      description: "Perform a calculation",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string" },
        },
        required: ["expression"],
      },
      handler: async (args: { expression: string }) => {
        // Initial buggy implementation
        return { result: 42 }; // Always returns 42!
      },
    });

    // Step 2: Agent tests the tool
    console.log("2️⃣ Agent tests the tool");
    const result1 = await server.callTool("calculate", { expression: "2 + 2" });
    console.log("   Result:", JSON.parse(result1.content[0].text!));
    console.log("   🐛 Oops! Always returns 42\n");

    // Step 3: Agent modifies the tool to fix the bug
    console.log("3️⃣ Agent fixes the bug and hot-reloads");
    await loader.updateTool({
      name: "calculate",
      description: "Perform a calculation",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string" },
        },
        required: ["expression"],
      },
      handler: async (args: { expression: string }) => {
        // Fixed implementation using eval (just for demo!)
        try {
          const result = eval(args.expression);
          return { result };
        } catch (error) {
          throw new Error(`Invalid expression: ${args.expression}`);
        }
      },
    });

    // Step 4: Agent tests again
    console.log("4️⃣ Agent tests the fixed tool");
    const result2 = await server.callTool("calculate", { expression: "2 + 2" });
    console.log("   Result:", JSON.parse(result2.content[0].text!));
    console.log("   ✅ Success! Returns 4\n");

    // Step 5: Agent iterates further
    console.log("5️⃣ Agent adds validation");
    await loader.updateTool({
      name: "calculate",
      description: "Perform a calculation with validation",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string" },
        },
        required: ["expression"],
      },
      handler: async (args: { expression: string }) => {
        // Enhanced with validation
        if (!/^[0-9+\-*/().\s]+$/.test(args.expression)) {
          throw new Error("Expression contains invalid characters");
        }
        try {
          const result = eval(args.expression);
          return {
            result,
            expression: args.expression,
            validated: true,
          };
        } catch (error) {
          throw new Error(`Invalid expression: ${args.expression}`);
        }
      },
    });

    console.log("6️⃣ Agent tests with validation");
    const result3 = await server.callTool("calculate", {
      expression: "10 * 5 + 2",
    });
    console.log("   Result:", JSON.parse(result3.content[0].text!));
    console.log("   ✅ Validated and calculated!\n");

    console.log("🎉 Hot-reload workflow complete!\n");
  }
}

