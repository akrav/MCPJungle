import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server/http';
import { restartOtelForTests, shutdownOtel } from '../../src/obs/otel';

describe('Sprint2 Ticket-208 log-trace correlation', () => {
  const logs: string[] = [];
  const orig = console.log;
  beforeAll(async () => {
    await restartOtelForTests();
    // capture logs
    // eslint-disable-next-line no-console
    const logger: (...args: any[]) => void = (s?: unknown) => {
      if (typeof s === 'string') logs.push(s);
    };
    // eslint-disable-next-line no-console
    console.log = logger;
    process.env.JUNGLE_URL = 'http://localhost:9000';
  });
  afterAll(async () => {
    // eslint-disable-next-line no-console
    console.log = orig;
    await shutdownOtel();
  });

  it('includes trace_id/span_id in log lines during a request', async () => {
    await request(app).get('/healthz');
    const joined = logs.join('\n');
    expect(/"trace_id"\s*:\s*"[a-f0-9]+"/.test(joined)).toBe(true);
    expect(/"span_id"\s*:\s*"[a-f0-9]+"/.test(joined)).toBe(true);
  });
});


