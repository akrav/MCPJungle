import type { Request } from 'express';
import { UpstreamClient } from './upstream.js';
import { buildToolSetFromUpstream, listToolDocs } from './toolset.js';
import {
  EXECUTE_CODE_SCHEMA,
  EXECUTE_CODE_WITH_TOOLS_SCHEMA,
  LIST_AVAILABLE_TOOLS_SCHEMA,
} from './schemas.js';

// Import codemode from built dist
import { CodemodeEngine, ToolCallingEngine } from '../../../codemode-standalone/dist/index.js';

export type McpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

function envBool(val: string | undefined, fallback: boolean): boolean {
  if (typeof val !== 'string') return fallback;
  const v = val.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return fallback;
}

function getSecurityPolicyFromEnv() {
  const maxExecutionTime = Number(process.env.CODEMODE_MAX_EXEC_MS || 10000);
  const maxMemoryMB = Number(process.env.CODEMODE_MAX_MEM_MB || 128);
  return { maxExecutionTime, maxMemoryMB, allowNetworkAccess: false };
}

export function getCodemodeToolDescriptors(): McpToolDescriptor[] {
  const enableLlm = envBool(process.env.CODEMODE_ENABLE_LLM, true) && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY);
  const tools: McpToolDescriptor[] = [];

  if (enableLlm) {
    tools.push({
      name: 'codemode__executeCode',
      description:
        'Execute complex workflows using LLM-generated JavaScript that orchestrates MCP tools. Requires Anthropic key.',
      inputSchema: EXECUTE_CODE_SCHEMA as any,
    });
  }

  tools.push(
    {
      name: 'codemode__executeCodeWithTools',
      description:
        'Execute provided JavaScript with access to all upstream MCP tools via the tools object. No LLM required.',
      inputSchema: EXECUTE_CODE_WITH_TOOLS_SCHEMA as any,
    },
    {
      name: 'codemode__listAvailableTools',
      description: 'List all available upstream MCP tools with inputs and usage examples.',
      inputSchema: LIST_AVAILABLE_TOOLS_SCHEMA as any,
    },
  );

  return tools;
}

export async function handleCodemodeCall(req: Request, id: string | number | null, name: string, args: any) {
  const upstream = new UpstreamClient();
  if (name === 'codemode__listAvailableTools') {
    const docs = await listToolDocs(req, upstream, id);
    return {
      isError: false,
      content: [{ type: 'text', text: JSON.stringify(docs, null, 2) }],
    };
  }

  if (name === 'codemode__executeCodeWithTools') {
    const policy = getSecurityPolicyFromEnv();
    const tools = await buildToolSetFromUpstream(req, upstream, id);
    const engine = new CodemodeEngine({
      generateCode: async () => String(args?.code || ''),
      tools,
      securityPolicy: policy,
      verbose: false,
    });
    const res = await engine.execute({ userRequest: '' });
    return {
      isError: !res.result.success,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: res.result.success,
              result: res.result.result,
              executionTime: res.result.executionTime,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (name === 'codemode__executeCode') {
    const enableLlm = envBool(process.env.CODEMODE_ENABLE_LLM, true) && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY);
    if (!enableLlm) {
      return {
        isError: true,
        content: [
          { type: 'text', text: 'Codemode LLM execution is disabled or Anthropic API key is missing.' },
        ],
      };
    }
    const policy = getSecurityPolicyFromEnv();
    const tools = await buildToolSetFromUpstream(req, upstream, id);
    const engine = new ToolCallingEngine({ tools, enableCodeExecution: true, securityPolicy: policy, verbose: false });
    const response = await engine.execute({ userRequest: String(args?.userRequest || '') });
    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              result: response.result,
              totalTokens: response.totalTokens,
              cost: response.cost,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  return {
    isError: true,
    content: [{ type: 'text', text: `Unknown codemode tool: ${name}` }],
  };
}


