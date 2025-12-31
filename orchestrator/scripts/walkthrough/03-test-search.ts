#!/usr/bin/env npx tsx
/**
 * Step 3: Test Search Pipeline
 * 
 * Demonstrates the full search pipeline:
 * 1. Query Expansion (LLM generates ideal tool description)
 * 2. Embedding Generation (OpenAI text-embedding-3-small)
 * 3. Vector Search (Supabase pgvector similarity search)
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

// Import discovery modules
import { 
  initializeSupabaseClient,
  isSupabaseConfigured,
} from '../../src/discovery/supabase/client.js';
import { expandQuery, isQueryExpansionConfigured } from '../../src/discovery/search/queryExpansion.js';
import { generateEmbedding, isEmbeddingConfigured } from '../../src/discovery/search/embedding.js';
import { findSimilarTools } from '../../src/discovery/search/vectorStore.js';
import { searchTools } from '../../src/discovery/search/index.js';

const query = process.argv[2] || 'weather forecast';

console.log('\n' + '='.repeat(70));
console.log('  STEP 3: Test Search Pipeline');
console.log('='.repeat(70) + '\n');

async function main() {
  // Check environment variables first
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  // Initialize Supabase if env vars are set
  if (SUPABASE_URL && SUPABASE_KEY) {
    initializeSupabaseClient({ supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY });
  }

  // Check configuration
  console.log('🔍 Checking configuration...\n');
  
  const configStatus = {
    'Supabase': isSupabaseConfigured() ? '✅' : '❌',
    'Query Expansion (OpenAI)': isQueryExpansionConfigured() ? '✅' : '❌',
    'Embeddings (OpenAI)': isEmbeddingConfigured() ? '✅' : '❌',
  };
  
  Object.entries(configStatus).forEach(([key, status]) => {
    console.log(`  ${status} ${key}`);
  });

  if (!isSupabaseConfigured() || !isQueryExpansionConfigured()) {
    console.error('\n❌ Missing required configuration. Check your .env file.');
    process.exit(1);
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`\n📝 Input Query: "${query}"\n`);
  console.log('-'.repeat(70));

  // Step 1: Query Expansion
  console.log('\n🧠 STEP 1: Query Expansion\n');
  console.log('   Sending to OpenAI (gpt-5-nano) to generate ideal tool description...\n');
  
  const startExpand = Date.now();
  let expandedQuery: string;
  try {
    expandedQuery = await expandQuery(query);
    const expandTime = Date.now() - startExpand;
    console.log('   ✅ Expanded Query:\n');
    console.log('   ┌' + '─'.repeat(66) + '┐');
    const lines = expandedQuery.match(/.{1,64}/g) || [expandedQuery];
    lines.forEach(line => {
      console.log(`   │ ${line.padEnd(64)} │`);
    });
    console.log('   └' + '─'.repeat(66) + '┘');
    console.log(`\n   ⏱️  Time: ${expandTime}ms`);
  } catch (error) {
    console.error('   ❌ Query expansion failed:', (error as Error).message);
    process.exit(1);
  }

  // Step 2: Generate Embedding
  console.log('\n' + '-'.repeat(70));
  console.log('\n🔢 STEP 2: Generate Embedding\n');
  console.log('   Sending to OpenAI (text-embedding-3-small)...\n');
  
  const startEmbed = Date.now();
  let embedding: number[];
  try {
    embedding = await generateEmbedding(expandedQuery);
    const embedTime = Date.now() - startEmbed;
    console.log(`   ✅ Generated ${embedding.length}-dimensional embedding`);
    console.log(`   📊 Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
    console.log(`\n   ⏱️  Time: ${embedTime}ms`);
  } catch (error) {
    console.error('   ❌ Embedding generation failed:', (error as Error).message);
    process.exit(1);
  }

  // Step 3: Vector Search
  console.log('\n' + '-'.repeat(70));
  console.log('\n🔍 STEP 3: Vector Similarity Search\n');
  console.log('   Querying Supabase (match_tools_orchestrator RPC)...\n');
  
  const startSearch = Date.now();
  try {
    const results = await findSimilarTools(embedding, 0.5, 10);
    const searchTime = Date.now() - startSearch;
    
    console.log(`   ✅ Found ${results.length} matching tools:\n`);
    
    if (results.length > 0) {
      console.log('   ┌───┬────────────────────────────┬────────────┬────────────────┐');
      console.log('   │ # │ Name                       │ Similarity │ Price          │');
      console.log('   ├───┼────────────────────────────┼────────────┼────────────────┤');
      
      results.forEach((tool, i) => {
        const name = tool.name.substring(0, 26).padEnd(26);
        const sim = `${(tool.similarity_score * 100).toFixed(1)}%`.padEnd(10);
        const price = `$${tool.price_per_call.toFixed(4)}`.padEnd(14);
        console.log(`   │ ${(i + 1).toString().padEnd(1)} │ ${name} │ ${sim} │ ${price} │`);
      });
      console.log('   └───┴────────────────────────────┴────────────┴────────────────┘');
    }
    
    console.log(`\n   ⏱️  Time: ${searchTime}ms`);
  } catch (error) {
    console.error('   ❌ Vector search failed:', (error as Error).message);
    process.exit(1);
  }

  // Full Pipeline Test
  console.log('\n' + '='.repeat(70));
  console.log('\n🚀 FULL PIPELINE TEST (searchTools function)\n');
  
  const startFull = Date.now();
  try {
    const fullResults = await searchTools(query);
    const fullTime = Date.now() - startFull;
    
    console.log(`   ✅ searchTools("${query}") returned ${fullResults.length} results`);
    console.log(`\n   ⏱️  Total Pipeline Time: ${fullTime}ms`);
    
    if (fullResults.length > 0) {
      console.log('\n   Top Result:');
      console.log(`     Name: ${fullResults[0].name}`);
      console.log(`     ID: ${fullResults[0].id}`);
      console.log(`     Similarity: ${(fullResults[0].similarity_score * 100).toFixed(1)}%`);
      console.log(`     Price: $${fullResults[0].price_per_call.toFixed(4)}/call`);
    }
  } catch (error) {
    console.error('   ❌ Full pipeline failed:', (error as Error).message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  Search Pipeline Test Complete!');
  console.log('='.repeat(70) + '\n');

  console.log('📝 Try different queries:');
  console.log('   npx tsx scripts/walkthrough/03-test-search.ts "github issues"');
  console.log('   npx tsx scripts/walkthrough/03-test-search.ts "http testing"');
  console.log('   npx tsx scripts/walkthrough/03-test-search.ts "fake api for testing"');
  console.log('');
}

main().catch(console.error);

