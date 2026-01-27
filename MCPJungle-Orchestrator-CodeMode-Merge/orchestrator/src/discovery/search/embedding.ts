/**
 * Embedding Provider
 *
 * Converts text into vector embeddings using OpenAI's embedding API.
 * These vectors are used for semantic similarity search against tool descriptions.
 *
 * @module discovery/search/embedding
 */

import { loadConfig } from '../../config/load.js';

/** Dimension of the embedding vectors (text-embedding-3-small) */
export const EMBEDDING_DIMENSION = 1536;

/** Default embedding model */
export const DEFAULT_MODEL = 'text-embedding-3-small';

/**
 * Error thrown when embedding generation fails
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/**
 * OpenAI embedding API response structure
 */
interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Gets the embedding configuration from environment
 *
 * @throws {EmbeddingError} If OPENAI_API_KEY is not configured
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  const cfg = loadConfig(process.env);

  if (!cfg.openaiApiKey) {
    throw new EmbeddingError(
      'OPENAI_API_KEY is required for embedding generation'
    );
  }

  return {
    apiKey: cfg.openaiApiKey,
    model: DEFAULT_MODEL,
    baseUrl: 'https://api.openai.com/v1',
  };
}

/**
 * Generates an embedding vector for the given text
 *
 * @param text - The text to embed
 * @param config - Optional configuration (uses env vars if not provided)
 * @returns Promise<number[]> - The embedding vector
 * @throws {EmbeddingError} If the API call fails
 */
export async function generateEmbedding(
  text: string,
  config?: Partial<EmbeddingConfig>
): Promise<number[]> {
  const cfg = config?.apiKey ? { ...getEmbeddingConfig(), ...config } : getEmbeddingConfig();

  if (!text || text.trim().length === 0) {
    throw new EmbeddingError('Text cannot be empty');
  }

  const url = `${cfg.baseUrl}/embeddings`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODEL,
        input: text.trim(),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new EmbeddingError(
        `OpenAI API error: ${response.status} ${response.statusText}`,
        errorBody,
        response.status
      );
    }

    const data: EmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0 || !data.data[0].embedding) {
      throw new EmbeddingError('Invalid response from OpenAI API: no embedding data');
    }

    const embedding = data.data[0].embedding;

    // Validate embedding dimension
    if (embedding.length !== EMBEDDING_DIMENSION) {
      console.warn(
        `Unexpected embedding dimension: ${embedding.length} (expected ${EMBEDDING_DIMENSION})`
      );
    }

    return embedding;
  } catch (err) {
    if (err instanceof EmbeddingError) {
      throw err;
    }
    throw new EmbeddingError('Failed to generate embedding', err);
  }
}

/**
 * Generates embeddings for multiple texts in a batch
 *
 * @param texts - Array of texts to embed
 * @param config - Optional configuration
 * @returns Promise<number[][]> - Array of embedding vectors
 * @throws {EmbeddingError} If the API call fails
 */
export async function generateEmbeddings(
  texts: string[],
  config?: Partial<EmbeddingConfig>
): Promise<number[][]> {
  const cfg = config?.apiKey ? { ...getEmbeddingConfig(), ...config } : getEmbeddingConfig();

  if (!texts || texts.length === 0) {
    return [];
  }

  const cleanTexts = texts.map((t) => t.trim()).filter((t) => t.length > 0);
  if (cleanTexts.length === 0) {
    throw new EmbeddingError('All texts are empty');
  }

  const url = `${cfg.baseUrl}/embeddings`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODEL,
        input: cleanTexts,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new EmbeddingError(
        `OpenAI API error: ${response.status} ${response.statusText}`,
        errorBody,
        response.status
      );
    }

    const data: EmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new EmbeddingError('Invalid response from OpenAI API: no embedding data');
    }

    // Sort by index to maintain order
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  } catch (err) {
    if (err instanceof EmbeddingError) {
      throw err;
    }
    throw new EmbeddingError('Failed to generate embeddings', err);
  }
}

/**
 * Checks if the embedding provider is configured
 */
export function isEmbeddingConfigured(): boolean {
  try {
    const cfg = loadConfig(process.env);
    return Boolean(cfg.openaiApiKey);
  } catch {
    return false;
  }
}

