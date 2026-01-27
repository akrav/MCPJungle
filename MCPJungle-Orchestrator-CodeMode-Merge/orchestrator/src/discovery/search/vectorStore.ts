/**
 * Vector Store - Supabase Vector Search
 *
 * Executes similarity search on Supabase using the match_tools_orchestrator RPC function.
 * This module handles the vector search query and result mapping.
 *
 * @module discovery/search/vectorStore
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client.js';
import { ToolWithScore, ListingStatus } from '../supabase/types.js';

/**
 * Error thrown when vector search fails
 */
export class VectorSearchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'VectorSearchError';
  }
}

/**
 * Parameters for the match_tools_orchestrator RPC function
 */
export interface MatchToolsParams {
  query_embedding: number[];
  match_threshold?: number;
  match_count?: number;
}

/**
 * Default configuration for vector search
 */
export const VECTOR_SEARCH_DEFAULTS = {
  matchThreshold: 0.5,
  matchCount: 10,
};

/**
 * Raw result from the Supabase RPC function
 */
interface RpcToolResult {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  price_per_call: number;
  average_rating: number;
  listing_status: string;
  similarity: number;
}

/**
 * Maps an RPC result to a ToolWithScore object
 */
function mapToToolWithScore(row: RpcToolResult): ToolWithScore {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    endpoint_url: row.endpoint_url,
    price_per_call: row.price_per_call,
    average_rating: row.average_rating,
    listing_status: row.listing_status as ListingStatus,
    similarity: row.similarity,
  };
}

/**
 * Finds tools similar to the given embedding vector
 *
 * @param embedding - The query embedding vector (1536 dimensions)
 * @param options - Optional search parameters
 * @returns Promise<ToolWithScore[]> - Tools sorted by similarity (highest first)
 * @throws {VectorSearchError} If the search fails
 */
export async function findSimilarTools(
  embedding: number[],
  options?: {
    matchThreshold?: number;
    matchCount?: number;
  }
): Promise<ToolWithScore[]> {
  if (!isSupabaseConfigured()) {
    throw new VectorSearchError('Supabase client not configured');
  }

  if (!embedding || embedding.length === 0) {
    throw new VectorSearchError('Embedding vector cannot be empty');
  }

  const threshold = options?.matchThreshold ?? VECTOR_SEARCH_DEFAULTS.matchThreshold;
  const count = options?.matchCount ?? VECTOR_SEARCH_DEFAULTS.matchCount;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('match_tools_orchestrator', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: count,
    });

    if (error) {
      throw new VectorSearchError(
        `Supabase RPC error: ${error.message}`,
        error
      );
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map(mapToToolWithScore);
  } catch (err) {
    if (err instanceof VectorSearchError) {
      throw err;
    }
    throw new VectorSearchError('Failed to search for similar tools', err);
  }
}

/**
 * Checks if any tools have embeddings stored
 *
 * @returns Promise<boolean> - True if embeddings exist
 */
export async function hasEmbeddings(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('tool_embeddings_orchestrator')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new VectorSearchError(
        `Failed to check embeddings: ${error.message}`,
        error
      );
    }

    return (count ?? 0) > 0;
  } catch (err) {
    if (err instanceof VectorSearchError) {
      throw err;
    }
    throw new VectorSearchError('Failed to check for embeddings', err);
  }
}

/**
 * Stores an embedding for a tool
 *
 * @param toolId - The tool UUID
 * @param embedding - The embedding vector
 * @throws {VectorSearchError} If the operation fails
 */
export async function storeToolEmbedding(
  toolId: string,
  embedding: number[]
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new VectorSearchError('Supabase client not configured');
  }

  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('tool_embeddings_orchestrator')
      .upsert(
        {
          tool_id: toolId,
          description_embedding: embedding,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tool_id' }
      );

    if (error) {
      throw new VectorSearchError(
        `Failed to store embedding: ${error.message}`,
        error
      );
    }
  } catch (err) {
    if (err instanceof VectorSearchError) {
      throw err;
    }
    throw new VectorSearchError('Failed to store tool embedding', err);
  }
}

/**
 * Gets the count of tools with embeddings
 *
 * @returns Promise<number> - Count of embedded tools
 */
export async function getEmbeddingCount(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('tool_embeddings_orchestrator')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new VectorSearchError(
        `Failed to count embeddings: ${error.message}`,
        error
      );
    }

    return count ?? 0;
  } catch (err) {
    if (err instanceof VectorSearchError) {
      throw err;
    }
    throw new VectorSearchError('Failed to count embeddings', err);
  }
}

