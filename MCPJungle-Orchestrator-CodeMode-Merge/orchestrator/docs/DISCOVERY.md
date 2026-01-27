# Tool Discovery System

The MCP Orchestrator includes a powerful **Tool Discovery** system that can automatically find, select, and install MCP tools from a central registry when a requested tool is not available locally.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Auto Mode](#auto-mode)
- [Manual Mode](#manual-mode)
- [Admin API](#admin-api)
- [Troubleshooting](#troubleshooting)

---

## Overview

When an AI agent requests a tool that isn't installed, the Orchestrator can:

1. **Search** the Supabase registry using semantic vector search
2. **Filter** results based on your safety constraints (price, rating)
3. **Select** the best matching tool using your preferred strategy
4. **Install** the tool automatically (Auto Mode) or wait for approval (Manual Mode)

### Key Features

- 🔍 **Semantic Search**: Uses vector embeddings to find relevant tools by meaning
- 💰 **Cost Control**: Set maximum price caps to prevent expensive tools
- ⭐ **Quality Filters**: Enforce minimum rating thresholds
- 🤖 **Auto Mode**: Fully automated discovery and installation
- 👤 **Manual Mode**: Human-in-the-loop approval process

---

## Quick Start

### 1. Set Environment Variables

Create a `.env` file with your credentials:

```bash
# Core Configuration
JUNGLE_URL=http://localhost:9000

# Supabase (Required for Discovery)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# OpenAI (Required for Embeddings)
OPENAI_API_KEY=sk-your-api-key
```

### 2. Configure User Preferences

User preferences are stored in the `user_preferences_orchestrator` Supabase table. Default values are:

| Setting | Default | Description |
|---------|---------|-------------|
| `discovery_mode` | `manual` | `auto` or `manual` |
| `auto_install_strategy` | `balanced` | `cheapest`, `rating`, or `balanced` |
| `max_price_cap` | `1.0` | Maximum $/call allowed |
| `min_rating_threshold` | `3.0` | Minimum stars required (0-5) |

### 3. Start the Orchestrator

```bash
cd orchestrator
npm run build
npm start
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase service role key (not anon) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for embeddings |
| `JUNGLE_URL` | No | MCPJungle server URL (default: `http://localhost:9000`) |

### User Preferences

Preferences are per-user and stored in Supabase. You can set them via:

**Option 1: Direct Database Insert**
```sql
INSERT INTO user_preferences_orchestrator 
  (user_id, discovery_mode, auto_install_strategy, max_price_cap, min_rating_threshold)
VALUES 
  ('user-123', 'auto', 'balanced', 0.50, 3.5);
```

**Option 2: Programmatically**
```typescript
import { setUserPreferences } from './discovery';

await setUserPreferences({
  userId: 'user-123',
  discoveryMode: 'auto',
  autoInstallStrategy: 'cheapest',
  maxPriceCap: 0.25,
  minRatingThreshold: 4.0,
});
```

---

## Auto Mode

In **Auto Mode**, the system handles everything automatically:

```
User Request → Tool Not Found → Search → Filter → Select → Install → Retry Request
```

### How It Works

1. **Intercept**: When a tool request fails with "Method Not Found", the interceptor catches it
2. **Search**: The query is expanded using an LLM, embedded, and searched in the vector database
3. **Filter**: Results are filtered by your `max_price_cap` and `min_rating_threshold`
4. **Rank**: Remaining tools are sorted by your `auto_install_strategy`:
   - `cheapest`: Lowest price first
   - `rating`: Highest rating first
   - `balanced`: Weighted score of both factors
5. **Install**: The top-ranked tool is automatically installed
6. **Retry**: The original request is re-dispatched

### Example Flow

```
AI Agent: "Get weather for London"
         ↓
Orchestrator: Tool 'weather_api' not found
         ↓
Discovery: Searching registry...
         ↓
Search Results: [Weather API ($0.005), Climate Service ($0.01)]
         ↓
Filter: Both pass ($0.50 cap, 3.0★ min)
         ↓
Rank (cheapest): Weather API selected
         ↓
Install: Weather API installed for user-123
         ↓
Retry: Original request succeeds!
```

### Enabling Auto Mode

```sql
UPDATE user_preferences_orchestrator 
SET discovery_mode = 'auto'
WHERE user_id = 'user-123';
```

---

## Manual Mode

In **Manual Mode**, the system pauses and waits for human approval:

```
User Request → Tool Not Found → Search → Filter → PAUSE → Admin Selects → Install
```

### How It Works

1. Steps 1-4 are the same as Auto Mode
2. **Pause**: Instead of auto-installing, the system:
   - Stores candidates in a pending state
   - Outputs a prompt to the console/logs
   - Returns a "Manual Selection Required" response
3. **User Action**: Admin reviews options and calls the Admin API
4. **Resume**: Selected tool is installed

### Console Output

When manual mode triggers, you'll see:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ACTION REQUIRED: Manual Tool Selection                                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Request ID: req_1704067200000_abc123
Query: "get weather data"

Available tools:

#   | Name           | Price   | Rating | ID
---------------------------------------------
1   | Weather API    | $0.0050 | 4.7★   | 550e8400-e29b-41d4-a716...
2   | Climate Pro    | $0.0100 | 4.2★   | 7c9e6679-7425-40de-944b...

To select a tool, run:
  curl -X POST http://localhost:8080/admin/select-tool \
    -H "Content-Type: application/json" \
    -d '{"requestId":"req_1704067200000_abc123","toolId":"550e8400...","action":"select"}'

To reject all options:
  curl -X POST http://localhost:8080/admin/select-tool \
    -H "Content-Type: application/json" \
    -d '{"requestId":"req_1704067200000_abc123","action":"reject"}'

This request will expire in 5 minutes.
```

### Enabling Manual Mode

```sql
UPDATE user_preferences_orchestrator 
SET discovery_mode = 'manual'
WHERE user_id = 'user-123';
```

---

## Admin API

The Admin API provides endpoints for managing manual selections.

### POST /admin/select-tool

Select or reject a pending tool choice.

**Request Body:**
```json
{
  "requestId": "req_1704067200000_abc123",
  "toolId": "550e8400-e29b-41d4-a716-446655440000",  // Required for 'select'
  "action": "select" | "reject"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Tool \"Weather API\" installed successfully",
  "data": {
    "requestId": "req_...",
    "toolId": "550e8400...",
    "toolName": "Weather API"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Pending selection not found or expired",
  "details": { "requestId": "req_..." }
}
```

### GET /admin/pending

List pending selections.

```bash
# All pending selections
curl http://localhost:8080/admin/pending

# For specific user
curl http://localhost:8080/admin/pending?userId=user-123
```

### GET /admin/health

Health check endpoint.

```bash
curl http://localhost:8080/admin/health
```

---

## Troubleshooting

### "No matching tools found"

**Cause**: The search didn't find any tools matching your query.

**Solutions**:
- Check that tools exist in the `tools` table
- Verify `tool_embeddings_orchestrator` has embeddings
- Try a more descriptive query
- Run the embedding seed script: `npm run seed-embeddings`

### "All tools filtered out by user preferences"

**Cause**: Tools were found, but all exceeded your price cap or fell below your rating threshold.

**Solutions**:
- Increase `max_price_cap` in your preferences
- Decrease `min_rating_threshold`
- Check what tools exist with: `SELECT * FROM tools WHERE listing_status = 'ACTIVE';`

### "Installation failed"

**Cause**: The tool was selected but couldn't be installed.

**Common Reasons**:
- Database connection issues
- Duplicate key conflict
- Invalid tool configuration

**Solutions**:
- Check Supabase logs
- Verify `user_tools_orchestrator` table permissions
- Ensure the tool has a valid `endpoint_url`

### "Pending selection not found or expired"

**Cause**: The request ID doesn't exist or has expired (default: 5 minutes).

**Solutions**:
- Check the request ID matches exactly
- Make selection within the expiration window
- Re-trigger discovery if expired

### "OPENAI_API_KEY is not configured"

**Cause**: The embedding/query expansion service needs an API key.

**Solutions**:
- Add `OPENAI_API_KEY` to your `.env` file
- Verify the key is valid and has credits

### Checking Discovery Status

```typescript
import { getSearchServiceStatus } from './discovery';

const status = getSearchServiceStatus();
console.log(status);
// {
//   queryExpansionConfigured: true,
//   embeddingConfigured: true,
//   queryExpansionModel: 'gpt-5-nano',
//   embeddingDimension: 1536,
//   vectorSearchDefaults: { MATCH_THRESHOLD: 0.78, MATCH_COUNT: 10 }
// }
```

### Logs to Check

The discovery system logs events with these prefixes:
- `resolve_missing_tool_*` - Main resolution flow
- `search_service_*` - Search operations
- `selection_service_*` - Filtering and ranking
- `installer_*` - Tool installation
- `pending_state_*` - Manual mode state
- `admin_*` - Admin API operations

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Agent Request                         │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Orchestrator Router                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Interceptor                          │   │
│  │  • Catches "Method Not Found" errors                    │   │
│  │  • Triggers Discovery Service                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Discovery Service                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │    Search     │  │   Selection   │  │   Provisioning    │   │
│  │  • Expand     │  │  • Filter     │  │  • Persist        │   │
│  │  • Embed      │  │  • Rank       │  │  • Refresh        │   │
│  │  • Vector     │  │  • Auto/Man   │  │  • Install        │   │
│  └───────────────┘  └───────────────┘  └───────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
│  ┌─────────────┐  ┌──────────────────────┐  ┌───────────────┐  │
│  │   tools     │  │ tool_embeddings_orch │  │ user_prefs_o  │  │
│  │ (read-only) │  │     (read-only)      │  │  (read/write) │  │
│  └─────────────┘  └──────────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

1. **Price Caps**: Always set reasonable `max_price_cap` values to prevent cost surprises
2. **Manual Mode**: Consider using manual mode for production until you trust the system
3. **API Keys**: Never commit API keys to version control
4. **Supabase Keys**: Use service role keys, not anon keys
5. **Rate Limits**: The system respects OpenAI rate limits; errors are handled gracefully

