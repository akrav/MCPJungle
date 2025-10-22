import type { z } from "zod";

/**
 * Represents a tool that can be called by generated code
 */
export interface Tool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput> | JSONSchema;
  outputSchema?: z.ZodType<TOutput> | JSONSchema;
  execute: (args: TInput) => Promise<TOutput>;
}

/**
 * JSON Schema definition
 */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  additionalProperties?: any;
  description?: string;
  [key: string]: any;
}

/**
 * A collection of tools indexed by name
 */
export type ToolSet = Record<string, Tool>;

/**
 * Configuration for code execution security
 */
export interface SecurityPolicy {
  /** Maximum execution time in milliseconds */
  maxExecutionTime: number;
  /** Maximum memory in MB */
  maxMemoryMB: number;
  /** Allow network access */
  allowNetworkAccess: boolean;
  /** Allowed domains for network access (if enabled) */
  allowedDomains?: string[];
}

/**
 * Result of code execution
 */
export interface ExecutionResult<T = any> {
  success: boolean;
  result?: T;
  error?: {
    message: string;
    stack?: string;
  };
  executionTime: number;
}

/**
 * Options for the codemode engine
 */
export interface CodemodeOptions {
  /** LLM function to generate code */
  generateCode: (prompt: string) => Promise<string>;
  /** Tools available to generated code */
  tools: ToolSet;
  /** Security policy for execution */
  securityPolicy?: Partial<SecurityPolicy>;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Request to execute generated code
 */
export interface CodemodeRequest {
  /** User's natural language request */
  userRequest: string;
  /** Additional context for the LLM */
  context?: string;
}

/**
 * Response from codemode execution
 */
export interface CodemodeResponse<T = any> {
  /** Generated code */
  code: string;
  /** Execution result */
  result: ExecutionResult<T>;
  /** TypeScript type definitions provided to LLM */
  typeDefinitions: string;
}






