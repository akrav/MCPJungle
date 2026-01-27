/**
 * Types for LLM integrations
 */

/**
 * Configuration options for code generation
 */
export interface CodeGeneratorOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Result from code generation
 */
export interface CodeGenerationResult {
  code: string;
  model: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  stopReason?: string;
  finishReason?: string;
}

/**
 * Interface for code generators
 */
export interface CodeGenerator {
  generateCode(prompt: string): Promise<string>;
  generateCodeWithMetadata(prompt: string): Promise<CodeGenerationResult>;
}

/**
 * Anthropic-specific configuration
 */
export interface AnthropicConfig extends CodeGeneratorOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Cost tracking for API calls
 */
export interface CostTracker {
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  addRequest(tokensUsed: number, cost: number): void;
  getStats(): { totalTokens: number; totalCost: number; requestCount: number };
}

