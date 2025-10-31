/**
 * Type generation adapter for orchestrator codemode.
 *
 * Ticket-3101: scaffold only. Wiring to the standalone TypeGenerator and
 * canonical naming will be implemented in Ticket-3102.
 */

export type ToolDescriptor = {
  // Prefer structured inputs but allow a fallback combined name
  server?: string;
  tool?: string;
  name?: string;
  description?: string;
  // Placeholder for schema fields; concrete shape to be defined when integrating.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputSchema?: any;
};

export type TypegenOutput = {
  dts: string;
  names: string[];
};

/**
 * Generate TypeScript ambient declaration text for the codemode surface.
 *
 * For now this is a scaffold that returns a deterministic placeholder so that
 * downstream code and tests can type-check.
 */
export function generateCodemodeTypes(tools: ToolDescriptor[]): TypegenOutput {
  // Canonicalize names to server__tool and de-duplicate
  const canonicalNames = Array.from(
    new Set(
      tools
        .map((t) => canonicalizeToolName(t))
        .filter((n): n is string => Boolean(n))
    )
  );

  const lines = canonicalNames.map(
    (name) => `  "${name}": (args: unknown) => Promise<unknown>;`
  );

  const dts = [
    "// codemode type surface (generated)",
    "declare const codemode: {",
    ...lines,
    "};",
  ].join("\n");

  return { dts, names: canonicalNames };
}

function canonicalizeToolName(desc: ToolDescriptor): string | undefined {
  const { server, tool, name } = desc;
  if (server && tool) return `${server}__${tool}`;
  if (!name) return undefined;

  // If already uses double-underscore, assume canonical
  if (name.includes("__")) return name;

  // Prefer explicit separators in priority order, preserving dots in server alias
  if (name.includes("::")) {
    const [srv, tl] = name.split("::", 2);
    return `${srv}__${tl}`;
  }
  if (name.includes("/")) {
    const [srv, tl] = name.split("/", 2);
    return `${srv}__${tl}`;
  }
  if (name.includes(":")) {
    const [srv, tl] = name.split(":", 2);
    return `${srv}__${tl}`;
  }
  if (name.includes(".")) {
    const [srv, tl] = name.split(".", 2);
    return `${srv}__${tl}`;
  }
  return name;
}

export default {
  generateCodemodeTypes,
};


