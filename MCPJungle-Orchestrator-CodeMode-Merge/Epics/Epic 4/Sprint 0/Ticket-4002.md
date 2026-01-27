# Ticket-4002 — Data Modeling (Types)

**What / Why**
Define TypeScript interfaces that mirror the existing Supabase `tools` table and the new `UserPreferences` structure. This ensures type safety throughout the discovery module.

**Where**
`/src/discovery/supabase/types.ts`, `/src/discovery/preferences/types.ts`

**Implementation Sketch**
*   Create `/src/discovery/supabase/types.ts`:
    ```typescript
    export interface Tool {
      id: string; // uuid
      created_at: string;
      merchant_id: string;
      name: string;
      description: string;
      endpoint_url: string;
      price_per_call: number;
      rating: number; // float
    }
    ```
*   Create `/src/discovery/preferences/types.ts`:
    ```typescript
    export type DiscoveryMode = 'auto' | 'manual';
    export type SortStrategy = 'cheapest' | 'rating' | 'balanced';

    export interface UserPreferences {
      userId: string;
      discoveryMode: DiscoveryMode;
      autoInstallStrategy: SortStrategy;
      maxPriceCap: number;
      minRatingThreshold: number;
    }
    ```

**Tests**
No runtime logic. Verify compilation.

**Accept When**
Types are exported and match the Epic 4 Overview spec.

**LLM Priming (keywords/APIs)**
`TypeScript interfaces`, `Supabase Database Definitions`, `Type safety`

