/**
 * Query Expansion (HyDE - Hypothetical Document Embeddings)
 *
 * Converts vague user queries into rich tool descriptions using an LLM.
 * This technique improves semantic search by matching against capabilities
 * rather than just keywords.
 *
 * @module discovery/search/queryExpansion
 */

import { loadConfig } from '../../config/load.js';

/**
 * Error thrown when query expansion fails
 */
export class QueryExpansionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'QueryExpansionError';
  }
}

/**
 * The system prompt for query expansion
 */
export const EXPANSION_SYSTEM_PROMPT = `You are an expert at finding APIs and MCP (Model Context Protocol) tools. Given a user's request, describe the ideal tool that would solve their problem.

Be precise and use technical keywords. Include:
- What the tool does
- What inputs it accepts
- What outputs it returns
- Key capabilities and features

Output ONLY the tool description, nothing else.`;

/**
 * OpenAI Chat Completion response structure
 */
interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Configuration for query expansion
 */
export interface QueryExpansionConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
}

/**
 * Gets the query expansion configuration from environment
 *
 * @throws {QueryExpansionError} If OPENAI_API_KEY is not configured
 */
export function getQueryExpansionConfig(): QueryExpansionConfig {
  const cfg = loadConfig(process.env);

  if (!cfg.openaiApiKey) {
    throw new QueryExpansionError(
      'OPENAI_API_KEY is required for query expansion'
    );
  }

  return {
    apiKey: cfg.openaiApiKey,
    model: 'gpt-4o-mini', // Fast and cheap for query expansion
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 300,
  };
}

/**
 * Expands a user query into a rich tool description using an LLM
 *
 * @param userQuery - The user's original query (e.g., "check weather")
 * @param config - Optional configuration
 * @returns Promise<string> - The expanded description
 * @throws {QueryExpansionError} If the API call fails
 */
export async function expandQuery(
  userQuery: string,
  config?: Partial<QueryExpansionConfig>
): Promise<string> {
  const cfg = config?.apiKey
    ? { ...getQueryExpansionConfig(), ...config }
    : getQueryExpansionConfig();

  if (!userQuery || userQuery.trim().length === 0) {
    throw new QueryExpansionError('User query cannot be empty');
  }

  const userPrompt = `The user wants: "${userQuery.trim()}"

Describe the ideal MCP tool that would solve this.`;

  const url = `${cfg.baseUrl}/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EXPANSION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: cfg.maxTokens || 300,
        temperature: 0.3, // Lower temperature for more focused output
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new QueryExpansionError(
        `OpenAI API error: ${response.status} ${response.statusText}`,
        errorBody,
        response.status
      );
    }

    const data: ChatCompletionResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new QueryExpansionError('No response from OpenAI API');
    }

    const content = data.choices[0].message?.content;
    if (!content || content.trim().length === 0) {
      throw new QueryExpansionError('Empty response from OpenAI API');
    }

    return content.trim();
  } catch (err) {
    if (err instanceof QueryExpansionError) {
      throw err;
    }
    throw new QueryExpansionError('Failed to expand query', err);
  }
}

/**
 * Checks if query expansion is configured
 */
export function isQueryExpansionConfigured(): boolean {
  try {
    const cfg = loadConfig(process.env);
    return Boolean(cfg.openaiApiKey);
  } catch {
    return false;
  }
}

