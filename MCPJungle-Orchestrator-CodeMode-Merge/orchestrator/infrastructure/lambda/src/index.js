/**
 * Lambda MCP Adapter - Dynamic Tool Loader
 *
 * This Lambda function dynamically loads and executes MCP (Model Context Protocol)
 * tools from S3. It handles:
 *
 * 1. Parsing tool name and version from query parameters
 * 2. Downloading and caching tool packages from S3 (supports .zip, .tar.gz)
 * 3. Resolving execution runtime (Node.js, Python, Binary) via mcp.json or heuristics
 * 4. Spawning the tool binary as a subprocess
 * 5. Piping JSON-RPC requests/responses via stdin/stdout
 * 6. Streaming SSE responses back to the caller
 *
 * @module lambda-mcp-adapter
 */

const { spawn, execSync } = require('child_process');
const { streamifyResponse } = require('lambda-stream');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// ==============================================================================
// Configuration
// ==============================================================================

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ARTIFACT_BUCKET = process.env.ARTIFACT_BUCKET;
const BASE_PATH = '/tmp/mcp-tools';

// Timeouts
const POST_TIMEOUT_MS = 120 * 1000;      // 120 seconds for tool calls
const GET_TIMEOUT_MS = 14 * 60 * 1000;   // 14 minutes for SSE connections

// ==============================================================================
// Helper Functions
// ==============================================================================

function log(level, message, data = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
}

