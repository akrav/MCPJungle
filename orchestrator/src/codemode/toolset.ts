import type { Request } from 'express';
import { UpstreamClient, type UpstreamTool } from './upstream.js';
// Import codemode types from built dist to avoid cross-project TS build coupling
import type { Tool, ToolSet } from '../../../codemode-standalone/dist/index.js';

function isValidJsIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

export type ToolDoc = {
  name: string;
  description?: string;
  inputs?: Record<string, unknown>;
  example: string;
};

export async function buildToolSetFromUpstream(req: Request, client: UpstreamClient, id: string | number | null): Promise<ToolSet> {
  const upstreamTools = await client.listTools(req, id);
  const toolSet: ToolSet = {};
  for (const t of upstreamTools) {
    const canonicalName = t.name;
    const tool: Tool = {
      name: canonicalName,
      description: t.description || `MCP tool ${canonicalName}`,
      inputSchema: (t.inputSchema ?? {}) as any,
      execute: async (args: any) => {
        return await client.callTool(req, id, canonicalName, args || {});
      },
    };
    toolSet[canonicalName] = tool;
  }
  return toolSet;
}

export async function listToolDocs(req: Request, client: UpstreamClient, id: string | number | null): Promise<{ tools: ToolDoc[]; usage: Record<string, string> }> {
  const upstreamTools: UpstreamTool[] = await client.listTools(req, id);
  const tools: ToolDoc[] = upstreamTools.map((t) => {
    const canDot = isValidJsIdentifier(t.name);
    const accessor = canDot ? `tools.${t.name}` : `tools[${JSON.stringify(t.name)}]`;
    return {
      name: t.name,
      description: t.description,
      inputs: (t.inputSchema as any)?.properties || {},
      example: `await ${accessor}({ /* args per inputs */ })`,
    };
  });
  return {
    tools,
    usage: {
      note: "Access upstream tools via the 'tools' object",
      pattern: "await tools.toolName({ ...arguments }) or tools['server__tool']({...})",
      async: 'All tools are async and return Promises',
    },
  };
}


