#!/usr/bin/env npx tsx
/**
 * Simple Discovery Test Script
 * 
 * Tests the full discovery flow without complex imports.
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

console.log('\n' + '='.repeat(70));
console.log('  EPIC 4 DISCOVERY TEST');
console.log('='.repeat(70) + '\n');

// Test user IDs
const AUTO_USER_ID = '11111111-1111-1111-1111-111111111111';
const MANUAL_USER_ID = '22222222-2222-2222-2222-222222222222';
const STRICT_USER_ID = '33333333-3333-3333-3333-333333333333';

async function expandQuery(query: string): Promise<string> {
  console.log('   📝 Expanding query with GPT-4o-mini...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at finding APIs. Given a request, describe the ideal tool. Be precise and use technical keywords. Output ONLY the description.',
        },
        {
          role: 'user',
          content: `The user wants: "${query}"\n\nDescribe the ideal MCP tool.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function generateEmbedding(text: string): Promise<number[]> {
  console.log('   🔢 Generating embedding...');
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchTools(supabase: any, embedding: number[], threshold = 0.5, limit = 10) {
  console.log('   🔍 Searching tools via vector similarity...');
  
  const { data, error } = await supabase.rpc('match_tools_orchestrator', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    console.error('   ❌ Search error:', error.message);
    return [];
  }
  return data || [];
}

async function getPreferences(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('user_preferences_orchestrator')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // Return defaults
    return {
      user_id: userId,
      discovery_mode: 'manual',
      auto_install_strategy: 'balanced',
      max_price_cap: 1.0,
      min_rating_threshold: 3.0,
    };
  }
  return data;
}

function filterTools(tools: any[], prefs: any) {
  return tools.filter(tool => 
    tool.price_per_call <= prefs.max_price_cap &&
    tool.average_rating >= prefs.min_rating_threshold
  );
}

function rankTools(tools: any[], strategy: string) {
  const sorted = [...tools];
  switch (strategy) {
    case 'cheapest':
      sorted.sort((a, b) => a.price_per_call - b.price_per_call);
      break;
    case 'rating':
      sorted.sort((a, b) => b.average_rating - a.average_rating);
      break;
    case 'balanced':
    default:
      sorted.sort((a, b) => {
        const scoreA = (a.average_rating / 5) * 0.6 + (1 - a.price_per_call) * 0.4;
        const scoreB = (b.average_rating / 5) * 0.6 + (1 - b.price_per_call) * 0.4;
        return scoreB - scoreA;
      });
  }
  return sorted;
}

async function installTool(supabase: any, userId: string, tool: any) {
  console.log(`   📥 Installing tool "${tool.name}" for user ${userId.slice(0, 8)}...`);
  
  const canonicalName = `${tool.name.replace(/[^a-zA-Z0-9]/g, '_')}__${tool.id.slice(0, 8)}`;
  
  const { error } = await supabase
    .from('user_tools_orchestrator')
    .upsert({
      user_id: userId,
      tool_id: tool.id,
      canonical_name: canonicalName,
      is_active: true,
    }, { onConflict: 'user_id,tool_id' });

  if (error) {
    console.error('   ❌ Install error:', error.message);
    return null;
  }
  
  return { canonicalName, toolId: tool.id };
}

async function testAutoMode(supabase: any, query: string) {
  console.log('\n' + '─'.repeat(70));
  console.log('\n🤖 TEST: AUTO MODE\n');
  console.log(`   Query: "${query}"`);
  console.log(`   User: AUTO (${AUTO_USER_ID.slice(0, 8)}...)\n`);

  // Get preferences
  const prefs = await getPreferences(supabase, AUTO_USER_ID);
  console.log(`   Mode: ${prefs.discovery_mode}, Strategy: ${prefs.auto_install_strategy}`);
  console.log(`   Max Price: $${prefs.max_price_cap}, Min Rating: ${prefs.min_rating_threshold}★\n`);

  // Expand query
  const expanded = await expandQuery(query);
  console.log(`   Expanded (first 100 chars): "${expanded.slice(0, 100)}..."\n`);

  // Generate embedding
  const embedding = await generateEmbedding(expanded);
  console.log(`   Embedding generated (${embedding.length} dimensions)\n`);

  // Search
  const results = await searchTools(supabase, embedding);
  console.log(`   Found ${results.length} potential matches\n`);

  if (results.length === 0) {
    console.log('   ❌ No tools found!\n');
    return;
  }

  // Filter
  const filtered = filterTools(results, prefs);
  console.log(`   After filtering: ${filtered.length} tools\n`);

  if (filtered.length === 0) {
    console.log('   ❌ All tools filtered out by preferences!\n');
    return;
  }

  // Rank
  const ranked = rankTools(filtered, prefs.auto_install_strategy);
  console.log('   Ranked candidates:');
  ranked.slice(0, 3).forEach((t: any, i: number) => {
    console.log(`     ${i + 1}. ${t.name} - $${t.price_per_call.toFixed(4)} - ${t.average_rating}★`);
  });

  // Auto install (since mode is 'auto')
  if (prefs.discovery_mode === 'auto') {
    const selected = ranked[0];
    console.log(`\n   🎯 Auto-selecting: ${selected.name}`);
    const result = await installTool(supabase, AUTO_USER_ID, selected);
    if (result) {
      console.log(`   ✅ Installed as: ${result.canonicalName}\n`);
    }
  } else {
    console.log('\n   ⚠️  Manual mode - not auto-installing\n');
  }
}

async function testManualMode(supabase: any, query: string) {
  console.log('\n' + '─'.repeat(70));
  console.log('\n🖐️  TEST: MANUAL MODE\n');
  console.log(`   Query: "${query}"`);
  console.log(`   User: MANUAL (${MANUAL_USER_ID.slice(0, 8)}...)\n`);

  // Get preferences
  const prefs = await getPreferences(supabase, MANUAL_USER_ID);
  console.log(`   Mode: ${prefs.discovery_mode}, Strategy: ${prefs.auto_install_strategy}`);
  console.log(`   Max Price: $${prefs.max_price_cap}, Min Rating: ${prefs.min_rating_threshold}★\n`);

  // Expand query
  const expanded = await expandQuery(query);
  console.log(`   Expanded (first 100 chars): "${expanded.slice(0, 100)}..."\n`);

  // Generate embedding
  const embedding = await generateEmbedding(expanded);

  // Search
  const results = await searchTools(supabase, embedding);
  console.log(`   Found ${results.length} potential matches\n`);

  if (results.length === 0) {
    console.log('   ❌ No tools found!\n');
    return;
  }

  // Filter & Rank
  const filtered = filterTools(results, prefs);
  const ranked = rankTools(filtered, prefs.auto_install_strategy);

  if (ranked.length === 0) {
    console.log('   ❌ All tools filtered out!\n');
    return;
  }

  // Show options (manual mode)
  console.log('   🖐️  MANUAL MODE - User selection required!\n');
  console.log('   Available tools:');
  console.log('   ┌───┬─────────────────────────┬────────────┬──────────────────────────────────────┐');
  console.log('   │ # │ Name                    │ Price      │ ID                                   │');
  console.log('   ├───┼─────────────────────────┼────────────┼──────────────────────────────────────┤');
  
  ranked.slice(0, 5).forEach((t: any, i: number) => {
    const name = t.name.substring(0, 23).padEnd(23);
    const price = `$${t.price_per_call.toFixed(4)}`.padEnd(10);
    console.log(`   │ ${i + 1} │ ${name} │ ${price} │ ${t.id} │`);
  });
  console.log('   └───┴─────────────────────────┴────────────┴──────────────────────────────────────┘');

  console.log('\n   To select tool #1, run:');
  console.log(`   curl -X POST http://localhost:8080/admin/select-tool \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"requestId":"manual-test","toolId":"${ranked[0].id}","action":"select"}'`);
  console.log('');
}

async function testEdgeCase(supabase: any) {
  console.log('\n' + '─'.repeat(70));
  console.log('\n⚠️  TEST: EDGE CASE (Strict Filters)\n');
  console.log(`   User: STRICT (${STRICT_USER_ID.slice(0, 8)}...)\n`);

  // Get preferences
  const prefs = await getPreferences(supabase, STRICT_USER_ID);
  console.log(`   Max Price: $${prefs.max_price_cap} (very strict!)`);
  console.log(`   Min Rating: ${prefs.min_rating_threshold}★ (very strict!)\n`);

  // Get all tools from tools table
  const { data: allTools } = await supabase
    .from('tools')
    .select('id, name, price_per_call, average_rating')
    .eq('listing_status', 'ACTIVE');

  console.log(`   Total tools in registry: ${allTools?.length || 0}`);

  // Apply filters
  const filtered = filterTools(allTools || [], prefs);
  console.log(`   After strict filtering: ${filtered.length} tools\n`);

  if (filtered.length === 0) {
    console.log('   ✅ EXPECTED: All tools filtered out by strict preferences!');
    console.log('   This is the correct behavior - user set impossible constraints.\n');
  } else {
    console.log('   Found tools that pass strict filters:');
    filtered.forEach((t: any) => {
      console.log(`     - ${t.name}: $${t.price_per_call} / ${t.average_rating}★`);
    });
  }
}

async function showInstalledTools(supabase: any) {
  console.log('\n' + '─'.repeat(70));
  console.log('\n📦 INSTALLED TOOLS\n');

  const { data: installed } = await supabase
    .from('user_tools_orchestrator')
    .select('*');

  if (!installed || installed.length === 0) {
    console.log('   No tools installed yet.\n');
  } else {
    console.log(`   Found ${installed.length} installed tool(s):\n`);
    installed.forEach((t: any) => {
      console.log(`   - User: ${t.user_id.slice(0, 8)}...`);
      console.log(`     Tool: ${t.canonical_name}`);
      console.log(`     Installed: ${t.installed_at}`);
      console.log('');
    });
  }
}

async function main() {
  console.log('🔧 Initializing...\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
  }

  if (!OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const query = process.argv[2] || 'echo http requests for testing and debugging';

  // Test Auto Mode
  await testAutoMode(supabase, query);

  // Test Manual Mode
  await testManualMode(supabase, 'github repository issues');

  // Test Edge Case
  await testEdgeCase(supabase);

  // Show installed tools
  await showInstalledTools(supabase);

  console.log('\n' + '='.repeat(70));
  console.log('  DISCOVERY TEST COMPLETE!');
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error);

