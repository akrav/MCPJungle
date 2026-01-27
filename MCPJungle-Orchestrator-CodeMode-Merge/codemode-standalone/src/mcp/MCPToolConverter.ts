import type { Tool, ToolSet } from "../types/index.js";
import type { MCPClient } from "./MCPClient.js";
import type { MCPTool } from "./types.js";

/**
 * Converts MCP tools to the format used by the codemode engine
 */
export class MCPToolConverter {
  /**
   * Convert a single MCP tool to codemode Tool format
   */
  convertTool(mcpTool: MCPTool, client: MCPClient): Tool {
    return {
      name: mcpTool.name,
      description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
      inputSchema: mcpTool.inputSchema,
      execute: async (args: any) => {
        return await client.callTool(mcpTool.name, args);
      },
    };
  }

  /**
   * Convert all tools from an MCP client to a ToolSet
   */
  convertAllTools(client: MCPClient): ToolSet {
    const mcpTools = client.getTools();
    const toolSet: ToolSet = {};

    for (const mcpTool of mcpTools) {
      // Prefix MCP tools to avoid naming conflicts
      const toolName = `mcp_${mcpTool.name}`;
      toolSet[toolName] = this.convertTool(mcpTool, client);
    }

    return toolSet;
  }

  /**
   * Convert tools from multiple MCP clients
   */
  convertMultipleClients(
    clients: Map<string, MCPClient>
  ): ToolSet {
    const toolSet: ToolSet = {};

    for (const [clientId, client] of clients.entries()) {
      const mcpTools = client.getTools();

      for (const mcpTool of mcpTools) {
        // Prefix with client ID to namespace tools from different servers
        const toolName = `mcp_${clientId}_${mcpTool.name}`;
        toolSet[toolName] = this.convertTool(mcpTool, client);
      }
    }

    return toolSet;
  }
}






