#!/usr/bin/env npx tsx
/**
 * Step 2: Setup Test User Preferences
 * 
 * Creates test users with different discovery mode configurations.
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

console.log('\n' + '='.repeat(70));
console.log('  STEP 2: Setup Test User Preferences');
console.log('='.repeat(70) + '\n');

// Test user IDs (using UUIDs for consistency)
const TEST_USERS = {
  auto: '11111111-1111-1111-1111-111111111111',
  manual: '22222222-2222-2222-2222-222222222222',
  strict: '33333333-3333-3333-3333-333333333333',
};

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Creating test user preferences...\n');

  // User 1: Auto mode with relaxed filters
  console.log('👤 Creating AUTO MODE user...');
  const { error: err1 } = await supabase
    .from('user_preferences_orchestrator')
    .upsert({
      user_id: TEST_USERS.auto,
      discovery_mode: 'auto',
      auto_install_strategy: 'balanced',
      max_price_cap: 1.0,           // $1 per call max
      min_rating_threshold: -2,      // Allow unrated tools (rating=-1)
    }, { onConflict: 'user_id' });

  if (err1) {
    console.error('   ❌ Error:', err1.message);
  } else {
    console.log('   ✅ Created: auto-mode-user');
    console.log(`      ID: ${TEST_USERS.auto}`);
    console.log('      Mode: auto');
    console.log('      Strategy: balanced');
    console.log('      Max Price: $1.00');
    console.log('      Min Rating: -2 (allows unrated)');
  }

  // User 2: Manual mode
  console.log('\n👤 Creating MANUAL MODE user...');
  const { error: err2 } = await supabase
    .from('user_preferences_orchestrator')
    .upsert({
      user_id: TEST_USERS.manual,
      discovery_mode: 'manual',
      auto_install_strategy: 'cheapest',
      max_price_cap: 0.50,           // $0.50 per call max
      min_rating_threshold: -2,       // Allow unrated tools
    }, { onConflict: 'user_id' });

  if (err2) {
    console.error('   ❌ Error:', err2.message);
  } else {
    console.log('   ✅ Created: manual-mode-user');
    console.log(`      ID: ${TEST_USERS.manual}`);
    console.log('      Mode: manual');
    console.log('      Strategy: cheapest');
    console.log('      Max Price: $0.50');
    console.log('      Min Rating: -2 (allows unrated)');
  }

  // User 3: Strict filters (for edge case testing)
  console.log('\n👤 Creating STRICT FILTER user...');
  const { error: err3 } = await supabase
    .from('user_preferences_orchestrator')
    .upsert({
      user_id: TEST_USERS.strict,
      discovery_mode: 'auto',
      auto_install_strategy: 'rating',
      max_price_cap: 0.0001,         // Very strict: $0.0001 max
      min_rating_threshold: 4.5,      // Very strict: 4.5★ minimum
    }, { onConflict: 'user_id' });

  if (err3) {
    console.error('   ❌ Error:', err3.message);
  } else {
    console.log('   ✅ Created: strict-filter-user');
    console.log(`      ID: ${TEST_USERS.strict}`);
    console.log('      Mode: auto');
    console.log('      Strategy: rating');
    console.log('      Max Price: $0.0001 (very strict!)');
    console.log('      Min Rating: 4.5★ (very strict!)');
  }

  // Verify
  console.log('\n' + '-'.repeat(50));
  console.log('Verifying preferences...\n');

  const { data: prefs } = await supabase
    .from('user_preferences_orchestrator')
    .select('*')
    .in('user_id', Object.values(TEST_USERS));

  console.log(`✅ ${prefs?.length || 0} test users configured:\n`);
  
  console.log('┌──────────────────────────────────────┬──────────┬───────────┬──────────┬────────────┐');
  console.log('│ User ID                              │ Mode     │ Strategy  │ Max $    │ Min Rating │');
  console.log('├──────────────────────────────────────┼──────────┼───────────┼──────────┼────────────┤');
  
  prefs?.forEach(p => {
    const id = p.user_id.substring(0, 36);
    const mode = p.discovery_mode.padEnd(8);
    const strat = p.auto_install_strategy.padEnd(9);
    const price = `$${p.max_price_cap.toFixed(4)}`.padEnd(8);
    const rating = p.min_rating_threshold.toString().padEnd(10);
    console.log(`│ ${id} │ ${mode} │ ${strat} │ ${price} │ ${rating} │`);
  });
  console.log('└──────────────────────────────────────┴──────────┴───────────┴──────────┴────────────┘');

  console.log('\n📝 Use these user IDs in the following tests:');
  console.log(`   AUTO mode:   ${TEST_USERS.auto}`);
  console.log(`   MANUAL mode: ${TEST_USERS.manual}`);
  console.log(`   STRICT mode: ${TEST_USERS.strict}`);
  console.log('\n✅ User preferences setup complete!\n');
}

main().catch(console.error);

