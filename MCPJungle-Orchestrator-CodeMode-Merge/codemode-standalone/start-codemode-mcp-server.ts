/**
 * Codemode MCP Server
 * 
 * This exposes the codemode execution engine as an MCP tool.
 * Cursor (or any MCP client) can call the codemode engine to:
 * - Generate and execute code
 * - Use multiple tools in complex workflows
 * - Handle conditional logic and data transformation
 */

import { createServer, type Server as HttpServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { CodemodeEngine, ToolCallingEngine } from "./src/index.js";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Define some example tools that the codemode engine can use
const exampleTools = {
  calculate: {
    name: "calculate",
    description: "Perform mathematical calculations",
    inputSchema: z.object({
      expression: z.string().describe("Mathematical expression to evaluate"),
    }),
    execute: async (args: { expression: string }) => {
      try {
        // Safe evaluation (in production, use a proper math parser)
        const result = eval(args.expression);
        return { result, expression: args.expression };
      } catch (error) {
        return { error: "Invalid expression", expression: args.expression };
      }
    },
  },
  
  searchWeb: {
    name: "searchWeb",
    description: "Search the web for information (mocked)",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
    }),
    execute: async (args: { query: string }) => {
      return {
        query: args.query,
        results: [
          { title: "Result 1", snippet: "Mock search result for: " + args.query },
          { title: "Result 2", snippet: "Another result about " + args.query },
        ],
      };
    },
  },

  getDateTime: {
    name: "getDateTime",
    description: "Get current date and time",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        timestamp: Date.now(),
        iso: new Date().toISOString(),
        formatted: new Date().toLocaleString(),
      };
    },
  },

  formatData: {
    name: "formatData",
    description: "Format data into various formats",
    inputSchema: z.object({
      data: z.any().describe("Data to format"),
      format: z.enum(["json", "table", "csv"]).describe("Output format"),
    }),
    execute: async (args: { data: any; format: string }) => {
      if (args.format === "json") {
        return { formatted: JSON.stringify(args.data, null, 2) };
      } else if (args.format === "table") {
        return { formatted: `Table format:\n${JSON.stringify(args.data, null, 2)}` };
      } else {
        return { formatted: "CSV format: " + JSON.stringify(args.data) };
      }
    },
  },
};

class CodemodeMCPServer {
  private httpServer: HttpServer | null = null;
  private port: number;
  private clients: Set<ServerResponse> = new Set();
  private codemodeEngine: ToolCallingEngine;
  
  constructor(port: number = 3457) {
    this.port = port;
    
    // Initialize the codemode engine with Anthropic
    this.codemodeEngine = new ToolCallingEngine({
      tools: exampleTools,
      enableCodeExecution: true,
      verbose: false,
    });
  }

  async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.httpServer.on("error", reject);
      
