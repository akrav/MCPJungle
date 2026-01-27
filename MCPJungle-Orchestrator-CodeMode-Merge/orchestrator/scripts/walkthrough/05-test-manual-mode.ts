#!/usr/bin/env npx tsx
/**
 * Step 5: Test Manual Mode Discovery
 * 
 * Demonstrates the manual (human-in-the-loop) flow:
 * 1. Search for matching tools
 * 2. Filter by user preferences
 * 3. PAUSE - show options for admin API selection
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const MANUAL_USER_ID = '22222222-2222-2222-2222-222222222222';
const query = process.argv[2] || 'github repository management';

console.log('\n' + '='.repeat(70));
console.log('  STEP 5: Test Manual Mode Discovery');
console.log('='.repeat(70) + '\n');

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

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
  }
  
  if (!OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Show user preferences
  console.log('👤 User Preferences:\n');
  const prefs = await getPreferences(supabase, MANUAL_USER_ID);
  console.log(`   User ID: ${MANUAL_USER_ID}`);
  console.log(`   Discovery Mode: ${prefs.discovery_mode} 🖐️`);
  console.log(`   Strategy: ${prefs.auto_install_strategy}`);
  console.log(`   Max Price Cap: $${prefs.max_price_cap.toFixed(4)}`);
  console.log(`   Min Rating: ${prefs.min_rating_threshold}★`);

  console.log('\n' + '-'.repeat(70));
  console.log(`\n📝 Query: "${query}"\n`);
  console.log('-'.repeat(70));

  // Run the discovery flow
  console.log('\n🚀 Running Manual Mode Discovery...\n');
  
  const startTime = Date.now();

  // Expand query
  const expanded = await expandQuery(query);
  console.log(`   Expanded: "${expanded.slice(0, 80)}..."\n`);

  // Generate embedding
  const embedding = await generateEmbedding(expanded);
  console.log(`   Embedding: ${embedding.length} dimensions\n`);

  // Search
  const results = await searchTools(supabase, embedding);
  console.log(`   Found: ${results.length} potential matches\n`);

  if (results.length === 0) {
    console.log('   ❌ No tools found matching your query.\n');
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

  const totalTime = Date.now() - startTime;

  // Generate a request ID for this manual selection
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Display results
  console.log('\n' + '-'.repeat(70));
  console.log('\n📊 Resolution Result:\n');
  
  console.log('   ┌' + '─'.repeat(50) + '┐');
  console.log('   │ Resolved:     ❌ NO (waiting for input)         │');
  console.log('   │ Manual Mode:  🖐️  YES - Paused!                  │');
  console.log(`   │ Request ID:   ${requestId}`.padEnd(53) + '│');
  console.log(`   │ Candidates:   ${ranked.length} tool(s)`.padEnd(53) + '│');
  console.log('   └' + '─'.repeat(50) + '┘');

  console.log('\n   ⚡ SYSTEM PAUSED - Waiting for admin selection!\n');

  console.log('   📦 Available Tools to Select From:');
  console.log('   ┌───┬────────────────────────────┬────────────┬────────┬──────────────────────────────────────┐');
  console.log('   │ # │ Name                       │ Price      │ Sim.   │ ID                                   │');
  console.log('   ├───┼────────────────────────────┼────────────┼────────┼──────────────────────────────────────┤');
  
  ranked.slice(0, 5).forEach((tool: any, i: number) => {
    const name = tool.name.substring(0, 26).padEnd(26);
    const price = `$${tool.price_per_call.toFixed(4)}`.padEnd(10);
    const sim = tool.similarity ? `${(tool.similarity * 100).toFixed(0)}%`.padEnd(6) : 'N/A   ';
    console.log(`   │ ${(i + 1).toString().padEnd(1)} │ ${name} │ ${price} │ ${sim} │ ${tool.id} │`);
  });
  console.log('   └───┴────────────────────────────┴────────────┴────────┴──────────────────────────────────────┘');

  // Show how to complete the selection
  console.log('\n' + '='.repeat(70));
  console.log('  HOW TO COMPLETE THE SELECTION');
  console.log('='.repeat(70));

  const firstTool = ranked[0];
  
  console.log('\n   📌 Option 1: Select tool #1 ("' + firstTool.name + '")\n');
  console.log('   curl -X POST http://localhost:8080/admin/select-tool \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(`     -d '{"requestId":"${requestId}","toolId":"${firstTool.id}","action":"select"}'`);

  if (ranked.length > 1) {
    const secondTool = ranked[1];
    console.log('\n   📌 Option 2: Select tool #2 ("' + secondTool.name + '")\n');
    console.log('   curl -X POST http://localhost:8080/admin/select-tool \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log(`     -d '{"requestId":"${requestId}","toolId":"${secondTool.id}","action":"select"}'`);
  }
  
  console.log('\n   📌 Reject all tools\n');
  console.log('   curl -X POST http://localhost:8080/admin/select-tool \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(`     -d '{"requestId":"${requestId}","action":"reject"}'`);
  
  console.log('\n   ⚠️  Note: Start the admin server first in another terminal:');
  console.log('   npx tsx scripts/walkthrough/07-admin-server.ts');

  console.log(`\n   ⏱️  Total Time: ${totalTime}ms`);

  console.log('\n' + '='.repeat(70));
  console.log('  Manual Mode Test Complete!');
  console.log('='.repeat(70) + '\n');

  console.log('🖐️  In production, the system would store this pending selection');
  console.log('   and wait for the admin API call to complete the installation.');
  console.log('');
}

main().catch(console.error);
