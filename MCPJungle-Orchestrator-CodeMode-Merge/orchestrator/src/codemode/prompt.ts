/**
 * Prompt builder for codemode.
 *
 * Ticket-3101: scaffold only. Contract content and guardrails will be
 * validated and expanded in later tickets.
 */

export type PromptFunctionDescriptor = {
  name: string;
  description: string;
};

export type BuildPromptInput = {
  functions: PromptFunctionDescriptor[];
};

/**
 * Build a concise prompt instructing the model to emit only code.
 */
export function buildPrompt(input: BuildPromptInput): string {
  const header = [
    "You are Codemode. Output only code.",
    "Return a single async function that uses `codemode` tools.",
    "Do not include commentary or explanations.",
  ].join(" \n");

  const list = input.functions
    .map((f) => `- ${f.name}: ${f.description}`)
    .join("\n");

  const usage = [
    "Example usage:",
    "```ts",
    "export default async function main() {",
    "  // example: await codemode[\"server__tool\"]({ /* args */ });",
    "}",
    "```",
  ].join("\n");

  return [header, "\nAvailable functions:", list, "\n", usage].join("\n\n");
}

export default {
  buildPrompt,
};


