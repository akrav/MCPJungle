package model

import (
	"encoding/json"
	"errors"

	"github.com/mcpjungle/mcpjungle/pkg/types"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type StreamableHTTPConfig struct {
	// URL must be a valid http/https URL.
	URL string `json:"url"`

	// TODO: Store the bearer token in a more secure way, e.g., encrypted instead of plaintext.
	// BearerToken is an optional token used for authenticating requests to the MCP server.
	// If present, it will be used to set the Authorization header in all requests to this MCP server.
	BearerToken string `json:"bearer_token,omitempty"`
}

type StdioConfig struct {
	// Command is the shell command to run the stdio mcp server.
	Command string `json:"command"`

	// Args contains a list of strings that are passed as arguments to the command
	Args []string `json:"args,omitempty"`

	// Env describes the environment variables to pass to the MCP server
	Env map[string]string `json:"env,omitempty"`
}

type SSEConfig struct {
	// URL must be a valid http/https URL.
	URL string `json:"url"`

	BearerToken string `json:"bearer_token,omitempty"`
}

// LambdaConfig describes the configuration for a Lambda-based MCP server.
// Lambda servers dynamically load MCP tools from S3 and execute them.
type LambdaConfig struct {
	// FunctionURL is the public HTTPS URL of the Lambda function.
	// This URL accepts requests with query parameters: ?tool=<name>&version=<ver>
	FunctionURL string `json:"function_url"`

	// ToolName is the name of the MCP tool to load from S3.
	ToolName string `json:"tool_name"`

	// ToolVersion is the version of the MCP tool to load. Defaults to "latest".
	ToolVersion string `json:"tool_version,omitempty"`

	// Region is the AWS region where the Lambda function is deployed.
	Region string `json:"region,omitempty"`
}

// McpServer represents a MCP server registered in mcpjungle
type McpServer struct {
	gorm.Model

	Name      string                   `json:"name" gorm:"uniqueIndex;not null"`
	Transport types.McpServerTransport `json:"transport" gorm:"type:varchar(30);not null"`

	Description string `json:"description"`

	// Config describes the transport-specific configuration for the MCP server.
	// It contains the JSON representation of either StreamableHTTPConfig or StdioConfig.
	Config datatypes.JSON `json:"config" gorm:"type:jsonb;not null"`
}

// NewStreamableHTTPServer creates a new MCP server with streamable HTTP transport configuration.
func NewStreamableHTTPServer(name, description, url, bearerToken string) (*McpServer, error) {
	if url == "" {
		return nil, errors.New("url is required for streamable HTTP transport")
	}
	config := StreamableHTTPConfig{
		URL:         url,
		BearerToken: bearerToken,
	}
	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}
	return &McpServer{
		Name:        name,
		Description: description,
		Transport:   types.TransportStreamableHTTP,
		Config:      configJSON,
	}, nil
}

// NewStdioServer creates a new MCP server with stdio transport configuration.
func NewStdioServer(name, description, command string, args []string, env map[string]string) (*McpServer, error) {
	if command == "" {
		return nil, errors.New("command is required for stdio transport")
	}
	config := StdioConfig{
		Command: command,
		Args:    args,
		Env:     env,
	}
	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}

	return &McpServer{
		Name:        name,
		Description: description,
		Transport:   types.TransportStdio,
		Config:      datatypes.JSON(configJSON),
	}, nil
}

func NewSSEServer(name, description, url, bearerToken string) (*McpServer, error) {
	if url == "" {
		return nil, errors.New("url is required for SSE transport")
	}
	config := SSEConfig{
		URL:         url,
		BearerToken: bearerToken,
	}
	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}
	return &McpServer{
		Name:        name,
		Description: description,
		Transport:   types.TransportSSE,
		Config:      configJSON,
	}, nil
}

// NewLambdaServer creates a new MCP server with Lambda transport configuration.
// Lambda servers dynamically load MCP tools from S3 based on the tool name and version.
func NewLambdaServer(name, description, functionURL, toolName, toolVersion, region string) (*McpServer, error) {
	if functionURL == "" {
		return nil, errors.New("function_url is required for Lambda transport")
	}
	if toolName == "" {
		return nil, errors.New("tool_name is required for Lambda transport")
	}
	if toolVersion == "" {
		toolVersion = "latest"
	}
	config := LambdaConfig{
		FunctionURL: functionURL,
		ToolName:    toolName,
		ToolVersion: toolVersion,
		Region:      region,
	}
	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}
	return &McpServer{
		Name:        name,
		Description: description,
		Transport:   types.TransportLambda,
		Config:      datatypes.JSON(configJSON),
	}, nil
}

// GetStreamableHTTPConfig returns the configuration if this is a streamable HTTP server
func (s *McpServer) GetStreamableHTTPConfig() (*StreamableHTTPConfig, error) {
	if s.Transport != types.TransportStreamableHTTP {
		return nil, errors.New("server is not a streamable HTTP transport type")
	}
	var config StreamableHTTPConfig
	if err := json.Unmarshal(s.Config, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

// GetStdioConfig returns the configuration if this is a stdio server
func (s *McpServer) GetStdioConfig() (*StdioConfig, error) {
	if s.Transport != types.TransportStdio {
		return nil, errors.New("server is not a stdio transport type")
	}
	var config StdioConfig
	if err := json.Unmarshal(s.Config, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

// GetSSEConfig returns the configuration if this is an SSE server
func (s *McpServer) GetSSEConfig() (*SSEConfig, error) {
	if s.Transport != types.TransportSSE {
		return nil, errors.New("server is not a SSE transport type")
	}
	var config SSEConfig
	if err := json.Unmarshal(s.Config, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

// GetLambdaConfig returns the configuration if this is a Lambda server
func (s *McpServer) GetLambdaConfig() (*LambdaConfig, error) {
	if s.Transport != types.TransportLambda {
		return nil, errors.New("server is not a Lambda transport type")
	}
	var config LambdaConfig
	if err := json.Unmarshal(s.Config, &config); err != nil {
		return nil, err
	}
	// Apply default version if not set
	if config.ToolVersion == "" {
		config.ToolVersion = "latest"
	}
	return &config, nil
}

// GetLambdaToolURL builds the full URL for a Lambda tool invocation
func (s *McpServer) GetLambdaToolURL() (string, error) {
	config, err := s.GetLambdaConfig()
	if err != nil {
		return "", err
	}
	// Build URL with query parameters
	url := config.FunctionURL
	if url[len(url)-1] != '/' && url[len(url)-1] != '?' {
		if !contains(url, "?") {
			url += "?"
		} else {
			url += "&"
		}
	}
	url += "tool=" + config.ToolName + "&version=" + config.ToolVersion
	return url, nil
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
