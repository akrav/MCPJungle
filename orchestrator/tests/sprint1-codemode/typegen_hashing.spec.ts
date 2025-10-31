import { describe, it, expect, vi } from "vitest";
import {
  computeCatalogHash,
  TypedSurfaceCache,
  type CatalogEntry,
  makeCacheKey,
} from "../../src/codemode/cache";

describe("codemode hashing and cache", () => {
  it("computes stable, order-insensitive catalog hash", () => {
    const a: CatalogEntry[] = [
      { name: "a__t1", schemaEtagOrJson: "s1" },
      { name: "b__t2", schemaEtagOrJson: "s2" },
    ];
    const b: CatalogEntry[] = [
      { name: "b__t2", schemaEtagOrJson: "s2" },
      { name: "a__t1", schemaEtagOrJson: "s1" },
    ];

    const h1 = computeCatalogHash(a);
    const h2 = computeCatalogHash(b);
    expect(h1).toBe(h2);

    const changed: CatalogEntry[] = [
      { name: "a__t1", schemaEtagOrJson: "s1-mut" },
      { name: "b__t2", schemaEtagOrJson: "s2" },
    ];
    const h3 = computeCatalogHash(changed);
    expect(h3).not.toBe(h1);
  });

  it("cache getOrCreate reduces generator calls within TTL", async () => {
    const cache = new TypedSurfaceCache(1000);
    const key = makeCacheKey("u1", "h1");

    const factory = vi.fn(async () => ({ dts: "dts-1", hash: "h1", ts: Date.now() }));

    const first = await cache.getOrCreate(key, factory);
    const second = await cache.getOrCreate(key, factory);

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});


