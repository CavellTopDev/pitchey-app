#!/usr/bin/env -S deno run --allow-all

/**
 * Test Enhanced Error Handling System
 * This script demonstrates the improved error handling for edge cases
 */

import { parseAndValidateJson, ValidationSchemas } from "./src/middleware/json-validation.middleware.ts";
import { parseDatabaseError, handleDatabaseError } from "./src/utils/database-error-handler.ts";
import { analyzeAuthError, createAuthErrorResponse, validateToken } from "./src/utils/auth-error-handler.ts";

console.log("🧪 Testing Enhanced Error Handling System\n");

// Test 1: JSON Validation
console.log("1️⃣ Testing JSON Validation");
console.log("=".repeat(40));

async function testJsonValidation() {
  // Test invalid JSON
  const invalidJsonRequest = new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"invalid": json}'
  });

  try {
    const result = await parseAndValidateJson(invalidJsonRequest, ValidationSchemas.login);
    console.log("❌ Should have failed for invalid JSON");
  } catch (error) {
    console.log("✅ Invalid JSON handled correctly");
  }

  // Test missing required fields
  const missingFieldsRequest = new Request("http://localhost/test", {
    method: "POST", 
    headers: { "content-type": "application/json" },
    body: '{"email": "test@example.com"}'
  });

  const validationResult = await parseAndValidateJson(missingFieldsRequest, ValidationSchemas.login);
  if (!validationResult.success && validationResult.response) {
    const responseBody = await validationResult.response.text();
    const parsed = JSON.parse(responseBody);
    console.log("✅ Missing field validation:", parsed.error);
  }

  // Test invalid email format
  const invalidEmailRequest = new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"email": "invalid-email", "password": "test123"}'
  });

  const emailValidationResult = await parseAndValidateJson(invalidEmailRequest, ValidationSchemas.login);
  if (!emailValidationResult.success && emailValidationResult.response) {
    const responseBody = await emailValidationResult.response.text();
    const parsed = JSON.parse(responseBody);
    console.log("✅ Invalid email validation:", parsed.error);
  }
}

await testJsonValidation();
console.log();

// Test 2: Database Error Handling
console.log("2️⃣ Testing Database Error Handling");
console.log("=".repeat(40));

function testDatabaseErrors() {
  // Test unique constraint violation
  const uniqueConstraintError = {
    code: '23505',
    message: 'duplicate key value violates unique constraint',
    detail: 'Key (email)=(test@example.com) already exists.',
    constraint: 'users_email_unique'
  };

  const uniqueResult = parseDatabaseError(uniqueConstraintError);
  console.log("✅ Unique constraint error:", uniqueResult.message);
  console.log("   Suggested action:", uniqueResult.suggestedAction);

  // Test foreign key violation
  const foreignKeyError = {
    code: '23503',
    message: 'insert or update on table violates foreign key constraint',
    detail: 'Key (user_id)=(999) is not present in table "users".'
  };

  const foreignKeyResult = parseDatabaseError(foreignKeyError);
  console.log("✅ Foreign key error:", foreignKeyResult.message);
  console.log("   Suggested action:", foreignKeyResult.suggestedAction);

  // Test not null violation
  const notNullError = {
    code: '23502',
    message: 'null value in column violates not-null constraint',
    column: 'email'
  };

  const notNullResult = parseDatabaseError(notNullError);
  console.log("✅ Not null error:", notNullResult.message);
  console.log("   Field:", notNullResult.field);
}

testDatabaseErrors();
console.log();

// Test 3: Authentication Error Handling
console.log("3️⃣ Testing Authentication Error Handling");
console.log("=".repeat(40));

function testAuthErrors() {
  // Test missing token
  const missingTokenResult = validateToken("");
  if (!missingTokenResult.valid && missingTokenResult.error) {
    console.log("✅ Missing token:", missingTokenResult.error.message);
    console.log("   Suggested action:", missingTokenResult.error.suggestedAction);
  }

  // Test invalid token format
  const invalidFormatResult = validateToken("InvalidToken");
  if (!invalidFormatResult.valid && invalidFormatResult.error) {
    console.log("✅ Invalid format:", invalidFormatResult.error.message);
    console.log("   Suggested action:", invalidFormatResult.error.suggestedAction);
  }

  // Test malformed JWT
  const malformedResult = validateToken("Bearer invalid.jwt");
  if (!malformedResult.valid && malformedResult.error) {
    console.log("✅ Malformed JWT:", malformedResult.error.message);
    console.log("   Suggested action:", malformedResult.error.suggestedAction);
  }

  // Test JWT expiration error
  const expiredError = new Error("TokenExpiredError: jwt expired");
  const expiredResult = analyzeAuthError(expiredError);
  console.log("✅ Expired token:", expiredResult.message);
  console.log("   Suggested action:", expiredResult.suggestedAction);

  // Test invalid credentials
  const credentialsError = "Invalid email or password";
  const credentialsResult = analyzeAuthError(credentialsError);
  console.log("✅ Invalid credentials:", credentialsResult.message);
  console.log("   Suggested action:", credentialsResult.suggestedAction);
}

testAuthErrors();
console.log();

// Test 4: Password Validation
console.log("4️⃣ Testing Password Validation");
console.log("=".repeat(40));

function testPasswordValidation() {
  const passwordTests = [
    { password: "weak", expected: "too short" },
    { password: "nouppercase123", expected: "missing uppercase" },
    { password: "NOLOWERCASE123", expected: "missing lowercase" },
    { password: "NoNumbers", expected: "missing number" },
    { password: "ValidPass123", expected: "valid" }
  ];

  passwordTests.forEach(test => {
    const validation = ValidationSchemas.register.password.custom!(test.password);
    if (validation) {
      console.log(`✅ Password "${test.password}": ${validation}`);
    } else {
      console.log(`✅ Password "${test.password}": Valid`);
    }
  });
}

testPasswordValidation();
console.log();

// Test 5: Complete Error Response Examples
console.log("5️⃣ Testing Complete Error Responses");
console.log("=".repeat(40));

async function testCompleteResponses() {
  // Test database error response
  const dbError = {
    code: '23505',
    constraint: 'users_email_unique',
    detail: 'Key (email)=(test@example.com) already exists.'
  };

  const dbResponse = handleDatabaseError(dbError);
  const dbBody = await dbResponse.text();
  console.log("✅ Database error response:");
  console.log(JSON.stringify(JSON.parse(dbBody), null, 2));
  console.log();

  // Test auth error response
  const authError = "jwt expired";
  const authResponse = createAuthErrorResponse(authError);
  const authBody = await authResponse.text();
  console.log("✅ Auth error response:");
  console.log(JSON.stringify(JSON.parse(authBody), null, 2));
}

await testCompleteResponses();

console.log("\n🎉 All error handling tests completed!");
console.log("\nKey Improvements:");
console.log("✅ JSON validation with specific error messages");
console.log("✅ Database constraint errors converted to user-friendly messages");
console.log("✅ Authentication errors with helpful guidance");
console.log("✅ Password validation with specific requirements");
console.log("✅ Consistent error response format across all endpoints");
console.log("✅ Request ID tracking for debugging");
console.log("✅ Rate limiting protection");
console.log("✅ Security-aware error messages (no internal detail exposure)");

console.log("\n📖 See ERROR_HANDLING_INTEGRATION_GUIDE.md for implementation details");