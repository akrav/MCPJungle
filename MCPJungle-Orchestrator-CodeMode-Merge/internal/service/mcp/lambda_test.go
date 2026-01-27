package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==============================================================================
// Test Helpers
// ==============================================================================

// mockSSEServer creates a test server that returns SSE responses
func mockSSEServer(t *testing.T, responses []string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("X-Cold-Start", "false")
		w.Header().Set("X-Tool-Name", "test-tool")

		for _, resp := range responses {
			w.Write([]byte("event: message\ndata: " + resp + "\n\n"))
		}
	}))
}

// mockErrorServer creates a test server that returns errors
func mockErrorServer(t *testing.T, statusCode int, message string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(statusCode)
		w.Write([]byte(message))
	}))
}

// ==============================================================================
// Lambda Config Tests
// ==============================================================================

func TestLambdaConfigParsing(t *testing.T) {
	t.Run("should parse valid Lambda config", func(t *testing.T) {
		configJSON := `{
			"function_url": "https://test.lambda-url.us-east-1.on.aws/",
			"tool_name": "test-tool",
			"version": "latest",
			"region": "us-east-1"
		}`

		var config LambdaClientConfig
		err := json.Unmarshal([]byte(configJSON), &config)

		require.NoError(t, err)
		assert.Equal(t, "https://test.lambda-url.us-east-1.on.aws/", config.FunctionURL)
		assert.Equal(t, "test-tool", config.ToolName)
		assert.Equal(t, "latest", config.Version)
		assert.Equal(t, "us-east-1", config.Region)
	})

	t.Run("should use defaults for missing optional fields", func(t *testing.T) {
		configJSON := `{
			"function_url": "https://test.lambda-url.us-east-1.on.aws/",
			"tool_name": "test-tool"
		}`

		var config LambdaClientConfig
		err := json.Unmarshal([]byte(configJSON), &config)

		require.NoError(t, err)
		assert.Equal(t, "", config.Version) // Will be defaulted elsewhere
		assert.Equal(t, "", config.Region)  // Will be defaulted elsewhere
	})
}

// ==============================================================================
// URL Construction Tests
// ==============================================================================

func TestLambdaURLConstruction(t *testing.T) {
	t.Run("should build URL with tool and version params", func(t *testing.T) {
		config := LambdaClientConfig{
			FunctionURL: "https://test.lambda-url.us-east-1.on.aws/",
			ToolName:    "context7",
			Version:     "latest",
		}

		url := buildLambdaURL(config)

		assert.Contains(t, url, "tool=context7")
		assert.Contains(t, url, "version=latest")
	})

	t.Run("should handle URL with existing query params", func(t *testing.T) {
		config := LambdaClientConfig{
			FunctionURL: "https://test.lambda-url.us-east-1.on.aws/?foo=bar",
			ToolName:    "test",
			Version:     "v1",
		}

		url := buildLambdaURL(config)

		assert.Contains(t, url, "tool=test")
		assert.Contains(t, url, "version=v1")
	})

	t.Run("should default version to latest", func(t *testing.T) {
		config := LambdaClientConfig{
			FunctionURL: "https://test.lambda-url.us-east-1.on.aws/",
			ToolName:    "test",
		}

		url := buildLambdaURL(config)

		assert.Contains(t, url, "version=latest")
	})
}

// ==============================================================================
// SSE Response Parsing Tests
// ==============================================================================

func TestSSEResponseParsing(t *testing.T) {
	t.Run("should parse single SSE event", func(t *testing.T) {
		sseData := "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":\"1\",\"result\":{}}\n\n"

		events := parseSSEEvents(sseData)

		require.Len(t, events, 1)
		assert.Equal(t, "message", events[0].Event)
		assert.Contains(t, events[0].Data, "jsonrpc")
	})

	t.Run("should parse multiple SSE events", func(t *testing.T) {
		sseData := "event: message\ndata: {\"id\":\"1\"}\n\nevent: message\ndata: {\"id\":\"2\"}\n\n"

		events := parseSSEEvents(sseData)

		require.Len(t, events, 2)
	})

	t.Run("should handle error events", func(t *testing.T) {
		sseData := "event: error\ndata: {\"error\":\"Tool failed\"}\n\n"

		events := parseSSEEvents(sseData)

		require.Len(t, events, 1)
		assert.Equal(t, "error", events[0].Event)
	})

	t.Run("should extract JSON-RPC responses", func(t *testing.T) {
		sseData := "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":\"test-1\",\"result\":{\"tools\":[]}}\n\n"

		events := parseSSEEvents(sseData)
		responses := extractJSONRPCResponses(events)

		require.Len(t, responses, 1)
		assert.Equal(t, "2.0", responses[0].JSONRPC)
		assert.Equal(t, "test-1", responses[0].ID)
	})
}

// ==============================================================================
// Lambda Error Handling Tests
// ==============================================================================

