interface Sample_CalculateInput {
/**
 * Math expression, e.g., 2 + 2
 */
expression: string
[k: string]: unknown
}
interface Sample_CalculateOutput { [key: string]: any }
interface Sample_GetDateTimeInput {
[k: string]: unknown
}
interface Sample_GetDateTimeOutput { [key: string]: any }
interface Codemode_ExecuteCodeWithToolsInput {
/**
 * JavaScript to execute. Use tools[...] to call MCP tools.
 */
code: string
[k: string]: unknown
}
interface Codemode_ExecuteCodeWithToolsOutput { [key: string]: any }
interface Codemode_ListAvailableToolsInput {
[k: string]: unknown
}
interface Codemode_ListAvailableToolsOutput { [key: string]: any }

declare const tools: {
	/**
	 * Evaluate a simple JS expression securely
	 */
	sample__calculate: (input: Sample_CalculateInput) => Promise<Sample_CalculateOutput>;

	/**
	 * Get current timestamp
	 */
	sample__getDateTime: (input: Sample_GetDateTimeInput) => Promise<Sample_GetDateTimeOutput>;

	/**
	 * Execute provided JavaScript with access to all upstream MCP tools via the tools object. No LLM required.
	 */
	codemode__executeCodeWithTools: (input: Codemode_ExecuteCodeWithToolsInput) => Promise<Codemode_ExecuteCodeWithToolsOutput>;

	/**
	 * List all available upstream MCP tools with inputs and usage examples.
	 */
	codemode__listAvailableTools: (input: Codemode_ListAvailableToolsInput) => Promise<Codemode_ListAvailableToolsOutput>;
};