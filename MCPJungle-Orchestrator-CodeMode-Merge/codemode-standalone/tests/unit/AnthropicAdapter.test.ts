/**
 * Tests for Anthropic adapter
 */

import { AnthropicCodeGenerator, SimpleCostTracker } from "../../src/llm/AnthropicAdapter.js";

// Mock Anthropic SDK
const mockMessageCreate = async (params: any) => {
  // Simulate Claude response
  return {
    id: "msg_test123",
    model: params.model,
    role: "assistant" as const,
    content: [
      {
        type: "text" as const,
        text: "const result = await tools.testTool({ arg: 'value' });\nreturn result;",
      },
    ],
    stop_reason: "end_turn" as const,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };
};

// Test suite
async function runTests() {
  let passedTests = 0;
  let failedTests = 0;

  console.log("🧪 Running Anthropic Adapter Tests\n");

  // Test 1: Constructor validates API key
  try {
    console.log("Test 1: Constructor validates API key requirement");
    
    // Save existing key
    const existingKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      new AnthropicCodeGenerator({});
      console.log("  ❌ FAILED - Should have thrown an error");
      failedTests++;
    } catch (error) {
      if (error instanceof Error && error.message.includes("API key")) {
        console.log("  ✅ PASSED - Correctly validates API key\n");
        passedTests++;
      } else {
        console.log("  ❌ FAILED - Wrong error message");
        failedTests++;
      }
    }

    // Restore key
    if (existingKey) {
      process.env.ANTHROPIC_API_KEY = existingKey;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 2: Default configuration
  try {
    console.log("Test 2: Default configuration values");
    
    const generator = new AnthropicCodeGenerator({
      apiKey: "test-key",
    });

    const config = generator.getConfig();
    
    if (
      config.model === "claude-3-5-sonnet-20241022" &&
      config.temperature === 0.3 &&
      config.maxTokens === 2048
    ) {
      console.log("  ✅ PASSED - Default config correct\n");
      passedTests++;
    } else {
      console.log("  ❌ FAILED - Default config incorrect");
      console.log(`     Got: ${JSON.stringify(config)}\n`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 3: Custom configuration
  try {
    console.log("Test 3: Custom configuration");
    
    const generator = new AnthropicCodeGenerator({
      apiKey: "test-key",
      model: "claude-3-5-haiku-20241022",
      temperature: 0.7,
      maxTokens: 4096,
    });

    const config = generator.getConfig();
    
    if (
      config.model === "claude-3-5-haiku-20241022" &&
      config.temperature === 0.7 &&
      config.maxTokens === 4096
    ) {
      console.log("  ✅ PASSED - Custom config applied\n");
      passedTests++;
    } else {
      console.log("  ❌ FAILED - Custom config not applied correctly\n");
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 4: Update configuration
  try {
    console.log("Test 4: Update configuration");
    
    const generator = new AnthropicCodeGenerator({
      apiKey: "test-key",
    });

    generator.updateConfig({
      temperature: 0.5,
      maxTokens: 1024,
    });

    const config = generator.getConfig();
    
    if (config.temperature === 0.5 && config.maxTokens === 1024) {
      console.log("  ✅ PASSED - Config updated correctly\n");
      passedTests++;
    } else {
      console.log("  ❌ FAILED - Config not updated\n");
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 5: Clean code response - removes markdown
  try {
    console.log("Test 5: Code cleaning removes markdown");
    
    const generator = new AnthropicCodeGenerator({
      apiKey: "test-key",
    });

    // Access private method through any cast for testing
    const cleanMethod = (generator as any).cleanCodeResponse.bind(generator);
    
    const input = "```javascript\nconst x = 5;\nreturn x;\n```";
    const output = cleanMethod(input);
    
    if (output === "const x = 5;\nreturn x;") {
      console.log("  ✅ PASSED - Markdown removed correctly\n");
      passedTests++;
    } else {
      console.log("  ❌ FAILED - Markdown not removed");
      console.log(`     Expected: "const x = 5;\\nreturn x;"`);
      console.log(`     Got: "${output}"\n`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 6: Cost calculation - Sonnet
  try {
    console.log("Test 6: Cost calculation for Claude 3.5 Sonnet");
    
    const generator = new AnthropicCodeGenerator({
      apiKey: "test-key",
      model: "claude-3-5-sonnet-20241022",
    });

    const cost = generator.calculateCost({
      prompt: 1_000_000, // 1M input tokens
      completion: 1_000_000, // 1M output tokens
    });

    // Sonnet: $3 per 1M input, $15 per 1M output = $18 total
    if (cost === 18) {
      console.log("  ✅ PASSED - Cost calculated correctly ($18.00)\n");
      passedTests++;
    } else {
      console.log(`  ❌ FAILED - Expected $18, got $${cost}\n`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 7: Cost calculation - Haiku
  try {
    console.log("Test 7: Cost calculation for Claude 3.5 Haiku");
    
    const generator = new AnthropicCodeGenerator({
      apiKey: "test-key",
      model: "claude-3-5-haiku-20241022",
    });

    const cost = generator.calculateCost({
      prompt: 1_000_000,
      completion: 1_000_000,
    });

    // Haiku: $0.8 per 1M input, $4 per 1M output = $4.8 total
    if (cost === 4.8) {
      console.log("  ✅ PASSED - Cost calculated correctly ($4.80)\n");
      passedTests++;
    } else {
      console.log(`  ❌ FAILED - Expected $4.8, got $${cost}\n`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 8: Cost tracker
  try {
    console.log("Test 8: SimpleCostTracker functionality");
    
    const tracker = new SimpleCostTracker();
    
    tracker.addRequest(1000, 0.05);
    tracker.addRequest(2000, 0.10);
    tracker.addRequest(1500, 0.075);

    const stats = tracker.getStats();
    
    if (
      stats.totalTokens === 4500 &&
      Math.abs(stats.totalCost - 0.225) < 0.0001 &&
      stats.requestCount === 3 &&
      stats.avgTokensPerRequest === 1500 &&
      Math.abs(stats.avgCostPerRequest - 0.075) < 0.0001
    ) {
      console.log("  ✅ PASSED - Cost tracker working correctly\n");
      passedTests++;
    } else {
      console.log("  ❌ FAILED - Cost tracker stats incorrect");
      console.log(`     Got: ${JSON.stringify(stats)}\n`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 9: Cost tracker reset
  try {
    console.log("Test 9: Cost tracker reset");
    
    const tracker = new SimpleCostTracker();
    tracker.addRequest(1000, 0.05);
    tracker.reset();
    
    const stats = tracker.getStats();
    
    if (
      stats.totalTokens === 0 &&
      stats.totalCost === 0 &&
      stats.requestCount === 0
    ) {
      console.log("  ✅ PASSED - Reset works correctly\n");
      passedTests++;
    } else {
      console.log("  ❌ FAILED - Reset didn't clear stats\n");
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 10: Cost tracker formatting
  try {
    console.log("Test 10: Cost tracker format output");
    
    const tracker = new SimpleCostTracker();
    tracker.addRequest(10000, 0.15);
    tracker.addRequest(5000, 0.075);
    
    const formatted = tracker.formatCost();
    
    if (formatted.includes("$0.2250") && formatted.includes("15,000") && formatted.includes("2 requests")) {
      console.log("  ✅ PASSED - Format output correct\n");
      passedTests++;
    } else {
      console.log(`  ❌ FAILED - Format output incorrect: "${formatted}"\n`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 11: Temperature of 0 is allowed
  try {
    console.log("Test 11: Temperature of 0 is allowed");
    
    const generator = new AnthropicCodeGenerator({
      apiKey: "test-key",
      temperature: 0,
    });

    const config = generator.getConfig();
    
    if (config.temperature === 0) {
      console.log("  ✅ PASSED - Temperature 0 accepted\n");
      passedTests++;
    } else {
      console.log(`  ❌ FAILED - Temperature is ${config.temperature}\n`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Test 12: Code cleaning handles no markdown
  try {
    console.log("Test 12: Code cleaning handles plain code");
    
    const generator = new AnthropicCodeGenerator({
      apiKey: "test-key",
    });

    const cleanMethod = (generator as any).cleanCodeResponse.bind(generator);
    
    const input = "const x = 5;\nreturn x;";
    const output = cleanMethod(input);
    
    if (output === "const x = 5;\nreturn x;") {
      console.log("  ✅ PASSED - Plain code unchanged\n");
      passedTests++;
    } else {
      console.log(`  ❌ FAILED - Plain code was modified\n`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED - ${error}\n`);
    failedTests++;
  }

  // Summary
  console.log("=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📝 Total: ${passedTests + failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  console.log("=".repeat(60));

  if (failedTests === 0) {
    console.log("\n🎉 All tests passed!\n");
  } else {
    console.log("\n⚠️  Some tests failed\n");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("Fatal test error:", error);
  process.exit(1);
});

