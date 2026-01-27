#!/usr/bin/env npx tsx
/**
 * Step 1: Verify Database State
 * 
 * This script checks the current state of your Supabase database
 * to ensure everything is set up correctly for the discovery system.
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

console.log('\n' + '='.repeat(70));
console.log('  STEP 1: Verify Database State');
console.log('='.repeat(70) + '\n');

async function main() {
  // Check environment
  console.log('🔍 Checking environment variables...\n');
  
  const envStatus = {
    SUPABASE_URL: SUPABASE_URL ? '✅ Set' : '❌ Missing',
    SUPABASE_KEY: SUPABASE_KEY ? '✅ Set' : '❌ Missing',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
  };
  
  console.log('Environment Variables:');
  Object.entries(envStatus).forEach(([key, status]) => {
    console.log(`  ${key}: ${status}`);
  });
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Cannot proceed without Supabase credentials.');
    console.log('\n📝 Please create/update your .env file with:');
    console.log('   SUPABASE_URL=https://your-project.supabase.co');
    console.log('   SUPABASE_KEY=your-service-role-key');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Check tools table
  console.log('📦 Checking tools table...\n');
  
  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .select('id, name, description, price_per_call, average_rating, listing_status')
    .eq('listing_status', 'ACTIVE');

  if (toolsError) {
    console.error('❌ Error fetching tools:', toolsError.message);
    process.exit(1);
  }

  console.log(`Found ${tools?.length || 0} active tools:\n`);
  console.log('┌─────────────────────────────┬────────────┬────────┬────────────────────────────────────────────┐');
  console.log('│ Name                        │ Price      │ Rating │ Description                                │');
  console.log('├─────────────────────────────┼────────────┼────────┼────────────────────────────────────────────┤');
  
  tools?.forEach(tool => {
    const name = tool.name.substring(0, 27).padEnd(27);
    const price = `$${tool.price_per_call.toFixed(4)}`.padEnd(10);
    const rating = tool.average_rating === -1 ? 'N/A   ' : `${tool.average_rating.toFixed(1)}★  `;
    const desc = tool.description.substring(0, 40).padEnd(40);
    console.log(`│ ${name} │ ${price} │ ${rating} │ ${desc} │`);
  });
  console.log('└─────────────────────────────┴────────────┴────────┴────────────────────────────────────────────┘');

  // Check embeddings
  console.log('\n🧠 Checking tool embeddings...\n');
  
  const { data: embeddings, error: embError } = await supabase
    .from('tool_embeddings_orchestrator')
    .select('tool_id, created_at');

  if (embError) {
    console.error('❌ Error fetching embeddings:', embError.message);
  } else {
    console.log(`Found ${embeddings?.length || 0} tool embeddings.`);
    
    // Check which tools are missing embeddings
    const embeddedToolIds = new Set(embeddings?.map(e => e.tool_id) || []);
    const missingEmbeddings = tools?.filter(t => !embeddedToolIds.has(t.id)) || [];
    
    if (missingEmbeddings.length > 0) {
      console.log(`\n⚠️  ${missingEmbeddings.length} tools are missing embeddings:`);
      missingEmbeddings.forEach(t => console.log(`   - ${t.name}`));
      console.log('\n   Run: npx tsx scripts/seed-embeddings.ts');
    } else if (tools && tools.length > 0) {
      console.log('✅ All active tools have embeddings.');
    }
  }

  // Check user preferences
  console.log('\n👤 Checking user preferences...\n');
  
  const { data: prefs, error: prefsError } = await supabase
    .from('user_preferences_orchestrator')
    .select('*');

  if (prefsError) {
    console.error('❌ Error fetching preferences:', prefsError.message);
  } else if (!prefs || prefs.length === 0) {
    console.log('No user preferences configured yet.');
    console.log('Run: npx tsx scripts/walkthrough/02-setup-preferences.ts');
  } else {
    console.log(`Found ${prefs.length} user preference(s):\n`);
    prefs.forEach(p => {
      console.log(`  User: ${p.user_id}`);
      console.log(`    Mode: ${p.discovery_mode}`);
      console.log(`    Strategy: ${p.auto_install_strategy}`);
      console.log(`    Max Price: $${p.max_price_cap.toFixed(2)}`);
      console.log(`    Min Rating: ${p.min_rating_threshold}★`);
      console.log('');
    });
  }

  // Check RPC function
  console.log('🔧 Checking match_tools_orchestrator RPC...\n');
  
  // Try calling with a dummy embedding to verify function exists
  const dummyEmbedding = new Array(1536).fill(0);
  const { error: rpcError } = await supabase.rpc('match_tools_orchestrator', {
    query_embedding: dummyEmbedding,
    match_threshold: 0.0,
    match_count: 1
  });

  if (rpcError) {
    console.log('❌ RPC function error:', rpcError.message);
    console.log('\n   The match_tools_orchestrator function may need to be created.');
  } else {
    console.log('✅ match_tools_orchestrator RPC function is working.');
  }

  // Check installed tools
  console.log('\n📥 Checking installed tools...\n');
  
  const { data: installed, error: instError } = await supabase
    .from('user_tools_orchestrator')
    .select('user_id, tool_id, canonical_name, installed_at');

  if (instError) {
    console.error('❌ Error fetching installed tools:', instError.message);
  } else if (!installed || installed.length === 0) {
    console.log('No tools have been installed yet.');
  } else {
    console.log(`Found ${installed.length} installed tool(s).`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('  Summary');
  console.log('='.repeat(70));
  console.log(`
  Tools in registry:     ${tools?.length || 0}
  Embeddings:            ${embeddings?.length || 0}
  User preferences:      ${prefs?.length || 0}
  Installed tools:       ${installed?.length || 0}
  RPC function:          ${rpcError ? '❌' : '✅'}
  `);

  // Note about ratings
  const toolsWithBadRating = tools?.filter(t => t.average_rating < 0) || [];
  if (toolsWithBadRating.length > 0) {
    console.log('⚠️  Note: Some tools have average_rating=-1 (unrated).');
    console.log('   The default minRatingThreshold is 3.0, which would filter these out.');
    console.log('   Set minRatingThreshold to -2 in preferences to include them.');
  }

  console.log('\n✅ Database verification complete!\n');
}

main().catch(console.error);

