# Implementation Plan: MCP Integration & LLM Integration

**Created**: October 11, 2025  
**Priority**: High  
**Estimated Time**: 5-6 hours total

---

## Overview

This document provides a detailed implementation plan for:
1. **MCP Integration Tests** (3 hours) - Test MCP client and tool conversion
2. **Real LLM Integration** (2-3 hours) - Connect with OpenAI and Anthropic

---

## 🎯 Part 1: MCP Integration Tests (3 hours)

### Goal
Test the MCP client and tool converter with a real/mock MCP server to ensure end-to-end MCP functionality works correctly.

### Current Status
- ✅ `MCPClient.ts` exists and looks correct
- ✅ `MCPToolConverter.ts` exists and looks correct
- ❌ No tests for MCP functionality
- ❌ No mock MCP server for testing

### Why This Matters
- MCP integration is a core feature but completely untested
- Need to verify tool discovery, conversion, and execution work
- Need to validate namespacing and multi-server support
- Risk: Production issues if MCP integration is broken

---

### Task Breakdown

#### Task 1.1: Create Mock MCP Server (1 hour)

**Objective**: Build a simple MCP server implementation for testing

**Location**: `tests/mocks/MockMCPServer.ts`

**Implementation Steps**:

1. **Create base mock server class** (20 min)
   ```typescript
   export class MockMCPServer {
     private tools: MCPTool[] = [];
     private serverInfo = {
       name: "mock-mcp-server",
       version: "1.0.0"
     };
     
     constructor(tools?: MCPTool[]) {
       this.tools = tools || this.getDefaultTools();
     }
     
     // Implement MCP protocol methods
     async listTools() { ... }
     async callTool(name: string, args: any) { ... }
   }
   ```

2. **Add default test tools** (20 min)
   ```typescript
   private getDefaultTools(): MCPTool[] {
     return [
       {
         name: "filesystem_read",
         description: "Read a file",
         inputSchema: {
           type: "object",
           properties: {
             path: { type: "string" }
           },
           required: ["path"]
         }
       },
       {
         name: "database_query",
         description: "Query database",
         inputSchema: {
           type: "object",
           properties: {
             sql: { type: "string" },
             params: { type: "array" }
           },
           required: ["sql"]
         }
       }
     ];
   }
   ```

3. **Implement tool execution mock** (20 min)
   ```typescript
   async callTool(name: string, args: any) {
     const tool = this.tools.find(t => t.name === name);
     if (!tool) {
       return {
         isError: true,
         content: [{ type: "text", text: "Tool not found" }]
       };
     }
     
     // Mock successful execution
     return {
       isError: false,
       content: [{
         type: "text",
         text: JSON.stringify({
           tool: name,
           args,
           result: `Mock result for ${name}`
         })
       }]
     };
   }
   ```

**Files to Create**:
- `tests/mocks/MockMCPServer.ts` (~150 lines)

**Verification**:
- Mock server can be instantiated
- listTools() returns configured tools
- callTool() executes and returns results

---

#### Task 1.2: Test MCPClient (45 minutes)

**Objective**: Verify MCPClient can connect, discover tools, and execute calls

**Location**: `tests/integration/MCPClient.test.ts`

**Test Cases**:

1. **Connection Tests** (15 min)
   ```typescript
   // Test 1: Create client with SSE config
   // Test 2: Create client with STDIO config
   // Test 3: Connect successfully
   // Test 4: Handle connection errors
   // Test 5: Check connection status
   ```

2. **Tool Discovery Tests** (15 min)
   ```typescript
   // Test 6: List tools from server
   // Test 7: Tools are correctly formatted
   // Test 8: Handle empty tool list
   // Test 9: Handle discovery errors
   ```

3. **Tool Execution Tests** (15 min)
   ```typescript
   // Test 10: Execute tool successfully
   // Test 11: Pass arguments correctly
   // Test 12: Parse JSON results
   // Test 13: Handle text results
   // Test 14: Handle tool execution errors
   // Test 15: Handle non-existent tool calls
   ```

4. **Cleanup Tests** (5 min)
   ```typescript
   // Test 16: Disconnect cleanly
   // Test 17: Check disconnected status
   ```

**Implementation**:
```typescript
async function runTests() {
  const mockServer = new MockMCPServer();
  const client = new MCPClient({
    url: "mock://localhost",
    transport: "sse"
  });
  
  // Use mockServer to simulate server responses
  // Test each scenario
}
```

