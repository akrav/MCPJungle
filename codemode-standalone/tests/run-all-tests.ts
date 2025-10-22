/**
 * Test runner - runs all test suites
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define all test files
const tests = [
  { name: "ToolRegistry (Unit)", path: "tests/unit/ToolRegistry.test.ts" },
  { name: "TypeGenerator (Unit)", path: "tests/unit/TypeGenerator.test.ts" },
  { name: "SecurityPolicy (Unit)", path: "tests/unit/SecurityPolicy.test.ts" },
  { name: "MCPToolConverter (Unit)", path: "tests/unit/MCPToolConverter.test.ts" },
  { name: "MCP Workflow (Unit)", path: "tests/unit/MCPWorkflow.test.ts" },
  { name: "IsolatedExecutor (Integration)", path: "tests/integration/IsolatedExecutor.test.ts" },
  { name: "CodemodeEngine (Integration)", path: "tests/integration/CodemodeEngine.test.ts" },
];

interface TestResult {
  name: string;
  passed: boolean;
  output: string;
}

async function runTest(testPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const testFile = join(__dirname, "..", testPath);
    const proc = spawn("npx", ["tsx", testFile], {
      cwd: join(__dirname, ".."),
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", (error) => {
      console.error(`Error running test: ${error}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log("🧪 Running all tests for codemode-standalone\n");
  console.log("=".repeat(80));

  const results: TestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const test of tests) {
    console.log(`\n📋 Running: ${test.name}`);
    console.log("-".repeat(80));
    
    const passed = await runTest(test.path);
    
    if (passed) {
      totalPassed++;
      console.log(`\n✅ ${test.name} - PASSED`);
    } else {
      totalFailed++;
      console.log(`\n❌ ${test.name} - FAILED`);
    }
    
    console.log("-".repeat(80));
    
    results.push({
      name: test.name,
      passed,
      output: "",
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 Test Summary");
  console.log("=".repeat(80));
  
  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} - ${result.name}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log(`Total: ${totalPassed + totalFailed} tests`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log("=".repeat(80));

  if (totalFailed === 0) {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${totalFailed} test suite(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});

