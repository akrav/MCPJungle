import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';

let srv: http.Server;
let url: string;

function json(res: http.ServerResponse, body: any, headers: Record<string, string> = {}) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

describe('Codemode integration - tools/list merge and codemode tools', () => {
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const msg = JSON.parse(body || '{}');
          if (msg.method === 'initialize') {
            json(res, {
              jsonrpc: '2.0',
              id: msg.id,
              result: { server: { name: 'up', version: '1' }, protocolVersion: '2024-11-05' },
            }, { 'mcp-session-id': 'sess-1' });
            return;
          }
          if (msg.method === 'tools/list') {
            json(res, {
              jsonrpc: '2.0', id: msg.id, result: {
                tools: [
                  {
                    name: 'echo__say',
                    description: 'Echo back a message',
                    inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
                  },
                ],
              },
            }, { 'mcp-session-id': 'sess-1' });
            return;
          }
          if (msg.method === 'tools/call') {
            const name = msg.params?.name;
            if (name === 'echo__say') {
              json(res, {
                jsonrpc: '2.0', id: msg.id, result: {
                  isError: false,
                  content: [ { type: 'text', text: JSON.stringify({ echoed: msg.params?.arguments?.message || '' }) } ],
                },
              }, { 'mcp-session-id': 'sess-1' });
              return;
            }
            // default: echo call body
            json(res, { jsonrpc: '2.0', id: msg.id, result: msg }, { 'mcp-session-id': 'sess-1' });
            return;
          }
          json(res, { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'not found' } });
        });
        return;
      }
      res.statusCode = 404; res.end();
    });
    await new Promise<void>((resolve) => srv.listen(0, resolve));
    const addr = srv.address();
    const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : 0;
    url = `http://127.0.0.1:${port}`;
    process.env.JUNGLE_URL = url;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  });

  beforeEach(() => {
    process.env.CODEMODE_ENABLED = 'true';
    delete process.env.ANTHROPIC_API_KEY; // ensure LLM tool is hidden
  });

  it('merges codemode tools into tools/list', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 't1', method: 'tools/list' });
    expect(res.status).toBe(200);
    const tools = res.body?.result?.tools || [];
    const names = tools.map((t: any) => t.name);
    expect(names).toContain('echo__say');
    expect(names).toContain('codemode__executeCodeWithTools');
    expect(names).toContain('codemode__listAvailableTools');
    // LLM tool disabled in this test by missing key
    expect(names).not.toContain('codemode__executeCode');
  });

  it('returns listAvailableTools metadata', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 't2', method: 'tools/call', params: { name: 'codemode__listAvailableTools', arguments: {} } });
    expect(res.status).toBe(200);
    const content = res.body?.result?.content?.[0]?.text || '{}';
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed.tools)).toBe(true);
    const names = parsed.tools.map((t: any) => t.name);
    expect(names).toContain('echo__say');
  });

  it('executes code via executeCodeWithTools and calls upstream tool', async () => {
    const code = `const r = await tools["echo__say"]({ message: "hi" }); return r;`;
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 't3', method: 'tools/call', params: { name: 'codemode__executeCodeWithTools', arguments: { code } } });
    expect(res.status).toBe(200);
    const txt = res.body?.result?.content?.[0]?.text || '{}';
    const parsed = JSON.parse(txt);
    expect(parsed.success).toBe(true);
    expect(parsed.result).toEqual({ echoed: 'hi' });
  });
});


