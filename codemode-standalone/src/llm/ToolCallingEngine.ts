/**
 * Tool Calling Engine - Pattern B Implementation
 * 
 * This engine uses Anthropic's native tool calling feature.
 * 
 * Architecture:
 * 1. User makes request
 * 2. Tools (including executeCode) are registered with Anthropic
 * 3. Claude uses tool_use blocks to call tools
 * 4. When executeCode is called, code is executed in isolated-vm
 * 5. Code in isolated-vm can call other registered tools
 * 6. Results flow back to Claude via tool_result blocks
 * 
 * Benefits:
 * - Uses Anthropic's tool calling properly
 * - Claude decides when to use code execution vs direct tools
 * - More flexible and explicit
 * - Follows Anthropic best practices
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages";
import { IsolatedExecutor } from "../execution/IsolatedExecutor.js";
import { ToolRegistry } from "../core/ToolRegistry.js";
import { SecurityPolicyManager } from "../execution/SecurityPolicy.js";
import type { Tool, ToolSet, SecurityPolicy } from "../types/index.js";
import { z } from "zod";

export interface ToolCallingEngineOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools: ToolSet;
  securityPolicy?: Partial<SecurityPolicy>;
  verbose?: boolean;
  
  // Advanced options
  enableCodeExecution?: boolean; // Whether to include executeCode tool
  maxTurns?: number; // Max conversation turns
}

export interface ToolCallingRequest {
  userRequest: string;
  context?: string;
  systemPrompt?: string;
}

export interface ToolCallingResponse {
  result: any;
  conversation: Anthropic.MessageParam[];
  toolCalls: Array<{
    tool: string;
    input: any;
    output: any;
  }>;
  totalTokens: number;
  cost: number;
}

/**
 * Convert our tool format to Anthropic's tool format
 */
function convertToAnthropicTool(tool: Tool): AnthropicTool {
  // Convert Zod schema to JSON schema
  const zodSchema = tool.inputSchema as z.ZodObject<any>;
  const shape = zodSchema._def.shape();
  
  const properties: Record<string, any> = {};
  const required: string[] = [];
  
  for (const [key, value] of Object.entries(shape)) {
    const zodField = value as z.ZodTypeAny;
    
    // Basic type inference
    let type = "string";
    let description = "";
    
    if (zodField instanceof z.ZodString) {
      type = "string";
      description = zodField.description || "";
    } else if (zodField instanceof z.ZodNumber) {
      type = "number";
      description = zodField.description || "";
    } else if (zodField instanceof z.ZodBoolean) {
      type = "boolean";
      description = zodField.description || "";
    } else if (zodField instanceof z.ZodArray) {
      type = "array";
      description = zodField.description || "";
    } else if (zodField instanceof z.ZodObject) {
      type = "object";
      description = zodField.description || "";
    } else if (zodField instanceof z.ZodEnum) {
      type = "string";
      description = zodField.description || "";
      properties[key] = {
        type,
        enum: zodField._def.values,
        description,
      };
      continue;
    }
    
    properties[key] = {
      type,
      description,
    };
    
    // Check if required
    if (!zodField.isOptional()) {
      required.push(key);
    }
  }
  
  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    },
  };
}

/**
 * Tool Calling Engine using Anthropic's native tool calling
 */
export class ToolCallingEngine {
  private client: Anthropic;
  private config: {
    model: string;
    temperature: number;
    maxTokens: number;
    maxTurns: number;
    enableCodeExecution: boolean;
  };
  private toolRegistry: ToolRegistry;
  private securityPolicy: SecurityPolicyManager;
  private verbose: boolean;
  
  // Cost tracking
  private static readonly COSTS = {
    "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
    "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
  } as const;

  constructor(options: ToolCallingEngineOptions) {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
    
    if (!apiKey) {
      throw new Error("Anthropic API key required");
    }

    this.client = new Anthropic({ apiKey });
    
    this.config = {
      model: options.model || "claude-3-5-sonnet-20241022",
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens || 4096,
      maxTurns: options.maxTurns || 10,
      enableCodeExecution: options.enableCodeExecution ?? true,
    };

    this.toolRegistry = new ToolRegistry(options.tools);
    this.securityPolicy = new SecurityPolicyManager(options.securityPolicy);
    this.verbose = options.verbose ?? false;
  }

