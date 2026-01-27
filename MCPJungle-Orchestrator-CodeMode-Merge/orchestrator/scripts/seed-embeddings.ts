/**
 * Seed Tool Embeddings Script
 *
 * Generates embeddings for all tools in the database and stores them
 * in the tool_embeddings_orchestrator table.
 *
 * Usage: npx tsx scripts/seed-embeddings.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file
config({ path: resolve(process.cwd(), '.env') });

import { initializeSupabaseClient } from '../src/discovery/supabase/client.js';
import { getAllTools } from '../src/discovery/supabase/service.js';
import { generateEmbedding } from '../src/discovery/search/embedding.js';
import { storeToolEmbedding, getEmbeddingCount } from '../src/discovery/search/vectorStore.js';

async function seedEmbeddings() {
  console.log('🌱 Starting embedding seed process...\n');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
  }

  if (!openaiKey) {
    console.error('❌ Missing OPENAI_API_KEY in .env');
    process.exit(1);
  }

  console.log('✅ Environment variables loaded');

  // Initialize Supabase client
  initializeSupabaseClient({ supabaseUrl, supabaseKey });
  console.log('✅ Supabase client initialized\n');

  // Get current embedding count
  const existingCount = await getEmbeddingCount();
  console.log(`📊 Existing embeddings: ${existingCount}`);

  // Fetch all tools
  const tools = await getAllTools();
  console.log(`📋 Found ${tools.length} tools in database\n`);

  if (tools.length === 0) {
    console.log('No tools to embed. Exiting.');
    return;
  }

  // Generate and store embeddings for each tool
  let success = 0;
  let failed = 0;

  for (const tool of tools) {
    const displayName = `${tool.name} (${tool.id.slice(0, 8)}...)`;

    try {
      console.log(`🔄 Processing: ${displayName}`);

      // Generate embedding for the description
      const embedding = await generateEmbedding(tool.description);
      console.log(`   ✓ Generated embedding (${embedding.length} dimensions)`);

      // Store in database
      await storeToolEmbedding(tool.id, embedding);
      console.log(`   ✓ Stored in database`);

      success++;
    } catch (err) {
      console.error(`   ❌ Failed: ${(err as Error).message}`);
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(50));
  console.log('📈 Seeding complete!');
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);

  // Verify final count
  const finalCount = await getEmbeddingCount();
  console.log(`   📊 Total embeddings in DB: ${finalCount}`);
}

// Run the script
seedEmbeddings()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

