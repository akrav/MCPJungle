#!/usr/bin/env npx tsx
/**
 * Step 6: Test Edge Cases
 * 
 * Demonstrates error handling and edge cases:
 * 1. No matching tools found
 * 2. All tools filtered out by strict preferences
 * 3. Query with no semantic match
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

const AUTO_USER_ID = '11111111-1111-1111-1111-111111111111';
const STRICT_USER_ID = '33333333-3333-3333-3333-333333333333';

// Initialize Supabase early
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (SUPABASE_URL && SUPABASE_KEY) {
  initializeSupabaseClient({ supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY });
}

console.log('\n' + '='.repeat(70));
console.log('  STEP 6: Test Edge Cases');
console.log('='.repeat(70) + '\n');

interface TestCase {
  name: string;
  userId: string;
  query: string;
  expectedResult: string;
}

const testCases: TestCase[] = [
  {
    name: 'No Semantic Match',
    userId: AUTO_USER_ID,
    query: 'quantum blockchain ai neural network xyz123',
    expectedResult: 'No matching tools (or very low similarity)',
  },
  {
    name: 'All Filtered by Strict Price Cap',
    userId: STRICT_USER_ID,
    query: 'http testing',
    expectedResult: 'Tools found but all filtered out (price > $0.0001)',
  },
  {
    name: 'All Filtered by Strict Rating',
    userId: STRICT_USER_ID,
    query: 'github api',
    expectedResult: 'Tools found but all filtered out (rating < 4.5★)',
  },
  {
    name: 'Empty Query',
    userId: AUTO_USER_ID,
    query: '',
    expectedResult: 'Should still attempt search (may return results)',
  },
];

async function runTestCase(tc: TestCase, index: number) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`\n📋 Test Case ${index + 1}: ${tc.name}\n`);
  console.log(`   Query: "${tc.query || '(empty)'}"`);
  console.log(`   User ID: ${tc.userId.substring(0, 8)}...`);
  console.log(`   Expected: ${tc.expectedResult}`);
  
  try {
    const prefs = await getUserPreferences(tc.userId);
    console.log(`\n   Preferences: mode=${prefs.discoveryMode}, maxPrice=$${prefs.maxPriceCap}, minRating=${prefs.minRatingThreshold}`);
  } catch {
    console.log(`\n   ⚠️  Could not fetch preferences for user`);
  }

  console.log('\n   Running resolveMissingTool...\n');
  
  const startTime = Date.now();
  const result = await resolveMissingTool(tc.userId, tc.query);
  const totalTime = Date.now() - startTime;

  // Display result
  console.log('   Result:');
  console.log(`     Resolved: ${result.resolved ? '✅' : '❌'}`);
  console.log(`     Manual Mode: ${result.manualMode ? 'Yes' : 'No'}`);
  console.log(`     Candidates: ${result.candidates.length}`);
  console.log(`     Error: ${result.error || 'None'}`);
  console.log(`     Time: ${totalTime}ms`);

  // Evaluate
  let passed = false;
  if (tc.name.includes('No Semantic')) {
    passed = result.candidates.length === 0 || !result.resolved;
  } else if (tc.name.includes('Filtered')) {
    passed = result.candidates.length === 0 && result.error?.includes('filtered');
  } else if (tc.name.includes('Empty')) {
    passed = true; // Just checking it doesn't crash
  }

  console.log(`\n   ${passed ? '✅ PASS' : '⚠️  CHECK'}: ${passed ? 'Behaved as expected' : 'Review result'}`);
  
  return passed;
}

async function main() {
  console.log('🧪 Running edge case tests...');
  console.log(`   Total test cases: ${testCases.length}`);

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < testCases.length; i++) {
    try {
      const result = await runTestCase(testCases[i], i);
      if (result) passed++;
      else failed++;
    } catch (error) {
      console.log(`\n   ❌ ERROR: ${(error as Error).message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('  Edge Case Test Summary');
  console.log('='.repeat(70));
  console.log(`
   Total:  ${testCases.length}
   Passed: ${passed} ✅
   Review: ${failed} ⚠️
  `);

  // Additional edge cases to try manually
  console.log('📝 Additional Edge Cases to Try Manually:\n');
  
  console.log('   1. Service Unavailable (stop Supabase):');
  console.log('      - Expected: Search fails gracefully with error message');
  
  console.log('\n   2. Invalid API Key:');
  console.log('      - Set OPENAI_API_KEY to invalid value');
  console.log('      - Expected: Query expansion fails with auth error');
  
  console.log('\n   3. Rate Limiting:');
  console.log('      - Make many rapid requests');
  console.log('      - Expected: Handles 429 errors gracefully');
  
  console.log('\n   4. Very Long Query:');
  console.log('      - Pass a 10,000+ character query');
  console.log('      - Expected: Still works (may truncate)');

  console.log('\n' + '='.repeat(70));
  console.log('  Edge Case Tests Complete!');
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error);

