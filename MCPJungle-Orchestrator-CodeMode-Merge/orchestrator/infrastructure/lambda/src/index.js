/**
 * Lambda MCP Adapter - Dynamic Tool Loader
 *
 * This Lambda function dynamically loads and executes MCP (Model Context Protocol)
 * tools from S3. It handles:
 *
 * 1. Parsing tool name and version from query parameters
 * 2. Downloading and caching tool packages from S3
 * 3. Spawning the tool binary as a subprocess
 * 4. Piping JSON-RPC requests/responses via stdin/stdout
 * 5. Streaming SSE responses back to the caller
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
const POST_TIMEOUT_MS = 120 * 1000;      // 120 seconds for tool calls (increased for slow external APIs)
const GET_TIMEOUT_MS = 14 * 60 * 1000;   // 14 minutes for SSE connections

// ==============================================================================
// Helper Functions
// ==============================================================================

/**
 * Logs a message with timestamp and level
 * @param {string} level - Log level (INFO, WARN, ERROR, DEBUG)
 * @param {string} message - Log message
 * @param {object} [data] - Optional data to include
 */
function log(level, message, data = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
}

/**
 * Checks if a tool package exists in S3
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>}
 */
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
 * Downloads a package from S3 and extracts it
 * @param {string} toolName - Name of the tool
 * @param {string} version - Version of the tool
 * @param {string} installDir - Directory to extract to
 * @returns {Promise<void>}
 */
