#!/usr/bin/env npx tsx
/**
 * Step 7: Run Admin API Server
 * 
 * Starts an Express server with the Admin API for manual tool selection.
 * 
 * Endpoints:
 *   POST /admin/select-tool  - Select or reject a pending tool
 *   GET  /admin/pending      - List pending selections
 *   GET  /admin/health       - Health check
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

import { initializeSupabaseClient } from '../../src/discovery/supabase/client.js';
import { createAdminRouter } from '../../src/server/admin.js';
import { 
  getPendingCount, 
  startCleanupInterval,
  stopCleanupInterval 
} from '../../src/discovery/interaction/pendingState.js';

const PORT = process.env.ADMIN_PORT || 8080;

console.log('\n' + '='.repeat(70));
console.log('  STEP 7: Admin API Server');
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

  // Create Express app
  const app = express();
  app.use(express.json());

  // Mount admin router
  app.use('/admin', createAdminRouter());

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'MCP Orchestrator Admin API',
      endpoints: [
        'POST /admin/select-tool',
        'GET /admin/pending',
        'GET /admin/health',
      ],
      pendingSelections: getPendingCount(),
    });
  });

  // Start cleanup interval
  startCleanupInterval();

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`🚀 Admin API Server running at http://localhost:${PORT}\n`);
    console.log('Available endpoints:');
    console.log(`   GET  http://localhost:${PORT}/`);
    console.log(`   GET  http://localhost:${PORT}/admin/health`);
    console.log(`   GET  http://localhost:${PORT}/admin/pending`);
    console.log(`   POST http://localhost:${PORT}/admin/select-tool`);
    console.log('\n' + '-'.repeat(70));
    console.log('\n📝 Example Commands:\n');
    console.log('   # Check health');
    console.log(`   curl http://localhost:${PORT}/admin/health`);
    console.log('\n   # List pending selections');
    console.log(`   curl http://localhost:${PORT}/admin/pending`);
    console.log('\n   # Select a tool (replace requestId and toolId)');
    console.log(`   curl -X POST http://localhost:${PORT}/admin/select-tool \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"requestId":"YOUR_REQ_ID","toolId":"YOUR_TOOL_ID","action":"select"}\'');
    console.log('\n   # Reject all options (replace requestId)');
    console.log(`   curl -X POST http://localhost:${PORT}/admin/select-tool \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"requestId":"YOUR_REQ_ID","action":"reject"}\'');
    console.log('\n' + '-'.repeat(70));
    console.log('\n⏳ Waiting for requests... (Ctrl+C to stop)\n');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    stopCleanupInterval();
    server.close(() => {
      console.log('✅ Server stopped.\n');
      process.exit(0);
    });
  });
}

main().catch(console.error);

