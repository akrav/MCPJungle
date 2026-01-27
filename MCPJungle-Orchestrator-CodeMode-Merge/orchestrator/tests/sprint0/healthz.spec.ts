import request from 'supertest';
import app from '../../src/server/http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const OLD = { ...process.env } as NodeJS.ProcessEnv;

describe('/healthz details', () => {
  beforeAll(() => {
    process.env.JUNGLE_URL = 'http://localhost:9000';
  });
  afterAll(() => {
    Object.assign(process.env, OLD);
  });
  it('returns ok, version and jungleUrl', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.version).toBeDefined();
    expect(res.body.jungleUrl).toBe('http://localhost:9000');
  });
});
