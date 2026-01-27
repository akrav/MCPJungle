/**
 * Mock MCP Server for testing
 * 
 * Supports two modes:
 * 1. In-memory mode: Simple mock for unit tests
 * 2. Live server mode: Runs as HTTP/SSE server with hot-reload support
 * 
 * The live server mode emulates the Vercel pattern where tools can be
 * dynamically modified and reloaded, allowing agents to test their changes
 */

import { createServer, type Server as HttpServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import type { MCPTool } from "../../src/mcp/types.js";

export interface MockToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
  // Function that executes the tool (can be dynamically updated)
  handler: (args: any) => Promise<any>;
}

export interface MockMCPServerOptions {
  /** Port to run the server on (only for live mode) */
  port?: number;
  /** Initial tools to register */
  tools?: MockToolDefinition[];
  /** Enable verbose logging */
  verbose?: boolean;
}

export interface MCPToolCallResult {
  isError: boolean;
  content: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
}

/**
 * Mock MCP Server that can run in-memory or as a live HTTP/SSE server
 */
export class MockMCPServer {
  private tools: Map<string, MockToolDefinition> = new Map();
  private httpServer: HttpServer | null = null;
  private port: number;
  private verbose: boolean;
  private serverInfo = {
    name: "mock-mcp-server",
    version: "1.0.0",
  };
  private clients: Set<ServerResponse> = new Set();

  constructor(options: MockMCPServerOptions = {}) {
    this.port = options.port || 3456;
    this.verbose = options.verbose || false;

    // Register initial tools
    if (options.tools) {
      for (const tool of options.tools) {
        this.registerTool(tool);
      }
    } else {
      // Register default test tools
      this.registerDefaultTools();
    }
  }

