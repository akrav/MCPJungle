import { loadConfig } from "../config/load.js";
import { generateCodemodeTypes, type ToolDescriptor } from "./typegen.js";
import {
  computeCatalogHash,
  makeCacheKey,
  TypedSurfaceCache,
  type CatalogEntry,
} from "./cache.js";
/**
 * Codemode facade: orchestrator entrypoint for generating a typed surface.
 *
 * This module will, in later tickets, compose configuration loading,
 * Jungle tool discovery, type generation and caching.
 */

export type GetTypedSurfaceParams = {
  userId: string;
};

export type TypedSurfaceResult = {
  dts: string;
  hash: string;
};

/**
 * Public facade for codemode typed surface generation.
 *
 * Ticket-3101: scaffold only; implementation lands in subsequent tickets.
 */
export async function getTypedSurface(_params: GetTypedSurfaceParams): Promise<TypedSurfaceResult> {
  const { userId } = _params;

  // Load configuration if available; fall back to a local URL for tests
  let jungleUrl = "http://127.0.0.1:8080";
  try {
    const cfg = loadConfig();
    jungleUrl = cfg.jungleUrl;
  } catch {
    // ignore; tests may run without env
  }

  const tools = await listJungleTools({
    url: `${jungleUrl}/mcp`,
    transport: "sse",
    clientFactory: __testClientFactory,
  });

  // Compute catalog hash from tool names (and placeholder schema id for now)
  const entries: CatalogEntry[] = tools.map((t) => ({
    name: t.name,
    schemaEtagOrJson: "n/a",
  }));
  const catalogHash = computeCatalogHash(entries);
  const cacheKey = makeCacheKey(userId, catalogHash);

  const result = await surfaceCache.getOrCreate(cacheKey, async () => {
    const descriptors: ToolDescriptor[] = tools.map((t) => ({ name: t.name, description: t.description }));
    const { dts } = generateCodemodeTypes(descriptors);
    return { dts, hash: catalogHash, ts: Date.now() };
  });

  return { dts: result.dts, hash: result.hash };
}

// --- Sprint 1 Ticket-3105: Jungle tool fetch (smoke; prefer mocks in CI) ---
export type MCPClientLike = {
  connect(): Promise<void>;
  getTools(): Array<{ name: string; description?: string }>;
  disconnect(): Promise<void>;
};

export type ListJungleToolsOptions = {
  url: string;
  transport: "sse" | "stdio" | "http";
  headers?: Record<string, string>;
  clientFactory?: (cfg: { url: string; transport: "sse" | "stdio" | "http"; headers?: Record<string, string> }) => MCPClientLike;
};

/**
 * Fetch tools from the user's Jungle via an MCP client. In CI, inject a mock client via clientFactory.
 */
export async function listJungleTools(options: ListJungleToolsOptions): Promise<Array<{ name: string; description?: string }>> {
  const { clientFactory, ...cfg } = options;
  if (!clientFactory) {
    // Guard: real network wiring will be added later; for now require injection
    return [];
  }
  const client = clientFactory(cfg);
  await client.connect();
  const tools = client.getTools();
  await client.disconnect();
  return tools.map((t) => ({ name: t.name, description: t.description }));
}

// Module-level cache instance (10 minutes TTL)
const surfaceCache = new TypedSurfaceCache(10 * 60 * 1000);

// Test-only injection for MCP client factory
let __testClientFactory: ListJungleToolsOptions["clientFactory"] | undefined;
export function setTestClientFactory(factory: ListJungleToolsOptions["clientFactory"] | undefined): void {
  __testClientFactory = factory;
}

export default {
  getTypedSurface,
  listJungleTools,
  setTestClientFactory,
};


