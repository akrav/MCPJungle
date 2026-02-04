package mcp

import (
	"context"
	"fmt"

	"github.com/mcpjungle/mcpjungle/internal/model"
	"github.com/mcpjungle/mcpjungle/pkg/types"
)

// RegisterMcpServer registers a new MCP server in the database.
// It also registers all the Tools provided by the server.
// Tool registration is on best-effort basis and does not fail the server registration.
// Registered tools are also added to the MCP proxy server.
func (m *MCPService) RegisterMcpServer(ctx context.Context, s *model.McpServer) error {
	if err := validateServerName(s.Name); err != nil {
		return err
	}

	// Handle Lambda transport separately since it uses a different client type
	if s.Transport == types.TransportLambda {
		return m.registerLambdaServer(ctx, s)
	}

	mcpClient, err := newMcpServerSession(ctx, s)
	if err != nil {
		return err
	}
	defer mcpClient.Close()

	// register the server in the DB
	if err := m.db.Create(s).Error; err != nil {
		return fmt.Errorf("failed to register mcp server: %w", err)
	}

	if err = m.registerServerTools(ctx, s, mcpClient); err != nil {
		return fmt.Errorf("failed to register tools for MCP server %s: %w", s.Name, err)
	}
	return nil
}

// registerLambdaServer handles registration for Lambda-based MCP servers.
// Lambda servers use a different client type that communicates via HTTP/SSE.
func (m *MCPService) registerLambdaServer(ctx context.Context, s *model.McpServer) error {
	lambdaClient, err := createLambdaMcpServerConn(ctx, s)
	if err != nil {
		return fmt.Errorf("failed to create Lambda client for %s: %w", s.Name, err)
	}
	defer lambdaClient.Close()

	// register the server in the DB
	if err := m.db.Create(s).Error; err != nil {
		return fmt.Errorf("failed to register mcp server: %w", err)
	}

	if err = m.registerLambdaServerTools(ctx, s, lambdaClient); err != nil {
		return fmt.Errorf("failed to register tools for Lambda MCP server %s: %w", s.Name, err)
	}
	return nil
}

// DeregisterMcpServer deregisters an MCP server from the database.
// It also deregisters all the tools registered by the server.
// If even a singe tool fails to deregister, the server deregistration fails.
// A deregistered tool is also removed from the MCP proxy server.
func (m *MCPService) DeregisterMcpServer(name string) error {
	s, err := m.GetMcpServer(name)
	if err != nil {
		return fmt.Errorf("failed to get MCP server %s from DB: %w", name, err)
	}
	if err := m.deregisterServerTools(s); err != nil {
		return fmt.Errorf(
			"failed to deregister tools for server %s, cannot proceed with server deregistration: %w",
			name,
			err,
		)
	}
	if err := m.db.Unscoped().Delete(s).Error; err != nil {
		return fmt.Errorf("failed to deregister server %s: %w", name, err)
	}

	return nil
}

// ListMcpServers returns all registered MCP servers.
func (m *MCPService) ListMcpServers() ([]model.McpServer, error) {
	var servers []model.McpServer
	if err := m.db.Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

// GetMcpServer fetches a server from the database by name.
func (m *MCPService) GetMcpServer(name string) (*model.McpServer, error) {
	var serverModel model.McpServer
	if err := m.db.Where("name = ?", name).First(&serverModel).Error; err != nil {
		return nil, err
	}
	return &serverModel, nil
}
