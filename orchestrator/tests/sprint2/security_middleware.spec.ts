import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';

describe('Sprint2 Ticket-203 security middleware', () => {
  beforeEach(() => { process.env.JUNGLE_URL = 'http://localhost:9000'; });
  it('GET /healthz has nosniff header', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(String(res.headers['x-content-type-options'] || '')).toContain('nosniff');
  });

  it('rejects wrong content-type', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'text/plain')
      .send('nope');
    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32600);
  });
});


