import { describe, it, expect } from "vitest";
import { generateCodemodeTypes, type ToolDescriptor } from "../../src/codemode/typegen";

describe("codemode typegen namespacing", () => {
  it("produces canonical server__tool names and single ambient declaration", () => {
    const input: ToolDescriptor[] = [
      { server: "jungle", tool: "list" },
      { name: "context7__resolve-library-id" },
      { name: "server.alpha/list_tools" },
      { name: "fs:read_file" },
      // duplicates should be de-duplicated
      { server: "jungle", tool: "list" },
    ];

    const { dts, names } = generateCodemodeTypes(input);

    expect(names).toEqual([
      "jungle__list",
      "context7__resolve-library-id",
      "server.alpha__list_tools",
      "fs__read_file",
    ]);

    // Exactly one declare const codemode
    const matches = dts.match(/declare const codemode/g) ?? [];
    expect(matches.length).toBe(1);

    // Should include each canonical name in the declaration body
    for (const name of names) {
      expect(dts).toContain(`"${name}": (args: unknown) => Promise<unknown>`);
    }
  });
});


