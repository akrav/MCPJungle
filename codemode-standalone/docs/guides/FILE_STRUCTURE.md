# File Structure Guide

Complete guide to every file in the codemode-standalone project.

## 📁 Project Structure

```
codemode-standalone/
├── 📄 Configuration Files
│   ├── package.json              # Dependencies and scripts
│   ├── tsconfig.json             # TypeScript configuration
│   └── .gitignore                # Git ignore rules
│
├── 📚 Documentation
│   ├── README.md                 # Main documentation
│   ├── QUICKSTART.md             # 5-minute getting started guide
│   ├── ARCHITECTURE.md           # Deep dive into architecture
│   ├── COMPARISON.md             # CF vs Standalone comparison
│   └── FILE_STRUCTURE.md         # This file
│
├── 💻 Source Code (src/)
│   ├── 🎯 core/
│   │   ├── CodemodeEngine.ts     # Main orchestrator class
│   │   ├── TypeGenerator.ts      # Schema → TypeScript conversion
│   │   └── ToolRegistry.ts       # Tool management and execution
│   │
│   ├── ⚙️ execution/
│   │   ├── IsolatedExecutor.ts   # Secure code execution engine
│   │   ├── ExecutionContext.ts   # Execution environment setup
│   │   └── SecurityPolicy.ts     # Security constraints manager
│   │
│   ├── 🔌 mcp/
│   │   ├── MCPClient.ts          # MCP server connection client
│   │   ├── MCPToolConverter.ts   # MCP → internal format conversion
│   │   └── types.ts              # MCP-specific TypeScript types
│   │
│   ├── 📝 types/
│   │   └── index.ts              # Shared TypeScript interfaces
│   │
│   └── index.ts                  # Main exports (public API)
│
└── 📖 Examples (examples/)
    ├── basic-usage.ts            # Simple tool usage example
    ├── with-mcp-server.ts        # MCP integration example
    └── advanced-llm-integration.ts # Real LLM integration example
```

## 📄 File Descriptions

### Configuration Files

#### `package.json`
**Purpose**: Project metadata and dependencies  
**Key Sections**:
- `dependencies`: Runtime dependencies (isolated-vm, MCP SDK, etc.)
- `devDependencies`: Development tools (TypeScript, tsx)
- `scripts`: Common commands (`build`, `example:basic`, etc.)

**Used by**: npm, Node.js  
**Edit when**: Adding dependencies, changing scripts

---

#### `tsconfig.json`
**Purpose**: TypeScript compiler configuration  
**Key Settings**:
- `target: ES2022`: Modern JavaScript output
- `module: ES2022`: ES modules
- `strict: true`: Strict type checking
- `outDir: ./dist`: Compiled output location

**Used by**: TypeScript compiler  
**Edit when**: Changing compilation settings

---

#### `.gitignore`
**Purpose**: Tell Git which files to ignore  
**Ignores**:
- `node_modules/`: Dependencies
- `dist/`: Compiled code
- `*.log`: Log files
- `.env`: Environment variables

**Used by**: Git  
**Edit when**: Adding new files to ignore

---

### Documentation Files

#### `README.md`
**Purpose**: Main project documentation  
**Sections**:
- What is codemode
- Installation instructions
- Usage examples
- API reference
- Security considerations

**Audience**: All users  
**Update when**: API changes, new features added

---

#### `QUICKSTART.md`
**Purpose**: 5-minute getting started guide  
**Sections**:
- Installation
- First example
- Common patterns
- Troubleshooting

**Audience**: New users  
**Update when**: Onboarding process changes

---

#### `ARCHITECTURE.md`
**Purpose**: Deep technical architecture documentation  
**Sections**:
- System diagrams
- Component responsibilities
- Data flow
- Security architecture
- Extensibility points

**Audience**: Contributors, advanced users  
**Update when**: Architecture changes

---

#### `COMPARISON.md`
**Purpose**: Compare with Cloudflare implementation  
**Sections**:
- Side-by-side comparison table
- What was reused
- What was adapted
- Migration guides

**Audience**: Users familiar with Cloudflare version  
**Update when**: Implementation differences change

---

### Source Code Files

#### `src/index.ts`
**Purpose**: Main entry point and public API  
**Exports**:
- All core classes
- All execution classes
- All MCP classes
- All TypeScript types

**Import from**: Your application code  
**Edit when**: Adding/removing public exports

---

### Core Layer (`src/core/`)

#### `CodemodeEngine.ts` (Main Orchestrator)
**Purpose**: Coordinates the entire codemode workflow  

