#!/usr/bin/env python3
"""
Test MCP Server - Python Implementation
Used to verify the polyglot Lambda adapter supports Python execution.
"""

import sys
import json

def log(message):
    """Log to stderr (visible in CloudWatch but not SSE stream)"""
    print(message, file=sys.stderr, flush=True)

def handle_request(request):
    """Process a JSON-RPC request and return a response."""
    method = request.get("method", "")
    request_id = request.get("id")
    
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {"listChanged": False}
                },
                "serverInfo": {
                    "name": "python-mcp-test",
                    "version": "1.0.0"
                }
            }
        }
    
    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "tools": [
                    {
                        "name": "echo",
                        "description": "Echoes back the input",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "message": {"type": "string"}
                            },
                            "required": ["message"]
                        }
                    }
                ]
            }
        }
    
    elif method == "tools/call":
        params = request.get("params", {})
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        if tool_name == "echo":
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Echo: {arguments.get('message', '')}"
                        }
                    ]
                }
            }
    
    # Unknown method
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {
            "code": -32601,
            "message": f"Method not found: {method}"
        }
    }

def main():
    # Check for flags (used by manifest/mcp.json tests)
    if "--manifest-test" in sys.argv:
        log("MANIFEST.JSON strategy detected via --manifest-test flag")
    if "--custom-test" in sys.argv:
        log("MCP.JSON strategy detected via --custom-test flag")
    if "--verbose" in sys.argv:
        log("Verbose mode enabled")
    
    log("Python MCP Test Server started")
    
    # Read from stdin line by line
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            request = json.loads(line)
            log(f"Received request: {request.get('method', 'unknown')}")
            
            response = handle_request(request)
            
            # Output to stdout (streamed via SSE)
            print(json.dumps(response), flush=True)
            
        except json.JSONDecodeError as e:
            log(f"JSON parse error: {e}")
            error_response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": "Parse error"
                }
            }
            print(json.dumps(error_response), flush=True)

if __name__ == "__main__":
    main()
