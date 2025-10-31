/**
 * Type generation adapter for orchestrator codemode.
 *
 * Ticket-3101: scaffold only. Wiring to the standalone TypeGenerator and
 * canonical naming will be implemented in Ticket-3102.
 */

export type ToolDescriptor = {
  name: string;
  // Placeholder for schema; concrete shape to be defined when integrating.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: any;
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
export function generateCodemodeTypes(_tools: ToolDescriptor[]): TypegenOutput {
  const dts = [
    "// codemode type surface placeholder",
    "declare const codemode: Record<string, (args: unknown) => Promise<unknown>>;",
  ].join("\n");

  return { dts, names: [] };
}

export default {
  generateCodemodeTypes,
};