func TestLambdaErrorHandling(t *testing.T) {
	t.Run("should handle 500 errors", func(t *testing.T) {
		server := mockErrorServer(t, 500, "Internal Server Error")
		defer server.Close()

		client := NewLambdaClient(LambdaClientConfig{
			FunctionURL: server.URL,
			ToolName:    "test",
			Version:     "latest",
		})

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_, err := client.Invoke(ctx, JSONRPCRequest{
			JSONRPC: "2.0",
			ID:      "1",
			Method:  "tools/list",
		})

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "500")
	})

	t.Run("should handle timeout", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(2 * time.Second)
		}))
		defer server.Close()

		client := NewLambdaClient(LambdaClientConfig{
			FunctionURL: server.URL,
			ToolName:    "test",
			Version:     "latest",
		})

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		_, err := client.Invoke(ctx, JSONRPCRequest{
			JSONRPC: "2.0",
			ID:      "1",
			Method:  "tools/list",
		})

		assert.Error(t, err)
		assert.True(t, ctx.Err() == context.DeadlineExceeded)
	})

	t.Run("should handle connection refused", func(t *testing.T) {
		client := NewLambdaClient(LambdaClientConfig{
			FunctionURL: "http://localhost:59999", // Non-existent port
			ToolName:    "test",
			Version:     "latest",
		})

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_, err := client.Invoke(ctx, JSONRPCRequest{
			JSONRPC: "2.0",
			ID:      "1",
			Method:  "tools/list",
		})

		assert.Error(t, err)
	})
}

// ==============================================================================
// Cold Start Detection Tests
// ==============================================================================

func TestLambdaColdStartDetection(t *testing.T) {
	t.Run("should detect cold start from header", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("X-Cold-Start", "true")
			w.Write([]byte("event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":\"1\",\"result\":{}}\n\n"))
		}))
		defer server.Close()

		client := NewLambdaClient(LambdaClientConfig{
			FunctionURL: server.URL,
			ToolName:    "test",
			Version:     "latest",
		})

		ctx := context.Background()
		result, err := client.Invoke(ctx, JSONRPCRequest{
			JSONRPC: "2.0",
			ID:      "1",
			Method:  "tools/list",
		})

		require.NoError(t, err)
		assert.True(t, result.IsColdStart)
	})

	t.Run("should detect warm start", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("X-Cold-Start", "false")
			w.Write([]byte("event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":\"1\",\"result\":{}}\n\n"))
		}))
		defer server.Close()

		client := NewLambdaClient(LambdaClientConfig{
			FunctionURL: server.URL,
			ToolName:    "test",
			Version:     "latest",
		})

		ctx := context.Background()
		result, err := client.Invoke(ctx, JSONRPCRequest{
			JSONRPC: "2.0",
			ID:      "1",
			Method:  "tools/list",
		})

		require.NoError(t, err)
		assert.False(t, result.IsColdStart)
	})
}

// ==============================================================================
// Helper Types for Tests
// ==============================================================================

// LambdaClientConfig holds configuration for the Lambda client
type LambdaClientConfig struct {
	FunctionURL string `json:"function_url"`
	ToolName    string `json:"tool_name"`
	Version     string `json:"version"`
	Region      string `json:"region,omitempty"`
}

// JSONRPCRequest represents a JSON-RPC 2.0 request
type JSONRPCRequest struct {
	JSONRPC string                 `json:"jsonrpc"`
	ID      string                 `json:"id"`
	Method  string                 `json:"method"`
	Params  map[string]interface{} `json:"params,omitempty"`
}

// JSONRPCResponse represents a JSON-RPC 2.0 response
type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      string      `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   interface{} `json:"error,omitempty"`
}

// SSEEvent represents a parsed SSE event
type SSEEvent struct {
	Event string
	Data  string
}

// InvokeResult represents the result of a Lambda invocation
type InvokeResult struct {
	Response    JSONRPCResponse
	IsColdStart bool
	DurationMs  int64
}

// LambdaClient interface for testing
type LambdaClient interface {
	Invoke(ctx context.Context, req JSONRPCRequest) (*InvokeResult, error)
}

// mockLambdaClient implements LambdaClient for testing
type mockLambdaClient struct {
	config LambdaClientConfig
}

func NewLambdaClient(config LambdaClientConfig) *mockLambdaClient {
	return &mockLambdaClient{config: config}
}

func (c *mockLambdaClient) Invoke(ctx context.Context, req JSONRPCRequest) (*InvokeResult, error) {
	// This is a placeholder - actual implementation would make HTTP request
	return nil, nil
}

// Helper functions (placeholders - actual implementations in lambda.go)
func buildLambdaURL(config LambdaClientConfig) string {
	version := config.Version
	if version == "" {
		version = "latest"
	}
	return config.FunctionURL + "?tool=" + config.ToolName + "&version=" + version
}

func parseSSEEvents(data string) []SSEEvent {
	// Placeholder - actual implementation parses SSE format
	return []SSEEvent{}
}

func extractJSONRPCResponses(events []SSEEvent) []JSONRPCResponse {
	// Placeholder - actual implementation extracts JSON-RPC from SSE
	return []JSONRPCResponse{}
}
