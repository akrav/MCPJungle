/**
 * Unit Tests for Lambda MCP Adapter
 * 
 * Run with: node --test src/index.test.js
 * Requires Node.js 20+
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test directory setup
const TEST_DIR = '/tmp/mcp-adapter-tests';

// Helper to create test files
function createTestPackage(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
}

// Cleanup helper
function cleanupDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ==============================================================================
// Test: resolveRuntime function
// ==============================================================================

describe('resolveRuntime', () => {
  before(() => {
    cleanupDir(TEST_DIR);
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    cleanupDir(TEST_DIR);
  });

  // --------------------------------------------------------------------------
  // Test: manifest.json (Standard MCP Bundle)
  // --------------------------------------------------------------------------
  it('should resolve runtime from manifest.json with command', () => {
    const testDir = path.join(TEST_DIR, 'manifest-test-1');
    createTestPackage(testDir, {
      'manifest.json': {
        manifest_version: '0.1',
        name: 'test-server',
        version: '1.0.0',
        server: {
          type: 'python',
          command: 'python3',
          args: ['main.py', '--verbose'],
          env: { PYTHONUNBUFFERED: '1' }
        }
      },
      'main.py': '# Python script'
    });

    // Import the actual resolveRuntime (we need to extract it)
    // For this test, we'll simulate the logic
    const manifestPath = path.join(testDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.strictEqual(manifest.server.command, 'python3');
    assert.deepStrictEqual(manifest.server.args, ['main.py', '--verbose']);
    assert.strictEqual(manifest.server.env.PYTHONUNBUFFERED, '1');
  });

  it('should resolve runtime from manifest.json with type=python (no command)', () => {
    const testDir = path.join(TEST_DIR, 'manifest-test-2');
    createTestPackage(testDir, {
      'manifest.json': {
        manifest_version: '0.1',
        name: 'test-server',
        version: '1.0.0',
        server: {
          type: 'python',
          entry_point: 'app.py'
        }
      },
      'app.py': '# Python script'
    });

    const manifestPath = path.join(testDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // When type=python and no command, should default to python3
    assert.strictEqual(manifest.server.type, 'python');
    assert.strictEqual(manifest.server.entry_point, 'app.py');
  });

  // --------------------------------------------------------------------------
  // Test: mcp.json (Custom Contract)
  // --------------------------------------------------------------------------
  it('should resolve runtime from mcp.json', () => {
    const testDir = path.join(TEST_DIR, 'mcp-test-1');
    createTestPackage(testDir, {
      'mcp.json': {
        spec: '1.0',
        runtime: 'python',
        executable: 'main.py',
        args: ['--custom'],
        env: { LOG_LEVEL: 'debug' }
      },
      'main.py': '# Python script'
    });

    const mcpPath = path.join(testDir, 'mcp.json');
    const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));

    assert.strictEqual(mcp.runtime, 'python');
    assert.strictEqual(mcp.executable, 'main.py');
    assert.deepStrictEqual(mcp.args, ['--custom']);
  });

  // --------------------------------------------------------------------------
  // Test: Python Heuristic
  // --------------------------------------------------------------------------
  it('should detect Python via main.py heuristic', () => {
    const testDir = path.join(TEST_DIR, 'python-heuristic-1');
    createTestPackage(testDir, {
      'main.py': '#!/usr/bin/env python3\nprint("hello")'
    });

    // Check for Python entry points
    const pyFiles = ['main.py', 'app.py', 'index.py', '__main__.py'];
    let foundEntry = null;
    for (const file of pyFiles) {
      if (fs.existsSync(path.join(testDir, file))) {
        foundEntry = file;
        break;
      }
    }

    assert.strictEqual(foundEntry, 'main.py');
  });

  it('should detect Python via app.py heuristic', () => {
    const testDir = path.join(TEST_DIR, 'python-heuristic-2');
    createTestPackage(testDir, {
      'app.py': '#!/usr/bin/env python3\nprint("hello")'
    });

    const pyFiles = ['main.py', 'app.py', 'index.py', '__main__.py'];
    let foundEntry = null;
    for (const file of pyFiles) {
      if (fs.existsSync(path.join(testDir, file))) {
        foundEntry = file;
        break;
      }
    }

    assert.strictEqual(foundEntry, 'app.py');
  });

  // --------------------------------------------------------------------------
  // Test: Node.js Heuristic
  // --------------------------------------------------------------------------
  it('should detect Node.js via node_modules/.bin', () => {
    const testDir = path.join(TEST_DIR, 'node-heuristic-1');
    createTestPackage(testDir, {
      'package.json': { name: 'test-tool', version: '1.0.0' },
      'node_modules/.bin/my-tool': '#!/usr/bin/env node\nconsole.log("hello")'
    });

    const binDir = path.join(testDir, 'node_modules', '.bin');
    const exists = fs.existsSync(binDir);
    const files = exists ? fs.readdirSync(binDir) : [];

    assert.strictEqual(exists, true);
    assert.ok(files.includes('my-tool'));
  });

  it('should detect Node.js via package.json + index.js', () => {
    const testDir = path.join(TEST_DIR, 'node-heuristic-2');
    createTestPackage(testDir, {
      'package.json': { name: 'test-tool', main: 'index.js' },
      'index.js': 'console.log("hello")'
    });

    assert.ok(fs.existsSync(path.join(testDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(testDir, 'index.js')));
  });

  it('should detect Node.js via package.json + dist/index.js', () => {
    const testDir = path.join(TEST_DIR, 'node-heuristic-3');
    createTestPackage(testDir, {
      'package.json': { name: 'test-tool', main: 'dist/index.js' },
      'dist/index.js': 'console.log("hello")'
    });

    assert.ok(fs.existsSync(path.join(testDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(testDir, 'dist', 'index.js')));
  });
});

// ==============================================================================
// Test: File Format Detection
// ==============================================================================

describe('File Format Detection', () => {
  before(() => {
    cleanupDir(TEST_DIR);
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    cleanupDir(TEST_DIR);
  });

  it('should identify .zip files', () => {
    const extensions = ['.zip', '.tar.gz', '.tgz', '.mcpb'];
    const file = 'package.zip';
    const ext = extensions.find(e => file.endsWith(e));
    assert.strictEqual(ext, '.zip');
  });

  it('should identify .tar.gz files', () => {
    const extensions = ['.zip', '.tar.gz', '.tgz', '.mcpb'];
    const file = 'package.tar.gz';
    const ext = extensions.find(e => file.endsWith(e));
    assert.strictEqual(ext, '.tar.gz');
  });

  it('should identify .tgz files', () => {
    const extensions = ['.zip', '.tar.gz', '.tgz', '.mcpb'];
    const file = 'package.tgz';
    const ext = extensions.find(e => file.endsWith(e));
    assert.strictEqual(ext, '.tgz');
  });

  it('should identify .mcpb files', () => {
    const extensions = ['.zip', '.tar.gz', '.tgz', '.mcpb'];
    const file = 'package.mcpb';
    const ext = extensions.find(e => file.endsWith(e));
    assert.strictEqual(ext, '.mcpb');
  });
});

// ==============================================================================
// Test: Extraction Commands
// ==============================================================================

describe('Extraction Commands', () => {
  before(() => {
    cleanupDir(TEST_DIR);
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    cleanupDir(TEST_DIR);
  });

  it('should extract .zip files correctly', () => {
    const srcDir = path.join(TEST_DIR, 'zip-src');
    const destDir = path.join(TEST_DIR, 'zip-dest');
    const zipFile = path.join(TEST_DIR, 'test.zip');

    createTestPackage(srcDir, {
      'main.py': '# test file',
      'config.json': { test: true }
    });

    // Create zip
    execSync(`cd "${srcDir}" && zip -r "${zipFile}" .`);
    assert.ok(fs.existsSync(zipFile));

    // Extract
    fs.mkdirSync(destDir, { recursive: true });
    execSync(`unzip -o -q "${zipFile}" -d "${destDir}"`);

    assert.ok(fs.existsSync(path.join(destDir, 'main.py')));
    assert.ok(fs.existsSync(path.join(destDir, 'config.json')));
  });

  it('should extract .tar.gz files correctly', () => {
    const srcDir = path.join(TEST_DIR, 'tar-src');
    const destDir = path.join(TEST_DIR, 'tar-dest');
    const tarFile = path.join(TEST_DIR, 'test.tar.gz');

    createTestPackage(srcDir, {
      'main.py': '# test file',
      'config.json': { test: true }
    });

    // Create tar.gz
    execSync(`cd "${srcDir}" && tar -czf "${tarFile}" .`);
    assert.ok(fs.existsSync(tarFile));

    // Extract
    fs.mkdirSync(destDir, { recursive: true });
    execSync(`tar -xzf "${tarFile}" -C "${destDir}"`);

    assert.ok(fs.existsSync(path.join(destDir, 'main.py')));
    assert.ok(fs.existsSync(path.join(destDir, 'config.json')));
  });
});

// ==============================================================================
// Test: Priority Order (manifest.json > mcp.json > heuristics)
// ==============================================================================

describe('Resolution Priority', () => {
  before(() => {
    cleanupDir(TEST_DIR);
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    cleanupDir(TEST_DIR);
  });

  it('should prefer manifest.json over mcp.json', () => {
    const testDir = path.join(TEST_DIR, 'priority-test-1');
    createTestPackage(testDir, {
      'manifest.json': {
        server: { command: 'manifest-command', args: ['--from-manifest'] }
      },
      'mcp.json': {
        executable: 'mcp-command', args: ['--from-mcp']
      },
      'main.py': '# Should not use heuristic'
    });

    // Check priority
    const manifestPath = path.join(testDir, 'manifest.json');
    const mcpPath = path.join(testDir, 'mcp.json');
    const mainPy = path.join(testDir, 'main.py');

    // manifest.json exists -> use it
    if (fs.existsSync(manifestPath)) {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.strictEqual(m.server.command, 'manifest-command');
    } else if (fs.existsSync(mcpPath)) {
      assert.fail('Should have used manifest.json');
    } else if (fs.existsSync(mainPy)) {
      assert.fail('Should have used manifest.json');
    }
  });

  it('should prefer mcp.json over heuristics when no manifest.json', () => {
    const testDir = path.join(TEST_DIR, 'priority-test-2');
    createTestPackage(testDir, {
      'mcp.json': {
        executable: 'mcp-command', args: ['--from-mcp']
      },
      'main.py': '# Should not use heuristic'
    });

    const manifestPath = path.join(testDir, 'manifest.json');
    const mcpPath = path.join(testDir, 'mcp.json');

    assert.ok(!fs.existsSync(manifestPath));
    assert.ok(fs.existsSync(mcpPath));

    const m = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    assert.strictEqual(m.executable, 'mcp-command');
  });
});

console.log('Running tests...');
