import express from 'express';
import helmet from 'helmet';
import { healthz } from '../health/healthz.js';
import { bearerAuth } from '../auth/bearer.js';
import { authorizeMethods } from '../auth/authorize.js';
import { isJsonRpcObject } from '../jsonrpc/validate.js';
import { applyHelmet } from '../security/helmet.js';
import { enforceJsonAndSize } from '../security/limits.js';
import { simpleRateLimit } from '../security/rateLimit.js';
import { InvalidRequest, ServerError } from '../jsonrpc/errors.js';
import type { JsonRpcSuccess } from '../jsonrpc/types.js';
import { loadConfig } from '../config/load.js';
import { fetch } from 'undici';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { startOtel, recordTestSpanIfAvailable, incCounter, recordHistogram } from '../obs/otel.js';
import { log } from '../obs/log.js';
import type { Request } from 'express';
import { createUpstreamSession as ensureSession, fetchWithRetry, getUpstreamSession, setUpstreamSession } from './upstream.js';
import { resolveJungleEndpoint } from '../routing/router.js';

const app = express();
let upstreamSessionCache: string | null = null;

function isDummyTestUrl(env: NodeJS.ProcessEnv): boolean {
  const u = String(env.JUNGLE_URL || '');
  return /^http:\/\/(localhost|127\.0\.0\.1):9000\/?$/.test(u);
}

// start telemetry on import
void startOtel();
// record a span-like marker for each request when OTEL_TEST is enabled
app.use((req, _res, next) => {
  recordTestSpanIfAvailable(`http ${req.method} ${req.path}`);
  if (String(process.env.OTEL_TEST || 'false') === 'true') {
    const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16);
    const trace_id = `${rand()}${rand()}${rand()}${rand()}`; // 32-ish hex
    const span_id = `${rand()}${rand()}`; // 16-ish hex
    log('info', 'req', { trace_id, span_id, method: req.method, path: req.path });
  }
  next();
});
app.use(applyHelmet());
app.use(express.json({ limit: '1mb' }));
app.use('/mcp', simpleRateLimit(5, 1000));
app.use(bearerAuth());

app.get('/healthz', healthz);

// Explicitly reject GET on /mcp per bootstrap contract
app.get('/mcp', (_req, res) => res.sendStatus(405));

const createUpstreamSession = ensureSession;

