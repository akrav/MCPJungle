package mcp

import (
	"context"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mcpjungle/mcpjungle/internal/model"
	"github.com/mcpjungle/mcpjungle/internal/telemetry"
	"github.com/mcpjungle/mcpjungle/pkg/types"
)

// MCPProxyToolCallHandler handles tool calls for the MCP proxy server
// by forwarding the request to the appropriate upstream MCP server and
// relaying the response back.
func (m *MCPService) MCPProxyToolCallHandler(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	started := time.Now()
	outcome := telemetry.ToolCallOutcomeSuccess

	name := request.Params.Name
	serverName, toolName, ok := splitServerToolName(name)
	if !ok {
		return nil, fmt.Errorf("invalid input: tool name does not contain a %s separator", serverToolNameSep)
	}

	serverMode := ctx.Value("mode").(model.ServerMode)
	if model.IsEnterpriseMode(serverMode) {
		// In enterprise mode, we need to check whether the MCP client is authorized to access the MCP server.
		// If not, return error Unauthorized.
		c := ctx.Value("client").(*model.McpClient)
		if !c.CheckHasServerAccess(serverName) {
			return nil, fmt.Errorf(
				"client %s is not authorized to access MCP server %s", c.Name, serverName,
			)
		}
	}

	// Record the tool call metrics at the end of the function
	defer func() {
		m.metrics.RecordToolCall(ctx, serverName, toolName, outcome, time.Since(started))
	}()

	// get the MCP server details from the database
	server, err := m.GetMcpServer(serverName)
	if err != nil {
		// TODO: differentiate between "server not found" and other errors.
		// server not found is not an internal error, so outcome should be success.
		outcome = telemetry.ToolCallOutcomeError

		return nil, fmt.Errorf(
			"failed to get details about MCP server %s from DB: %w", serverName, err,
		)
	}

	// Ensure the tool name is set correctly, ie, without the server name prefix
	request.Params.Name = toolName

	// Handle Lambda transport specially since it has a different client type
	if server.Transport == types.TransportLambda {
		return m.handleLambdaToolCall(ctx, server, request, &outcome)
	}

	mcpClient, err := newMcpServerSession(ctx, server)
	if err != nil {
		outcome = telemetry.ToolCallOutcomeError
		return nil, err
	}
	defer mcpClient.Close()

	res, err := mcpClient.CallTool(ctx, request)
	if err != nil {
		outcome = telemetry.ToolCallOutcomeError
	}

	// forward the request to the upstream MCP server and relay the response back
	return res, err
}

// handleLambdaToolCall handles tool calls for Lambda-based MCP servers.
// Lambda servers use a different client type that communicates via HTTP/SSE.
func (m *MCPService) handleLambdaToolCall(
	ctx context.Context,
	server *model.McpServer,
	request mcp.CallToolRequest,
	outcome *telemetry.ToolCallOutcome,
) (*mcp.CallToolResult, error) {
	lambdaClient, err := createLambdaMcpServerConn(ctx, server)
	if err != nil {
		*outcome = telemetry.ToolCallOutcomeError
		return nil, fmt.Errorf("failed to create Lambda client for %s: %w", server.Name, err)
	}
	defer lambdaClient.Close()

	res, err := lambdaClient.CallTool(ctx, request)
	if err != nil {
		*outcome = telemetry.ToolCallOutcomeError
	}

	return res, err
}

// initMCPProxyServer initializes the MCP proxy server.
// It loads all the registered MCP tools from the database into the proxy server.
func (m *MCPService) initMCPProxyServer() error {
	mcpServerModelsCache := make(map[string]*model.McpServer)

	tools, err := m.ListTools()
	if err != nil {
		return fmt.Errorf("failed to list tools from DB: %w", err)
	}

	for _, tm := range tools {
		if !tm.Enabled {
			// do not add disabled tools to the proxy
			continue
		}

		// Add tool to the MCP proxy server
		tool, err := convertToolModelToMcpObject(&tm)
		if err != nil {
			return fmt.Errorf("failed to convert tool model to MCP object for tool %s: %w", tm.Name, err)
		}

		// get the tool's MCP server so we can determine the transport type
		// use a cache to avoid querying the DB multiple times for the same server
		// since multiple tools can belong to the same server
		var server *model.McpServer
		serverName, _, _ := splitServerToolName(tool.Name)

		server, exists := mcpServerModelsCache[serverName]
		if !exists {
			server, err = m.GetMcpServer(serverName)
			if err != nil {
				return fmt.Errorf(
					"init mcp proxy server: failed to get MCP server %s for tool %s from DB: %w", serverName, tool.Name, err,
				)
			}
			// store the server model in cache so we don't have to query the DB again for the same server
			mcpServerModelsCache[serverName] = server
		}

		// Add tool to the appropriate proxy server based on transport type
		// SSE uses a separate proxy server for streaming
		// Lambda uses the standard proxy server (streaming handled internally)
		if server.Transport == types.TransportSSE {
			m.sseMcpProxyServer.AddTool(tool, m.MCPProxyToolCallHandler)
		} else {
			// HTTP, stdio, and Lambda all use the standard proxy server
			m.mcpProxyServer.AddTool(tool, m.MCPProxyToolCallHandler)
		}

		m.addToolInstance(tool)
	}

	return nil
}