**Files to Create**:
- `tests/integration/MCPClient.test.ts` (~400 lines)

**Expected Results**:
- 17 tests, all passing
- Verify connection lifecycle
- Verify tool discovery
- Verify tool execution

---

#### Task 1.3: Test MCPToolConverter (30 minutes)

**Objective**: Verify tool conversion from MCP format to internal format

**Location**: `tests/integration/MCPToolConverter.test.ts`

**Test Cases**:

1. **Single Tool Conversion** (10 min)
   ```typescript
   // Test 1: Convert MCP tool to internal format
   // Test 2: Schema is preserved
   // Test 3: Name is preserved
   // Test 4: Description is preserved
   // Test 5: Execute function is created
   ```

2. **Batch Conversion** (10 min)
   ```typescript
   // Test 6: Convert all tools from client
   // Test 7: Tool count matches
   // Test 8: Tools are prefixed with mcp_
   // Test 9: All tools executable
   ```

3. **Multi-Server Conversion** (10 min)
   ```typescript
   // Test 10: Convert from multiple clients
   // Test 11: Namespacing by client ID
   // Test 12: No name conflicts
   // Test 13: All tools from all servers present
   ```

**Implementation**:
```typescript
async function runTests() {
  const mockServer = new MockMCPServer();
  const client = new MCPClient({ url: "mock://localhost", transport: "sse" });
  await client.connect();
  
  const converter = new MCPToolConverter();
  
  // Test single tool conversion
  const tools = client.getTools();
  const converted = converter.convertTool(tools[0], client);
  
  // Test batch conversion
  const toolSet = converter.convertAllTools(client);
  
  // Test multi-server
  const clients = new Map([
    ["server1", client1],
    ["server2", client2]
  ]);
  const multiTools = converter.convertMultipleClients(clients);
}
```

**Files to Create**:
- `tests/integration/MCPToolConverter.test.ts` (~300 lines)

**Expected Results**:
- 13 tests, all passing
- Verify conversion accuracy
- Verify namespacing
- Verify executability

---

#### Task 1.4: End-to-End MCP Test (45 minutes)

**Objective**: Test full workflow from MCP server to code execution

**Location**: `tests/integration/MCPEndToEnd.test.ts`

**Test Scenarios**:

1. **Basic MCP Workflow** (15 min)
   ```typescript
   // Test 1: Connect to MCP server
   // Test 2: Discover and convert tools
   // Test 3: Create CodemodeEngine with MCP tools
   // Test 4: Generate code that calls MCP tool
   // Test 5: Execute code successfully
   // Test 6: Verify MCP tool was called
   ```

2. **Multiple Tool Calls** (15 min)
   ```typescript
   // Test 7: Call multiple MCP tools in sequence
   // Test 8: Pass data between MCP tool calls
   // Test 9: Conditional logic with MCP tools
   ```

3. **Mixed Tools** (15 min)
   ```typescript
   // Test 10: Mix MCP tools with local tools
   // Test 11: Call both in same code
   // Test 12: Verify namespacing works
   ```

**Implementation**:
```typescript
async function runTests() {
  // Set up mock MCP server
  const mockServer = new MockMCPServer([
    {
      name: "get_data",
      description: "Get some data",
      inputSchema: { type: "object", properties: { id: { type: "string" } } }
    }
  ]);
  
  // Connect and convert
  const client = new MCPClient({ url: "mock://localhost", transport: "sse" });
  await client.connect();
  
  const converter = new MCPToolConverter();
  const mcpTools = converter.convertAllTools(client);
  
  // Create engine with MCP tools
  const engine = new CodemodeEngine({
    generateCode: async () => {
      return `
        const data = await tools.mcp_get_data({ id: "123" });
        return { data };
      `;
    },
    tools: mcpTools
  });
  
  // Execute and verify
  const response = await engine.execute({ userRequest: "Get data" });
  // Assert response is successful
  // Assert MCP tool was called
}
```

**Files to Create**:
- `tests/integration/MCPEndToEnd.test.ts` (~350 lines)

**Expected Results**:
- 12 tests, all passing
- Verify full MCP workflow
- Verify integration with CodemodeEngine
- Verify mixed tool scenarios

---

### MCP Testing Summary

**Total Files**: 4 new files
**Total Lines**: ~1,200 lines
**Total Tests**: 42 tests
**Total Time**: 3 hours

