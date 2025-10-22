import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MCPServerConfig, MCPConnectionStatus, MCPTool } from "./types.js";

/**
 * Client for connecting to MCP servers
 * Handles the connection lifecycle and tool discovery
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: SSEClientTransport | StdioClientTransport | null = null;
  private connected = false;
  private tools: MCPTool[] = [];

  constructor(private config: MCPServerConfig) {}

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    try {
      // Create the appropriate transport
      if (this.config.transport === "sse") {
        this.transport = new SSEClientTransport(new URL(this.config.url));
      } else if (this.config.transport === "stdio") {
        // For stdio, the URL should be a command
        const [command, ...args] = this.config.url.split(" ");
        this.transport = new StdioClientTransport({
          command,
          args,
        });
      } else {
        throw new Error(`Unsupported transport type: ${this.config.transport}`);
      }

      // Create the client
      this.client = new Client(
        {
          name: "codemode-standalone",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // Connect
      await this.client.connect(this.transport);
      this.connected = true;

      // Discover available tools
      await this.discoverTools();
    } catch (error) {
      this.connected = false;
      throw new Error(
        `Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Discover tools available on the MCP server
   */
  private async discoverTools(): Promise<void> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      const result = await this.client.listTools();
      this.tools = result.tools as MCPTool[];
    } catch (error) {
      console.warn(
        `Failed to discover tools: ${error instanceof Error ? error.message : String(error)}`
      );
      this.tools = [];
    }
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, any>): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error("Not connected to MCP server");
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      // MCP returns results in a specific format
      if (result.isError) {
        throw new Error(`Tool execution failed: ${JSON.stringify(result.content)}`);
      }

      // Extract the actual result
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const firstContent = result.content[0] as any;
        if (firstContent.type === "text" && firstContent.text) {
          try {
            // Try to parse as JSON
            return JSON.parse(firstContent.text);
          } catch {
            // Return as-is if not JSON
            return firstContent.text;
          }
        }
        return firstContent;
      }

      return result;
    } catch (error) {
      throw new Error(
        `Tool call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all available tools
   */
  getTools(): MCPTool[] {
    return [...this.tools];
  }

  /**
   * Get connection status
   */
  getStatus(): MCPConnectionStatus {
    return {
      connected: this.connected,
      toolCount: this.tools.length,
    };
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.warn(
          `Error during disconnect: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    this.client = null;
    this.transport = null;
    this.connected = false;
    this.tools = [];
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