**Key Methods**:
```typescript
async execute(request)    // Main execution method
addTools(tools)          // Add new tools dynamically
updateSecurityPolicy()   // Update security settings
```

**Dependencies**:
- TypeGenerator (for type generation)
- ToolRegistry (for tool management)
- IsolatedExecutor (for execution)
- SecurityPolicyManager (for security)

**Used by**: Your application (main entry point)  
**Edit when**: Changing orchestration logic

**Lines of Code**: ~150  
**Complexity**: Medium

---

#### `TypeGenerator.ts` (Type Conversion)
**Purpose**: Convert tool schemas to TypeScript definitions  

**Key Methods**:
```typescript
async generateTypeDefinitions(tools)  // Main generation method
generateToolDescriptions(tools)       // Plain text descriptions
```

**Dependencies**:
- `json-schema-to-typescript`: JSON Schema conversion
- `zod-to-ts`: Zod schema conversion

**Used by**: CodemodeEngine  
**Edit when**: Changing type generation logic

**Lines of Code**: ~120  
**Complexity**: Medium-High

---

#### `ToolRegistry.ts` (Tool Management)
**Purpose**: Manage tool lifecycle and execution  

**Key Methods**:
```typescript
registerTool(name, tool)      // Register a tool
executeTool(name, args)       // Execute a tool
getAllTools()                 // Get all tools
```

**Dependencies**: None (pure TypeScript)

**Used by**: CodemodeEngine, IsolatedExecutor  
**Edit when**: Changing tool management logic

**Lines of Code**: ~100  
**Complexity**: Low

---

### Execution Layer (`src/execution/`)

#### `IsolatedExecutor.ts` (Code Execution)
**Purpose**: Execute generated code in isolated environment  

**Key Methods**:
```typescript
async execute(code)          // Execute code safely
validateCode(code)           // Check for dangerous patterns
```

**Dependencies**:
- `isolated-vm`: V8 isolation
- ExecutionContext (for setup)
- SecurityPolicyManager (for limits)
- ToolRegistry (for tools)

**Used by**: CodemodeEngine  
**Edit when**: Changing execution logic

**Lines of Code**: ~180  
**Complexity**: High

**⚠️ Critical**: Security-sensitive code

---

#### `ExecutionContext.ts` (Environment Setup)
**Purpose**: Set up execution environment with tool proxy  

**Key Methods**:
```typescript
createToolProxy()            // Create proxy for tools
generateWrapperCode(code)    // Wrap user code
serializeValue(value)        // Serialize for isolate
```

**Dependencies**: ToolRegistry

**Used by**: IsolatedExecutor  
**Edit when**: Changing how tools are injected

**Lines of Code**: ~80  
**Complexity**: Medium

---

#### `SecurityPolicy.ts` (Security Management)
**Purpose**: Manage security policies and constraints  

**Key Methods**:
```typescript
getPolicy()                  // Get current policy
updatePolicy(updates)        // Update policy
isDomainAllowed(domain)      // Check network access
```

**Constants**:
```typescript
DEFAULT_SECURITY_POLICY = {
  maxExecutionTime: 30000,
  maxMemoryMB: 128,
  allowNetworkAccess: false
}
```

**Dependencies**: None

**Used by**: IsolatedExecutor, CodemodeEngine  
**Edit when**: Changing security defaults

**Lines of Code**: ~70  
**Complexity**: Low

---

### MCP Layer (`src/mcp/`)

#### `MCPClient.ts` (MCP Connection)
**Purpose**: Connect to and communicate with MCP servers  

**Key Methods**:
```typescript
async connect()              // Establish connection
async callTool(name, args)   // Execute remote tool
getTools()                   // Get available tools
async disconnect()           // Clean up connection
```

**Dependencies**:
- `@modelcontextprotocol/sdk`: Official MCP SDK

**Supported Transports**:
- SSE (Server-Sent Events)
- STDIO (Standard IO)

**Used by**: MCPToolConverter  
**Edit when**: Adding transport types

**Lines of Code**: ~150  
**Complexity**: Medium

---

#### `MCPToolConverter.ts` (Tool Conversion)
**Purpose**: Convert MCP tools to internal format  

**Key Methods**:
```typescript
convertTool(mcpTool, client)         // Convert single tool
convertAllTools(client)              // Convert all from client
convertMultipleClients(clients)      // Handle multiple servers
```

**Dependencies**: MCPClient

**Used by**: Your application (when using MCP)  
**Edit when**: Changing conversion logic

**Lines of Code**: ~60  
**Complexity**: Low

---

#### `mcp/types.ts` (MCP Types)
**Purpose**: TypeScript types for MCP functionality  

