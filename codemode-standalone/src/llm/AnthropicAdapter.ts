import Anthropic from "@anthropic-ai/sdk";
import type {
  CodeGenerator,
  CodeGenerationResult,
  AnthropicConfig,
} from "./types.js";

/**
 * Internal configuration with all required fields
 */
interface InternalConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Adapter for Anthropic Claude API
 * Generates JavaScript code using Claude models
 */
export class AnthropicCodeGenerator implements CodeGenerator {
  private client: Anthropic;
  private config: InternalConfig;

  // Cost per 1M tokens (as of Oct 2024)
  private static readonly COSTS = {
    "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
    "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
    "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
  } as const;

  constructor(config: AnthropicConfig) {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        "Anthropic API key is required. Provide it in config.apiKey or ANTHROPIC_API_KEY environment variable."
      );
    }

    this.client = new Anthropic({ apiKey });
    
    this.config = {
      apiKey,
      model: config.model || "claude-3-5-sonnet-20241022",
      maxTokens: config.maxTokens || 2048,
      temperature: config.temperature ?? 0.3,
      topP: config.topP,
      stopSequences: config.stopSequences,
    };
  }

  /**
   * Generate code from a prompt (simple interface)
   */
  async generateCode(prompt: string): Promise<string> {
    const result = await this.generateCodeWithMetadata(prompt);
    return result.code;
  }

  /**
   * Generate code with full metadata
   */
  async generateCodeWithMetadata(prompt: string): Promise<CodeGenerationResult> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        stop_sequences: this.config.stopSequences,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // Extract text from response
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Claude response");
      }

      const rawCode = textBlock.text;
      const cleanedCode = this.cleanCodeResponse(rawCode);

      return {
        code: cleanedCode,
        model: response.model,
        tokensUsed: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        stopReason: response.stop_reason ?? undefined,
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Clean up code response from Claude
   * Removes markdown code blocks, extra whitespace, etc.
   */
  private cleanCodeResponse(code: string): string {
    let cleaned = code.trim();

    // Remove markdown code blocks
    const codeBlockRegex = /```(?:javascript|js)?\n?([\s\S]*?)\n?```/g;
    const match = codeBlockRegex.exec(cleaned);
    if (match) {
      cleaned = match[1].trim();
    }

    // Remove any remaining leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Calculate cost for a request
   */
  calculateCost(tokensUsed: { prompt: number; completion: number }): number {
    const modelCosts =
      AnthropicCodeGenerator.COSTS[
        this.config.model as keyof typeof AnthropicCodeGenerator.COSTS
      ];
    
    if (!modelCosts) {
      return 0;
    }

    const inputCost = (tokensUsed.prompt / 1_000_000) * modelCosts.input;
    const outputCost = (tokensUsed.completion / 1_000_000) * modelCosts.output;

    return inputCost + outputCost;
  }

  /**
   * Get current configuration
   */
  getConfig(): Omit<InternalConfig, "apiKey"> {
    const { apiKey, ...config } = this.config;
    return config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AnthropicConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
  }

  /**
   * Test the connection to Anthropic API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Simple cost tracker for monitoring API usage
 */
export class SimpleCostTracker {
  private totalTokens = 0;
  private totalCost = 0;
  private requestCount = 0;

  addRequest(tokensUsed: number, cost: number): void {
    this.totalTokens += tokensUsed;
    this.totalCost += cost;
    this.requestCount += 1;
  }

  getStats(): { totalTokens: number; totalCost: number; requestCount: number; avgTokensPerRequest: number; avgCostPerRequest: number } {
    return {
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      requestCount: this.requestCount,
      avgTokensPerRequest: this.requestCount > 0 ? this.totalTokens / this.requestCount : 0,
      avgCostPerRequest: this.requestCount > 0 ? this.totalCost / this.requestCount : 0,
    };
  }

  reset(): void {
    this.totalTokens = 0;
    this.totalCost = 0;
    this.requestCount = 0;
  }

  formatCost(): string {
    const stats = this.getStats();
    return `$${stats.totalCost.toFixed(4)} (${stats.totalTokens.toLocaleString()} tokens, ${stats.requestCount} requests)`;
  }
}

