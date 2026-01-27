import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';

describe('Sprint4 Ticket-401 initialize contract', () => {
  beforeAll(() => { process.env.JUNGLE_URL = 'http://localhost:9000'; });

  it('responds with JSON-RPC 2.0, id echo, non-null result', async () => {
    const id = 'init-1';
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id, method: 'initialize' });
    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe('2.0');
    expect(res.body.id).toBe(id);
    expect(res.body.result).toBeTruthy();
    expect(res.body.error).toBeUndefined();
  });
});
