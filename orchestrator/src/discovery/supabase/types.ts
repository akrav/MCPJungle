/**
 * Type definitions for Supabase database entities
 *
 * These interfaces mirror the existing Supabase `tools` table schema.
 * Note: We have read-only access to existing tables - we can SELECT but not INSERT/UPDATE/DELETE.
 *
 * @module discovery/supabase/types
 */

/**
 * Listing status enum for tools
 */
export type ListingStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Tool entity representing an MCP tool in the Supabase registry
 *
 * This interface mirrors the `public.tools` table in Supabase.
 */
export interface Tool {
  /** Unique identifier (UUID) */
  id: string;
  /** Timestamp when the tool was created */
  created_at: string;
  /** Reference to the merchant who provides this tool */
  merchant_id: string;
  /** Human-readable name of the tool */
  name: string;
  /** Description of what the tool does - used for vector search */
  description: string;
  /** URL endpoint to access/download this MCP tool */
  endpoint_url: string;
  /** Cost per API call in the platform's currency unit */
  price_per_call: number;
  /** Average user rating (0-5 scale) */
  average_rating: number;
  /** Timestamp when the tool was last updated */
  updated_at: string;
  /** Whether the tool is currently available for use */
  listing_status: ListingStatus;
}

/**
 * Minimal tool representation for search results and selection
 * Contains only the fields needed for discovery and filtering
 */
export interface ToolSummary {
  id: string;
  name: string;
  description: string;
  endpoint_url: string;
  price_per_call: number;
  average_rating: number;
  listing_status: ListingStatus;
}

/**
 * Tool with similarity score from vector search
 */
export interface ToolWithScore extends ToolSummary {
  /** Cosine similarity score from vector search (0-1) */
  similarity: number;
}