**Key Types**:
```typescript
MCPTool                      // Tool from MCP server
MCPServerConfig              // Connection configuration
MCPConnectionStatus          // Status information
```

**Dependencies**: None

**Used by**: MCPClient, MCPToolConverter  
**Edit when**: Adding MCP features

**Lines of Code**: ~40  
**Complexity**: Low

---

### Types Layer (`src/types/`)

#### `types/index.ts` (Shared Types)
**Purpose**: Common TypeScript interfaces used across project  

**Key Types**:
```typescript
Tool                         // Tool definition
ToolSet                      // Collection of tools
SecurityPolicy               // Security configuration
ExecutionResult              // Execution output
CodemodeOptions              // Engine configuration
CodemodeRequest              // User request
CodemodeResponse             // System response
```

**Dependencies**: None (pure types)

**Used by**: All modules  
**Edit when**: Adding new types

**Lines of Code**: ~100  
**Complexity**: Low

---

### Examples

#### `examples/basic-usage.ts`
**Purpose**: Simple example with local tools  
**Demonstrates**:
- Defining tools with Zod schemas
- Creating a CodemodeEngine
- Executing a request
- Handling results

**Run**: `npm run example:basic`  
**Good for**: Learning the basics

---

#### `examples/with-mcp-server.ts`
**Purpose**: Example with MCP server integration  
**Demonstrates**:
- Connecting to MCP server
- Converting MCP tools
- Combining MCP and local tools
- Clean disconnection

**Run**: `npm run example:mcp`  
**Good for**: MCP integration

---

#### `examples/advanced-llm-integration.ts`
**Purpose**: Template for real LLM integration  
**Demonstrates**:
- OpenAI API integration (commented out)
- Complex tool definitions
- Error handling
- Type definition inspection

**Run**: `npm run example:advanced`  
**Good for**: Production setup

---

## 🗺️ Import Map

Who imports what:

```
CodemodeEngine
  ├─→ TypeGenerator
  ├─→ ToolRegistry
  ├─→ IsolatedExecutor
  │    ├─→ ExecutionContext
  │    │    └─→ ToolRegistry
  │    └─→ SecurityPolicyManager
  └─→ SecurityPolicyManager

MCPClient
  └─→ @modelcontextprotocol/sdk

MCPToolConverter
  ├─→ MCPClient
  └─→ types/index.ts

Your Application
  ├─→ CodemodeEngine
  ├─→ MCPClient
  ├─→ MCPToolConverter
  └─→ types/index.ts
```

## 📏 Code Statistics

| Component | Files | Lines | Complexity |
|-----------|-------|-------|------------|
| Core | 3 | ~370 | Medium |
| Execution | 3 | ~330 | High |
| MCP | 3 | ~250 | Medium |
| Types | 1 | ~100 | Low |
| Examples | 3 | ~500 | Low |
| **Total** | **13** | **~1550** | **Medium** |

## 🎯 Entry Points

Where do you start?

| Use Case | Start Here | Then See |
|----------|-----------|----------|
| Using the library | `src/index.ts` | `examples/basic-usage.ts` |
| Understanding architecture | `ARCHITECTURE.md` | `src/core/CodemodeEngine.ts` |
| Quick start | `QUICKSTART.md` | `examples/` |
| Extending | `ARCHITECTURE.md` | Relevant component file |
| Contributing | `README.md` | All source files |

## 🔧 Maintenance Guide

### Adding a New Feature

1. **Core feature**: Add to `src/core/`
2. **Execution feature**: Add to `src/execution/`
3. **MCP feature**: Add to `src/mcp/`
4. **Types**: Update `src/types/index.ts`
5. **Exports**: Update `src/index.ts`
6. **Example**: Add to `examples/`
7. **Docs**: Update `README.md` and `ARCHITECTURE.md`

### Fixing a Bug

1. **Identify component** using import map above
2. **Add test case** (when test infrastructure added)
3. **Fix the bug** in component file
4. **Update docs** if behavior changed

### Performance Optimization

| Component | Optimization Target | File |
|-----------|-------------------|------|
| Type generation | Cache results | `TypeGenerator.ts` |
| Tool execution | Connection pooling | `ToolRegistry.ts` |
| Code execution | Reuse isolates | `IsolatedExecutor.ts` |
| MCP calls | Batch requests | `MCPClient.ts` |

## 📚 Further Reading

- [README.md](./README.md) - Overview and API
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical details
- [COMPARISON.md](./COMPARISON.md) - CF vs Standalone
- [QUICKSTART.md](./QUICKSTART.md) - Getting started

---

**Last Updated**: Initial creation  
**Maintainers**: Add your name here when contributing