**Deliverables**:
- ✅ Mock MCP server for testing
- ✅ MCPClient fully tested (17 tests)
- ✅ MCPToolConverter fully tested (13 tests)
- ✅ End-to-end MCP workflow tested (12 tests)
- ✅ Documentation of MCP usage patterns

---

## 🤖 Part 2: Real LLM Integration (2-3 hours)

### Goal
Create working examples with real LLM providers (OpenAI and Anthropic) to validate prompt engineering and code generation quality.

### Current Status
- ⚠️  Example code exists but commented out
- ❌ No working integration with real LLMs
- ❌ No validation of prompt effectiveness
- ❌ No comparison between providers

### Why This Matters
- Need to verify LLM can generate valid code from our prompts
- Need to understand LLM-specific quirks (markdown blocks, etc.)
- Need to establish best practices for prompt engineering
- Need to compare quality across providers

---

### Task Breakdown

#### Task 2.1: OpenAI Integration (45 minutes)

**Objective**: Create working example with OpenAI's GPT-4

**Location**: `examples/openai-integration.ts`

**Implementation Steps**:

1. **Set up OpenAI client** (10 min)
   ```typescript
   import OpenAI from "openai";
   import { CodemodeEngine } from "../src/index.js";
   
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY,
   });
   
   async function generateCodeWithOpenAI(prompt: string): Promise<string> {
     const response = await openai.chat.completions.create({
       model: "gpt-4",
       messages: [
         {
           role: "system",
           content: `You are a code-generating AI assistant. Generate ONLY JavaScript code.
   
   CRITICAL RULES:
   - Do NOT wrap code in markdown code blocks
   - Do NOT include any explanations or comments outside the code
   - Do NOT include \`\`\`javascript or \`\`\` markers
   - Output ONLY the JavaScript code that accomplishes the task`
         },
         {
           role: "user",
           content: prompt
         }
       ],
       temperature: 0.2, // Lower for more consistent code
       max_tokens: 2000,
     });
     
     let code = response.choices[0].message.content || "";
     
     // Clean up any markdown blocks if LLM ignored instructions
     code = code.replace(/```javascript\n?/g, "").replace(/```\n?/g, "");
     code = code.trim();
     
     return code;
   }
   ```

2. **Create test scenarios** (20 min)
   ```typescript
   const tools = {
     fetchUser: { ... },
     sendEmail: { ... },
     logActivity: { ... }
   };
   
   const testScenarios = [
     {
       name: "Simple tool call",
       request: "Fetch user with ID 123",
       expectedTools: ["fetchUser"]
     },
     {
       name: "Multiple tools",
       request: "Fetch user 123, send them an email, and log the activity",
       expectedTools: ["fetchUser", "sendEmail", "logActivity"]
     },
     {
       name: "Conditional logic",
       request: "Fetch user 123, if they have an email, send them a message",
       expectedTools: ["fetchUser", "sendEmail"]
     },
     {
       name: "Data processing",
       request: "Fetch users 1, 2, and 3, then return their names in an array",
       expectedTools: ["fetchUser"]
     }
   ];
   ```

3. **Run and validate** (15 min)
   ```typescript
   async function main() {
     const engine = new CodemodeEngine({
       generateCode: generateCodeWithOpenAI,
       tools,
       verbose: true
     });
     
     for (const scenario of testScenarios) {
       console.log(`\nScenario: ${scenario.name}`);
       console.log(`Request: ${scenario.request}`);
       
       const response = await engine.execute({
         userRequest: scenario.request
       });
       
       console.log(`Success: ${response.result.success}`);
       console.log(`Generated code:\n${response.code}`);
       
       if (response.result.success) {
         console.log(`Result: ${JSON.stringify(response.result.result, null, 2)}`);
       } else {
         console.log(`Error: ${response.result.error?.message}`);
       }
     }
   }
   ```

**Files to Create**:
- `examples/openai-integration.ts` (~250 lines)
- `.env.example` (add OPENAI_API_KEY)

**Package Dependencies**:
```bash
npm install openai dotenv
```

**Environment Setup**:
```bash
# .env
OPENAI_API_KEY=sk-...
```

**Expected Results**:
- All 4 scenarios execute successfully
- Code is valid JavaScript
- Tools are called correctly
- Results are as expected

---

#### Task 2.2: Anthropic Integration (45 minutes)

**Objective**: Create working example with Anthropic's Claude

**Location**: `examples/anthropic-integration.ts`

**Implementation Steps**:

1. **Set up Anthropic client** (10 min)
   ```typescript
   import Anthropic from "@anthropic-ai/sdk";
   import { CodemodeEngine } from "../src/index.js";
   
   const anthropic = new Anthropic({
     apiKey: process.env.ANTHROPIC_API_KEY,
   });
   
   async function generateCodeWithClaude(prompt: string): Promise<string> {
     const response = await anthropic.messages.create({
       model: "claude-3-5-sonnet-20241022",
       max_tokens: 2000,
       system: `You are a code-generating AI assistant. Generate ONLY JavaScript code.
   
   CRITICAL RULES:
   - Do NOT wrap code in markdown code blocks
   - Do NOT include any explanations or comments outside the code
   - Do NOT include \`\`\`javascript or \`\`\` markers
   - Output ONLY the JavaScript code that accomplishes the task`,
       messages: [
         {
           role: "user",
           content: prompt
         }
       ],
       temperature: 0.2,
     });
     
     const content = response.content[0];
     if (content.type !== "text") {
       throw new Error("Expected text response from Claude");
     }
     
     let code = content.text;
     
     // Clean up markdown blocks
     code = code.replace(/```javascript\n?/g, "").replace(/```\n?/g, "");
     code = code.trim();
     
     return code;
   }
   ```

2. **Use same test scenarios** (5 min)
   - Reuse scenarios from OpenAI example
   - Same tools, same expectations

3. **Run and compare** (30 min)
   ```typescript
   async function main() {
     const engine = new CodemodeEngine({
       generateCode: generateCodeWithClaude,
       tools,
       verbose: true
     });
     
     // Run same scenarios
     // Compare results with OpenAI
     // Document differences
   }
   ```

**Files to Create**:
- `examples/anthropic-integration.ts` (~250 lines)
- Update `.env.example` (add ANTHROPIC_API_KEY)

**Package Dependencies**:
```bash
npm install @anthropic-ai/sdk
```

**Environment Setup**:
```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

