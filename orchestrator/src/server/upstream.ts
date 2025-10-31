import * as undici from 'undici';
import type { Request } from 'express';
import { loadConfig } from '../config/load.js';
import { log } from '../obs/log.js';

type RetryConfig = { retries: number; baseMs: number };

let upstreamSessionCache: string | null = null;

export function getUpstreamSession(): string | null {
  return upstreamSessionCache;
}

export function setUpstreamSession(session: string | null): void {
  upstreamSessionCache = session;
}

export async function fetchWithRetry(
  url: string,
  init: Parameters<typeof undici.fetch>[1],
  cfg: RetryConfig,
): Promise<undici.Response> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await undici.fetch(url, init);
    if (res.status !== 502 && res.status !== 503) return res;
    if (attempt >= cfg.retries) return res;
    attempt++;
    const jitter = Math.random() * cfg.baseMs;
    const delay = cfg.baseMs * Math.pow(2, attempt - 1) + jitter;
    await new Promise((r) => setTimeout(r, delay));
  }
}

export async function createUpstreamSession(req: Request, initId: string | number | null): Promise<string | null> {
  const cfg = loadConfig(process.env);
  try {
    const upstream = await undici.fetch(`${cfg.jungleUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(cfg.jungleToken ? { Authorization: `Bearer ${cfg.jungleToken}` } : {}),
        'User-Agent': 'orchestrator/1.0',
        Forwarded: `proto=http`,
        ...(req.headers['x-user-id'] ? { 'x-user-id': String(req.headers['x-user-id']) } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: initId ?? 0, method: 'initialize' }),
      signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
    });
    const s = upstream.headers.get('mcp-session-id');
    upstreamSessionCache = s && s.trim() !== '' ? s : upstreamSessionCache;
    return upstreamSessionCache;
  } catch {
    return null;
  }
}

export async function createStandaloneSession(userId?: string, initId: string | number | null = 0): Promise<string | null> {
  const cfg = loadConfig(process.env);
  try {
    const upstream = await undici.fetch(`${cfg.jungleUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(cfg.jungleToken ? { Authorization: `Bearer ${cfg.jungleToken}` } : {}),
        'User-Agent': 'orchestrator/1.0',
        Forwarded: `proto=http`,
        ...(userId ? { 'x-user-id': String(userId) } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: initId ?? 0, method: 'initialize' }),
      signal: AbortSignal.timeout(cfg.upstreamTimeoutMs),
    });
    const s = upstream.headers.get('mcp-session-id');
    upstreamSessionCache = s && s.trim() !== '' ? s : upstreamSessionCache;
    return upstreamSessionCache;
  } catch {
    return null;
  }
}

export async function postToJungle(
  body: unknown,
  opts: {
    userId?: string;
    useSession?: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
    retries?: number;
    baseUrl?: string;
  } = {},
): Promise<undici.Response> {
  const cfg = loadConfig(process.env);
  const method = typeof (body as any)?.method === 'string' ? (body as any).method : 'unknown';
  if (opts.useSession && !upstreamSessionCache && String(process.env.CODEMODE_AUTO_INIT || '0') === '1') {
    await createStandaloneSession(opts.userId, (body as any)?.id ?? 0);
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'User-Agent': 'orchestrator/1.0',
    Forwarded: `proto=http`,
  };
  if (cfg.jungleToken) headers.Authorization = `Bearer ${cfg.jungleToken}`;
  if (opts.userId) headers['x-user-id'] = String(opts.userId);
  if (opts.useSession && upstreamSessionCache) headers['Mcp-Session-Id'] = upstreamSessionCache;

  const init: Parameters<typeof undici.fetch>[1] = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? cfg.upstreamTimeoutMs),
  };

  const base = (opts.baseUrl || cfg.jungleUrl).replace(/\/$/, '');
  const res = await fetchWithRetry(
    `${base}/mcp`,
    init,
    { retries: opts.retries ?? 2, baseMs: 50 },
  );

  const reflected = res.headers.get('mcp-session-id');
  if (reflected && reflected.trim() !== '') upstreamSessionCache = reflected;
  try {
    log('info', 'upstream_post', { method, used_session: Boolean(headers['Mcp-Session-Id']), status: res.status });
  } catch {}
  return res;
}


