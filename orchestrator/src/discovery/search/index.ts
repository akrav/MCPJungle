/**
 * Search Service Facade
 *
 * Orchestrates the full search pipeline:
 * 1. Query Expansion (HyDE) - Generate ideal tool description
 * 2. Embedding - Convert description to vector
 * 3. Vector Search - Find similar tools in Supabase
 *
 * @module discovery/search
 */

import { generateEmbedding, isEmbeddingConfigured, EmbeddingError } from './embedding.js';
import { expandQuery, isQueryExpansionConfigured, QueryExpansionError } from './queryExpansion.js';
import { findSimilarTools, VectorSearchError, VECTOR_SEARCH_DEFAULTS } from './vectorStore.js';
import { ToolWithScore } from '../supabase/types.js';

// Re-export sub-module types and functions for convenience
export {
  generateEmbedding,
  generateEmbeddings,
  isEmbeddingConfigured,
  EmbeddingError,
  EMBEDDING_DIMENSION,
  DEFAULT_MODEL,
} from './embedding.js';

export {
  expandQuery,
  isQueryExpansionConfigured,
  QueryExpansionError,
  EXPANSION_SYSTEM_PROMPT,
} from './queryExpansion.js';

export {
  findSimilarTools,
  hasEmbeddings,
  storeToolEmbedding,
  getEmbeddingCount,
  VectorSearchError,
  VECTOR_SEARCH_DEFAULTS,
} from './vectorStore.js';

/**
 * Error thrown when the search service fails
 */
export class SearchServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly step?: 'expansion' | 'embedding' | 'search'
  ) {
    super(message);
    this.name = 'SearchServiceError';
  }
}

/**
 * Options for the search service
 */
export interface SearchOptions {
  /** Skip query expansion and use raw query for embedding */
  skipExpansion?: boolean;
  /** Minimum similarity threshold (0-1) */
  matchThreshold?: number;
  /** Maximum number of results to return */
  matchCount?: number;
}

/**
 * Result of a search operation
 */
export interface SearchResult {
  /** The user's original query */
  originalQuery: string;
  /** The expanded query (if expansion was used) */
  expandedQuery?: string;
  /** Tools found, sorted by similarity */
  tools: ToolWithScore[];
  /** Time taken for each step in milliseconds */
  timing: {
    expansion?: number;
    embedding: number;
    search: number;
    total: number;
  };
}

/**
 * Searches for tools matching the user's query
 *
 * Pipeline:
 * 1. Expand the user query into an ideal tool description (optional)
 * 2. Generate embedding vector for the query/description
 * 3. Search Supabase for similar tools using vector similarity
 *
 * @param userQuery - The user's search query (e.g., "check weather")
 * @param options - Optional search configuration
 * @returns Promise<SearchResult> - Search results with tools and timing
 * @throws {SearchServiceError} If any step in the pipeline fails
 */
export async function searchTools(
  userQuery: string,
  options?: SearchOptions
): Promise<SearchResult> {
  const startTime = Date.now();
  const timing: SearchResult['timing'] = {
    embedding: 0,
    search: 0,
    total: 0,
  };

  if (!userQuery || userQuery.trim().length === 0) {
    throw new SearchServiceError('Search query cannot be empty');
  }

  const query = userQuery.trim();
  let textToEmbed = query;
  let expandedQuery: string | undefined;

  // Step 1: Query Expansion (optional)
  if (!options?.skipExpansion && isQueryExpansionConfigured()) {
    try {
      const expansionStart = Date.now();
      expandedQuery = await expandQuery(query);
      textToEmbed = expandedQuery;
      timing.expansion = Date.now() - expansionStart;
    } catch (err) {
      if (err instanceof QueryExpansionError) {
        throw new SearchServiceError(
          `Query expansion failed: ${err.message}`,
          err,
          'expansion'
        );
      }
      throw new SearchServiceError('Query expansion failed', err, 'expansion');
    }
  }

  // Step 2: Generate Embedding
  let embedding: number[];
  try {
    const embeddingStart = Date.now();
    embedding = await generateEmbedding(textToEmbed);
    timing.embedding = Date.now() - embeddingStart;
  } catch (err) {
    if (err instanceof EmbeddingError) {
      throw new SearchServiceError(
        `Embedding generation failed: ${err.message}`,
        err,
        'embedding'
      );
    }
    throw new SearchServiceError('Embedding generation failed', err, 'embedding');
  }

  // Step 3: Vector Search
  let tools: ToolWithScore[];
  try {
    const searchStart = Date.now();
    tools = await findSimilarTools(embedding, {
      matchThreshold: options?.matchThreshold ?? VECTOR_SEARCH_DEFAULTS.matchThreshold,
      matchCount: options?.matchCount ?? VECTOR_SEARCH_DEFAULTS.matchCount,
    });
    timing.search = Date.now() - searchStart;
  } catch (err) {
    if (err instanceof VectorSearchError) {
      throw new SearchServiceError(
        `Vector search failed: ${err.message}`,
        err,
        'search'
      );
    }
    throw new SearchServiceError('Vector search failed', err, 'search');
  }

  timing.total = Date.now() - startTime;

  return {
    originalQuery: query,
    expandedQuery,
    tools,
    timing,
  };
}

/**
 * Searches for tools using a raw embedding vector (skips expansion and embedding)
 *
 * @param embedding - Pre-computed embedding vector
 * @param options - Optional search configuration
 * @returns Promise<ToolWithScore[]> - Tools sorted by similarity
 */
export async function searchToolsByEmbedding(
  embedding: number[],
  options?: Pick<SearchOptions, 'matchThreshold' | 'matchCount'>
): Promise<ToolWithScore[]> {
  return findSimilarTools(embedding, options);
}

/**
 * Checks if the search service is fully configured
 *
 * @returns Object with status of each component
 */
export function getSearchServiceStatus(): {
  embedding: boolean;
  queryExpansion: boolean;
  ready: boolean;
} {
  const embedding = isEmbeddingConfigured();
  const queryExpansion = isQueryExpansionConfigured();

  return {
    embedding,
    queryExpansion,
    // Ready if at least embedding is configured (expansion is optional)
    ready: embedding,
  };
}

