# Epic 4 Production Walkthrough

This walkthrough demonstrates the complete Tool Discovery system in a production-like environment.

## Prerequisites

1. **Environment Variables** - Create/update `.env` file with real credentials:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key
   OPENAI_API_KEY=sk-your-api-key
   ```

2. **Build the project**:
   ```bash
   cd orchestrator
   npm run build
   ```

## Walkthrough Steps

### Step 1: Verify Database State
```bash
npx tsx scripts/walkthrough/01-verify-database.ts
```
Shows current tools, embeddings, and user preferences.

### Step 2: Setup Test User Preferences
```bash
npx tsx scripts/walkthrough/02-setup-preferences.ts
```
Creates test user with both auto and manual mode configurations.

### Step 3: Test Search Pipeline
```bash
npx tsx scripts/walkthrough/03-test-search.ts "weather forecast"
```
Demonstrates query expansion, embedding generation, and vector search.

### Step 4: Test Auto Mode Discovery
```bash
npx tsx scripts/walkthrough/04-test-auto-mode.ts
```
Full auto-discovery flow: search → filter → select → install.

### Step 5: Test Manual Mode Discovery
```bash
npx tsx scripts/walkthrough/05-test-manual-mode.ts
```
Manual mode: search → pause → admin selection → install.

### Step 6: Test Edge Cases
```bash
npx tsx scripts/walkthrough/06-test-edge-cases.ts
```
Tests no matches, filtered out, and error scenarios.

### Step 7: Run Admin API Server
```bash
npx tsx scripts/walkthrough/07-admin-server.ts
```
Starts the admin API server for manual tool selection.

## Quick Full Walkthrough
```bash
npx tsx scripts/walkthrough/run-all.ts
```
Runs all steps sequentially with prompts.