  /**
   * Register default tools for testing
   */
  private registerDefaultTools(): void {
    this.registerTool({
      name: "filesystem_read",
      description: "Read a file from the filesystem",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file" },
        },
        required: ["path"],
      },
      handler: async (args: { path: string }) => {
        return {
          path: args.path,
          content: `Mock content of ${args.path}`,
          size: 1024,
        };
      },
    });

    this.registerTool({
      name: "database_query",
      description: "Query a database",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string", description: "SQL query" },
          params: { type: "array", description: "Query parameters" },
        },
        required: ["sql"],
      },
      handler: async (args: { sql: string; params?: any[] }) => {
        return {
          rows: [
            { id: 1, name: "Test User 1" },
            { id: 2, name: "Test User 2" },
          ],
          count: 2,
        };
      },
    });

    this.registerTool({
      name: "get_weather",
      description: "Get weather information",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "Location name" },
        },
        required: ["location"],
      },
      handler: async (args: { location: string }) => {
        return {
          location: args.location,
          temperature: 72,
          condition: "sunny",
          humidity: 45,
        };
      },
    });
  }

  /**
   * Register a new tool or update an existing one
   * This supports dynamic hot-reloading
   */
  registerTool(tool: MockToolDefinition): void {
    this.tools.set(tool.name, tool);
    if (this.verbose) {
      console.log(`📝 Registered tool: ${tool.name}`);
    }
    
    // Notify connected clients about the update
    this.notifyClientsOfToolUpdate();
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) {
      this.notifyClientsOfToolUpdate();
    }
    return result;
  }

  /**
   * List all available tools (MCP protocol)
   */
  async listTools(): Promise<{ tools: MCPTool[] }> {
    const tools: MCPTool[] = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return { tools };
  }

  /**
   * Call a tool (MCP protocol)
   */
  async callTool(name: string, args: any): Promise<MCPToolCallResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Tool '${name}' not found`,
          },
        ],
      };
    }

    try {
      // Execute the tool handler
      const result = await tool.handler(args);

      return {
        isError: false,
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Tool execution failed: ${message}`,
          },
        ],
      };
    }
  }

  /**
   * Start the HTTP/SSE server for live mode
   */
  async startServer(): Promise<void> {
    if (this.httpServer) {
      throw new Error("Server is already running");
    }

    return new Promise((resolve, reject) => {
      this.httpServer = createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.httpServer.on("error", (error) => {
        console.error("Server error:", error);
        reject(error);
      });

      this.httpServer.listen(this.port, () => {
        if (this.verbose) {
          console.log(`🚀 Mock MCP Server running on http://localhost:${this.port}`);
        }
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stopServer(): Promise<void> {
    if (!this.httpServer) {
      return;
    }

    // Close all SSE connections
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();

    return new Promise((resolve, reject) => {
      this.httpServer!.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.httpServer = null;
          if (this.verbose) {
            console.log("🛑 Mock MCP Server stopped");
          }
          resolve();
        }
      });
    });
  }

  /**
   * Handle HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || "/";
    
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // SSE endpoint for MCP
    if (url === "/sse" || url === "/mcp") {
      this.handleSSE(req, res);
      return;
    }

    // Management API - list tools
    if (url === "/api/tools" && req.method === "GET") {
      const tools = await this.listTools();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(tools));
      return;
    }

    // Management API - register/update tool
    if (url === "/api/tools" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const toolDef = JSON.parse(body) as MockToolDefinition;
          this.registerTool(toolDef);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, tool: toolDef.name }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid tool definition" }));
        }
      });
      return;
    }

    // Management API - delete tool
    if (url.startsWith("/api/tools/") && req.method === "DELETE") {
      const toolName = url.substring(11);
      const deleted = this.unregisterTool(toolName);
      res.writeHead(deleted ? 200 : 404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: deleted }));
      return;
    }

    // Health check
    if (url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: this.tools.size }));
      return;
    }

    // 404
    res.writeHead(404);
    res.end("Not found");
  }

  /**
   * Handle SSE connections for MCP protocol
   */
  private handleSSE(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    this.clients.add(res);

    // Handle incoming POST data for SSE
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", async () => {
        try {
          const message = JSON.parse(body);
          await this.handleMCPMessage(message, res);
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      });
    }

    req.on("close", () => {
      this.clients.delete(res);
    });

    req.on("error", () => {
      this.clients.delete(res);
    });

    // Send endpoint event immediately
    this.sendSSEMessage(res, {
      type: "endpoint",
      endpoint: "/mcp",
    });
  }

  /**
   * Handle MCP protocol messages
   */
  private async handleMCPMessage(message: any, res: ServerResponse): Promise<void> {
    try {
      if (message.method === "initialize") {
        this.sendSSEMessage(res, {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: this.serverInfo,
          },
        });
      } else if (message.method === "tools/list") {
        const tools = await this.listTools();
        this.sendSSEMessage(res, {
          jsonrpc: "2.0",
          id: message.id,
          result: tools,
        });
      } else if (message.method === "tools/call") {
        const result = await this.callTool(
          message.params.name,
          message.params.arguments
        );
        this.sendSSEMessage(res, {
          jsonrpc: "2.0",
          id: message.id,
          result,
        });
      } else {
        // Handle unknown methods
        this.sendSSEMessage(res, {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32601,
            message: "Method not found",
          },
        });
      }
    } catch (error) {
      this.sendSSEMessage(res, {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      });
    }
  }

  /**
   * Send a message via SSE
   */
  private sendSSEMessage(res: ServerResponse, data: any): void {
    try {
      const message = JSON.stringify(data);
      if (data.type === "endpoint") {
        res.write(`event: endpoint\ndata: ${message}\n\n`);
      } else {
        res.write(`event: message\ndata: ${message}\n\n`);
      }
    } catch (error) {
      console.error("Failed to send SSE message:", error);
    }
  }

  /**
   * Notify all connected clients about tool updates
   */
  private notifyClientsOfToolUpdate(): void {
    for (const client of this.clients) {
      this.sendSSEMessage(client, {
        jsonrpc: "2.0",
        method: "notifications/tools/updated",
        params: {
          toolCount: this.tools.size,
        },
      });
    }
  }

  /**
   * Get the server URL (for connecting MCPClient)
   */
  getServerUrl(): string {
    return `http://localhost:${this.port}/mcp`;
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      ...this.serverInfo,
      running: this.httpServer !== null,
      port: this.port,
      toolCount: this.tools.size,
    };
  }

  /**
   * Get all registered tools (for inspection)
   */
  getTools(): MockToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

