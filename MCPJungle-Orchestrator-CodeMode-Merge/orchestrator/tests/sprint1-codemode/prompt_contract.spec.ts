import { describe, it, expect } from "vitest";

import { getTypedSurface } from "../../src/codemode/index";
import { buildPrompt } from "../../src/codemode/prompt";
import { generateCodemodeTypes } from "../../src/codemode/typegen";
import { computeCatalogHash, TypedSurfaceCache } from "../../src/codemode/cache";

describe("codemode scaffold contract", () => {
  it("exposes getTypedSurface facade", () => {
    expect(typeof getTypedSurface).toBe("function");
  });

  it("exposes prompt builder", () => {
    expect(typeof buildPrompt).toBe("function");
  });

  it("exposes type generation adapter", () => {
    expect(typeof generateCodemodeTypes).toBe("function");
  });

  it("exposes cache utilities", () => {
    expect(typeof computeCatalogHash).toBe("function");
    expect(typeof TypedSurfaceCache).toBe("function");
  });

  it("prompt includes function names and guardrails", () => {
    const prompt = buildPrompt({
      functions: [
        { name: "jungle__list", description: "List tools" },
        { name: "fs__read_file", description: "Read a file from disk" },
      ],
    });

    expect(prompt).toMatch(/Output only code/i);
    expect(prompt).toMatch(/single async function/i);
    expect(prompt).toContain("jungle__list");
    expect(prompt).toContain("fs__read_file");
    expect(prompt).toContain('codemode["server__tool"]');
  });
});


