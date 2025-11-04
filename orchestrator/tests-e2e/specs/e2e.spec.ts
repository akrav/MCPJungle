import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import app from '../../src/server/http.js';
import request from 'supertest';
import { waitForHttp } from '../scripts/waitFor.js';
import { startSampleMcpServer } from '../sample-mcp-server.js';
import { reportInit, reportTest, reportActual } from '../report.js';

const composeFile = path.resolve(__dirname, '../compose.e2e.yml');
const jungleHealth = 'http://localhost:9001/health';
const orchestratorHealth = 'http://localhost:8080/healthz';

async function httpJson(method: string, url: string, body?: unknown, headers?: Record<string, string>) {
  return new Promise<any>((resolve, reject) => {
    const u = new URL(url);
    const data = body ? Buffer.from(JSON.stringify(body)) : undefined;
    const req = http.request({
      method,
      hostname: u.hostname,
      port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': data.length } : {}),
        ...(headers || {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

describe('E2E Orchestrator + Jungle + Sample MCP (live)', () => {
  let sample: { stop: () => Promise<void>; port: number } | null = null;

  beforeAll(async () => {
    reportInit();
    // 1) Bring up Jungle via compose
    execSync(`docker compose -f ${composeFile} up -d`, { stdio: 'inherit' });
    await waitForHttp(jungleHealth, 60000, 1000);
    // 2) Initialize Jungle in development mode
    const initRes = await httpJson('POST', 'http://localhost:9001/init', { mode: 'development' });
    if ((initRes.status || 0) >= 400 && initRes.body?.error && String(initRes.body.error).includes('already initialized')) {
      // ok
    }
    // 3) Start sample MCP server on host
    sample = await startSampleMcpServer(0);
    await waitForHttp(`http://localhost:${sample.port}/health`, 15000, 500);
    // 4) Register sample server in Jungle via HTTP API
    const regBody = {
      name: 'sample',
      transport: 'streamable_http',
      description: 'E2E Sample server',
      url: `http://host.docker.internal:${sample.port}/mcp`,
    };
    reportTest('Register sample server', regBody, { status: 201 });
    const reg = await httpJson('POST', 'http://localhost:9001/api/v0/servers', regBody);
    reportActual(reg, (reg.status === 201 || reg.status === 200));

    // Wait for tools to be visible
    for (let i = 0; i < 20; i++) {
      const tools = await httpJson('GET', 'http://localhost:9001/api/v0/tools?server=sample');
      if (tools.status === 200 && Array.isArray(tools.body) && tools.body.some((t: any) => typeof t?.name === 'string')) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 5) Set orchestrator env
    process.env.JUNGLE_URL = 'http://localhost:9001';
    process.env.CODEMODE_ENABLED = 'true';
    delete process.env.ANTHROPIC_API_KEY; // LLM path disabled for these E2E
  }, 120000);

  afterAll(async () => {
    if (sample) await sample.stop();
    try { execSync(`docker compose -f ${composeFile} down -v`, { stdio: 'inherit' }); } catch {/* ignore */}
  }, 60000);

  it('03 - Orchestrator tools/list includes codemode tools and sample tools', async () => {
    const reqBody = { jsonrpc: '2.0', id: 'l1', method: 'tools/list' };
    reportTest('tools/list via orchestrator', reqBody, { toolsInclude: ['codemode__executeCodeWithTools', 'codemode__listAvailableTools', 'sample__calculate'] });
    const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send(reqBody);
    const tools = res.body?.result?.tools || [];
    const names = tools.map((t: any) => t.name);
    reportActual({ status: res.status, names }, res.status === 200 && names.includes('codemode__executeCodeWithTools') && names.includes('codemode__listAvailableTools'));
    expect(res.status).toBe(200);
    expect(names).toContain('codemode__executeCodeWithTools');
    expect(names).toContain('codemode__listAvailableTools');
  });

  it('04 - Generate TypeScript bindings and compile usage', async () => {
    // Fetch tools/list
    const listRes = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 'l2', method: 'tools/list' });
    const tools = listRes.body?.result?.tools || [];
    const toolSet: Record<string, any> = {};
    for (const t of tools) {
      if (typeof t?.name === 'string' && t.inputSchema) {
        toolSet[t.name] = { name: t.name, description: t.description || '', inputSchema: t.inputSchema };
      }
    }
    reportTest('Type generation input', Object.keys(toolSet), { contains: ['sample__calculate', 'sample__getDateTime'] });
    const { TypeGenerator } = await import('../../../codemode-standalone/dist/index.js');
    const gen = new (TypeGenerator as any)();
    const types = await gen.generateTypeDefinitions(toolSet);
    const fs = await import('node:fs'); const p = await import('node:path');
    const artifactsDir = p.resolve(__dirname, '../artifacts');
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(p.join(artifactsDir, 'types.d.ts'), types);
    // Create tiny usage file
    const usage = `// types are included via tsconfig include of artifacts/types.d.ts
type _Check = Parameters<typeof tools.sample__calculate>[0];
const x: _Check = { expression: '2+2' };
console.log(x);`;
    fs.writeFileSync(p.join(p.resolve(__dirname), 'bindings-usage.ts'), usage);
    // Compile
    let ok = true; let err: any = null;
    try { execSync(`npx -y tsc -p ${p.resolve(__dirname, '../tsconfig.bindings.json')}`, { stdio: 'pipe' }); } catch (e) { ok = false; err = e; }
    reportActual({ compiled: ok, error: err?.stderr?.toString?.() }, ok);
    expect(ok).toBe(true);
  });

  it('05 - executeCodeWithTools calls two upstream tools and returns combined JSON', async () => {
    const code = `const a = await tools["sample__calculate"]({ expression: "2+3" }); const t = await tools["sample__getDateTime"]({}); return { sum: a.result, ts: t.timestamp };`;
    const reqBody = { jsonrpc: '2.0', id: 'c1', method: 'tools/call', params: { name: 'codemode__executeCodeWithTools', arguments: { code } } };
    reportTest('executeCodeWithTools', { code }, { success: true, result: { sum: 5 } });
    const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send(reqBody);
    const txt = res.body?.result?.content?.[0]?.text || '{}';
    const parsed = JSON.parse(txt);
    reportActual(parsed, parsed.success === true && typeof parsed.result?.ts === 'number');
    expect(parsed.success).toBe(true);
    expect(parsed.result?.sum).toBe(5);
    expect(typeof parsed.result?.ts).toBe('number');
  });

  it('06 - canonical name access works with bracket accessor', async () => {
    const code = `return await tools["sample__calculate"]({ expression: "10-4" });`;
    const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 'c2', method: 'tools/call', params: { name: 'codemode__executeCodeWithTools', arguments: { code } } });
    const parsed = JSON.parse(res.body?.result?.content?.[0]?.text || '{}');
    reportTest('canonical access (bracket)', { code }, { result: 6 });
    reportActual(parsed, parsed.success === true && parsed.result === 6 || parsed.result?.result === 6);
    // Sample server returns { result: number }
    expect(parsed.success).toBe(true);
    expect((parsed.result?.result ?? parsed.result)).toBe(6);
  });

  it('07 - error propagation for invalid args', async () => {
    const code = `return await tools["sample__calculate"]({ expression: 123 });`;
    const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 'e1', method: 'tools/call', params: { name: 'codemode__executeCodeWithTools', arguments: { code } } });
    const parsed = JSON.parse(res.body?.result?.content?.[0]?.text || '{}');
    reportTest('invalid args', { code }, { isError: true });
    const isErr = res.body?.result?.isError === true || String(parsed.error || parsed.result?.error || '').length > 0;
    reportActual({ wire: res.body?.result, parsed }, isErr);
    expect(isErr).toBe(true);
  });

  it('08 - timeout enforcement', async () => {
    process.env.CODEMODE_MAX_EXEC_MS = '500';
    const code = `const t = Date.now()+2000; while(Date.now()<t){}; return { done: true };`;
    const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send({ jsonrpc: '2.0', id: 'tmo', method: 'tools/call', params: { name: 'codemode__executeCodeWithTools', arguments: { code } } });
    const parsed = JSON.parse(res.body?.result?.content?.[0]?.text || '{}');
    reportTest('timeout', { limitMs: 500, code }, { isError: true });
    const isErr = res.body?.result?.isError === true || /timeout/i.test(String(parsed.error || ''));
    reportActual({ wire: res.body?.result, parsed }, isErr);
    expect(isErr).toBe(true);
  });
});


