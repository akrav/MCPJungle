import { createHash } from "node:crypto";

/**
 * In-memory cache and hashing utilities for codemode type surfaces.
 *
 * Ticket-3101: scaffold only. Hashing stability and TTL enforcement will be
 * implemented in Ticket-3103.
 */

export type CatalogEntry = {
  name: string;
  // An opaque identifier representing the tool schema. In later tickets this
  // may be an ETag or a normalized JSON string.
  schemaEtagOrJson: string;
};

export type CachedTypedSurface = {
  dts: string;
  hash: string;
  ts: number; // cached at timestamp (ms since epoch)
};

export class TypedSurfaceCache {
  private readonly ttlMs: number;
  private readonly store: Map<string, CachedTypedSurface> = new Map();

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string): CachedTypedSurface | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: CachedTypedSurface): void {
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }

  async getOrCreate(
    key: string,
    factory: () => Promise<CachedTypedSurface>
  ): Promise<CachedTypedSurface> {
    const cached = this.get(key);
    if (cached) return cached;
    const created = await factory();
    this.set(key, created);
    return created;
  }
}

/**
 * Compute a placeholder catalog hash. Stability and normalization will be
 * implemented in Ticket-3103.
 */
export function computeCatalogHash(entries: CatalogEntry[]): string {
  // Stable, order-insensitive hash of name + schema identifiers
  const canonical = entries
    .map((e) => ({ name: e.name, schema: e.schemaEtagOrJson }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const json = JSON.stringify(canonical);
  return createHash("sha256").update(json).digest("hex");
}

export function makeCacheKey(userId: string, catalogHash: string): string {
  return `${userId}:${catalogHash}`;
}

export default {
  TypedSurfaceCache,
  computeCatalogHash,
  makeCacheKey,
};