async function packageExistsInS3(bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

/**
 * Downloads a package from S3 and extracts it.
 * Supports .zip, .tar.gz, .tgz
 */
async function downloadAndExtract(toolName, version, installDir) {
  const bucket = ARTIFACT_BUCKET;
  const extensions = ['.zip', '.tar.gz', '.tgz', '.mcpb'];
  
  let foundKey = null;
  let foundExt = null;

  // 1. Detect File Type
  for (const ext of extensions) {
    const key = `packages/${toolName}/${version}${ext}`;
    if (await packageExistsInS3(bucket, key)) {
      foundKey = key;
      foundExt = ext;
      break;
    }
  }

  if (!foundKey) {
    throw new Error(`Package not found in S3 for ${toolName}@${version} (checked ${extensions.join(', ')})`);
  }

  const downloadPath = path.join(BASE_PATH, `${toolName}-${version}-download${foundExt}`);
  log('INFO', 'Downloading package from S3', { bucket, key: foundKey });

  // 2. Download
  const command = new GetObjectCommand({ Bucket: bucket, Key: foundKey });
  const s3Response = await s3.send(command);
  const byteArray = await s3Response.Body.transformToByteArray();
  
  log('INFO', 'Package downloaded', { size: byteArray.length });
  fs.writeFileSync(downloadPath, Buffer.from(byteArray));

  // 3. Extract
  log('INFO', 'Extracting package', { installDir, format: foundExt });
  
  try {
    // Ensure install directory exists
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }

    if (foundExt === '.zip' || foundExt === '.mcpb') {
      execSync(`unzip -o -q "${downloadPath}" -d "${installDir}"`, {
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } else if (foundExt === '.tar.gz' || foundExt === '.tgz') {
      execSync(`tar -xzf "${downloadPath}" -C "${installDir}"`, {
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }
  } catch (err) {
    throw new Error(`Failed to extract package: ${err.message}`);
  }

  // Cleanup
  fs.unlinkSync(downloadPath);
  log('INFO', 'Package extracted successfully');
}

/**
 * Resolves the runtime configuration (command, args, env) for a tool.
 * Strategy: manifest.json (Standard) > mcp.json (Custom) > Python Heuristic > Node.js Heuristic
 */
function resolveRuntime(installDir, toolName) {
  const standardManifestPath = path.join(installDir, 'manifest.json');
  const customManifestPath = path.join(installDir, 'mcp.json');

  // Strategy A: Standard Manifest (manifest.json)
  if (fs.existsSync(standardManifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(standardManifestPath, 'utf8'));
      if (manifest.server) {
        let command = manifest.server.command;
        let args = manifest.server.args || [];
        const env = manifest.server.env || {};

        // Normalize command path if relative
        if (command && (command.startsWith('./') || command.startsWith('src/') || command.startsWith('dist/'))) {
          command = path.join(installDir, command);
          if (fs.existsSync(command)) fs.chmodSync(command, '755');
        }

        // Handle simple "python" alias
        if (manifest.server.type === 'python' && !command) {
            // If command is missing but type is python, look for main entry point
            const entry = manifest.server.entry_point || 'main.py';
            command = 'python3';
            args = [path.join(installDir, entry), ...args];
        }

        return { command, args, env };
      }
    } catch (err) {
      log('WARN', 'Failed to parse manifest.json', { error: err.message });
    }
  }

  // Strategy B: Custom Manifest (mcp.json)
  if (fs.existsSync(customManifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(customManifestPath, 'utf8'));
      let command = manifest.executable;
      let args = manifest.args || [];
      const env = manifest.env || {};

      // Normalize command path if it's a relative path in the package
      if (command && (command.startsWith('./') || command.startsWith('src/') || command.startsWith('dist/'))) {
        command = path.join(installDir, command);
        // Ensure executable permissions
        if (fs.existsSync(command)) {
          fs.chmodSync(command, '755');
        }
      }

      // Handle "python" runtime alias if used
      if (manifest.runtime === 'python' && !command.startsWith('/')) {
         // If executable is just a script name, prepend python3
         // e.g. executable: "main.py" -> cmd: "python3", args: ["main.py"]
         if (command.endsWith('.py')) {
             args = [path.join(installDir, manifest.executable), ...args];
             command = 'python3';
         }
      }

      return { command, args, env };
    } catch (err) {
      log('WARN', 'Failed to parse mcp.json', { error: err.message });
    }
  }

  // Strategy B: Python Heuristic
  // Check for common Python entry points
  const pyFiles = ['main.py', 'app.py', 'index.py', '__main__.py'];
  for (const file of pyFiles) {
    const filePath = path.join(installDir, file);
    if (fs.existsSync(filePath)) {
      return {
        command: 'python3',
        args: [filePath],
        env: { PYTHONUNBUFFERED: '1' }
      };
    }
  }

  // Strategy C: Node.js Heuristic (Legacy)
  // Look for binaries in node_modules/.bin
  const binDir = path.join(installDir, 'node_modules', '.bin');
  if (fs.existsSync(binDir)) {
    // 1. Specific matches
    const candidates = [`${toolName}-mcp`, toolName, `mcp-${toolName}`];
    for (const name of candidates) {
      const binPath = path.join(binDir, name);
      if (fs.existsSync(binPath)) {
        return { command: binPath, args: [], env: {} };
      }
    }
    // 2. Fuzzy match
    const files = fs.readdirSync(binDir);
    for (const file of files) {
      if (file.toLowerCase().includes(toolName.toLowerCase())) {
         return { command: path.join(binDir, file), args: [], env: {} };
      }
    }
  }

  // Strategy D: Check for root 'package.json' -> imply Node
  if (fs.existsSync(path.join(installDir, 'package.json'))) {
      if (fs.existsSync(path.join(installDir, 'index.js'))) {
          return { command: 'node', args: [path.join(installDir, 'index.js')], env: {} };
      }
      if (fs.existsSync(path.join(installDir, 'dist', 'index.js'))) {
          return { command: 'node', args: [path.join(installDir, 'dist', 'index.js')], env: {} };
      }
  }

  throw new Error(`Could not resolve runtime execution for tool: ${toolName}`);
}

// ==============================================================================
// Lambda Handler
// ==============================================================================

exports.handler = streamifyResponse(async (event, responseStream, context) => {
  const startTime = Date.now();
  const method = event.requestContext?.http?.method || 'GET';
  
  log('INFO', 'Request received', {
    method,
    queryParams: event.queryStringParameters,
    requestId: context.awsRequestId
  });

  // 1. Parse Request Parameters
  const toolName = event.queryStringParameters?.tool;
  const version = event.queryStringParameters?.version || 'latest';

  if (!toolName) {
    responseStream = awslambda.HttpResponseStream.from(responseStream, { statusCode: 400 });
    responseStream.write(JSON.stringify({ error: "Missing 'tool' query parameter" }));
    responseStream.end();
    return;
  }

  const installDir = path.join(BASE_PATH, `${toolName}-${version}`);

  // 2. Cache Check & Download
  let runtimeConfig = null;
  let isColdStart = false;

  try {
    // Attempt to resolve runtime first to check if already installed
    try {
      runtimeConfig = resolveRuntime(installDir, toolName);
      log('INFO', '🔥 Warm Start: Using cached tool', { toolName });
    } catch (e) {
      // Not installed or broken
      isColdStart = true;
      log('INFO', '❄️ Cold Start: Fetching tool from S3', { toolName, version });
      
      // Ensure base directory exists
      if (!fs.existsSync(BASE_PATH)) {
        fs.mkdirSync(BASE_PATH, { recursive: true });
      }

      await downloadAndExtract(toolName, version, installDir);
      runtimeConfig = resolveRuntime(installDir, toolName);
    }
  } catch (err) {
    log('ERROR', 'Failed to load tool', { error: err.message });
    responseStream = awslambda.HttpResponseStream.from(responseStream, { statusCode: 500 });
    responseStream.write(JSON.stringify({ error: `Failed to load tool: ${err.message}` }));
    responseStream.end();
    return;
  }

  // 3. Setup SSE Response Headers
  const responseMetadata = {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Cold-Start': isColdStart ? 'true' : 'false',
      'X-Tool-Name': toolName
    }
  };
  
  responseStream = awslambda.HttpResponseStream.from(responseStream, responseMetadata);

  // 4. Spawn Tool Process
  const { command, args, env } = runtimeConfig;
  log('INFO', '🚀 Spawning tool process', { command, args });

  const child = spawn(command, args, {
    cwd: installDir,
    env: {
      ...process.env,
      ...env,
      // Ensure Python output is unbuffered for SSE
      PYTHONUNBUFFERED: '1', 
      PATH: `${process.env.PATH}:${installDir}:${path.join(installDir, 'node_modules', '.bin')}`
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let hasExited = false;
  let responseCount = 0;

  // 5. Handle Process Events
  child.on('error', (err) => {
    log('ERROR', 'Process spawn error', { error: err.message });
    if (!hasExited) {
      responseStream.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      hasExited = true;
      responseStream.end();
    }
  });

  child.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) log('DEBUG', 'Tool stderr', { output: text });
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      responseCount++;
      responseStream.write(`event: message\ndata: ${trimmed}\n\n`);
      
      // Check for JSON-RPC response in POST calls
      if (method === 'POST' && trimmed.includes('"jsonrpc"')) {
        setTimeout(() => { if (!hasExited) child.kill('SIGTERM'); }, 50);
      }
    }
  });

  // 6. Send Input (POST)
  if (method === 'POST' && event.body) {
    try {
      const body = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
      child.stdin.write(body + '\n');
    } catch (err) {
      log('ERROR', 'Failed to write to stdin', { error: err.message });
    }
  }

  // 7. Timeout & Cleanup
  const timeoutMs = method === 'POST' ? POST_TIMEOUT_MS : GET_TIMEOUT_MS;

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!hasExited) {
        log('WARN', 'Timeout reached, killing process');
        child.kill('SIGTERM');
        setTimeout(() => { if (!hasExited) child.kill('SIGKILL'); }, 1000);
        resolve();
      }
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      hasExited = true;
      log('INFO', 'Process exited', { code, responseCount, durationMs: Date.now() - startTime });
      if (code !== 0 && code !== null) {
        responseStream.write(`event: error\ndata: ${JSON.stringify({ error: `Tool exited with code ${code}` })}\n\n`);
      }
      resolve();
    });
  });

  responseStream.end();
});