  /**
   * Execute a request using tool calling
   */
  async execute(request: ToolCallingRequest): Promise<ToolCallingResponse> {
    this.log("Starting tool calling execution...");

    const conversation: Anthropic.MessageParam[] = [];
    const toolCalls: Array<{ tool: string; input: any; output: any }> = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Build system prompt
    const systemPrompt = request.systemPrompt || this.buildSystemPrompt(request.context);

    // Initial user message
    conversation.push({
      role: "user",
      content: request.userRequest,
    });

    // Get Anthropic tools
    const anthropicTools = this.getAnthropicTools();

    this.log(`Registered ${anthropicTools.length} tools with Anthropic`);

    // Conversation loop
    for (let turn = 0; turn < this.config.maxTurns; turn++) {
      this.log(`\n--- Turn ${turn + 1} ---`);

      // Call Anthropic API
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        tools: anthropicTools,
        messages: conversation,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      this.log(`API Response - Stop reason: ${response.stop_reason}`);
      this.log(`Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);

      // Add assistant response to conversation
      conversation.push({
        role: "assistant",
        content: response.content,
      });

      // Check stop reason
      if (response.stop_reason === "end_turn") {
        // Claude is done, extract final result
        const textBlock = response.content.find(block => block.type === "text");
        const result = textBlock && textBlock.type === "text" ? textBlock.text : null;

        const cost = this.calculateCost(totalInputTokens, totalOutputTokens);

        return {
          result,
          conversation,
          toolCalls,
          totalTokens: totalInputTokens + totalOutputTokens,
          cost,
        };
      }

      if (response.stop_reason === "tool_use") {
        // Execute tools
        const toolResults: Anthropic.MessageParam = {
          role: "user",
          content: [],
        };

        for (const block of response.content) {
          if (block.type === "tool_use") {
            this.log(`\nTool called: ${block.name}`);
            this.log(`Input: ${JSON.stringify(block.input, null, 2)}`);

            try {
              const result = await this.executeTool(block.name, block.input);
              
              this.log(`Output: ${JSON.stringify(result, null, 2)}`);

              toolCalls.push({
                tool: block.name,
                input: block.input,
                output: result,
              });

              (toolResults.content as any[]).push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            } catch (error) {
              this.log(`Error: ${error}`);

              (toolResults.content as any[]).push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
                is_error: true,
              });
            }
          }
        }

        // Add tool results to conversation
        conversation.push(toolResults);

        // Continue loop for next turn
        continue;
      }

      // Max tokens reached or other stop reason
      break;
    }

    // Max turns reached
    const cost = this.calculateCost(totalInputTokens, totalOutputTokens);

    return {
      result: "Max turns reached",
      conversation,
      toolCalls,
      totalTokens: totalInputTokens + totalOutputTokens,
      cost,
    };
  }

  /**
   * Execute a tool (either direct tool or executeCode)
   */
  private async executeTool(name: string, input: any): Promise<any> {
    if (name === "executeCode") {
      return await this.executeCode(input.code, input.description);
    }

    // Direct tool execution
    return await this.toolRegistry.executeTool(name, input);
  }

  /**
   * Execute JavaScript code in isolated-vm
   */
  private async executeCode(code: string, description?: string): Promise<any> {
    this.log(`\nExecuting code in isolated-vm...`);
    if (description) {
      this.log(`Description: ${description}`);
    }
    this.log(`Code:\n${code}`);

    const executor = new IsolatedExecutor(this.toolRegistry, this.securityPolicy);

    const result = await executor.execute(code);

    if (!result.success) {
      throw new Error(`Code execution failed: ${result.error?.message}`);
    }

    this.log(`Execution time: ${result.executionTime}ms`);

    return result.result;
  }

  /**
   * Get tools in Anthropic format
   * 
   * Note: We ONLY expose executeCode to Claude.
   * All other tools are available inside the isolated-vm execution environment.
   * This ensures all logic flows through code execution.
   */
  private getAnthropicTools(): AnthropicTool[] {
    const tools: AnthropicTool[] = [];

    // Build description of available tools for executeCode
    const allTools = this.toolRegistry.getAllTools();
    const toolDescriptions = Object.keys(allTools).map(toolName => {
      const tool = allTools[toolName];
      return `  - ${tool.name}: ${tool.description}`;
    }).join('\n');

    // Only add executeCode tool
    // All actual tools are accessed via the 'tools' object inside the code
    if (this.config.enableCodeExecution) {
      tools.push({
        name: "executeCode",
        description: `Execute JavaScript code in a secure isolated environment. The code has access to the following tools via the 'tools' object:\n\n${toolDescriptions}\n\nUse this to orchestrate tools with complex logic, data transformation, conditional statements, loops, or multi-step workflows. All tool access must go through this code execution.`,
        input_schema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "JavaScript code to execute. Must use 'return' to return the final result. Can use async/await. Access tools via 'tools.toolName({...})'. Example: 'const weather = await tools.getWeather({location: \"NYC\"}); return weather;'",
            },
            description: {
              type: "string",
              description: "Brief description of what this code does (optional but recommended for debugging)",
            },
          },
          required: ["code"],
        },
      });
    }

    return tools;
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(context?: string): string {
    let prompt = "You are a helpful AI assistant that writes JavaScript code to accomplish tasks.";

    if (this.config.enableCodeExecution) {
      prompt += "\n\nYou have access to the 'executeCode' tool which runs JavaScript in a secure sandbox. Inside the code, you can call various tools using the 'tools' object.";
      prompt += "\n\nWrite clear, concise JavaScript code that accomplishes the user's request. Use async/await for tool calls. Always return the final result.";
    }

    if (context) {
      prompt += `\n\nAdditional context: ${context}`;
    }

    return prompt;
  }

  /**
   * Calculate cost
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const costs = ToolCallingEngine.COSTS[
      this.config.model as keyof typeof ToolCallingEngine.COSTS
    ];

    if (!costs) return 0;

    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;

    return inputCost + outputCost;
  }

  /**
   * Log helper
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[ToolCallingEngine] ${message}`);
    }
  }
}

