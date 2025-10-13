import express from 'express';
import helmet from 'helmet';
import { healthz } from '../health/healthz';
import { bearerAuth } from '../auth/bearer';
import { authorizeMethods } from '../auth/authorize';
import { isJsonRpcObject } from '../jsonrpc/validate';
import { applyHelmet } from '../security/helmet';
import { enforceJsonAndSize } from '../security/limits';
import { InvalidRequest, ServerError } from '../jsonrpc/errors';
import type { JsonRpcSuccess } from '../jsonrpc/types';
import { loadConfig } from '../config/load';
import { fetch } from 'undici';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';

const app = express();
app.use(applyHelmet());
app.use(express.json({ limit: '1mb' }));
app.use(bearerAuth());

app.get('/healthz', healthz);

// Explicitly reject GET on /mcp per bootstrap contract
app.get('/mcp', (_req, res) => res.sendStatus(405));

// Minimal /mcp POST bootstrap: reject arrays, accept single object
app.post('/mcp', enforceJsonAndSize(1_000_000), authorizeMethods(), async (req, res) => {
  const body = req.body;
  // Content-Type guard: only JSON is accepted
  const ctype = req.headers['content-type'] || '';
  if (typeof ctype !== 'string' || !ctype.startsWith('application/json')) {
    return res.json(InvalidRequest(null));
  }
  if (Array.isArray(body)) {
    return res.json(InvalidRequest(null));
  }
  if (!isJsonRpcObject(body)) {
    // attempt to grab potential id if present and narrow it to string|number|null
    let id: string | number | null = null;
    if (body && typeof body === 'object' && 'id' in body) {
      const raw = (body as Record<string, unknown>).id;
      id = typeof raw === 'string' || typeof raw === 'number' ? raw : null;
    }
    return res.json(InvalidRequest(id));
  }

  const id = body.id ?? null;
  if (body.method === 'initialize') {
    const resp: JsonRpcSuccess = {
      jsonrpc: '2.0',
      id,
      result: {
        server: { name: 'orchestrator', version: '0.1.0' },
        protocolVersion: '2024-11-05',
      },
    };
    return res.json(resp);
  }

  // Minimal cancel relay: forward cancel as-is
  if (body.method === 'cancel') {
    const cfg = loadConfig(process.env);
    try {
      const upstream = await fetch(`${cfg.jungleUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await upstream.text();
      try {
        return res.json(JSON.parse(text));
      } catch {
        return res.json(ServerError(id, upstream.status));
      }
    } catch {
      return res.json(ServerError(id));
    }
  }

  // Happy-path proxy: forward JSON-RPC body to Jungle and relay response
  const cfg = loadConfig(process.env);
  try {
    const upstream = await fetchWithRetry(
      `${cfg.jungleUrl}/mcp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.jungleToken
            ? { Authorization: `Bearer ${cfg.jungleToken}` }
            : {}),
          'User-Agent': 'orchestrator/1.0',
          Forwarded: `proto=http`,
          ...(req.headers['x-user-id']
            ? { 'x-user-id': String(req.headers['x-user-id']) }
            : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
      },
      { retries: 2, baseMs: 50 },
    );
    // Stream response if upstream is OK and JSON; otherwise map to JSON-RPC error or parse JSON body
    const upstreamContentType = upstream.headers.get('content-type') ?? '';
    const isJson = typeof upstreamContentType === 'string' && upstreamContentType.startsWith('application/json');
    if (upstream.ok && upstream.body && isJson) {
      res.setHeader('Content-Type', upstreamContentType || 'application/json');
      Readable.fromWeb(upstream.body as WebReadableStream).pipe(res);
      return;
    }
    // Fallback: read the body, try JSON parse, else wrap as ServerError
    const text = await upstream.text();
    try {
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch {
      return res.json(ServerError(id, upstream.status));
    }
  } catch (e) {
    return res.json(ServerError(id));
  }
});

type RetryConfig = { retries: number; baseMs: number };
type FetchInit = Parameters<typeof fetch>[1];
async function fetchWithRetry(url: string, init: FetchInit, cfg: RetryConfig) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(url, init);
    if (res.status !== 502 && res.status !== 503) return res;
    if (attempt >= cfg.retries) return res;
    attempt++;
    const jitter = Math.random() * cfg.baseMs;
    const delay = cfg.baseMs * Math.pow(2, attempt - 1) + jitter;
    await new Promise((r) => setTimeout(r, delay));
  }
}

export default app;
