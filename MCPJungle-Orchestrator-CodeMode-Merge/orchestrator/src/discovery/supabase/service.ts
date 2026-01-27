/**
 * Supabase Tools Service
 *
 * Provides read-only access to the tools table in Supabase.
 * Note: We can only SELECT from existing tables - INSERT/UPDATE/DELETE are not allowed.
 *
 * @module discovery/supabase/service
 */

import { getSupabaseClient, isSupabaseConfigured } from './client.js';
import { Tool, ToolSummary, ListingStatus } from './types.js';

/**
 * Error thrown when a Supabase operation fails
 */
export class SupabaseServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SupabaseServiceError';
  }
}

/**
 * Maps raw Supabase row data to a Tool object
 */
function mapToTool(row: Record<string, unknown>): Tool {
  return {
    id: row.id as string,
    created_at: row.created_at as string,
    merchant_id: row.merchant_id as string,
    name: row.name as string,
    description: row.description as string,
    endpoint_url: row.endpoint_url as string,
    price_per_call: row.price_per_call as number,
    average_rating: row.average_rating as number,
    updated_at: row.updated_at as string,
    listing_status: row.listing_status as ListingStatus,
  };
}

/**
 * Maps raw Supabase row data to a ToolSummary object
 */
function mapToToolSummary(row: Record<string, unknown>): ToolSummary {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    endpoint_url: row.endpoint_url as string,
    price_per_call: row.price_per_call as number,
    average_rating: row.average_rating as number,
    listing_status: row.listing_status as ListingStatus,
  };
}

/**
 * Fetches all tools from the Supabase tools table
 *
 * @returns Promise<Tool[]> Array of all tools
 * @throws {SupabaseServiceError} If the query fails or client is not configured
 */
export async function getAllTools(): Promise<Tool[]> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseServiceError('Supabase client not configured');
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('tools').select('*');

    if (error) {
      throw new SupabaseServiceError(`Failed to fetch tools: ${error.message}`, error);
    }

    if (!data) {
      return [];
    }

    return data.map(mapToTool);
  } catch (err) {
    if (err instanceof SupabaseServiceError) {
      throw err;
    }
    throw new SupabaseServiceError('Failed to fetch tools from Supabase', err);
  }
}

/**
 * Fetches all active tools (listing_status = 'ACTIVE')
 *
 * @returns Promise<ToolSummary[]> Array of active tool summaries
 * @throws {SupabaseServiceError} If the query fails or client is not configured
 */
export async function getActiveTools(): Promise<ToolSummary[]> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseServiceError('Supabase client not configured');
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tools')
      .select('id, name, description, endpoint_url, price_per_call, average_rating, listing_status')
      .eq('listing_status', 'ACTIVE');

    if (error) {
      throw new SupabaseServiceError(`Failed to fetch active tools: ${error.message}`, error);
    }

    if (!data) {
      return [];
    }

    return data.map(mapToToolSummary);
  } catch (err) {
    if (err instanceof SupabaseServiceError) {
      throw err;
    }
    throw new SupabaseServiceError('Failed to fetch active tools from Supabase', err);
  }
}

/**
 * Fetches a single tool by its ID
 *
 * @param id - The UUID of the tool to fetch
 * @returns Promise<Tool | null> The tool if found, null otherwise
 * @throws {SupabaseServiceError} If the query fails or client is not configured
 */
export async function getToolById(id: string): Promise<Tool | null> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseServiceError('Supabase client not configured');
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new SupabaseServiceError(`Failed to fetch tool by ID: ${error.message}`, error);
    }

    if (!data) {
      return null;
    }

    return mapToTool(data);
  } catch (err) {
    if (err instanceof SupabaseServiceError) {
      throw err;
    }
    throw new SupabaseServiceError(`Failed to fetch tool ${id} from Supabase`, err);
  }
}

/**
 * Fetches tools by name (partial match, case-insensitive)
 *
 * @param name - The name pattern to search for
 * @returns Promise<ToolSummary[]> Array of matching tools
 * @throws {SupabaseServiceError} If the query fails or client is not configured
 */
export async function getToolsByName(name: string): Promise<ToolSummary[]> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseServiceError('Supabase client not configured');
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tools')
      .select('id, name, description, endpoint_url, price_per_call, average_rating, listing_status')
      .ilike('name', `%${name}%`)
      .eq('listing_status', 'ACTIVE');

    if (error) {
      throw new SupabaseServiceError(`Failed to search tools by name: ${error.message}`, error);
    }

    if (!data) {
      return [];
    }

    return data.map(mapToToolSummary);
  } catch (err) {
    if (err instanceof SupabaseServiceError) {
      throw err;
    }
    throw new SupabaseServiceError('Failed to search tools by name from Supabase', err);
  }
}

