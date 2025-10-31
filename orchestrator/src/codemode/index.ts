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
  // Stub implementation: returns deterministic placeholders so callers can type-check.
  return {
    dts: "// codemode typed surface will be generated in subsequent tickets\n",
    hash: "stub-hash",
  };
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

export default {
  getTypedSurface,
  listJungleTools,
};


