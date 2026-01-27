import { describe, it, expect, vi } from "vitest";
import { listJungleTools, type MCPClientLike } from "../../src/codemode/index";

describe("mcp client listTools smoke (mocked)", () => {
  it("fetches tools without throwing and logs names", async () => {
    const tools = [
      { name: "fs__read_file", description: "Read file" },
      { name: "jungle__list", description: "List tools" },
    ];

    const mockClient: MCPClientLike = {
      async connect() { /* no-op */ },
      getTools() { return tools; },
      async disconnect() { /* no-op */ },
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await listJungleTools({
      url: "http://localhost:8080/mcp",
      transport: "sse",
      clientFactory: () => mockClient,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);

    for (const t of result) {
      console.log(`tool: ${t.name}`);
    }

    expect(logSpy).toHaveBeenCalledWith("tool: fs__read_file");
    expect(logSpy).toHaveBeenCalledWith("tool: jungle__list");

    logSpy.mockRestore();
  });
});