async function downloadAndExtract(toolName, version, installDir) {
  const bucket = ARTIFACT_BUCKET;
  const key = `packages/${toolName}/${version}.zip`;
  const zipPath = path.join(BASE_PATH, `${toolName}-${version}-download.zip`);

  log('INFO', 'Downloading package from S3', { bucket, key });

  // Check if package exists
  const exists = await packageExistsInS3(bucket, key);
  if (!exists) {
    throw new Error(`Package not found in S3: s3://${bucket}/${key}`);
  }

  // Download to disk
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const s3Response = await s3.send(command);
  const byteArray = await s3Response.Body.transformToByteArray();
  
  log('INFO', 'Package downloaded', { size: byteArray.length });
  
  fs.writeFileSync(zipPath, Buffer.from(byteArray));

  // Extract using native unzip (preserves symlinks)
  log('INFO', 'Extracting package', { installDir });
  
  try {
    execSync(`unzip -o -q "${zipPath}" -d "${installDir}"`, {
      timeout: 60000, // 60 second timeout for extraction
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    throw new Error(`Failed to extract package: ${err.message}`);
  }

  // Clean up zip file
  fs.unlinkSync(zipPath);

  log('INFO', 'Package extracted successfully');
}

/**
 * Finds the binary path for a tool
 * @param {string} installDir - Installation directory
 * @param {string} toolName - Name of the tool
 * @returns {string|null} - Path to the binary or null if not found
 */
function findBinaryPath(installDir, toolName) {
  // Common patterns for MCP tool binaries
  const patterns = [
    path.join(installDir, 'node_modules', '.bin', `${toolName}-mcp`),
    path.join(installDir, 'node_modules', '.bin', toolName),
    path.join(installDir, 'node_modules', '.bin', `mcp-${toolName}`),
  ];

  for (const binPath of patterns) {
    if (fs.existsSync(binPath)) {
      return binPath;
    }
  }

  // Search for any executable in .bin
  const binDir = path.join(installDir, 'node_modules', '.bin');
  if (fs.existsSync(binDir)) {
    const files = fs.readdirSync(binDir);
    log('DEBUG', 'Available binaries in .bin', { files });
    
    // Return the first executable that contains the tool name
    for (const file of files) {
      if (file.toLowerCase().includes(toolName.toLowerCase())) {
        return path.join(binDir, file);
      }
    }
  }

  return null;
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

  // --------------------------------------------------------------------------
  // 1. Parse Request Parameters
  // --------------------------------------------------------------------------

  const toolName = event.queryStringParameters?.tool;
  const version = event.queryStringParameters?.version || 'latest';

  if (!toolName) {
    responseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    responseStream.write(JSON.stringify({
      error: "Missing 'tool' query parameter",
      usage: "?tool=<name>&version=<version>"
    }));
    responseStream.end();
    return;
  }

  if (!ARTIFACT_BUCKET) {
    responseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    responseStream.write(JSON.stringify({
      error: "ARTIFACT_BUCKET environment variable not set"
    }));
    responseStream.end();
    return;
  }

  const installDir = path.join(BASE_PATH, `${toolName}-${version}`);

  // --------------------------------------------------------------------------
  // 2. Cache Check & Download
  // --------------------------------------------------------------------------

  let binPath = findBinaryPath(installDir, toolName);
  let isColdStart = false;

  if (!binPath) {
    isColdStart = true;
    log('INFO', '❄️ Cold Start: Fetching tool from S3', { toolName, version });

    try {
      // Ensure base directory exists
      if (!fs.existsSync(BASE_PATH)) {
        fs.mkdirSync(BASE_PATH, { recursive: true });
      }

      // Download and extract
      await downloadAndExtract(toolName, version, installDir);

      // Find the binary
      binPath = findBinaryPath(installDir, toolName);
      
      if (!binPath) {
        throw new Error(`Binary not found after extraction. Check package structure.`);
      }

      // Make binary executable
      fs.chmodSync(binPath, '755');
      
      log('INFO', 'Tool ready', { binPath, coldStartMs: Date.now() - startTime });
    } catch (err) {
      log('ERROR', 'Failed to load tool', { error: err.message, stack: err.stack });
      
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      responseStream.write(JSON.stringify({
        error: `Failed to load tool: ${err.message}`,
        tool: toolName,
        version: version
      }));
      responseStream.end();
      return;
    }
  } else {
    log('INFO', '🔥 Warm Start: Using cached tool', { toolName, binPath });
  }

  // --------------------------------------------------------------------------
  // 3. Setup SSE Response Headers
  // --------------------------------------------------------------------------

  const responseMetadata = {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Cold-Start': isColdStart ? 'true' : 'false',
      'X-Tool-Name': toolName,
      'X-Tool-Version': version
    }
  };
  
  responseStream = awslambda.HttpResponseStream.from(responseStream, responseMetadata);

  // --------------------------------------------------------------------------
  // 4. Spawn Tool Process
  // --------------------------------------------------------------------------

  log('INFO', '🚀 Spawning tool process', { binPath });

  const child = spawn(binPath, [], {
    cwd: installDir,
    env: {
      ...process.env,
      PATH: `${process.env.PATH}:${installDir}:${path.join(installDir, 'node_modules', '.bin')}`
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let hasExited = false;
  let responseCount = 0;

  // --------------------------------------------------------------------------
  // 5. Handle Process Events
  // --------------------------------------------------------------------------

  child.on('error', (err) => {
    log('ERROR', 'Process spawn error', { error: err.message });
    if (!hasExited) {
      responseStream.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      hasExited = true;
      responseStream.end();
    }
  });

  // Pipe stderr to logs
  child.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      log('DEBUG', 'Tool stderr', { output: text });
    }
  });

  // Pipe stdout to SSE response
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      responseCount++;
      responseStream.write(`event: message\ndata: ${trimmed}\n\n`);

      // For POST requests, check if we got a JSON-RPC response
      if (method === 'POST' && trimmed.includes('"jsonrpc"')) {
        log('INFO', 'JSON-RPC response received, closing process', { responseCount });
        // Give a small delay for any remaining output, then close
        setTimeout(() => {
          if (!hasExited) {
            child.kill('SIGTERM');
          }
        }, 50);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 6. Send Input (for POST requests)
  // --------------------------------------------------------------------------

  if (method === 'POST' && event.body) {
    const body = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
    log('INFO', 'Writing to stdin', { bodyLength: body.length });
    
    try {
      child.stdin.write(body + '\n');
    } catch (err) {
      log('ERROR', 'Failed to write to stdin', { error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // 7. Handle Timeout and Cleanup
  // --------------------------------------------------------------------------

  const timeoutMs = method === 'POST' ? POST_TIMEOUT_MS : GET_TIMEOUT_MS;

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!hasExited) {
        log('WARN', 'Timeout reached, killing process', { timeoutMs });
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!hasExited) {
            child.kill('SIGKILL');
          }
        }, 1000);
        resolve();
      }
    }, timeoutMs);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      hasExited = true;
      
      log('INFO', 'Process exited', { 
        code, 
        signal, 
        responseCount,
        durationMs: Date.now() - startTime 
      });
      
      if (code !== 0 && code !== null) {
        responseStream.write(`event: error\ndata: ${JSON.stringify({ error: `Tool exited with code ${code}` })}\n\n`);
      }
      
      resolve();
    });
  });

  responseStream.end();
});
