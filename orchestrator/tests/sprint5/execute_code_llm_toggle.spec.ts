import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import app from '../../src/server/http';

let srv: http.Server;
let url: string;

function json(res: http.ServerResponse, body: any) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

describe('Codemode LLM toggle - executeCode listing behavior', () => {
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const msg = JSON.parse(body || '{}');
          if (msg.method === 'initialize') return json(res, { jsonrpc: '2.0', id: msg.id, result: { server: { name: 'u' } } });
          if (msg.method === 'tools/list') return json(res, { jsonrpc: '2.0', id: msg.id, result: { tools: [] } });
          return json(res, { jsonrpc: '2.0', id: msg.id, result: {} });
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
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('hides executeCode when no Anthropic key is present', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 'l1', method: 'tools/list' });
    const names = (res.body?.result?.tools || []).map((t: any) => t.name);
    expect(names).toContain('codemode__executeCodeWithTools');
    expect(names).toContain('codemode__listAvailableTools');
    expect(names).not.toContain('codemode__executeCode');
  });

  it('lists executeCode when Anthropic key is present (no call made)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-dummy';
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 'l2', method: 'tools/list' });
    const names = (res.body?.result?.tools || []).map((t: any) => t.name);
    expect(names).toContain('codemode__executeCode');
  });
});


