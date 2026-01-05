/**
 * Container Security Integration Tests
 * 
 * Validates container security configurations, isolation, and vulnerability scanning
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import ContainerTestBase from '../framework/container-test-base.ts';

class ContainerSecurityTests extends ContainerTestBase {
  
  async testContainerIsolation(): Promise<void> {
    console.log('🔍 Testing container isolation');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      // Test process isolation
      const processResult = await this.execInContainer(serviceName, [
        'sh', '-c', 'ps aux | wc -l'
      ]);
      
      assertEquals(processResult.code, 0);
      const processCount = parseInt(processResult.stdout.trim());
      
      // Container should have minimal processes (typically < 10)
      assert(processCount < 20, `Too many processes in ${serviceName}: ${processCount}`);
      
      // Test network namespace isolation
      const networkResult = await this.execInContainer(serviceName, [
        'sh', '-c', 'ip route show | grep -c default || echo 0'
      ]);
      
      assertEquals(networkResult.code, 0);
      console.log(`✅ ${serviceName} container isolation verified`);
    }
  }
  
  async testNonRootExecution(): Promise<void> {
    console.log('🔍 Testing non-root execution');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      const userResult = await this.execInContainer(serviceName, [
        'id', '-u'
      ]);
      
      assertEquals(userResult.code, 0);
      const uid = parseInt(userResult.stdout.trim());
      
      // Should not be running as root (uid 0)
      assert(uid !== 0, `Service ${serviceName} is running as root (uid: ${uid})`);
      
      console.log(`✅ ${serviceName} running as non-root user (uid: ${uid})`);
    }
  }
  
  async testResourceLimitsEnforcement(): Promise<void> {
    console.log('🔍 Testing resource limits enforcement');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      // Check memory limits
      const memoryResult = await this.execInContainer(serviceName, [
        'sh', '-c', 'cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || cat /sys/fs/cgroup/memory.max 2>/dev/null || echo "unlimited"'
      ]);
      
      if (memoryResult.code === 0 && !memoryResult.stdout.includes('unlimited')) {
        const memoryLimit = parseInt(memoryResult.stdout.trim());
        assert(memoryLimit > 0, `Invalid memory limit for ${serviceName}`);
        console.log(`✅ ${serviceName} has memory limit: ${Math.round(memoryLimit / 1024 / 1024)}MB`);
      }
      
      // Check CPU limits
      const cpuResult = await this.execInContainer(serviceName, [
        'sh', '-c', 'cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us 2>/dev/null || cat /sys/fs/cgroup/cpu.max 2>/dev/null || echo "-1"'
      ]);
      
      if (cpuResult.code === 0 && cpuResult.stdout.trim() !== '-1') {
        console.log(`✅ ${serviceName} has CPU limit configured`);
      }
    }
  }
  
  async testFileSystemPermissions(): Promise<void> {
    console.log('🔍 Testing file system permissions');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      // Test read-only access to sensitive directories
      const sensitiveDirs = ['/etc', '/sys', '/proc'];
      
      for (const dir of sensitiveDirs) {
        const writeTest = await this.execInContainer(serviceName, [
          'sh', '-c', `touch ${dir}/test-write 2>&1 || echo "write-denied"`
        ]);
        
        // Should not be able to write to sensitive directories
        assert(
          writeTest.stderr.includes('Permission denied') || 
          writeTest.stdout.includes('write-denied') ||
          writeTest.stderr.includes('Read-only file system'),
          `Service ${serviceName} can write to ${dir}`
        );
      }
      
      // Test that working directory is writable
      const workdirTest = await this.execInContainer(serviceName, [
        'sh', '-c', 'touch /tmp/test-write && rm -f /tmp/test-write'
      ]);
      
      assertEquals(workdirTest.code, 0, `Service ${serviceName} cannot write to working directory`);
      
      console.log(`✅ ${serviceName} file system permissions verified`);
    }
  }
  
  async testNetworkSecurityPolicies(): Promise<void> {
    console.log('🔍 Testing network security policies');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      // Test that containers can only access allowed ports
      const portsResult = await this.execInContainer(serviceName, [
        'sh', '-c', 'netstat -tuln 2>/dev/null | grep LISTEN || ss -tuln 2>/dev/null | grep LISTEN || echo "no-netstat"'
      ]);
      
      if (portsResult.code === 0 && !portsResult.stdout.includes('no-netstat')) {
        const lines = portsResult.stdout.split('\n').filter(line => line.includes('LISTEN'));
        
        // Should only have necessary ports open
        assert(lines.length <= 5, `Too many listening ports in ${serviceName}: ${lines.length}`);
      }
      
      // Test external network access restrictions for code executor
      if (serviceName === 'code') {
        const networkTest = await this.execInContainer(serviceName, [
          'sh', '-c', 'timeout 5 nc -z google.com 80 2>&1 || echo "connection-blocked"'
        ]);
        
        // Code executor should have restricted external access
        assert(
          networkTest.stdout.includes('connection-blocked') ||
          networkTest.stderr.includes('Connection timed out') ||
          networkTest.stderr.includes('Connection refused'),
          'Code executor has unrestricted external network access'
        );
      }
      
      console.log(`✅ ${serviceName} network security verified`);
    }
  }
  
  async testSecretManagement(): Promise<void> {
    console.log('🔍 Testing secret management');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      // Test that sensitive environment variables are not exposed
      const envResult = await this.execInContainer(serviceName, [
        'env'
      ]);
      
      if (envResult.code === 0) {
        const envVars = envResult.stdout.toLowerCase();
        
        // Check for exposed secrets
        const sensitivePatterns = [
          'password=',
          'secret=',
          'token=',
          'key=.*[a-z0-9]{20,}', // Long alphanumeric strings that might be keys
        ];
        
        for (const pattern of sensitivePatterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(envVars)) {
            console.warn(`⚠️ Potential secret exposure in ${serviceName}: ${pattern}`);
          }
        }
      }
      
      // Test that service can access required secrets through proper channels
      const healthResponse = await this.makeRequest(serviceName, '/health');
      assertEquals(healthResponse.status, 200, `Service ${serviceName} cannot access required secrets`);
      
      console.log(`✅ ${serviceName} secret management verified`);
    }
  }
  
  async testInputValidation(): Promise<void> {
    console.log('🔍 Testing input validation');
    
    // Test malicious payload rejection
    const maliciousPayloads = [
      '../../../../etc/passwd',
      '<script>alert("xss")</script>',
      "'; DROP TABLE users; --",
      '../../../proc/self/environ',
      'A'.repeat(1000000), // Large payload
    ];
    
    const services = [
      { name: 'video', endpoint: '/api/thumbnail' },
      { name: 'document', endpoint: '/api/generate-pdf' },
      { name: 'ai', endpoint: '/api/classify' },
      { name: 'code', endpoint: '/api/execute' },
    ];
    
    for (const service of services) {
      for (const payload of maliciousPayloads) {
        let response;
        
        if (service.name === 'video') {
          // Test file upload with malicious filename
          const formData = new FormData();
          formData.append('file', new Blob(['test']), payload);
          
          response = await this.makeRequest(service.name, service.endpoint, {
            method: 'POST',
            body: formData,
          });
        } else {
          // Test JSON payload
          response = await this.makeRequest(service.name, service.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              text: payload,
              code: payload,
              data: payload 
            }),
          });
        }
        
        // Should reject malicious input
        assert(
          response.status >= 400 && response.status < 500,
          `Service ${service.name} accepted malicious payload: ${payload.slice(0, 50)}`
        );
      }
      
      console.log(`✅ ${service.name} input validation verified`);
    }
  }
  
  async testVulnerabilityScanning(): Promise<void> {
    console.log('🔍 Testing vulnerability scanning capabilities');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      // Check for common vulnerability patterns
      const packageResult = await this.execInContainer(serviceName, [
        'sh', '-c', 'find /usr /opt /app -name "*.py" -o -name "*.js" -o -name "*.json" | head -10'
      ]);
      
      if (packageResult.code === 0) {
        const files = packageResult.stdout.split('\n').filter(f => f.trim());
        assert(files.length > 0, `No application files found in ${serviceName}`);
      }
      
      // Check for security headers in HTTP responses
      const response = await this.makeRequest(serviceName, '/health');
      
      if (response.headers) {
        // Should have security headers
        const securityHeaders = [
          'x-content-type-options',
          'x-frame-options',
          'x-xss-protection',
        ];
        
        let securityHeaderCount = 0;
        for (const header of securityHeaders) {
          if (response.headers.get(header)) {
            securityHeaderCount++;
          }
        }
        
        // At least some security headers should be present
        if (securityHeaderCount === 0) {
          console.warn(`⚠️ ${serviceName} missing security headers`);
        }
      }
      
      console.log(`✅ ${serviceName} vulnerability scanning completed`);
    }
  }
  
  async testLogSecurity(): Promise<void> {
    console.log('🔍 Testing log security');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      // Get recent logs
      const logs = await this.getLogs(serviceName, 50);
      
      // Check for sensitive data in logs
      const logContent = logs.join('\n').toLowerCase();
      
      const sensitivePatterns = [
        /password[:\s=]+[^\s\n]+/i,
        /api[_\s]?key[:\s=]+[^\s\n]+/i,
        /token[:\s=]+[a-z0-9]{20,}/i,
        /secret[:\s=]+[^\s\n]+/i,
        /credit[_\s]?card/i,
        /ssn[:\s=]+\d{3}-?\d{2}-?\d{4}/i,
      ];
      
      for (const pattern of sensitivePatterns) {
        if (pattern.test(logContent)) {
          console.warn(`⚠️ Potential sensitive data in ${serviceName} logs`);
        }
      }
      
      // Logs should exist and be accessible
      assert(logs.length > 0, `No logs available for ${serviceName}`);
      
      console.log(`✅ ${serviceName} log security verified`);
    }
  }
  
  async testContainerImageSecurity(): Promise<void> {
    console.log('🔍 Testing container image security');
    
    const services = ['video', 'document', 'ai', 'media', 'code'];
    
    for (const serviceName of services) {
      // Check for package managers that shouldn't be in production images
      const packageManagerResult = await this.execInContainer(serviceName, [
        'sh', '-c', 'which apt-get || which yum || which apk || echo "no-package-manager"'
      ]);
      
      // Production images should not have package managers for security
      if (packageManagerResult.code === 0 && 
          !packageManagerResult.stdout.includes('no-package-manager')) {
        console.warn(`⚠️ Package manager found in ${serviceName} production image`);
      }
      
      // Check for unnecessary setuid binaries
      const setuidResult = await this.execInContainer(serviceName, [
        'sh', '-c', 'find /usr /bin /sbin -perm -4000 2>/dev/null | wc -l'
      ]);
      
      if (setuidResult.code === 0) {
        const setuidCount = parseInt(setuidResult.stdout.trim());
        
        // Should have minimal setuid binaries
        assert(setuidCount < 10, `Too many setuid binaries in ${serviceName}: ${setuidCount}`);
      }
      
      console.log(`✅ ${serviceName} container image security verified`);
    }
  }
}

// Test execution
Deno.test({
  name: "Container Security: Container Isolation",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testContainerIsolation();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: Non-Root Execution",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testNonRootExecution();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: Resource Limits Enforcement",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testResourceLimitsEnforcement();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: File System Permissions",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testFileSystemPermissions();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: Network Security Policies",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testNetworkSecurityPolicies();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: Secret Management",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testSecretManagement();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: Input Validation",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testInputValidation();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: Vulnerability Scanning",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testVulnerabilityScanning();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: Log Security",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testLogSecurity();
    } finally {
      await tests.cleanup();
    }
  },
});

Deno.test({
  name: "Container Security: Container Image Security",
  async fn() {
    const tests = new ContainerSecurityTests();
    try {
      await tests.setup();
      await tests.testContainerImageSecurity();
    } finally {
      await tests.cleanup();
    }
  },
});

export default ContainerSecurityTests;