import { createServer, IncomingMessage, ServerResponse } from 'http';

// Simple streamable HTTP MCP server with two tools: calculate and getDateTime
// Endpoints: POST /mcp with JSON-RPC 2.0 body

function json(res: ServerResponse, body: any, status: number = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function isObject(v: any): v is Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function handleInitialize(id: any) {
  return { jsonrpc: '2.0', id, result: { server: { name: 'sample-mcp', version: '0.1.0' }, protocolVersion: '2024-11-05' } };
}

function handleToolsList(id: any) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      tools: [
        {
          name: 'calculate',
          description: 'Evaluate a simple JS expression securely',
          inputSchema: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: 'Math expression, e.g., 2 + 2' },
            },
            required: ['expression'],
          },
        },
        {
          name: 'getDateTime',
          description: 'Get current timestamp',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    },
  };
}

function safeEvalExpression(expr: string): number | string {
  try {
    // Very limited safe eval using Function - for test purposes only
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${expr});`);
    const out = fn();
    if (typeof out === 'number') return out;
    return String(out);
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

function handleToolsCall(id: any, params: any) {
  const name = params?.name;
  const args = params?.arguments || {};
  let result: any;
  if (name === 'calculate') {
    if (typeof args.expression !== 'string') {
      return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: 'Invalid argument: expression must be string' }] } };
    }
    const expr = String(args.expression || '0');
    const value = safeEvalExpression(expr);
    result = { isError: false, content: [{ type: 'text', text: JSON.stringify({ result: value }) }] };
  } else if (name === 'getDateTime') {
    result = { isError: false, content: [{ type: 'text', text: JSON.stringify({ timestamp: Date.now() }) }] };
  } else {
    result = { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
  return { jsonrpc: '2.0', id, result };
}

export function startSampleMcpServer(port = 0) {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const msg = JSON.parse(body || '{}');
          if (!isObject(msg)) return json(res, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });
          const id = msg.id ?? null;
          if (msg.method === 'initialize') return json(res, handleInitialize(id));
          if (msg.method === 'tools/list') return json(res, handleToolsList(id));
          if (msg.method === 'tools/call') return json(res, handleToolsCall(id, msg.params || {}));
          return json(res, { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
        } catch (e) {
          return json(res, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        }
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, { status: 'ok', service: 'sample-mcp' });
    }
    res.statusCode = 404; res.end();
  });

  return new Promise<{ stop: () => Promise<void>; port: number }>((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      const addr = server.address();
      const p = typeof addr === 'object' && addr && 'port' in addr ? (addr as any).port as number : (port || 0);
      resolve({ stop: () => new Promise<void>((r) => server.close(() => r())), port: p });
    });
  });
}
