#!/usr/bin/env npx tsx
/**
 * Step 5: Test Manual Mode Discovery
 * 
 * Demonstrates the manual (human-in-the-loop) flow:
 * 1. Search for matching tools
 * 2. Filter by user preferences
 * 3. PAUSE - store pending choices
 * 4. Wait for admin API selection
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

import { initializeSupabaseClient } from '../../src/discovery/supabase/client.js';
import { resolveMissingTool } from '../../src/discovery/index.js';
import { getUserPreferences } from '../../src/discovery/preferences/store.js';
import { getPendingChoices, clearAllPendingChoices } from '../../src/discovery/interaction/pendingState.js';

const MANUAL_USER_ID = '22222222-2222-2222-2222-222222222222';
const query = process.argv[2] || 'github repository management';

console.log('\n' + '='.repeat(70));
console.log('  STEP 5: Test Manual Mode Discovery');
console.log('='.repeat(70) + '\n');

async function main() {
  // Initialize Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
  }
  
  initializeSupabaseClient({ supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY });
  
  // Clear any existing pending choices
  clearAllPendingChoices();

  // Show user preferences
  console.log('👤 User Preferences:\n');
  try {
    const prefs = await getUserPreferences(MANUAL_USER_ID);
    console.log(`   User ID: ${MANUAL_USER_ID}`);
    console.log(`   Discovery Mode: ${prefs.discoveryMode} 🖐️`);
    console.log(`   Strategy: ${prefs.autoInstallStrategy}`);
    console.log(`   Max Price Cap: $${prefs.maxPriceCap.toFixed(4)}`);
    console.log(`   Min Rating: ${prefs.minRatingThreshold}★`);
  } catch (error) {
    console.error('   ❌ Could not fetch preferences. Run step 2 first!');
    console.log('   npx tsx scripts/walkthrough/02-setup-preferences.ts');
    process.exit(1);
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`\n📝 Query: "${query}"\n`);
  console.log('-'.repeat(70));

  // Run the resolution
  console.log('\n🚀 Running resolveMissingTool (manual mode)...\n');
  console.log('   ⏳ This will PAUSE and wait for admin selection...\n');
  
  const startTime = Date.now();
  const result = await resolveMissingTool(MANUAL_USER_ID, query);
  const totalTime = Date.now() - startTime;

  // Display results
  console.log('\n' + '-'.repeat(70));
  console.log('\n📊 Resolution Result:\n');
  
  console.log('   ┌' + '─'.repeat(50) + '┐');
  console.log(`   │ Resolved:     ${result.resolved ? '✅ YES' : '❌ NO (waiting for input)'}`.padEnd(53) + '│');
  console.log(`   │ Manual Mode:  ${result.manualMode ? '🖐️  YES - Paused!' : '🤖 NO'}`.padEnd(53) + '│');
  console.log(`   │ Request ID:   ${result.requestId || 'N/A'}`.padEnd(53) + '│');
  console.log(`   │ Candidates:   ${result.candidates.length} tool(s)`.padEnd(53) + '│');
  console.log('   └' + '─'.repeat(50) + '┘');

  if (result.manualMode && result.requestId) {
    console.log('\n   ⚡ SYSTEM PAUSED - Waiting for admin selection!\n');
    
    // Show pending state
    const pending = getPendingChoices(result.requestId);
    if (pending) {
      console.log('   📋 Pending Selection State:');
      console.log(`      Request ID: ${pending.requestId}`);
      console.log(`      User ID: ${pending.userId}`);
      console.log(`      Query: "${pending.query}"`);
      console.log(`      Candidates: ${pending.candidates.length}`);
      console.log(`      Expires: ${new Date(pending.expiresAt).toLocaleTimeString()}`);
    }

    if (result.candidates.length > 0) {
      console.log('\n   📦 Available Tools to Select From:');
      console.log('   ┌───┬────────────────────────────┬────────────┬──────────────────────────────────────┐');
      console.log('   │ # │ Name                       │ Price      │ ID                                   │');
      console.log('   ├───┼────────────────────────────┼────────────┼──────────────────────────────────────┤');
      
      result.candidates.forEach((tool, i) => {
        const name = tool.name.substring(0, 26).padEnd(26);
        const price = `$${tool.price_per_call.toFixed(4)}`.padEnd(10);
        console.log(`   │ ${(i + 1).toString().padEnd(1)} │ ${name} │ ${price} │ ${tool.id} │`);
      });
      console.log('   └───┴────────────────────────────┴────────────┴──────────────────────────────────────┘');
    }

    // Show how to complete the selection
    console.log('\n' + '='.repeat(70));
    console.log('  HOW TO COMPLETE THE SELECTION');
    console.log('='.repeat(70));

    if (result.candidates.length > 0) {
      const firstTool = result.candidates[0];
      
      console.log('\n   📌 Option 1: Select a tool\n');
      console.log('   curl -X POST http://localhost:8080/admin/select-tool \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log(`     -d '{"requestId":"${result.requestId}","toolId":"${firstTool.id}","action":"select"}'`);
      
      console.log('\n   📌 Option 2: Reject all tools\n');
      console.log('   curl -X POST http://localhost:8080/admin/select-tool \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log(`     -d '{"requestId":"${result.requestId}","action":"reject"}'`);
      
      console.log('\n   ⚠️  Note: Start the admin server first:');
      console.log('   npx tsx scripts/walkthrough/07-admin-server.ts');
    }
  } else if (!result.resolved) {
    console.log(`\n   ⚠️  Status: ${result.error}`);
  }

  console.log(`\n   ⏱️  Total Time: ${totalTime}ms`);

  console.log('\n' + '='.repeat(70));
  console.log('  Manual Mode Test Complete!');
  console.log('='.repeat(70) + '\n');

  if (result.manualMode) {
    console.log('🖐️  System is waiting for your input via the Admin API.');
    console.log('   Use the curl commands above to make a selection.');
  }
  console.log('');
}

main().catch(console.error);

