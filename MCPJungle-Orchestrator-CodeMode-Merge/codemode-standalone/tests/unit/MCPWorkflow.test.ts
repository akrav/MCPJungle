/**
 * Unit tests for complete MCP workflow
 * Tests the full integration without requiring a live MCP server
 */

import { CodemodeEngine } from "../../src/core/CodemodeEngine.js";
import { MCPToolConverter } from "../../src/mcp/MCPToolConverter.js";
import type { MCPTool } from "../../src/mcp/types.js";
import type { ToolSet } from "../../src/types/index.js";
import { z } from "zod";

// Mock MCP Client
class MockMCPClientForWorkflow {
  private tools: MCPTool[] = [
    {
      name: "get_user",
      description: "Get user by ID",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "number" },
        },
        required: ["userId"],
      },
    },
    {
      name: "send_email",
      description: "Send an email",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["to", "subject", "body"],
      },
    },
    {
      name: "log_action",
      description: "Log an action",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string" },
          details: { type: "object" },
        },
        required: ["action"],
      },
    },
  ];

  getTools(): MCPTool[] {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    if (name === "get_user") {
      return {
        id: args.userId,
        name: `User ${args.userId}`,
        email: `user${args.userId}@example.com`,
      };
    } else if (name === "send_email") {
      return {
        sent: true,
        to: args.to,
        messageId: "msg-12345",
      };
    } else if (name === "log_action") {
      return {
        logged: true,
        timestamp: Date.now(),
        action: args.action,
      };
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  isConnected(): boolean {
    return true;
  }
}

async function runTests() {
  console.log("🧪 Testing MCP Workflow (Unit)...\n");

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Convert MCP tools to ToolSet
  totalTests++;
  try {
    const mockClient = new MockMCPClientForWorkflow() as any;
    const converter = new MCPToolConverter();
    const toolSet = converter.convertAllTools(mockClient);

    if (Object.keys(toolSet).length === 3) {
      console.log("✅ Test 1: Convert MCP tools to ToolSet");
      passedTests++;
    } else {
      console.log("❌ Test 1: Conversion failed");
    }
  } catch (error) {
    console.log(`❌ Test 1: ${error}`);
  }

  // Test 2: Call single MCP tool via generated code
  totalTests++;
  try {
    const mockClient = new MockMCPClientForWorkflow() as any;
    const converter = new MCPToolConverter();
    const toolSet = converter.convertAllTools(mockClient);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const user = await tools.mcp_get_user({ userId: 123 });
          return { userName: user.name };
        `;
      },
      tools: toolSet,
    });

    const response = await engine.execute({
      userRequest: "Get user 123",
    });

    if (response.result.success && response.result.result?.userName === "User 123") {
      console.log("✅ Test 2: Call single MCP tool via generated code");
      passedTests++;
    } else {
      console.log(`❌ Test 2: Execution failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 2: ${error}`);
  }

  // Test 3: Call multiple MCP tools in sequence
  totalTests++;
  try {
    const mockClient = new MockMCPClientForWorkflow() as any;
    const converter = new MCPToolConverter();
    const toolSet = converter.convertAllTools(mockClient);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const user = await tools.mcp_get_user({ userId: 456 });
          const emailResult = await tools.mcp_send_email({
            to: user.email,
            subject: "Hello",
            body: "Welcome!"
          });
          const logResult = await tools.mcp_log_action({
            action: "email_sent",
            details: { userId: user.id }
          });
          
          return {
            user: user.name,
            emailSent: emailResult.sent,
            logged: logResult.logged
          };
        `;
      },
      tools: toolSet,
    });

    const response = await engine.execute({
      userRequest: "Get user, send email, and log",
    });

    if (
      response.result.success &&
      response.result.result?.user === "User 456" &&
      response.result.result?.emailSent === true &&
      response.result.result?.logged === true
    ) {
      console.log("✅ Test 3: Call multiple MCP tools in sequence");
      passedTests++;
    } else {
      console.log(`❌ Test 3: Multi-call failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 3: ${error}`);
  }

  // Test 4: Pass data between MCP tool calls
  totalTests++;
  try {
    const mockClient = new MockMCPClientForWorkflow() as any;
    const converter = new MCPToolConverter();
    const toolSet = converter.convertAllTools(mockClient);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const user = await tools.mcp_get_user({ userId: 789 });
          const email = await tools.mcp_send_email({
            to: user.email,
            subject: "Hi " + user.name,
            body: "Your ID is " + user.id
          });
          
          return {
            recipient: user.email,
            messageId: email.messageId
          };
        `;
      },
      tools: toolSet,
    });

    const response = await engine.execute({
      userRequest: "Get user and send personalized email",
    });

    if (
      response.result.success &&
      response.result.result?.recipient === "user789@example.com" &&
      response.result.result?.messageId
    ) {
      console.log("✅ Test 4: Pass data between MCP tool calls");
      passedTests++;
    } else {
      console.log(`❌ Test 4: Data passing failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 4: ${error}`);
  }

  // Test 5: Conditional logic with MCP tools
  totalTests++;
  try {
    const mockClient = new MockMCPClientForWorkflow() as any;
    const converter = new MCPToolConverter();
    const toolSet = converter.convertAllTools(mockClient);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const user = await tools.mcp_get_user({ userId: 100 });
          
          let action;
          if (user.id > 50) {
            action = await tools.mcp_log_action({
              action: "high_id_user",
              details: { id: user.id }
            });
          } else {
            action = await tools.mcp_log_action({
              action: "low_id_user",
              details: { id: user.id }
            });
          }
          
          return {
            userId: user.id,
            actionLogged: action.action
          };
        `;
      },
      tools: toolSet,
    });

    const response = await engine.execute({
      userRequest: "Conditional MCP tool logic",
    });

    if (
      response.result.success &&
      response.result.result?.userId === 100 &&
      response.result.result?.actionLogged === "high_id_user"
    ) {
      console.log("✅ Test 5: Conditional logic with MCP tools");
      passedTests++;
    } else {
      console.log(`❌ Test 5: Conditional logic failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 5: ${error}`);
  }

  // Test 6: Mix MCP tools with local tools
  totalTests++;
  try {
    const mockClient = new MockMCPClientForWorkflow() as any;
    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(mockClient);

    // Add local tools
    const allTools: ToolSet = {
      ...mcpTools,
      local_uppercase: {
        name: "local_uppercase",
        description: "Convert text to uppercase",
        inputSchema: z.object({
          text: z.string(),
        }),
        execute: async (args: { text: string }) => {
          return { result: args.text.toUpperCase() };
        },
      },
    };

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const user = await tools.mcp_get_user({ userId: 555 });
          const uppercase = await tools.local_uppercase({ text: user.name });
          
          return {
            original: user.name,
            uppercase: uppercase.result
          };
        `;
      },
      tools: allTools,
    });

    const response = await engine.execute({
      userRequest: "Get user and uppercase their name",
    });

    if (
      response.result.success &&
      response.result.result?.original === "User 555" &&
      response.result.result?.uppercase === "USER 555"
    ) {
      console.log("✅ Test 6: Mix MCP tools with local tools");
      passedTests++;
    } else {
      console.log(`❌ Test 6: Mixed tools failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 6: ${error}`);
  }

  // Test 7: Verify namespacing prevents conflicts
  totalTests++;
  try {
    const mockClient = new MockMCPClientForWorkflow() as any;
    const converter = new MCPToolConverter();
    const mcpTools = converter.convertAllTools(mockClient);

    const allTools: ToolSet = {
      ...mcpTools,
      get_user: {
        // Same name as MCP tool (but MCP is prefixed)
        name: "get_user",
        description: "Local get user",
        inputSchema: z.object({
          userId: z.number(),
        }),
        execute: async (args: { userId: number }) => {
          return {
            id: args.userId,
            name: "LOCAL USER",
            source: "local",
          };
        },
      },
    };

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const mcpUser = await tools.mcp_get_user({ userId: 1 });
          const localUser = await tools.get_user({ userId: 2 });
          
          return {
            mcpName: mcpUser.name,
            localName: localUser.name
          };
        `;
      },
      tools: allTools,
    });

    const response = await engine.execute({
      userRequest: "Test namespacing",
    });

    if (
      response.result.success &&
      response.result.result?.mcpName === "User 1" &&
      response.result.result?.localName === "LOCAL USER"
    ) {
      console.log("✅ Test 7: Verify namespacing prevents conflicts");
      passedTests++;
    } else {
      console.log(`❌ Test 7: Namespacing failed: ${JSON.stringify(response.result)}`);
    }
  } catch (error) {
    console.log(`❌ Test 7: ${error}`);
  }

  // Test 8: Dynamic tool update simulation
  totalTests++;
  try {
    console.log("\n--- Hot Reload Simulation ---");
    
    // Simulate initial tool set
    const mockClient = new MockMCPClientForWorkflow() as any;
    const converter = new MCPToolConverter();
    let toolSet = converter.convertAllTools(mockClient);

    const engine = new CodemodeEngine({
      generateCode: async () => {
        return `
          const user = await tools.mcp_get_user({ userId: 999 });
          return { name: user.name };
        `;
      },
      tools: toolSet,
    });

    const result1 = await engine.execute({ userRequest: "Test 1" });
    console.log(`   Initial execution: ${result1.result.result?.name}`);

    // Simulate tool update (hot reload) - create a NEW engine with the updated tool set
    const newTool = {
      name: "calculate",
      description: "Perform calculation",
      inputSchema: {
        type: "object",
        properties: {
          expression: { type: "string" },
        },
        required: ["expression"],
      },
    };

    // Mock client with new tool
    class UpdatedMockClient extends MockMCPClientForWorkflow {
      getTools() {
        return [...super.getTools(), newTool as MCPTool];
      }
      
      async callTool(name: string, args: Record<string, any>) {
        if (name === "calculate") {
          return { result: eval(args.expression) };
        }
        return super.callTool(name, args);
      }
    }

    const updatedClient = new UpdatedMockClient() as any;
    const updatedToolSet = converter.convertAllTools(updatedClient);

    // Create NEW engine with updated tools (simulates hot reload)
    const engine2 = new CodemodeEngine({
      generateCode: async () => {
        return `
          const calc = await tools.mcp_calculate({ expression: "2 + 2" });
          return { calculation: calc.result };
        `;
      },
      tools: updatedToolSet,
    });

    const result2 = await engine2.execute({ userRequest: "Test calculation" });
    console.log(`   After hot reload: ${result2.result.result?.calculation}`);

    if (result1.result.success && result2.result.success && result2.result.result?.calculation === 4) {
      console.log("✅ Test 8: Dynamic tool update simulation\n");
      passedTests++;
    } else {
      console.log("❌ Test 8: Hot reload simulation failed\n");
    }
  } catch (error) {
    console.log(`❌ Test 8: ${error}\n`);
  }

  console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);
  return passedTests === totalTests;
}

runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });

