import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';

describe('size caps end-to-end', () => {
  it('oversized request returns InvalidRequest', async () => {
    process.env.JUNGLE_URL = 'http://localhost:9000';
    const body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'x', arguments: {} } };
    const big = JSON.stringify(body) + ' '.repeat(2_000_000);
    const res = await request(app).post('/mcp').set('Content-Type', 'application/json').send(big);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});


