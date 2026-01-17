/**
 * Unit Tests for Contract Validation Logic
 * Tests the validation schemas and middleware directly without networking
 */

import { 
  LoginRequestSchema,
  CreatePitchSchema, 
  NDARequestSchema,
  validateRequest 
} from '../src/shared/contracts.ts';

import { matchValidatedRoute } from '../src/handlers/validated-endpoints.ts';

interface TestCase {
  name: string;
  data: any;
  expectValid: boolean;
  expectedErrors?: string[];
}

function runSchemaTests() {
  console.log('🧪 Contract Validation Unit Tests');
  console.log('==================================\n');

  let totalTests = 0;
  let passedTests = 0;

  // Test Login Schema
  console.log('📧 Testing LoginRequestSchema');
  console.log('-----------------------------');
  
  const loginTests: TestCase[] = [
    {
      name: 'Valid login request',
      data: { email: 'test@example.com', password: 'password123', userType: 'creator' },
      expectValid: true
    },
    {
      name: 'Invalid email format',
      data: { email: 'invalid-email', password: 'password123', userType: 'creator' },
      expectValid: false,
      expectedErrors: ['email']
    },
    {
      name: 'Password too short', 
      data: { email: 'test@example.com', password: '123', userType: 'creator' },
      expectValid: false,
      expectedErrors: ['password']
    },
    {
      name: 'Missing required fields',
      data: { email: 'test@example.com' },
      expectValid: false,
      expectedErrors: ['password']
    },
    {
      name: 'Invalid userType',
      data: { email: 'test@example.com', password: 'password123', userType: 'invalid' },
      expectValid: false,
      expectedErrors: ['userType']
    }
  ];

  for (const test of loginTests) {
    totalTests++;
    const result = validateRequest(LoginRequestSchema, test.data);
    const passed = result.success === test.expectValid;
    
    if (passed) {
      passedTests++;
      console.log(`  ✅ ${test.name}`);
    } else {
      console.log(`  ❌ ${test.name}`);
      console.log(`     Expected: ${test.expectValid ? 'valid' : 'invalid'}`);
      console.log(`     Got: ${result.success ? 'valid' : 'invalid'}`);
      if (!result.success) {
        console.log(`     Errors:`, result.errors.issues.map(i => `${i.path.join('.')}: ${i.message}`));
      }
    }
  }

  console.log('');

  // Test Create Pitch Schema
  console.log('🎬 Testing CreatePitchSchema');
  console.log('----------------------------');

  const pitchTests: TestCase[] = [
    {
      name: 'Valid pitch',
      data: { 
        title: 'Test Pitch', 
        logline: 'A compelling story',
        genre: 'Drama',
        format: 'Film',
        budget: 1000000
      },
      expectValid: true
    },
    {
      name: 'Minimal valid pitch',
      data: { title: 'Test', logline: 'Test', genre: 'Comedy' },
      expectValid: true
    },
    {
      name: 'Empty title',
      data: { title: '', logline: 'Test', genre: 'Action' },
      expectValid: false,
      expectedErrors: ['title']
    },
    {
      name: 'Title too long',
      data: { title: 'A'.repeat(201), logline: 'Test', genre: 'Action' },
      expectValid: false,
      expectedErrors: ['title']
    },
    {
      name: 'Logline too long',
      data: { title: 'Test', logline: 'A'.repeat(501), genre: 'Action' },
      expectValid: false,
      expectedErrors: ['logline']
    },
    {
      name: 'Invalid genre',
      data: { title: 'Test', logline: 'Test', genre: 'Invalid' },
      expectValid: false,
      expectedErrors: ['genre']
    },
    {
      name: 'Negative budget',
      data: { title: 'Test', logline: 'Test', genre: 'Action', budget: -1000 },
      expectValid: false,
      expectedErrors: ['budget']
    }
  ];

  for (const test of pitchTests) {
    totalTests++;
    const result = validateRequest(CreatePitchSchema, test.data);
    const passed = result.success === test.expectValid;
    
    if (passed) {
      passedTests++;
      console.log(`  ✅ ${test.name}`);
    } else {
      console.log(`  ❌ ${test.name}`);
      console.log(`     Expected: ${test.expectValid ? 'valid' : 'invalid'}`);
      console.log(`     Got: ${result.success ? 'valid' : 'invalid'}`);
      if (!result.success) {
        console.log(`     Errors:`, result.errors.issues.map(i => `${i.path.join('.')}: ${i.message}`));
      }
    }
  }

  console.log('');

  // Test NDA Request Schema
  console.log('📄 Testing NDARequestSchema');
  console.log('---------------------------');

  const ndaTests: TestCase[] = [
    {
      name: 'Valid basic NDA',
      data: { pitchId: 123, ndaType: 'basic', requestMessage: 'Please approve my NDA request' },
      expectValid: true
    },
    {
      name: 'Valid enhanced NDA with company info',
      data: {
        pitchId: 123,
        ndaType: 'enhanced',
        requestMessage: 'Enhanced NDA request',
        companyInfo: { name: 'Test Corp', address: '123 Main St' }
      },
      expectValid: true
    },
    {
      name: 'Missing pitch ID',
      data: { ndaType: 'basic', requestMessage: 'Test' },
      expectValid: false,
      expectedErrors: ['pitchId']
    },
    {
      name: 'Invalid NDA type',
      data: { pitchId: 123, ndaType: 'invalid', requestMessage: 'Test' },
      expectValid: false,
      expectedErrors: ['ndaType']
    },
    {
      name: 'Request message too long',
      data: { pitchId: 123, ndaType: 'basic', requestMessage: 'A'.repeat(1001) },
      expectValid: false,
      expectedErrors: ['requestMessage']
    }
  ];

  for (const test of ndaTests) {
    totalTests++;
    const result = validateRequest(NDARequestSchema, test.data);
    const passed = result.success === test.expectValid;
    
    if (passed) {
      passedTests++;
      console.log(`  ✅ ${test.name}`);
    } else {
      console.log(`  ❌ ${test.name}`);
      console.log(`     Expected: ${test.expectValid ? 'valid' : 'invalid'}`);
      console.log(`     Got: ${result.success ? 'valid' : 'invalid'}`);
      if (!result.success) {
        console.log(`     Errors:`, result.errors.issues.map(i => `${i.path.join('.')}: ${i.message}`));
      }
    }
  }

  console.log('');

  // Test Route Matching
  console.log('🔗 Testing Route Matching');
  console.log('-------------------------');

  const routeTests = [
    { method: 'POST', path: '/api/auth/sign-in', shouldMatch: true },
    { method: 'POST', path: '/api/pitches', shouldMatch: true },
    { method: 'POST', path: '/api/pitches/123/nda', shouldMatch: true },
    { method: 'GET', path: '/api/auth/sign-in', shouldMatch: false },
    { method: 'POST', path: '/api/unknown', shouldMatch: false },
    { method: 'POST', path: '/api/pitches/abc/nda', shouldMatch: true }, // Should match with param
  ];

  for (const test of routeTests) {
    totalTests++;
    const route = matchValidatedRoute(test.method, test.path);
    const matched = route !== null;
    const passed = matched === test.shouldMatch;
    
    if (passed) {
      passedTests++;
      console.log(`  ✅ ${test.method} ${test.path} -> ${matched ? 'matched' : 'no match'}`);
    } else {
      console.log(`  ❌ ${test.method} ${test.path} -> Expected ${test.shouldMatch ? 'match' : 'no match'}, got ${matched ? 'match' : 'no match'}`);
    }
  }

  console.log('');

  // Summary
  console.log('📊 TEST SUMMARY');
  console.log('================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n✅ All unit tests passed!');
    return true;
  } else {
    console.log('\n❌ Some unit tests failed!');
    return false;
  }
}

if (import.meta.main) {
  const success = runSchemaTests();
  Deno.exit(success ? 0 : 1);
}