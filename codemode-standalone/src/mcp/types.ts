/**
 * MCP-specific type definitions
 */

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export interface MCPServerConfig {
  url: string;
  transport: "sse" | "stdio" | "http";
  headers?: Record<string, string>;
}

export interface MCPConnectionStatus {
  connected: boolean;
  error?: string;
  toolCount: number;
}






