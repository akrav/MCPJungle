#!/usr/bin/env npx tsx
/**
 * Run All Walkthrough Steps
 * 
 * Executes all walkthrough steps in sequence with pauses for review.
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(message: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      resolve(answer);
    });
  });
}

function runScript(scriptPath: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', scriptPath, ...args], {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  EPIC 4: TOOL DISCOVERY - COMPLETE WALKTHROUGH');
  console.log('═'.repeat(70) + '\n');

  console.log('This walkthrough will demonstrate all Epic 4 features:\n');
  console.log('  1. Verify Database State');
  console.log('  2. Setup Test User Preferences');
  console.log('  3. Test Search Pipeline');
  console.log('  4. Test Auto Mode Discovery');
  console.log('  5. Test Manual Mode Discovery');
  console.log('  6. Test Edge Cases');
  console.log('  7. (Optional) Run Admin API Server');
  console.log('');

  await prompt('Press Enter to begin...');

  // Step 1
  console.log('\n' + '─'.repeat(70) + '\n');
  await runScript(path.join(__dirname, '01-verify-database.ts'));
  await prompt('\nPress Enter to continue to Step 2...');

  // Step 2
  console.log('\n' + '─'.repeat(70) + '\n');
  await runScript(path.join(__dirname, '02-setup-preferences.ts'));
  await prompt('\nPress Enter to continue to Step 3...');

  // Step 3
  console.log('\n' + '─'.repeat(70) + '\n');
  const searchQuery = await prompt('Enter search query (or press Enter for "weather forecast"): ');
  await runScript(path.join(__dirname, '03-test-search.ts'), [searchQuery || 'weather forecast']);
  await prompt('\nPress Enter to continue to Step 4...');

  // Step 4
  console.log('\n' + '─'.repeat(70) + '\n');
  const autoQuery = await prompt('Enter query for auto-mode (or press Enter for "http testing"): ');
  await runScript(path.join(__dirname, '04-test-auto-mode.ts'), [autoQuery || 'http testing']);
  await prompt('\nPress Enter to continue to Step 5...');

  // Step 5
  console.log('\n' + '─'.repeat(70) + '\n');
  const manualQuery = await prompt('Enter query for manual-mode (or press Enter for "github api"): ');
  await runScript(path.join(__dirname, '05-test-manual-mode.ts'), [manualQuery || 'github api']);
  await prompt('\nPress Enter to continue to Step 6...');

  // Step 6
  console.log('\n' + '─'.repeat(70) + '\n');
  await runScript(path.join(__dirname, '06-test-edge-cases.ts'));

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('  WALKTHROUGH COMPLETE!');
  console.log('═'.repeat(70));
  console.log(`
  You have successfully tested:

  ✅ Database connectivity and state verification
  ✅ User preference configuration
  ✅ Search pipeline (query expansion → embedding → vector search)
  ✅ Auto mode discovery (search → filter → rank → install)
  ✅ Manual mode discovery (search → filter → pause → wait for input)
  ✅ Edge cases (no matches, filtered out, etc.)

  Next Steps:
  
  1. To test manual mode with the Admin API:
     npx tsx scripts/walkthrough/07-admin-server.ts
     
     Then in another terminal:
     npx tsx scripts/walkthrough/05-test-manual-mode.ts
     
     And use curl to select a tool.

  2. To integrate with the full orchestrator:
     See docs/DISCOVERY.md

  3. To add more tools to the registry:
     Insert into the 'tools' table in Supabase
     Then run: npx tsx scripts/seed-embeddings.ts
  `);

  const runAdmin = await prompt('\nWould you like to start the Admin API server? (y/n): ');
  
  if (runAdmin.toLowerCase() === 'y') {
    console.log('\nStarting Admin API server...\n');
    rl.close();
    await runScript(path.join(__dirname, '07-admin-server.ts'));
  } else {
    console.log('\n✅ Walkthrough complete. Goodbye!\n');
    rl.close();
  }
}

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});

