import { loadConfig } from '../config/load.js';

type Entry = { baseUrl: string; expiresAt: number };
const map = new Map<string, Entry>();

export function set(userId: string, baseUrl: string, ttlMs?: number): void {
  const cfg = loadConfig(process.env);
  const ttl = ttlMs ?? cfg.routingUserTtlMs;
  map.set(userId, { baseUrl, expiresAt: Date.now() + ttl });
}

export function get(userId: string): string | undefined {
  const entry = map.get(userId);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    map.delete(userId);
    return undefined;
  }
  return entry.baseUrl;
}

export function remove(userId: string): void {
  map.delete(userId);
}

export function prune(): void {
  const now = Date.now();
  for (const [k, v] of map.entries()) {
    if (now >= v.expiresAt) map.delete(k);
  }
}

export function clearAll(): void {
  map.clear();
}

export function listExpired(now: number = Date.now()): Array<{ userId: string; baseUrl: string }> {
  const out: Array<{ userId: string; baseUrl: string }> = [];
  for (const [k, v] of map.entries()) {
    if (now >= v.expiresAt) out.push({ userId: k, baseUrl: v.baseUrl });
  }
  return out;
}

export function size(): number {
  return map.size;
}


