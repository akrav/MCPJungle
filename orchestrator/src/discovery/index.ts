/**
 * Discovery Module
 *
 * Exports for the tool discovery system that integrates with Supabase
 * for finding and managing MCP tools.
 *
 * @module discovery
 */

// Supabase client
export {
  initializeSupabaseClient,
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClient,
  SupabaseConfig,
  SupabaseConfigError,
} from './supabase/client.js';

// Supabase types
export {
  Tool,
  ToolSummary,
  ToolWithScore,
  ListingStatus,
} from './supabase/types.js';

// Supabase service
export {
  getAllTools,
  getActiveTools,
  getToolById,
  getToolsByName,
  SupabaseServiceError,
} from './supabase/service.js';

// User preferences types
export {
  UserPreferences,
  UserPreferencesUpdate,
  DiscoveryMode,
  SortStrategy,
  DEFAULT_USER_PREFERENCES,
} from './preferences/types.js';

// User preferences store
export {
  getUserPreferences,
  setUserPreferences,
  updateUserPreferences,
  deleteUserPreferences,
  hasCustomPreferences,
  PreferencesStoreError,
} from './preferences/store.js';

// Search service (vector search, query expansion, embeddings)
export {
  // Main search functions
  searchTools,
  searchToolsByEmbedding,
  getSearchServiceStatus,
  SearchServiceError,
  // Embedding functions
  generateEmbedding,
  generateEmbeddings,
  isEmbeddingConfigured,
  EmbeddingError,
  EMBEDDING_DIMENSION,
  DEFAULT_MODEL,
  // Query expansion functions
  expandQuery,
  isQueryExpansionConfigured,
  QueryExpansionError,
  EXPANSION_SYSTEM_PROMPT,
  // Vector store functions
  findSimilarTools,
  hasEmbeddings,
  storeToolEmbedding,
  getEmbeddingCount,
  VectorSearchError,
  VECTOR_SEARCH_DEFAULTS,
} from './search/index.js';

// Selection service (filtering and ranking)
export {
  // Main selection functions
  selectBestTool,
  getAutoSelectedTool,
  getManualCandidates,
  hasViableCandidates,
  describeFiltering,
  SelectionResult,
  SelectionOptions,
  SelectableTool,
  // Filter functions
  filterTools,
  passesPriceFilter,
  passesRatingFilter,
  getFilterStats,
  FilterOptions,
  FilterableTool,
  DEFAULT_FILTER_OPTIONS,
  // Ranking functions
  rankTools,
  getBestTool,
  getTopRanked,
  getComparator,
  compareByPriceAsc,
  compareByRatingDesc,
  compareByBalancedScore,
  calculateBalancedScore,
  RankableTool,
} from './selection/index.js';
