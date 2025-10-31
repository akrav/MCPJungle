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
}

/**
 * Compute a placeholder catalog hash. Stability and normalization will be
 * implemented in Ticket-3103.
 */
export function computeCatalogHash(_entries: CatalogEntry[]): string {
  return "stub-catalog-hash";
}

export default {
  TypedSurfaceCache,
  computeCatalogHash,
};


