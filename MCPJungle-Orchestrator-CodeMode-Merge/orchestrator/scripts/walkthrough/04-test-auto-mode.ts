#!/usr/bin/env npx tsx
/**
 * Step 4: Test Auto Mode Discovery
 * 
 * Demonstrates the complete auto-discovery flow:
 * 1. Search for matching tools
 * 2. Filter by user preferences (price/rating)
 * 3. Rank by strategy (cheapest/rating/balanced)
 * 4. Auto-install the best tool
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

import { initializeSupabaseClient } from '../../src/discovery/supabase/client.js';
import { resolveMissingTool, tryResolveMissingTool } from '../../src/discovery/index.js';
import { getUserPreferences } from '../../src/discovery/preferences/store.js';

const AUTO_USER_ID = '11111111-1111-1111-1111-111111111111';
const query = process.argv[2] || 'http testing and debugging';

console.log('\n' + '='.repeat(70));
console.log('  STEP 4: Test Auto Mode Discovery');
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

  // Show user preferences
  console.log('👤 User Preferences:\n');
  try {
    const prefs = await getUserPreferences(AUTO_USER_ID);
    console.log(`   User ID: ${AUTO_USER_ID}`);
    console.log(`   Discovery Mode: ${prefs.discoveryMode}`);
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

  // Run the full resolution
  console.log('\n🚀 Running resolveMissingTool...\n');
  
  const startTime = Date.now();
  const result = await resolveMissingTool(AUTO_USER_ID, query);
  const totalTime = Date.now() - startTime;

  // Display results
  console.log('📊 Resolution Result:\n');
  
  console.log('   ┌' + '─'.repeat(50) + '┐');
  console.log(`   │ Resolved:     ${result.resolved ? '✅ YES' : '❌ NO'}`.padEnd(53) + '│');
  console.log(`   │ Manual Mode:  ${result.manualMode ? '🖐️  YES' : '🤖 NO (auto)'}`.padEnd(53) + '│');
  console.log(`   │ Candidates:   ${result.candidates.length} tool(s)`.padEnd(53) + '│');
  console.log('   └' + '─'.repeat(50) + '┘');

  if (result.error) {
    console.log(`\n   ⚠️  Error/Status: ${result.error}`);
  }

  if (result.candidates.length > 0) {
    console.log('\n   📦 Candidates (after filtering & ranking):');
    console.log('   ┌───┬────────────────────────────┬────────────┬────────┐');
    console.log('   │ # │ Name                       │ Price      │ Rating │');
    console.log('   ├───┼────────────────────────────┼────────────┼────────┤');
    
    result.candidates.forEach((tool, i) => {
      const name = tool.name.substring(0, 26).padEnd(26);
      const price = `$${tool.price_per_call.toFixed(4)}`.padEnd(10);
      const rating = tool.average_rating === -1 ? 'N/A   ' : `${tool.average_rating.toFixed(1)}★  `;
      const marker = i === 0 ? ' ← Selected' : '';
      console.log(`   │ ${(i + 1).toString().padEnd(1)} │ ${name} │ ${price} │ ${rating} │${marker}`);
    });
    console.log('   └───┴────────────────────────────┴────────────┴────────┘');
  }

  if (result.selectedTool) {
    console.log('\n   🎯 Selected Tool:');
    console.log(`      Name: ${result.selectedTool.name}`);
    console.log(`      ID: ${result.selectedTool.id}`);
    console.log(`      Endpoint: ${result.selectedTool.endpoint_url}`);
    console.log(`      Price: $${result.selectedTool.price_per_call.toFixed(4)}/call`);
  }

  if (result.installResult) {
    console.log('\n   📥 Installation Result:');
    console.log(`      Success: ${result.installResult.success ? '✅' : '❌'}`);
    console.log(`      Message: ${result.installResult.message}`);
    if (result.installResult.canonicalName) {
      console.log(`      Canonical Name: ${result.installResult.canonicalName}`);
    }
    console.log(`      New Install: ${result.installResult.isNewInstall ? 'Yes' : 'No (already existed)'}`);
  }

  console.log(`\n   ⏱️  Total Time: ${totalTime}ms`);

  // Quick boolean check
  console.log('\n' + '-'.repeat(70));
  console.log('\n🔍 Quick Check (tryResolveMissingTool):\n');
  
  const quickResult = await tryResolveMissingTool(AUTO_USER_ID, query);
  console.log(`   tryResolveMissingTool returned: ${quickResult ? '✅ true' : '❌ false'}`);

  console.log('\n' + '='.repeat(70));
  console.log('  Auto Mode Test Complete!');
  console.log('='.repeat(70) + '\n');

  if (result.resolved) {
    console.log('✅ SUCCESS: Tool was discovered and installed automatically!');
    console.log('\n📝 The tool is now available for use.');
  } else {
    console.log('ℹ️  No tool was installed. Check the error/status above.');
  }
  console.log('');
}

main().catch(console.error);

