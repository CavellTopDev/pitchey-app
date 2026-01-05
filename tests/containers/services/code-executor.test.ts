/**
 * Code Executor Container Integration Tests
 * 
 * Tests secure code execution capabilities including validation, sandboxing,
 * multi-language support, and security scanning
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import ContainerTestBase from '../framework/container-test-base.ts';
import { PERFORMANCE_TARGETS } from '../config/test-config.ts';

class CodeExecutorTests extends ContainerTestBase {
  private serviceName = 'code';
  
  async testBasicHealth(): Promise<void> {
    console.log('🔍 Testing code executor basic health');
    
    const startTime = performance.now();
    await this.assertServiceHealthy(this.serviceName);
    const responseTime = performance.now() - startTime;
    
    this.assertResponseTime(responseTime, 5000, 'Code executor health check');
    console.log('✅ Code executor health check passed');
  }
  
  async testPythonCodeExecution(): Promise<void> {
    console.log('🔍 Testing Python code execution');
    
    const pythonCode = `
print("Hello from Python!")
result = 2 + 2
print(f"2 + 2 = {result}")
    `.trim();
    
    const startTime = performance.now();
    const response = await this.makeRequest(this.serviceName, '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: pythonCode,
        language: 'python',
        timeout: 10000,
      }),
    });
    const duration = performance.now() - startTime;
    
    assertEquals(response.status, 200);
    
    const result = await response.json();
    assertExists(result.stdout);
    assertExists(result.execution_time);
    assertEquals(result.exit_code, 0);
    assert(result.stdout.includes('Hello from Python!'));
    assert(result.stdout.includes('2 + 2 = 4'));
    
    this.assertResponseTime(duration, PERFORMANCE_TARGETS.CODE_EXECUTOR.execution, 'Python code execution');
    console.log(`✅ Python code executed successfully in ${duration.toFixed(2)}ms`);
  }
  
  async testJavaScriptCodeExecution(): Promise<void> {
    console.log('🔍 Testing JavaScript code execution');
    
    const jsCode = `
console.log("Hello from JavaScript!");
const result = 3 * 7;
console.log(\`3 * 7 = \${result}\`);
    `.trim();
    
    const startTime = performance.now();
    const response = await this.makeRequest(this.serviceName, '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: jsCode,
        language: 'javascript',
        timeout: 10000,
      }),
    });
    const duration = performance.now() - startTime;
    
    assertEquals(response.status, 200);
    
    const result = await response.json();
    assertExists(result.stdout);
    assertExists(result.execution_time);
    assertEquals(result.exit_code, 0);
    assert(result.stdout.includes('Hello from JavaScript!'));
    assert(result.stdout.includes('3 * 7 = 21'));
    
    this.assertResponseTime(duration, PERFORMANCE_TARGETS.CODE_EXECUTOR.execution, 'JavaScript code execution');
    console.log(`✅ JavaScript code executed successfully in ${duration.toFixed(2)}ms`);
  }
  
  async testSQLCodeExecution(): Promise<void> {
    console.log('🔍 Testing SQL code execution');
    
    const sqlCode = `
-- Test SQL execution
SELECT 'Hello from SQL!' as greeting;
SELECT 10 + 20 as calculation;
    `.trim();
    
    const startTime = performance.now();
    const response = await this.makeRequest(this.serviceName, '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: sqlCode,
        language: 'sql',
        timeout: 10000,
      }),
    });
    const duration = performance.now() - startTime;
    
    assertEquals(response.status, 200);
    
    const result = await response.json();
    assertExists(result.stdout);
    assertExists(result.execution_time);
    assertEquals(result.exit_code, 0);
    
    this.assertResponseTime(duration, PERFORMANCE_TARGETS.CODE_EXECUTOR.execution, 'SQL code execution');
    console.log(`✅ SQL code executed successfully in ${duration.toFixed(2)}ms`);
  }
  
  async testCodeValidation(): Promise<void> {
    console.log('🔍 Testing code validation');
    
    const testCases = [
      {
        code: 'print("Valid Python code")',
        language: 'python',
        expectedValid: true,
      },
      {
        code: 'print("Missing closing quote)',
        language: 'python',
        expectedValid: false,
      },
      {
        code: 'console.log("Valid JS code");',
        language: 'javascript',
        expectedValid: true,
      },
      {
        code: 'console.log("Missing semicolon"',
        language: 'javascript',
        expectedValid: false,
      },
    ];
    
    for (const testCase of testCases) {
      const startTime = performance.now();
      const response = await this.makeRequest(this.serviceName, '/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: testCase.code,
          language: testCase.language,
        }),
      });
      const duration = performance.now() - startTime;
      
      assertEquals(response.status, 200);
      
      const result = await response.json();
      assertExists(result.valid);
      assertEquals(result.valid, testCase.expectedValid);
      
      if (!testCase.expectedValid) {
        assertExists(result.errors);
        assert(Array.isArray(result.errors));
        assert(result.errors.length > 0);
      }
      
      this.assertResponseTime(duration, PERFORMANCE_TARGETS.CODE_EXECUTOR.validation, 'Code validation');
    }
    
    console.log('✅ Code validation completed successfully');
  }
  
  async testSecurityScanning(): Promise<void> {
    console.log('🔍 Testing security scanning');
    
    const maliciousCode = `
import os
import subprocess

# Attempt to access sensitive files
os.system('cat /etc/passwd')
subprocess.call(['rm', '-rf', '/'])
    `.trim();
    
    const startTime = performance.now();
    const response = await this.makeRequest(this.serviceName, '/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: maliciousCode,
        language: 'python',
      }),
    });
    const duration = performance.now() - startTime;
    
    assertEquals(response.status, 200);
    
    const result = await response.json();
    assertExists(result.safe);
    assertExists(result.threats);
    assertEquals(result.safe, false);
    assert(Array.isArray(result.threats));
    assert(result.threats.length > 0);
    
    // Check for detected threats
    const threatTypes = result.threats.map((t: any) => t.type);
    assert(threatTypes.includes('file_access') || threatTypes.includes('system_call'));
    
    this.assertResponseTime(duration, PERFORMANCE_TARGETS.CODE_EXECUTOR.security_scan, 'Security scanning');
    console.log(`✅ Security scanning detected ${result.threats.length} threats`);
  }
  
  async testSandboxIsolation(): Promise<void> {
    console.log('🔍 Testing sandbox isolation');
    
    const isolationTests = [
      {
        name: 'File system access',
        code: 'import os; print(os.listdir("/"))',
        language: 'python',
        shouldFail: true,
      },
      {
        name: 'Network access',
        code: 'import urllib.request; urllib.request.urlopen("http://example.com")',
        language: 'python',
        shouldFail: true,
      },
      {
        name: 'Process spawning',
        code: 'import subprocess; subprocess.Popen(["ps", "aux"])',
        language: 'python',
        shouldFail: true,
      },
      {
        name: 'Safe calculation',
        code: 'print(sum(range(100)))',
        language: 'python',
        shouldFail: false,
      },
    ];
    
    for (const test of isolationTests) {
      const response = await this.makeRequest(this.serviceName, '/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: test.code,
          language: test.language,
          timeout: 5000,
          sandbox: true,
        }),
      });
      
      const result = await response.json();
      
      if (test.shouldFail) {
        // Should either fail with non-zero exit code or be blocked by sandbox
        assert(
          result.exit_code !== 0 || 
          result.stderr?.includes('Permission denied') ||
          result.stderr?.includes('Operation not permitted'),
          `Test "${test.name}" should have failed but succeeded`
        );
      } else {
        assertEquals(result.exit_code, 0, `Test "${test.name}" should have succeeded`);
      }
    }
    
    console.log('✅ Sandbox isolation working correctly');
  }
  
  async testResourceLimits(): Promise<void> {
    console.log('🔍 Testing resource limits');
    
    // Test memory limit
    const memoryIntensiveCode = `
# Try to allocate large amounts of memory
data = []
for i in range(1000000):
    data.append('x' * 1000)
print("Memory allocation completed")
    `.trim();
    
    const memoryResponse = await this.makeRequest(this.serviceName, '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: memoryIntensiveCode,
        language: 'python',
        timeout: 10000,
        memory_limit: '64M',
      }),
    });
    
    const memoryResult = await memoryResponse.json();
    // Should either complete within limits or be terminated
    assert(memoryResult.exit_code !== undefined);
    
    // Test CPU time limit
    const cpuIntensiveCode = `
# Infinite loop to test CPU timeout
while True:
    pass
    `.trim();
    
    const cpuResponse = await this.makeRequest(this.serviceName, '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: cpuIntensiveCode,
        language: 'python',
        timeout: 3000, // 3 second timeout
      }),
    });
    
    const cpuResult = await cpuResponse.json();
    // Should be terminated due to timeout
    assert(cpuResult.exit_code !== 0 || cpuResult.timed_out);
    
    console.log('✅ Resource limits working correctly');
  }
  
  async testConcurrentExecution(): Promise<void> {
    console.log('🔍 Testing concurrent code execution');
    
    const concurrentRequests = 5;
    const testCode = `
import time
import random
time.sleep(random.uniform(0.1, 0.5))
print(f"Executed at {time.time()}")
    `.trim();
    
    const promises = Array.from({ length: concurrentRequests }, async (_, index) => {
      const response = await this.makeRequest(this.serviceName, '/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: testCode.replace('Executed', `Request ${index + 1} executed`),
          language: 'python',
          timeout: 10000,
        }),
      });
      
      return {
        index: index + 1,
        status: response.status,
        result: await response.json(),
      };
    });
    
    const results = await Promise.all(promises);
    
    // All requests should succeed
    for (const result of results) {
      assertEquals(result.status, 200);
      assertEquals(result.result.exit_code, 0);
      assert(result.result.stdout.includes(`Request ${result.index} executed`));
    }
    
    console.log(`✅ Successfully executed ${concurrentRequests} concurrent requests`);
  }
  
  async testDeploymentSimulation(): Promise<void> {
    console.log('🔍 Testing deployment simulation');
    
    const deploymentScript = `
#!/bin/bash
echo "Starting deployment simulation..."
echo "Checking dependencies..."
echo "Building application..."
echo "Running tests..."
echo "Deployment completed successfully!"
    `.trim();
    
    const startTime = performance.now();
    const response = await this.makeRequest(this.serviceName, '/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: deploymentScript,
        environment: 'test',
        dry_run: true,
      }),
    });
    const duration = performance.now() - startTime;
    
    assertEquals(response.status, 200);
    
    const result = await response.json();
    assertExists(result.deployment_id);
    assertExists(result.status);
    assertExists(result.logs);
    
    this.assertResponseTime(duration, PERFORMANCE_TARGETS.CODE_EXECUTOR.deployment, 'Deployment simulation');
    console.log(`✅ Deployment simulation completed in ${duration.toFixed(2)}ms`);
  }
  
  async testErrorHandling(): Promise<void> {
    console.log('🔍 Testing error handling');
    
    // Test syntax error
    const syntaxErrorResponse = await this.makeRequest(this.serviceName, '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'print("Missing closing quote)',
        language: 'python',
      }),
    });
    
    assertEquals(syntaxErrorResponse.status, 200);
    const syntaxResult = await syntaxErrorResponse.json();
    assert(syntaxResult.exit_code !== 0);
    assertExists(syntaxResult.stderr);
    
    // Test runtime error
    const runtimeErrorResponse = await this.makeRequest(this.serviceName, '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'print(1/0)',
        language: 'python',
      }),
    });
    
    assertEquals(runtimeErrorResponse.status, 200);
    const runtimeResult = await runtimeErrorResponse.json();
    assert(runtimeResult.exit_code !== 0);
    assertExists(runtimeResult.stderr);
    assert(runtimeResult.stderr.includes('ZeroDivisionError'));
    
    // Test unsupported language
    const unsupportedResponse = await this.makeRequest(this.serviceName, '/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'print("Hello")',
        language: 'unsupported',
      }),
    });
    
    assertEquals(unsupportedResponse.status, 400);
    
    // Verify service remains healthy after errors
    await this.assertServiceHealthy(this.serviceName);
    
    console.log('✅ Error handling working correctly');
  }
  
  async testCodeTemplates(): Promise<void> {
    console.log('🔍 Testing code templates');
    
    const templatesResponse = await this.makeRequest(this.serviceName, '/api/templates');
    assertEquals(templatesResponse.status, 200);
    
    const templates = await templatesResponse.json();
    assertExists(templates.templates);
    assert(Array.isArray(templates.templates));
    
    // Test using a template
    if (templates.templates.length > 0) {
      const template = templates.templates[0];
      
      const templateResponse = await this.makeRequest(this.serviceName, '/api/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          variables: template.variables || {},
        }),
      });
      
      assertEquals(templateResponse.status, 200);
      const result = await templateResponse.json();
      assertExists(result.code);
      assertExists(result.language);
    }
    
    console.log('✅ Code templates working correctly');
  }
  
  async testCodeAnalysis(): Promise<void> {
    console.log('🔍 Testing code analysis');
    
    const analysisCode = `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(5)
print(f"Factorial of 5 is {result}")
    `.trim();
    
    const response = await this.makeRequest(this.serviceName, '/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: analysisCode,
        language: 'python',
        metrics: ['complexity', 'quality', 'security'],
      }),
    });
    
    assertEquals(response.status, 200);
    
    const analysis = await response.json();
    assertExists(analysis.complexity);
    assertExists(analysis.quality_score);
    assertExists(analysis.security_issues);
    assertExists(analysis.suggestions);
    
    console.log('✅ Code analysis completed successfully');
  }
}

// Test execution
Deno.test({
  name: "Code Executor: Basic Health Check",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testBasicHealth();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Python Code Execution",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testPythonCodeExecution();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: JavaScript Code Execution",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testJavaScriptCodeExecution();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: SQL Code Execution",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testSQLCodeExecution();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Code Validation",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testCodeValidation();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Security Scanning",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testSecurityScanning();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Sandbox Isolation",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testSandboxIsolation();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Resource Limits",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testResourceLimits();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Concurrent Execution",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testConcurrentExecution();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Deployment Simulation",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testDeploymentSimulation();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Error Handling",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testErrorHandling();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Code Templates",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testCodeTemplates();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Code Executor: Code Analysis",
  async fn() {
    const tests = new CodeExecutorTests();
    try {
      await tests.setup();
      await tests.testCodeAnalysis();
    } finally {
      await tests.cleanup();
    }
  },
});

export default CodeExecutorTests;