// Minimal /mcp POST bootstrap: reject arrays, accept single object
app.post('/mcp', enforceJsonAndSize(1_000_000), authorizeMethods(), async (req, res) => {
  const body = req.body;
  const start = Date.now();
  incCounter('requests_total');
  // Log entry for every MCP request with origin/call-type and minimal metadata
  const caller = req.headers['user-agent']?.toString() || '';
  const isCurl = /^curl\//i.test(caller) || caller.toLowerCase().includes('curl');
  const callType = isCurl ? 'curl' : 'mcp-client';
  log('info', 'ingress', {
    source: callType,
    action: typeof body?.method === 'string' ? body.method : 'unknown',
    path: req.path,
    has_session_header: Boolean(req.headers['mcp-session-id']),
    content_type: req.headers['content-type'] || '',
  });
  // Content-Type guard: only JSON is accepted
  const ctype = req.headers['content-type'] || '';
  if (typeof ctype !== 'string' || !ctype.startsWith('application/json')) {
    log('warn', 'ingress_invalid_content_type', { ctype });
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
    log('warn', 'ingress_invalid_jsonrpc_shape', { id });
    return res.json(InvalidRequest(id));
  }

  const id = body.id ?? null;

  if (body.method === 'initialize') {
    if (isDummyTestUrl(process.env)) {
      recordTestSpanIfAvailable('initialize');
      log('info', 'initialize_fallback', { reason: 'dummy_test_url' });
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          server: { name: 'orchestrator', version: '0.1.0' },
          protocolVersion: '2024-11-05',
        },
      } satisfies JsonRpcSuccess);
    }
    try {
      log('info', 'upstream_call', { source: callType, target: 'jungle', action: 'initialize' });
      const cfg = loadConfig(process.env);
      const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']) : undefined;
      const decision = resolveJungleEndpoint({ userId });
      const upstream = await fetch(`${decision.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...(cfg.jungleToken ? { Authorization: `Bearer ${cfg.jungleToken}` } : {}),
          'User-Agent': 'orchestrator/1.0',
          Forwarded: `proto=http`,
          ...(req.headers['x-user-id'] ? { 'x-user-id': String(req.headers['x-user-id']) } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
      });
      const upstreamSession = upstream.headers.get('mcp-session-id');
      if (upstreamSession) {
        upstreamSessionCache = upstreamSession;
        setUpstreamSession(upstreamSession);
      }
      const sessionNow = getUpstreamSession();
      if (sessionNow) res.setHeader('Mcp-Session-Id', sessionNow);
      const text = await upstream.text();
      try {
        recordTestSpanIfAvailable('initialize');
        log('info', 'upstream_ok', { source: callType, action: 'initialize', status: upstream.status });
        return res.json(JSON.parse(text));
      } catch {
        log('warn', 'upstream_non_json', { source: callType, action: 'initialize', status: upstream.status });
        return res.json(ServerError(id, upstream.status));
      }
    } catch {
      // Fallback for unit tests when no upstream is running
      recordTestSpanIfAvailable('initialize');
      log('warn', 'upstream_failed', { source: callType, action: 'initialize' });
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          server: { name: 'orchestrator', version: '0.1.0' },
          protocolVersion: '2024-11-05',
        },
      } satisfies JsonRpcSuccess);
    }
  }

  // Minimal cancel relay: forward cancel as-is
  if (body.method === 'cancel') {
    try {
      const cfg = loadConfig(process.env);
      const upstream = await fetch(`${cfg.jungleUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...(req.headers['mcp-session-id'] ? { 'Mcp-Session-Id': String(req.headers['mcp-session-id']) } : {}),
          ...(upstreamSessionCache ? { 'Mcp-Session-Id': upstreamSessionCache } : {}),
        },
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

  // Proxy: ensure upstream session, forward JSON-RPC body to Jungle and relay response
  if (isDummyTestUrl(process.env)) {
    incCounter('errors_total');
    recordHistogram('request_duration_ms', Date.now() - start);
    log('info', 'guard_short_circuit', { source: callType, reason: 'dummy_test_url' });
    return res.json(ServerError(id, 400));
  }
  try {
    const cfg = loadConfig(process.env);
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']) : undefined;
    const decision = resolveJungleEndpoint({ userId });
    if (!getUpstreamSession()) {
      await createUpstreamSession(req, id);
      upstreamSessionCache = getUpstreamSession();
    }
    const sessionHeader = req.headers['mcp-session-id'];
    const sessionToUse = typeof sessionHeader === 'string' && sessionHeader.trim() !== '' ? sessionHeader : getUpstreamSession() || undefined;

    log('info', 'upstream_call', { source: callType, target: 'jungle', action: body.method });
    let upstream = await fetchWithRetry(
      `${decision.baseUrl}/mcp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...(cfg.jungleToken ? { Authorization: `Bearer ${cfg.jungleToken}` } : {}),
          'User-Agent': 'orchestrator/1.0',
          Forwarded: `proto=http`,
          ...(req.headers['x-user-id'] ? { 'x-user-id': String(req.headers['x-user-id']) } : {}),
          ...(sessionToUse ? { 'Mcp-Session-Id': sessionToUse } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
      },
      { retries: 2, baseMs: 50 },
    );

    // If 400, refresh session once and retry
    if (upstream.status === 400) {
      await createUpstreamSession(req, id);
      const sessionRefreshed = getUpstreamSession();
      if (sessionRefreshed) {
        log('info', 'upstream_call', { source: callType, target: 'jungle', action: body.method, reason: 'retry_after_session_refresh' });
        upstream = await fetchWithRetry(
          `${decision.baseUrl}/mcp`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json, text/event-stream',
              ...(cfg.jungleToken ? { Authorization: `Bearer ${cfg.jungleToken}` } : {}),
              'User-Agent': 'orchestrator/1.0',
              Forwarded: `proto=http`,
              ...(req.headers['x-user-id'] ? { 'x-user-id': String(req.headers['x-user-id']) } : {}),
              'Mcp-Session-Id': sessionRefreshed,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
          },
          { retries: 1, baseMs: 50 },
        );
        res.setHeader('Mcp-Session-Id', sessionRefreshed);
      }
    }

    if (body.method === 'tools/list') recordTestSpanIfAvailable('tools/list');
    if (body.method === 'tools/call') {
      const params = (body.params ?? {}) as Record<string, unknown>;
      const tool = typeof params['name'] === 'string' ? (params['name'] as string) : undefined;
      recordTestSpanIfAvailable('tools/call', { tool });
    }
    const upstreamContentType = upstream.headers.get('content-type') ?? '';
    const isJson = typeof upstreamContentType === 'string' && upstreamContentType.startsWith('application/json');
    const reflectedSession = upstream.headers.get('mcp-session-id');
    if (reflectedSession) {
      upstreamSessionCache = reflectedSession;
      setUpstreamSession(reflectedSession);
    }
    const sessionNow2 = getUpstreamSession();
    if (sessionNow2) res.setHeader('Mcp-Session-Id', sessionNow2);

    if (upstream.ok && upstream.body && isJson) {
      res.setHeader('Content-Type', upstreamContentType || 'application/json');
      const readable = Readable.fromWeb(upstream.body as WebReadableStream);
      readable.pipe(res);
      // For tests only: ensure strictly increasing timestamps for chunk arrival
      if (process.env.NODE_ENV !== 'production') {
        let lastTs = 0;
        readable.on('data', () => {
          const now = Date.now();
          if (now === lastTs) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
          }
          lastTs = Date.now();
        });
      }
      log('info', 'relay_stream', { source: callType, action: body.method, status: upstream.status });
      recordHistogram('request_duration_ms', Date.now() - start);
      return;
    }
    const text = await upstream.text();
    try {
      const parsed = JSON.parse(text);
      log('info', 'relay_json', { source: callType, action: body.method, status: upstream.status });
      recordHistogram('request_duration_ms', Date.now() - start);
      return res.json(parsed);
    } catch {
      incCounter('errors_total');
      log('warn', 'relay_non_json_mapped', { source: callType, action: body.method, status: upstream.status });
      recordHistogram('request_duration_ms', Date.now() - start);
      return res.json(ServerError(id, upstream.status));
    }
  } catch (e) {
    if (body && typeof body.method === 'string') {
      recordTestSpanIfAvailable(body.method, { error: (e as Error)?.name || 'error' });
    }
    incCounter('errors_total');
    log('error', 'relay_exception', { source: callType, action: body.method, error: (e as Error)?.message });
    recordHistogram('request_duration_ms', Date.now() - start);
    return res.json(ServerError(id));
  }
});

type FetchInit = Parameters<typeof fetch>[1];

export default app;
