/**
 * Unit tests for SecurityPolicyManager
 */

import {
  SecurityPolicyManager,
  DEFAULT_SECURITY_POLICY,
} from "../../src/execution/SecurityPolicy.js";

async function runTests() {
  console.log("🧪 Testing SecurityPolicyManager...\n");

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Create manager with default policy
  totalTests++;
  try {
    const manager = new SecurityPolicyManager();
    const policy = manager.getPolicy();
    if (
      policy.maxExecutionTime === DEFAULT_SECURITY_POLICY.maxExecutionTime &&
      policy.maxMemoryMB === DEFAULT_SECURITY_POLICY.maxMemoryMB &&
      policy.allowNetworkAccess === DEFAULT_SECURITY_POLICY.allowNetworkAccess
    ) {
      console.log("✅ Test 1: Create manager with default policy");
      passedTests++;
    } else {
      console.log("❌ Test 1: Default policy values incorrect");
    }
  } catch (error) {
    console.log(`❌ Test 1: Create manager with default policy - ${error}`);
  }

  // Test 2: Create manager with custom policy
  totalTests++;
  try {
    const customPolicy = {
      maxExecutionTime: 5000,
      maxMemoryMB: 64,
      allowNetworkAccess: true,
    };
    const manager = new SecurityPolicyManager(customPolicy);
    const policy = manager.getPolicy();
    if (
      policy.maxExecutionTime === 5000 &&
      policy.maxMemoryMB === 64 &&
      policy.allowNetworkAccess === true
    ) {
      console.log("✅ Test 2: Create manager with custom policy");
      passedTests++;
    } else {
      console.log("❌ Test 2: Custom policy values incorrect");
    }
  } catch (error) {
    console.log(`❌ Test 2: Create manager with custom policy - ${error}`);
  }

  // Test 3: Update policy
  totalTests++;
  try {
    const manager = new SecurityPolicyManager();
    manager.updatePolicy({ maxExecutionTime: 10000 });
    const policy = manager.getPolicy();
    if (policy.maxExecutionTime === 10000) {
      console.log("✅ Test 3: Update policy");
      passedTests++;
    } else {
      console.log("❌ Test 3: Policy update failed");
    }
  } catch (error) {
    console.log(`❌ Test 3: Update policy - ${error}`);
  }

  // Test 4: Get policy returns a copy (immutability)
  totalTests++;
  try {
    const manager = new SecurityPolicyManager();
    const policy1 = manager.getPolicy();
    policy1.maxExecutionTime = 999;
    const policy2 = manager.getPolicy();
    if (policy2.maxExecutionTime !== 999) {
      console.log("✅ Test 4: Get policy returns a copy (immutable)");
      passedTests++;
    } else {
      console.log("❌ Test 4: Policy is not immutable");
    }
  } catch (error) {
    console.log(`❌ Test 4: Policy immutability - ${error}`);
  }

  // Test 5: Get max execution time
  totalTests++;
  try {
    const manager = new SecurityPolicyManager({ maxExecutionTime: 7500 });
    if (manager.getMaxExecutionTime() === 7500) {
      console.log("✅ Test 5: Get max execution time");
      passedTests++;
    } else {
      console.log("❌ Test 5: Max execution time incorrect");
    }
  } catch (error) {
    console.log(`❌ Test 5: Get max execution time - ${error}`);
  }

  // Test 6: Get max memory bytes
  totalTests++;
  try {
    const manager = new SecurityPolicyManager({ maxMemoryMB: 64 });
    const expectedBytes = 64 * 1024 * 1024;
    if (manager.getMaxMemoryBytes() === expectedBytes) {
      console.log("✅ Test 6: Get max memory bytes (MB to bytes conversion)");
      passedTests++;
    } else {
      console.log(
        `❌ Test 6: Expected ${expectedBytes}, got ${manager.getMaxMemoryBytes()}`
      );
    }
  } catch (error) {
    console.log(`❌ Test 6: Get max memory bytes - ${error}`);
  }

  // Test 7: Domain allowed - network disabled
  totalTests++;
  try {
    const manager = new SecurityPolicyManager({ allowNetworkAccess: false });
    if (!manager.isDomainAllowed("example.com")) {
      console.log("✅ Test 7: Domain blocked when network disabled");
      passedTests++;
    } else {
      console.log("❌ Test 7: Domain should be blocked when network disabled");
    }
  } catch (error) {
    console.log(`❌ Test 7: Domain allowed check - ${error}`);
  }

  // Test 8: Domain allowed - network enabled, no whitelist
  totalTests++;
  try {
    const manager = new SecurityPolicyManager({
      allowNetworkAccess: true,
      allowedDomains: [],
    });
    if (manager.isDomainAllowed("example.com")) {
      console.log("✅ Test 8: All domains allowed when no whitelist");
      passedTests++;
    } else {
      console.log("❌ Test 8: Domain should be allowed with no whitelist");
    }
  } catch (error) {
    console.log(`❌ Test 8: Domain allowed - no whitelist - ${error}`);
  }

  // Test 9: Domain allowed - with whitelist (exact match)
  totalTests++;
  try {
    const manager = new SecurityPolicyManager({
      allowNetworkAccess: true,
      allowedDomains: ["example.com", "api.example.com"],
    });
    if (
      manager.isDomainAllowed("example.com") &&
      manager.isDomainAllowed("api.example.com") &&
      !manager.isDomainAllowed("other.com")
    ) {
      console.log("✅ Test 9: Domain whitelist with exact matches");
      passedTests++;
    } else {
      console.log("❌ Test 9: Domain whitelist exact match failed");
    }
  } catch (error) {
    console.log(`❌ Test 9: Domain whitelist exact match - ${error}`);
  }

  // Test 10: Domain allowed - with wildcards
  totalTests++;
  try {
    const manager = new SecurityPolicyManager({
      allowNetworkAccess: true,
      allowedDomains: ["*.example.com"],
    });
    if (
      manager.isDomainAllowed("api.example.com") &&
      manager.isDomainAllowed("sub.example.com") &&
      !manager.isDomainAllowed("example.com") && // Wildcard doesn't match the root
      !manager.isDomainAllowed("other.com")
    ) {
      console.log("✅ Test 10: Domain whitelist with wildcards");
      passedTests++;
    } else {
      console.log("❌ Test 10: Domain whitelist wildcard match failed");
    }
  } catch (error) {
    console.log(`❌ Test 10: Domain whitelist wildcards - ${error}`);
  }

  // Test 11: Partial policy update preserves other values
  totalTests++;
  try {
    const manager = new SecurityPolicyManager({
      maxExecutionTime: 5000,
      maxMemoryMB: 64,
      allowNetworkAccess: true,
    });
    manager.updatePolicy({ maxExecutionTime: 10000 });
    const policy = manager.getPolicy();
    if (
      policy.maxExecutionTime === 10000 &&
      policy.maxMemoryMB === 64 &&
      policy.allowNetworkAccess === true
    ) {
      console.log("✅ Test 11: Partial policy update preserves other values");
      passedTests++;
    } else {
      console.log("❌ Test 11: Partial update corrupted other values");
    }
  } catch (error) {
    console.log(`❌ Test 11: Partial policy update - ${error}`);
  }

  // Test 12: Default values
  totalTests++;
  try {
    if (
      DEFAULT_SECURITY_POLICY.maxExecutionTime === 30000 &&
      DEFAULT_SECURITY_POLICY.maxMemoryMB === 128 &&
      DEFAULT_SECURITY_POLICY.allowNetworkAccess === false &&
      Array.isArray(DEFAULT_SECURITY_POLICY.allowedDomains)
    ) {
      console.log("✅ Test 12: Default security policy has expected values");
      passedTests++;
    } else {
      console.log("❌ Test 12: Default policy values unexpected");
    }
  } catch (error) {
    console.log(`❌ Test 12: Default policy values - ${error}`);
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

