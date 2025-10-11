import request from 'supertest';
import app from '../../src/server/http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const OLD = { ...process.env } as NodeJS.ProcessEnv;

describe('healthz', () => {
  beforeAll(() => {
    process.env.JUNGLE_URL = 'http://localhost:9000';
  });
  afterAll(() => {
    Object.assign(process.env, OLD);
  });
  it('returns ok true', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
  });

  it('rejects GET /mcp with 405', async () => {
    const res = await request(app).get('/mcp');
    expect(res.status).toBe(405);
  });

  it('rejects batch array body on /mcp', async () => {
    const res = await request(app)
      .post('/mcp')
      .send([])
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32600);
  });

  it('handles initialize method success', async () => {
    const res = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.jsonrpc).toBe('2.0');
    expect(res.body.id).toBe(1);
  });

  it('proxies unknown methods to Jungle and maps non-JSON', async () => {
    // No Jungle running during unit tests; we just assert we get a JSON-RPC error envelope
    const res = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 'x', method: 'tools/list' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe('2.0');
    expect(res.body.id).toBe('x');
    expect(res.body.error).toBeDefined();
  });
});