      this.httpServer.listen(this.port, () => {
        console.log(`🚀 Codemode MCP Server running on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stopServer(): Promise<void> {
    if (!this.httpServer) return;

    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();

    return new Promise((resolve, reject) => {
      this.httpServer!.close((error) => {
        if (error) reject(error);
        else {
          this.httpServer = null;
          resolve();
        }
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || "/";
    
    // CORS headers
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

    // Health check
    if (url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        status: "ok", 
        service: "codemode-mcp",
        anthropic_configured: !!process.env.ANTHROPIC_API_KEY,
      }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  }

  private handleSSE(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    this.clients.add(res);

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

    req.on("close", () => this.clients.delete(res));
    req.on("error", () => this.clients.delete(res));

    // Send endpoint event
    this.sendSSEMessage(res, {
      type: "endpoint",
      endpoint: "/mcp",
    });
  }

  private async handleMCPMessage(message: any, res: ServerResponse): Promise<void> {
    try {
      if (message.method === "initialize") {
        this.sendSSEMessage(res, {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "codemode-standalone",
              version: "1.0.0",
            },
          },
        });
      } 
      else if (message.method === "tools/list") {
        this.sendSSEMessage(res, {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            tools: [
              {
                name: "executeCode",
                description: "Execute complex workflows using LLM-generated code. The codemode engine will generate JavaScript code to orchestrate multiple tool calls, handle conditional logic, and transform data. Use listAvailableTools to see what tools are available for use.",
                inputSchema: {
                  type: "object",
                  properties: {
                    userRequest: {
                      type: "string",
                      description: "Natural language description of what you want to accomplish. The engine will generate and execute code to fulfill this request using available tools.",
                    },
                  },
                  required: ["userRequest"],
                },
              },
              {
                name: "executeCodeWithTools",
                description: "Execute code with access to internal tools. Use this for complex multi-step operations. Call listAvailableTools to see available tools, their inputs, and outputs.",
                inputSchema: {
                  type: "object",
                  properties: {
                    code: {
                      type: "string",
                      description: "JavaScript code to execute. Has access to a 'tools' object with various methods. Use listAvailableTools to see what tools are available.",
                    },
                  },
                  required: ["code"],
                },
              },
              {
                name: "listAvailableTools",
                description: "Returns a description of all available JavaScript tools that can be used in executeCode and executeCodeWithTools, including their functionality, inputs, and outputs.",
                inputSchema: {
                  type: "object",
                  properties: {},
                  required: [],
                },
              },
            ],
          },
        });
      } 
      else if (message.method === "tools/call") {
        const toolName = message.params.name;
        const args = message.params.arguments;

        let result: any;

        if (toolName === "executeCode") {
          // Use the full codemode engine with LLM
          if (!process.env.ANTHROPIC_API_KEY) {
            result = {
              isError: true,
              content: [{
                type: "text",
                text: "ANTHROPIC_API_KEY not configured. Please set it in your environment.",
              }],
            };
          } else {
            try {
              const response = await this.codemodeEngine.execute({
                userRequest: args.userRequest,
              });

              result = {
                isError: !response.result.success,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: response.result.success,
                    result: response.result.result,
                    executionTime: response.result.executionTime,
                    cost: response.cost,
                    tokensUsed: response.totalTokens,
                  }, null, 2),
                }],
              };
            } catch (error) {
              result = {
                isError: true,
                content: [{
                  type: "text",
                  text: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
                }],
              };
            }
          }
        } 
        else if (toolName === "executeCodeWithTools") {
          // Direct code execution (no LLM)
          try {
            const engine = new CodemodeEngine({
              generateCode: async () => args.code,
              tools: exampleTools,
              securityPolicy: {
                maxExecutionTime: 10000,
                maxMemoryMB: 128,
              },
            });

            const response = await engine.execute({ userRequest: "" });

            result = {
              isError: !response.result.success,
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: response.result.success,
                  result: response.result.result,
                  executionTime: response.result.executionTime,
                }, null, 2),
              }],
            };
          } catch (error) {
            result = {
              isError: true,
              content: [{
                type: "text",
                text: `Code execution failed: ${error instanceof Error ? error.message : String(error)}`,
              }],
            };
          }
        }
        else if (toolName === "listAvailableTools") {
          // Return descriptions of all available tools
          const toolDescriptions = {
            tools: [
              {
                name: "calculate",
                description: "Perform mathematical calculations using JavaScript evaluation",
                inputs: {
                  expression: {
                    type: "string",
                    description: "Mathematical expression to evaluate (e.g., '2 + 2', 'Math.sqrt(16)', '5 * (3 + 2)')",
                    required: true,
                  },
                },
                outputs: {
                  success: {
                    result: "number | any - The result of the calculation",
                    expression: "string - The expression that was evaluated",
                  },
                  error: {
                    error: "string - Error message if expression is invalid",
                    expression: "string - The expression that failed",
                  },
                },
                example: "await tools.calculate({ expression: '2 + 2' }) // Returns { result: 4, expression: '2 + 2' }",
              },
              {
                name: "searchWeb",
                description: "Search the web for information (currently returns mocked results)",
                inputs: {
                  query: {
                    type: "string",
                    description: "Search query to look up",
                    required: true,
                  },
                },
                outputs: {
                  query: "string - The search query that was used",
                  results: "Array<{ title: string, snippet: string }> - Array of search results with title and snippet",
                },
                example: "await tools.searchWeb({ query: 'JavaScript tutorials' }) // Returns { query: '...', results: [...] }",
              },
              {
                name: "getDateTime",
                description: "Get the current date and time in various formats",
                inputs: {},
                outputs: {
                  timestamp: "number - Unix timestamp in milliseconds",
                  iso: "string - ISO 8601 formatted date string",
                  formatted: "string - Locale-formatted date and time string",
                },
                example: "await tools.getDateTime() // Returns { timestamp: 1234567890, iso: '2024-...', formatted: '...' }",
              },
              {
                name: "formatData",
                description: "Format data into various output formats (json, table, csv)",
                inputs: {
                  data: {
                    type: "any",
                    description: "Data to format (can be any JavaScript value)",
                    required: true,
                  },
                  format: {
                    type: "enum",
                    values: ["json", "table", "csv"],
                    description: "Output format to use",
                    required: true,
                  },
                },
                outputs: {
                  formatted: "string - The formatted data as a string",
                },
                example: "await tools.formatData({ data: { name: 'John' }, format: 'json' }) // Returns { formatted: '{\\n  \"name\": \"John\"\\n}' }",
              },
            ],
            usage: {
              note: "All tools are accessed through the 'tools' object in your code",
              pattern: "await tools.toolName({ ...arguments })",
              async: "All tools are asynchronous and return Promises",
            },
          };

          result = {
            isError: false,
            content: [{
              type: "text",
              text: JSON.stringify(toolDescriptions, null, 2),
            }],
          };
        } 
        else {
          result = {
            isError: true,
            content: [{
              type: "text",
              text: `Unknown tool: ${toolName}`,
            }],
          };
        }

        this.sendSSEMessage(res, {
          jsonrpc: "2.0",
          id: message.id,
          result,
        });
      } 
      else {
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

  getServerUrl(): string {
    return `http://localhost:${this.port}/mcp`;
  }
}

async function main() {
  console.log("🚀 Starting Codemode MCP Server\n");

  const server = new CodemodeMCPServer(3457);
  await server.startServer();

  console.log("\n✅ Codemode MCP Server is running!");
  console.log("\n📡 Connection Details:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  MCP Endpoint:  ${server.getServerUrl()}`);
  console.log(`  Transport:     SSE (Server-Sent Events)`);
  console.log(`  Port:          3457`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔧 Available MCP Tools:");
  console.log("  1. executeCode");
  console.log("     - Full codemode pattern with LLM");
  console.log("     - Takes natural language requests");
  console.log("     - Generates and executes code automatically");
  console.log("");
  console.log("  2. executeCodeWithTools");
  console.log("     - Direct code execution (no LLM)");
  console.log("     - You provide the JavaScript code");
  console.log("     - Has access to internal tools (use listAvailableTools for details)");
  console.log("");
  console.log("  3. listAvailableTools");
  console.log("     - Returns descriptions of all available JS tools");
  console.log("     - Shows inputs, outputs, and usage examples");
  console.log("");

  console.log("🎯 For Cursor Integration:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  1. Open Cursor Settings → MCP");
  console.log("  2. Add server:");
  console.log(`     URL: ${server.getServerUrl()}`);
  console.log("     Transport: SSE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (process.env.ANTHROPIC_API_KEY) {
    console.log("✅ Anthropic API Key configured - Full codemode pattern available");
  } else {
    console.log("⚠️  Anthropic API Key not found");
    console.log("   Set ANTHROPIC_API_KEY to enable the executeCode tool");
    console.log("   executeCodeWithTools will still work without it");
  }

  console.log("\nPress Ctrl+C to stop the server\n");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n\n🛑 Shutting down Codemode MCP Server...");
    await server.stopServer();
    console.log("✅ Server stopped gracefully");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n\n🛑 Shutting down Codemode MCP Server...");
    await server.stopServer();
    console.log("✅ Server stopped gracefully");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("❌ Failed to start Codemode MCP Server:", error);
  process.exit(1);
});

