/**
 * API Contract Testing Framework
 * Tests API endpoints against OpenAPI specifications and ensures contract compliance
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { TestFactory } from "../framework/test-factory.ts";
import { testDb, withDatabase } from "../framework/test-database.ts";
import { TestHelper, TEST_CONFIG } from "../setup.ts";

interface APIContract {
  path: string;
  method: string;
  operationId: string;
  requestSchema?: any;
  responseSchema?: any;
  security?: string[];
  parameters?: any[];
  responses: Record<string, any>;
}

interface ContractTestResult {
  passed: boolean;
  endpoint: string;
  method: string;
  statusCode: number;
  errors: string[];
  warnings: string[];
  responseTime: number;
}

class APIContractTester {
  private baseURL: string;
  private testHelper: TestHelper;
  private contracts: Map<string, APIContract> = new Map();

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.testHelper = new TestHelper();
    this.loadAPIContracts();
  }

  private loadAPIContracts(): void {
    // Define API contracts based on the actual API endpoints
    const contracts: APIContract[] = [
      // Authentication endpoints
      {
        path: "/api/auth/creator/login",
        method: "POST",
        operationId: "creatorLogin",
        requestSchema: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 }
          }
        },
        responseSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            token: { type: "string" },
            user: { type: "object" }
          }
        },
        responses: {
          "200": { description: "Login successful" },
          "401": { description: "Invalid credentials" },
          "422": { description: "Validation error" }
        }
      },
      {
        path: "/api/auth/investor/login",
        method: "POST",
        operationId: "investorLogin",
        requestSchema: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 }
          }
        },
        responseSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            token: { type: "string" },
            user: { type: "object" }
          }
        },
        responses: {
          "200": { description: "Login successful" },
          "401": { description: "Invalid credentials" }
        }
      },
      // User endpoints
      {
        path: "/api/users/profile",
        method: "GET",
        operationId: "getUserProfile",
        security: ["bearerAuth"],
        responseSchema: {
          type: "object",
          properties: {
            id: { type: "number" },
            email: { type: "string" },
            username: { type: "string" },
            userType: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" }
          }
        },
        responses: {
          "200": { description: "User profile retrieved" },
          "401": { description: "Unauthorized" }
        }
      },
      // Pitch endpoints
      {
        path: "/api/pitches",
        method: "GET",
        operationId: "getPitches",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "genre", in: "query", schema: { type: "string" } },
          { name: "budget", in: "query", schema: { type: "string" } }
        ],
        responseSchema: {
          type: "object",
          properties: {
            pitches: { type: "array" },
            pagination: { type: "object" },
            total: { type: "number" }
          }
        },
        responses: {
          "200": { description: "Pitches retrieved successfully" }
        }
      },
      {
        path: "/api/pitches",
        method: "POST",
        operationId: "createPitch",
        security: ["bearerAuth"],
        requestSchema: {
          type: "object",
          required: ["title", "logline", "genre"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 255 },
            logline: { type: "string", minLength: 10, maxLength: 500 },
            genre: { type: "string" },
            shortSynopsis: { type: "string" },
            targetAudience: { type: "string" },
            budgetRange: { type: "string", enum: ["low", "medium", "high"] }
          }
        },
        responseSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            pitch: { type: "object" },
            id: { type: "number" }
          }
        },
        responses: {
          "201": { description: "Pitch created successfully" },
          "400": { description: "Invalid request data" },
          "401": { description: "Unauthorized" }
        }
      },
      // NDA endpoints
      {
        path: "/api/ndas/request",
        method: "POST",
        operationId: "requestNDA",
        security: ["bearerAuth"],
        requestSchema: {
          type: "object",
          required: ["pitchId"],
          properties: {
            pitchId: { type: "number" },
            message: { type: "string" },
            ndaType: { type: "string", enum: ["basic", "standard", "custom"] }
          }
        },
        responses: {
          "201": { description: "NDA request created" },
          "401": { description: "Unauthorized" },
          "404": { description: "Pitch not found" }
        }
      }
    ];

    contracts.forEach(contract => {
      const key = `${contract.method} ${contract.path}`;
      this.contracts.set(key, contract);
    });
  }

  async testContract(contract: APIContract, testData?: any): Promise<ContractTestResult> {
    const startTime = Date.now();
    const result: ContractTestResult = {
      passed: true,
      endpoint: contract.path,
      method: contract.method,
      statusCode: 0,
      errors: [],
      warnings: [],
      responseTime: 0
    };

    try {
      // Prepare request
      const url = `${this.baseURL}${contract.path}`;
      const options: RequestInit = {
        method: contract.method,
        headers: {
          "Content-Type": "application/json",
        }
      };

      // Add authentication if required
      if (contract.security?.includes("bearerAuth")) {
        try {
          const { token } = await this.testHelper.login("creator");
          options.headers = {
            ...options.headers,
            "Authorization": `Bearer ${token}`
          };
        } catch (error) {
          result.errors.push("Failed to authenticate for secured endpoint");
          result.passed = false;
          return result;
        }
      }

      // Add request body if needed
      if (contract.method !== "GET" && testData) {
        options.body = JSON.stringify(testData);
      }

      // Make request
      const response = await fetch(url, options);
      result.statusCode = response.status;
      result.responseTime = Date.now() - startTime;

      // Validate status code
      const validStatuses = Object.keys(contract.responses).map(Number);
      if (!validStatuses.includes(response.status)) {
        result.errors.push(`Unexpected status code: ${response.status}. Expected one of: ${validStatuses.join(", ")}`);
        result.passed = false;
      }

      // Validate response content type
      const contentType = response.headers.get("content-type");
      if (response.status < 300 && !contentType?.includes("application/json")) {
        result.warnings.push("Response content-type is not application/json");
      }

      // Parse and validate response body
      if (response.status < 300) {
        try {
          const responseBody = await response.json();
          
          // Validate against response schema
          if (contract.responseSchema) {
            const schemaErrors = this.validateSchema(responseBody, contract.responseSchema);
            result.errors.push(...schemaErrors);
            if (schemaErrors.length > 0) {
              result.passed = false;
            }
          }
        } catch (error) {
          result.errors.push("Failed to parse JSON response");
          result.passed = false;
        }
      }

      // Performance checks
      if (result.responseTime > 5000) {
        result.warnings.push(`Slow response time: ${result.responseTime}ms`);
      }

    } catch (error) {
      result.errors.push(`Request failed: ${error.message}`);
      result.passed = false;
      result.responseTime = Date.now() - startTime;
    }

    return result;
  }

  private validateSchema(data: any, schema: any): string[] {
    const errors: string[] = [];

    // Basic schema validation (simplified)
    if (schema.type === "object") {
      if (typeof data !== "object" || data === null) {
        errors.push(`Expected object, got ${typeof data}`);
        return errors;
      }

      // Check required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (!(prop in data)) {
            errors.push(`Missing required property: ${prop}`);
          }
        }
      }

      // Check property types
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties as any)) {
          if (prop in data) {
            const propErrors = this.validateSchema(data[prop], propSchema);
            errors.push(...propErrors.map(err => `${prop}: ${err}`));
          }
        }
      }
    } else if (schema.type === "array") {
      if (!Array.isArray(data)) {
        errors.push(`Expected array, got ${typeof data}`);
      }
    } else if (schema.type === "string") {
      if (typeof data !== "string") {
        errors.push(`Expected string, got ${typeof data}`);
      } else {
        if (schema.minLength && data.length < schema.minLength) {
          errors.push(`String too short: ${data.length} < ${schema.minLength}`);
        }
        if (schema.maxLength && data.length > schema.maxLength) {
          errors.push(`String too long: ${data.length} > ${schema.maxLength}`);
        }
        if (schema.format === "email" && !data.includes("@")) {
          errors.push("Invalid email format");
        }
      }
    } else if (schema.type === "number" || schema.type === "integer") {
      if (typeof data !== "number") {
        errors.push(`Expected number, got ${typeof data}`);
      } else {
        if (schema.minimum && data < schema.minimum) {
          errors.push(`Number too small: ${data} < ${schema.minimum}`);
        }
        if (schema.maximum && data > schema.maximum) {
          errors.push(`Number too large: ${data} > ${schema.maximum}`);
        }
      }
    } else if (schema.type === "boolean") {
      if (typeof data !== "boolean") {
        errors.push(`Expected boolean, got ${typeof data}`);
      }
    }

    return errors;
  }

  async testAllContracts(): Promise<Map<string, ContractTestResult>> {
    const results = new Map<string, ContractTestResult>();

    for (const [key, contract] of this.contracts) {
      console.log(`Testing contract: ${contract.method} ${contract.path}`);
      
      // Generate appropriate test data
      let testData: any = null;
      if (contract.method !== "GET" && contract.requestSchema) {
        testData = this.generateTestData(contract);
      }

      const result = await this.testContract(contract, testData);
      results.set(key, result);
    }

    return results;
  }

  private generateTestData(contract: APIContract): any {
    if (!contract.requestSchema) return null;

    // Generate test data based on operation
    switch (contract.operationId) {
      case "creatorLogin":
      case "investorLogin":
        return {
          email: "alex.creator@demo.com",
          password: "Demo123"
        };
      
      case "createPitch":
        return {
          title: "Test Pitch Contract Validation",
          logline: "A comprehensive test pitch to validate API contract compliance",
          genre: "Drama",
          shortSynopsis: "Test synopsis for contract validation",
          targetAudience: "18-35 Adults",
          budgetRange: "medium"
        };
      
      case "requestNDA":
        return {
          pitchId: 1,
          message: "Requesting NDA access for contract testing",
          ndaType: "basic"
        };
      
      default:
        return this.generateGenericTestData(contract.requestSchema);
    }
  }

  private generateGenericTestData(schema: any): any {
    if (schema.type === "object") {
      const data: any = {};
      
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties as any)) {
          data[prop] = this.generateGenericTestData(propSchema);
        }
      }
      
      return data;
    } else if (schema.type === "string") {
      if (schema.format === "email") {
        return "test@example.com";
      } else if (schema.enum) {
        return schema.enum[0];
      } else {
        return "test string";
      }
    } else if (schema.type === "number" || schema.type === "integer") {
      return schema.minimum || 1;
    } else if (schema.type === "boolean") {
      return true;
    } else if (schema.type === "array") {
      return [];
    }
    
    return null;
  }
}

// ==================== INTEGRATION TESTS ====================

Deno.test({
  name: "API Contract Integration Tests",
  async fn() {
    await withDatabase("basic_user_flow", async () => {
      const tester = new APIContractTester(TEST_CONFIG.API_BASE);
      console.log("🔌 Testing API Contract Compliance...");

      // Test individual contracts
      await Deno.test({
        name: "Authentication Contracts",
        async fn() {
          // Test creator login
          const creatorLoginContract = tester.contracts.get("POST /api/auth/creator/login")!;
          const creatorResult = await tester.testContract(creatorLoginContract, {
            email: "alex.creator@demo.com",
            password: "Demo123"
          });

          assertEquals(creatorResult.passed, true, `Creator login failed: ${creatorResult.errors.join(", ")}`);
          assertEquals(creatorResult.statusCode, 200);
          assert(creatorResult.responseTime < 5000, "Response time too slow");

          // Test investor login  
          const investorLoginContract = tester.contracts.get("POST /api/auth/investor/login")!;
          const investorResult = await tester.testContract(investorLoginContract, {
            email: "sarah.investor@demo.com", 
            password: "Demo123"
          });

          assertEquals(investorResult.passed, true, `Investor login failed: ${investorResult.errors.join(", ")}`);
          assertEquals(investorResult.statusCode, 200);
        }
      });

      await Deno.test({
        name: "User Profile Contract",
        async fn() {
          const profileContract = tester.contracts.get("GET /api/users/profile")!;
          const result = await tester.testContract(profileContract);

          assertEquals(result.passed, true, `Profile endpoint failed: ${result.errors.join(", ")}`);
          assertEquals(result.statusCode, 200);
          assert(result.responseTime < 3000, "Profile response too slow");
        }
      });

      await Deno.test({
        name: "Pitch Endpoints Contract",
        async fn() {
          // Test GET /api/pitches
          const getPitchesContract = tester.contracts.get("GET /api/pitches")!;
          const getResult = await tester.testContract(getPitchesContract);

          assertEquals(getResult.passed, true, `Get pitches failed: ${getResult.errors.join(", ")}`);
          assertEquals(getResult.statusCode, 200);

          // Test POST /api/pitches
          const createPitchContract = tester.contracts.get("POST /api/pitches")!;
          const createResult = await tester.testContract(createPitchContract, {
            title: "Contract Test Pitch",
            logline: "A test pitch for API contract validation testing",
            genre: "Drama",
            shortSynopsis: "Test synopsis",
            targetAudience: "18-35 Adults",
            budgetRange: "medium"
          });

          assertEquals(createResult.passed, true, `Create pitch failed: ${createResult.errors.join(", ")}`);
          assert([200, 201].includes(createResult.statusCode), `Unexpected status: ${createResult.statusCode}`);
        }
      });

      await Deno.test({
        name: "NDA Request Contract", 
        async fn() {
          // First create a pitch to request NDA for
          const testHelper = new TestHelper();
          const pitch = await testHelper.createTestPitch("creator");

          const ndaContract = tester.contracts.get("POST /api/ndas/request")!;
          const result = await tester.testContract(ndaContract, {
            pitchId: pitch.id,
            message: "Contract validation NDA request",
            ndaType: "basic"
          });

          assertEquals(result.passed, true, `NDA request failed: ${result.errors.join(", ")}`);
          assert([200, 201].includes(result.statusCode), `Unexpected status: ${result.statusCode}`);
        }
      });

      await Deno.test({
        name: "Error Response Contracts",
        async fn() {
          // Test invalid login credentials
          const loginContract = tester.contracts.get("POST /api/auth/creator/login")!;
          const invalidResult = await tester.testContract(loginContract, {
            email: "invalid@example.com",
            password: "wrongpassword"
          });

          assertEquals(invalidResult.statusCode, 401);
          // Should still pass contract test even with 401 since 401 is defined in contract
          assertEquals(invalidResult.passed, true);

          // Test missing required fields
          const missingFieldsResult = await tester.testContract(loginContract, {
            email: "test@example.com"
            // missing password
          });

          assert([400, 422].includes(missingFieldsResult.statusCode), "Should return validation error");
        }
      });

      await Deno.test({
        name: "Performance Contract Requirements",
        async fn() {
          const contracts = [
            "POST /api/auth/creator/login",
            "GET /api/users/profile", 
            "GET /api/pitches"
          ];

          for (const contractKey of contracts) {
            const contract = tester.contracts.get(contractKey)!;
            const result = await tester.testContract(contract);
            
            assert(result.responseTime < 5000, 
              `${contractKey} response time ${result.responseTime}ms exceeds 5000ms limit`);
            
            if (result.responseTime > 1000) {
              console.warn(`⚠️ ${contractKey} response time is slow: ${result.responseTime}ms`);
            }
          }
        }
      });

      console.log("✅ All API contract tests passed!");
    });
  }
});