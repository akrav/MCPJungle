import { describe, it, expect, vi } from "vitest";
import {
  computeCatalogHash,
  TypedSurfaceCache,
  type CatalogEntry,
  makeCacheKey,
} from "../../src/codemode/cache";
import { getTypedSurface, setTestClientFactory, type MCPClientLike } from "../../src/codemode/index";

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

  it("facade getTypedSurface returns stable {dts, hash} and uses cache path", async () => {
    // Inject mock client for listJungleTools used inside the facade
    const tools = [
      { name: "fs__read_file", description: "Read file" },
      { name: "jungle__list", description: "List tools" },
    ];
    const mockClient: MCPClientLike = {
      async connect() {},
      getTools() { return tools; },
      async disconnect() {},
    };
    setTestClientFactory(() => mockClient);

    const a = await getTypedSurface({ userId: "u1" });
    const b = await getTypedSurface({ userId: "u1" });

    expect(a.hash).toBe(b.hash);
    expect(a.dts).toBe(b.dts);

    // Reset factory after test
    setTestClientFactory(undefined);
  });
});