**Expected Results**:
- All 4 scenarios execute successfully
- Code quality comparison with OpenAI
- Note any differences in behavior

---

#### Task 2.3: Prompt Engineering Guide (30 minutes)

**Objective**: Document best practices for LLM prompts based on testing

**Location**: `docs/PROMPT_ENGINEERING.md`

**Content to Document**:

1. **System Message Best Practices** (10 min)
   - Clear instructions to output only code
   - Emphasize no markdown
   - Specify JavaScript version
   - Tool calling expectations

2. **Prompt Structure** (10 min)
   - How type definitions help
   - Role of tool descriptions
   - Importance of examples
   - Context passing strategies

3. **Common Issues and Solutions** (10 min)
   - Markdown code blocks → solution: system prompt + cleaning
   - Missing return statement → solution: explicit instruction
   - Wrong tool names → solution: better type definitions
   - Complex logic failures → solution: few-shot examples

**Content Structure**:
```markdown
# Prompt Engineering Guide

## Overview
How to craft effective prompts for code generation...

## System Message
Best practices for system messages...

## User Prompt Structure
How to structure the user prompt...

## Type Definitions
How type definitions improve accuracy...

## Common Issues
Problems and solutions...

## LLM Comparison
OpenAI vs Anthropic vs others...

## Examples
Good and bad prompts...
```

**Files to Create**:
- `docs/PROMPT_ENGINEERING.md` (~500 lines)

---

#### Task 2.4: LLM Comparison Tool (30 minutes)

**Objective**: Create utility to compare LLM performance side-by-side

**Location**: `examples/compare-llms.ts`

**Implementation**:
```typescript
import { generateCodeWithOpenAI } from "./openai-integration.js";
import { generateCodeWithClaude } from "./anthropic-integration.js";

interface ComparisonResult {
  scenario: string;
  openai: {
    success: boolean;
    time: number;
    code: string;
    result?: any;
    error?: string;
  };
  anthropic: {
    success: boolean;
    time: number;
    code: string;
    result?: any;
    error?: string;
  };
}

async function compareOnScenario(
  scenario: TestScenario,
  tools: ToolSet
): Promise<ComparisonResult> {
  const result: ComparisonResult = {
    scenario: scenario.name,
    openai: {} as any,
    anthropic: {} as any
  };
  
  // Test with OpenAI
  const openaiEngine = new CodemodeEngine({
    generateCode: generateCodeWithOpenAI,
    tools
  });
  
  const openaiStart = Date.now();
  const openaiResponse = await openaiEngine.execute({
    userRequest: scenario.request
  });
  result.openai = {
    success: openaiResponse.result.success,
    time: Date.now() - openaiStart,
    code: openaiResponse.code,
    result: openaiResponse.result.result,
    error: openaiResponse.result.error?.message
  };
  
  // Test with Anthropic (same structure)
  // ...
  
  return result;
}

async function main() {
  console.log("🔬 LLM Comparison Tool\n");
  
  const results: ComparisonResult[] = [];
  for (const scenario of testScenarios) {
    const result = await compareOnScenario(scenario, tools);
    results.push(result);
    printComparison(result);
  }
  
  printSummary(results);
}
```

