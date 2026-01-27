/**
 * Unit tests for TypeGenerator
 */

import { TypeGenerator } from "../../src/core/TypeGenerator.js";
import { z } from "zod";
import type { ToolSet } from "../../src/types/index.js";

const testTools: ToolSet = {
  simpleStringTool: {
    name: "simpleStringTool",
    description: "A simple tool with string input",
    inputSchema: z.object({
      message: z.string(),
    }),
    execute: async (args) => ({ result: args.message }),
  },
  complexTool: {
    name: "complexTool",
    description: "A tool with complex input schema",
    inputSchema: z.object({
      name: z.string().describe("User's name"),
      age: z.number().describe("User's age"),
      email: z.string().email().optional(),
      preferences: z.object({
        notifications: z.boolean(),
        theme: z.enum(["light", "dark"]),
      }),
    }),
    outputSchema: z.object({
      id: z.string(),
      created: z.boolean(),
    }),
    execute: async () => ({ id: "123", created: true }),
  },
  arrayTool: {
    name: "arrayTool",
    description: "A tool with array inputs",
    inputSchema: z.object({
      items: z.array(z.string()),
      counts: z.array(z.number()),
    }),
    execute: async () => ({}),
  },
};

async function runTests() {
  console.log("🧪 Testing TypeGenerator...\n");

  let passedTests = 0;
  let totalTests = 0;

  const generator = new TypeGenerator();

  // Test 1: Generate type definitions for simple tool
  totalTests++;
  try {
    const simpleTool = { simpleStringTool: testTools.simpleStringTool };
    const types = await generator.generateTypeDefinitions(simpleTool);
    if (
      types.includes("SimpleStringToolInput") &&
      types.includes("message") &&
      types.includes("declare const tools")
    ) {
      console.log("✅ Test 1: Generate type definitions for simple tool");
      passedTests++;
    } else {
      console.log("❌ Test 1: Generated types missing expected content");
      console.log("Generated:", types);
    }
  } catch (error) {
    console.log(`❌ Test 1: Generate type definitions - ${error}`);
  }

  // Test 2: Generate type definitions for complex tool
  totalTests++;
  try {
    const complexTool = { complexTool: testTools.complexTool };
    const types = await generator.generateTypeDefinitions(complexTool);
    if (
      types.includes("ComplexToolInput") &&
      types.includes("ComplexToolOutput") &&
      types.includes("name") &&
      types.includes("age") &&
      types.includes("preferences")
    ) {
      console.log("✅ Test 2: Generate type definitions for complex tool");
      passedTests++;
    } else {
      console.log("❌ Test 2: Complex tool types missing expected content");
    }
  } catch (error) {
    console.log(`❌ Test 2: Generate type definitions for complex tool - ${error}`);
  }

  // Test 3: Generate type definitions for tool with arrays
  totalTests++;
  try {
    const arrayTool = { arrayTool: testTools.arrayTool };
    const types = await generator.generateTypeDefinitions(arrayTool);
    if (
      types.includes("ArrayToolInput") &&
      types.includes("items") &&
      types.includes("counts")
    ) {
      console.log("✅ Test 3: Generate type definitions for array tool");
      passedTests++;
    } else {
      console.log("❌ Test 3: Array tool types missing expected content");
    }
  } catch (error) {
    console.log(`❌ Test 3: Generate type definitions for array tool - ${error}`);
  }

  // Test 4: Generate type definitions for multiple tools
  totalTests++;
  try {
    const types = await generator.generateTypeDefinitions(testTools);
    const toolNames = Object.keys(testTools);
    let allPresent = true;
    for (const toolName of toolNames) {
      if (!types.includes(toolName)) {
        allPresent = false;
        break;
      }
    }
    if (allPresent && types.includes("declare const tools")) {
      console.log("✅ Test 4: Generate type definitions for multiple tools");
      passedTests++;
    } else {
      console.log("❌ Test 4: Multiple tools - not all tools present in output");
    }
  } catch (error) {
    console.log(`❌ Test 4: Generate type definitions for multiple tools - ${error}`);
  }

  // Test 5: Generate tool descriptions
  totalTests++;
  try {
    const descriptions = generator.generateToolDescriptions(testTools);
    if (
      descriptions.includes("simpleStringTool") &&
      descriptions.includes("complexTool") &&
      descriptions.includes("arrayTool") &&
      descriptions.includes("A simple tool with string input")
    ) {
      console.log("✅ Test 5: Generate tool descriptions");
      passedTests++;
    } else {
      console.log("❌ Test 5: Tool descriptions missing expected content");
      console.log("Generated:", descriptions);
    }
  } catch (error) {
    console.log(`❌ Test 5: Generate tool descriptions - ${error}`);
  }

  // Test 6: Type definitions include JSDoc comments
  totalTests++;
  try {
    const types = await generator.generateTypeDefinitions(testTools);
    if (types.includes("/**") && types.includes("*/")) {
      console.log("✅ Test 6: Type definitions include JSDoc comments");
      passedTests++;
    } else {
      console.log("❌ Test 6: JSDoc comments not found in type definitions");
    }
  } catch (error) {
    console.log(`❌ Test 6: Type definitions include JSDoc comments - ${error}`);
  }

  // Test 7: Output schema generates correct types
  totalTests++;
  try {
    const complexTool = { complexTool: testTools.complexTool };
    const types = await generator.generateTypeDefinitions(complexTool);
    if (
      types.includes("ComplexToolOutput") &&
      types.includes("id") &&
      types.includes("created")
    ) {
      console.log("✅ Test 7: Output schema generates correct types");
      passedTests++;
    } else {
      console.log("❌ Test 7: Output schema types missing expected content");
    }
  } catch (error) {
    console.log(`❌ Test 7: Output schema generates correct types - ${error}`);
  }

  // Test 8: Handle tool without output schema
  totalTests++;
  try {
    const simpleTool = { simpleStringTool: testTools.simpleStringTool };
    const types = await generator.generateTypeDefinitions(simpleTool);
    if (types.includes("SimpleStringToolOutput")) {
      console.log("✅ Test 8: Handle tool without output schema (generates default)");
      passedTests++;
    } else {
      console.log("❌ Test 8: Missing output schema handling");
    }
  } catch (error) {
    console.log(`❌ Test 8: Handle tool without output schema - ${error}`);
  }

  // Test 9: Type definitions are valid TypeScript syntax
  totalTests++;
  try {
    const types = await generator.generateTypeDefinitions(testTools);
    // Basic syntax validation
    const hasValidSyntax =
      types.includes("declare const tools") &&
      types.split("{").length === types.split("}").length && // Balanced braces
      types.includes("Input") && // Has input types
      types.includes("Output") && // Has output types
      types.includes("Promise<"); // Functions return promises
    if (hasValidSyntax) {
      console.log("✅ Test 9: Type definitions have valid TypeScript syntax");
      passedTests++;
    } else {
      console.log("❌ Test 9: Invalid TypeScript syntax detected");
    }
  } catch (error) {
    console.log(`❌ Test 9: Type definitions syntax validation - ${error}`);
  }

  // Test 10: Enum types are properly converted
  totalTests++;
  try {
    const complexTool = { complexTool: testTools.complexTool };
    const types = await generator.generateTypeDefinitions(complexTool);
    if (
      (types.includes('"light"') && types.includes('"dark"')) ||
      (types.includes("'light'") && types.includes("'dark'"))
    ) {
      console.log("✅ Test 10: Enum types are properly converted");
      passedTests++;
    } else {
      console.log("❌ Test 10: Enum types not properly converted");
      console.log("Generated:", types);
    }
  } catch (error) {
    console.log(`❌ Test 10: Enum types conversion - ${error}`);
  }

  console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed`);
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

