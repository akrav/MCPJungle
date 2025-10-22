# MCP Testing Guide

## Overview

This document describes the testing strategy and implementation for MCP (Model Context Protocol) integration in the codemode-standalone project.

## Test Organization

### Unit Tests (tests/unit/)

#### MCPToolConverter.test.ts
Tests the conversion logic from MCP tools to internal tool format without requiring a live MCP server.

**Coverage**: 10 tests
- Single tool conversion
- Schema preservation
- Execute function creation
- Batch conversion
- Tool prefixing (mcp_ namespace)
- Multi-client conversion
- Namespace collision prevention

**Key Features**:
- Uses mock MCP clients
- Fast execution (< 1 second)
- No external dependencies
- Tests namespacing patterns

#### MCPWorkflow.test.ts
Tests the complete workflow from MCP tool conversion through code generation and execution.

**Coverage**: 8 tests
- Single tool execution via generated code
- Multiple sequential tool calls
- Data passing between tools
- Conditional logic with MCP tools
- Mixing MCP and local tools
- Namespace collision prevention
- **Hot-reload simulation**

**Key Features**:
- End-to-end workflow testing
- Integration with CodemodeEngine
- Dynamic tool updates
- Real code execution in isolated environment

### Integration Tests (tests/integration/)

Integration tests for connecting to real MCP servers are provided but not included in the default test suite due to complexity of the MCP protocol handshake. These are available for manual testing with real MCP servers.

## Hot-Reload Pattern

### Overview

The hot-reload pattern allows agents to modify MCP tool implementations and immediately test them without restarting the server. This emulates the Vercel-style development workflow where code changes are automatically reflected.

### How It Works

1. **Initial State**: Engine starts with a set of MCP tools
2. **Modification**: Agent modifies or adds tool implementations
3. **Reload**: New engine instance is created with updated tool set
4. **Test**: Agent can immediately test the modified tools

### Example

```typescript
// Initial tool set
const mockClient = new MockMCPClient();
const converter = new MCPToolConverter();
const toolSet = converter.convertAllTools(mockClient);

const engine = new CodemodeEngine({
  generateCode: yourLLMFunction,
  tools: toolSet,
});

// Execute with initial tools
const result1 = await engine.execute({ userRequest: "Use initial tools" });

// Agent modifies tool implementation
// ... tool modification happens here ...

// Create new engine with updated tools (hot reload)
const updatedToolSet = converter.convertAllTools(updatedClient);
const newEngine = new CodemodeEngine({
  generateCode: yourLLMFunction,
  tools: updatedToolSet,
});

// Execute with updated tools - no server restart needed
const result2 = await newEngine.execute({ userRequest: "Use updated tools" });
```

### Mock MCP Server

The `MockMCPServer` class supports this pattern:

```typescript
const mockServer = new MockMCPServer({ port: 3456 });
await mockServer.startServer();

// Register initial tool
mockServer.registerTool({
  name: "calculate",
  description: "Perform calculation",
  inputSchema: { /* ... */ },
  handler: async (args) => {
    return { result: 42 }; // Initial implementation
  },
});

// Later: Update the tool implementation (hot reload)
mockServer.registerTool({
  name: "calculate",
  description: "Perform calculation",
  inputSchema: { /* ... */ },
  handler: async (args) => {
    return { result: eval(args.expression) }; // Updated implementation
  },
});

// Connected clients automatically see the updated tool
```

### Use Cases

1. **Agent Self-Improvement**
   - Agent detects bug in tool implementation
   - Modifies the tool code
   - Tests the fix immediately
   - Iterates until correct

2. **Rapid Prototyping**
   - Agent experiments with different implementations
   - Tests each variant quickly
   - No deployment overhead

3. **Tool Discovery**
   - Agent creates new tools dynamically
   - Tests them in context
   - Refines based on results

## Test Execution

### Run All Tests
```bash
npm test
```

### Run Only MCP Tests
```bash
npm run test:mcp
```

### Run Specific Test Suite
```bash
npx tsx tests/unit/MCPToolConverter.test.ts
npx tsx tests/unit/MCPWorkflow.test.ts
```

## Test Results

**Phase 1 (MCP Integration Tests) - ✅ COMPLETE**

- Total Tests: 18
- Passed: 18 (100%)
- Coverage:
  - Tool conversion: 10 tests
  - Workflow integration: 8 tests
  - Hot-reload simulation: Included

**Overall Project Test Suite**

- Total Tests: 79
- Passed: 79 (100%)
- Test Suites: 7
- All suites passing

## Testing Strategy

### Why Unit Tests?

We chose unit tests with mocked MCP clients over integration tests with live servers because:

1. **Speed**: Unit tests run in < 1 second vs several seconds for server startup
2. **Reliability**: No network issues or protocol handshake complexity
3. **Isolation**: Tests focus on conversion and execution logic
4. **CI/CD Friendly**: Easy to run in any environment

### When to Use Integration Tests

Use the integration tests (tests/integration/MCP*.test.ts) when:

- Testing with real MCP servers
- Validating protocol compliance
- Debugging connection issues
- Testing specific MCP server implementations

## Mock Components

### MockMCPClient
A lightweight mock that simulates MCP client behavior:
- Returns predefined tools
- Simulates tool execution
- No network required

### MockMCPServer
A full HTTP/SSE server for advanced testing:
- Runs on configurable port
- Implements MCP protocol
- Supports dynamic tool registration
- Can be used for live integration testing

### DynamicToolLoader
Simulates hot-reload functionality:
- Watches for tool changes
- Automatically reloads tools
- Demonstrates agent workflow

## Best Practices

1. **Use Unit Tests for Development**
   - Fast feedback loop
   - Easy to debug
   - No external dependencies

2. **Mock at the Right Level**
   - Mock MCP client responses, not individual functions
   - Keep mocks simple but representative

3. **Test the Hot-Reload Pattern**
   - Verify tools can be updated
   - Test that old and new versions coexist properly
   - Ensure no state leakage between versions

4. **Namespace Your Tools**
   - Always prefix MCP tools (e.g., `mcp_get_weather`)
   - Use client IDs for multi-server scenarios
   - Test for namespace collisions

## Future Enhancements

- [ ] Add performance benchmarks
- [ ] Test with real MCP server implementations
- [ ] Add stress tests for many tool updates
- [ ] Test concurrent tool modifications
- [ ] Add integration tests with popular MCP servers

## Troubleshooting

### Tests Hang

If tests hang, it usually means:
- An MCP server wasn't properly stopped
- Async operation not awaited
- Isolated executor timeout too high

**Solution**: Ensure all servers are stopped in `finally` blocks

### Tool Not Found Errors

Usually caused by:
- Missing namespace prefix
- Tool not registered in mock client
- Typo in tool name

**Solution**: Check tool names match exactly, including namespace prefix

### Hot-Reload Not Working

Check that:
- New engine instance is created (not reusing old one)
- Tool set includes the updated tool
- No caching issues in type generation

## Contributing

When adding new MCP tests:

1. Add unit tests first for fast feedback
2. Use mock clients for isolation
3. Test edge cases (empty tools, errors, etc.)
4. Include hot-reload scenarios if relevant
5. Update this documentation

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Cloudflare Agents Pattern](https://developers.cloudflare.com/workers/examples/agents/)

