package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mcpjungle/mcpjungle/internal/model"
)

// lambdaClientTimeout is the default timeout for Lambda HTTP requests
const lambdaClientTimeout = 60 * time.Second

// LambdaClient implements an MCP client that communicates with Lambda functions.
// It sends JSON-RPC requests to the Lambda function URL and parses SSE responses.
type LambdaClient struct {
	config     *model.LambdaConfig
	httpClient *http.Client
	toolURL    string
}

// newLambdaClient creates a new Lambda client for the given MCP server.
func newLambdaClient(s *model.McpServer) (*LambdaClient, error) {
	config, err := s.GetLambdaConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get Lambda config: %w", err)
	}

	// Build the full tool URL with query parameters
	toolURL, err := buildLambdaToolURL(config)
	if err != nil {
		return nil, fmt.Errorf("failed to build Lambda tool URL: %w", err)
	}

	client := &LambdaClient{
		config: config,
		httpClient: &http.Client{
			Timeout: lambdaClientTimeout,
		},
		toolURL: toolURL,
	}

	return client, nil
}

// buildLambdaToolURL constructs the Lambda function URL with query parameters
func buildLambdaToolURL(config *model.LambdaConfig) (string, error) {
	baseURL := config.FunctionURL

	// Parse and rebuild the URL to ensure proper formatting
	u, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid function URL: %w", err)
	}

	// Add query parameters
	q := u.Query()
	q.Set("tool", config.ToolName)
	q.Set("version", config.ToolVersion)
	u.RawQuery = q.Encode()

	return u.String(), nil
}

// CallTool sends a tool call request to the Lambda function and returns the result.
// It handles SSE responses and parses JSON-RPC from the SSE data frames.
func (c *LambdaClient) CallTool(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	// Build JSON-RPC request
	jsonRPCRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]interface{}{
			"name":      request.Params.Name,
			"arguments": request.Params.Arguments,
		},
	}

	return c.sendRequest(ctx, jsonRPCRequest)
}

// Initialize sends an initialization request to the Lambda function.
func (c *LambdaClient) Initialize(ctx context.Context) (*mcp.InitializeResult, error) {
	jsonRPCRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]interface{}{
			"protocolVersion": mcp.LATEST_PROTOCOL_VERSION,
			"capabilities":    map[string]interface{}{},
			"clientInfo": map[string]interface{}{
				"name":    "mcpjungle-lambda-client",
				"version": "1.0.0",
			},
		},
	}

	result, err := c.sendRawRequest(ctx, jsonRPCRequest)
	if err != nil {
		return nil, err
	}

	// Parse the result into InitializeResult
	var initResult mcp.InitializeResult
	if resultData, ok := result["result"]; ok {
		resultBytes, err := json.Marshal(resultData)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal result: %w", err)
		}
		if err := json.Unmarshal(resultBytes, &initResult); err != nil {
			return nil, fmt.Errorf("failed to unmarshal initialize result: %w", err)
		}
	}

	return &initResult, nil
}

// ListTools sends a tools/list request to the Lambda function.
func (c *LambdaClient) ListTools(ctx context.Context) (*mcp.ListToolsResult, error) {
	jsonRPCRequest := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/list",
		"params":  map[string]interface{}{},
	}

	result, err := c.sendRawRequest(ctx, jsonRPCRequest)
	if err != nil {
		return nil, err
	}

	// Parse the result into ListToolsResult
	var listResult mcp.ListToolsResult
	if resultData, ok := result["result"]; ok {
		resultBytes, err := json.Marshal(resultData)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal result: %w", err)
		}
		if err := json.Unmarshal(resultBytes, &listResult); err != nil {
			return nil, fmt.Errorf("failed to unmarshal tools list result: %w", err)
		}
	}

	return &listResult, nil
}

// sendRequest sends a JSON-RPC request and parses the CallToolResult
func (c *LambdaClient) sendRequest(ctx context.Context, request map[string]interface{}) (*mcp.CallToolResult, error) {
	result, err := c.sendRawRequest(ctx, request)
	if err != nil {
		return nil, err
	}

	// Check for error in response
	if errData, ok := result["error"]; ok {
		errBytes, _ := json.Marshal(errData)
		return nil, fmt.Errorf("Lambda returned error: %s", string(errBytes))
	}

	// Parse the result into CallToolResult
	var callResult mcp.CallToolResult
	if resultData, ok := result["result"]; ok {
		resultBytes, err := json.Marshal(resultData)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal result: %w", err)
		}
		if err := json.Unmarshal(resultBytes, &callResult); err != nil {
			return nil, fmt.Errorf("failed to unmarshal call tool result: %w", err)
		}
	}

	return &callResult, nil
}

// sendRawRequest sends a JSON-RPC request to the Lambda function and returns the raw response.
func (c *LambdaClient) sendRawRequest(ctx context.Context, request map[string]interface{}) (map[string]interface{}, error) {
	// Serialize request body
	reqBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	log.Printf("[Lambda] Sending request to %s: %s", c.toolURL, string(reqBody))

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.toolURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	// Send request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Lambda returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse SSE response
	return c.parseSSEResponse(resp.Body)
}

// parseSSEResponse reads an SSE stream and extracts the JSON-RPC response.
// SSE format: "event: message\ndata: {...json...}\n\n"
func (c *LambdaClient) parseSSEResponse(body io.Reader) (map[string]interface{}, error) {
	scanner := bufio.NewScanner(body)
	var result map[string]interface{}

	for scanner.Scan() {
		line := scanner.Text()

		// Skip empty lines and event lines
		if line == "" || strings.HasPrefix(line, "event:") {
			continue
		}

		// Parse data lines
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")

			// Try to parse as JSON-RPC response
			var jsonData map[string]interface{}
			if err := json.Unmarshal([]byte(data), &jsonData); err != nil {
				log.Printf("[Lambda] Skipping non-JSON data: %s", data)
				continue
			}

			// Check if this is a JSON-RPC response (has "jsonrpc" field)
			if _, ok := jsonData["jsonrpc"]; ok {
				result = jsonData
				log.Printf("[Lambda] Received JSON-RPC response")
				// Continue reading in case there's more, but we have a result
			}

			// Check for error events
			if errMsg, ok := jsonData["error"]; ok {
				return nil, fmt.Errorf("Lambda error: %v", errMsg)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading SSE stream: %w", err)
	}

	if result == nil {
		return nil, fmt.Errorf("no JSON-RPC response found in SSE stream")
	}

	return result, nil
}

// Close closes the Lambda client (no-op for HTTP client)
func (c *LambdaClient) Close() error {
	return nil
}

// createLambdaMcpServerConn creates a connection to a Lambda-based MCP server.
// This function initializes the connection and verifies the Lambda function is responsive.
func createLambdaMcpServerConn(ctx context.Context, s *model.McpServer) (*LambdaClient, error) {
	client, err := newLambdaClient(s)
	if err != nil {
		return nil, fmt.Errorf("failed to create Lambda client for MCP server %s: %w", s.Name, err)
	}

	// Initialize the connection
	initCtx, cancel := context.WithTimeout(ctx, serverInitRequestTimeout*time.Second)
	defer cancel()

	_, err = client.Initialize(initCtx)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Lambda MCP server %s: %w", s.Name, err)
	}

	log.Printf("[Lambda] Successfully connected to MCP server: %s (tool: %s@%s)",
		s.Name, client.config.ToolName, client.config.ToolVersion)

	return client, nil
}