**Files to Create**:
- `examples/compare-llms.ts` (~300 lines)

**Expected Output**:
```
🔬 LLM Comparison Tool

Scenario: Simple tool call
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OpenAI (GPT-4)
  ✅ Success in 1,234ms
  Code length: 87 chars
  
Anthropic (Claude)
  ✅ Success in 987ms
  Code length: 92 chars

Winner: Anthropic (faster)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  OpenAI: 4/4 scenarios (100%)
  Anthropic: 4/4 scenarios (100%)
  
  Avg time OpenAI: 1,150ms
  Avg time Anthropic: 950ms
  
  Code quality: Similar
  Recommendation: Both work well, Anthropic slightly faster
```

---

### LLM Integration Summary

**Total Files**: 5 new files
**Total Lines**: ~1,300 lines
**Total Time**: 2.5-3 hours

**Deliverables**:
- ✅ OpenAI integration example
- ✅ Anthropic integration example  
- ✅ Prompt engineering guide
- ✅ LLM comparison tool
- ✅ .env.example with API key templates
- ✅ Documentation of findings

---

## 📋 Complete Checklist

### MCP Integration Tests (3 hours)
- [ ] Task 1.1: Create Mock MCP Server (1 hour)
- [ ] Task 1.2: Test MCPClient (45 min)
- [ ] Task 1.3: Test MCPToolConverter (30 min)
- [ ] Task 1.4: End-to-End MCP Test (45 min)

### Real LLM Integration (2-3 hours)
- [ ] Task 2.1: OpenAI Integration (45 min)
- [ ] Task 2.2: Anthropic Integration (45 min)
- [ ] Task 2.3: Prompt Engineering Guide (30 min)
- [ ] Task 2.4: LLM Comparison Tool (30 min)

### Dependencies
- [ ] Install OpenAI SDK: `npm install openai`
- [ ] Install Anthropic SDK: `npm install @anthropic-ai/sdk`
- [ ] Install dotenv: `npm install dotenv`
- [ ] Create `.env.example` file
- [ ] Update package.json scripts

---

## 🚀 Getting Started

### Prerequisites
1. Node.js 18+ installed
2. OpenAI API key (from platform.openai.com)
3. Anthropic API key (from console.anthropic.com)
4. ~$5-10 credit for testing

### Setup Steps
```bash
# 1. Install new dependencies
cd codemode-standalone
npm install openai @anthropic-ai/sdk dotenv

# 2. Create .env file
cp .env.example .env
# Edit .env and add your API keys

# 3. Start with MCP tests
npx tsx tests/mocks/MockMCPServer.ts

# 4. Test OpenAI integration
npx tsx examples/openai-integration.ts

# 5. Test Anthropic integration
npx tsx examples/anthropic-integration.ts

# 6. Compare LLMs
npx tsx examples/compare-llms.ts
```

---

## 📊 Success Criteria

### MCP Integration
- ✅ Mock MCP server works
- ✅ 42 new tests, all passing
- ✅ Full MCP workflow tested
- ✅ Multi-server support verified
- ✅ Documentation complete

### LLM Integration
- ✅ Both OpenAI and Anthropic work
- ✅ All test scenarios pass
- ✅ Code quality is good
- ✅ Prompt engineering documented
- ✅ Comparison tool provides insights

---

## 🎯 Next Actions After Completion

1. **Update TESTING_SUMMARY.md** with new test count
2. **Update README.md** with LLM integration examples
3. **Update package.json** with new dependencies
4. **Create PR** with all changes
5. **Update NEXT_STEPS.md** to mark these complete

---

## 📞 Questions During Implementation?

- Check existing MCPClient code for patterns
- Reference isolated-vm documentation for limitations
- Test with small prompts first, then increase complexity
- Compare generated code quality across scenarios
- Document any unexpected behavior

---

**Ready to implement!** Start with Task 1.1 (Mock MCP Server) and work through sequentially.

