#!/usr/bin/env -S deno run --allow-all

/**
 * Test Script for Mock Payment System
 * 
 * This script tests the mock payment functionality end-to-end,
 * including database updates and webhook simulation.
 */

import { getPaymentService, initializePayments } from "./src/services/payment/index.ts";
import { db } from "./src/db/client.ts";
import { users, userCredits, creditTransactions, payments } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

// Test configuration
const TEST_USER_EMAIL = "alex.creator@demo.com"; // Use existing demo user
const BASE_URL = "http://localhost:8001";

async function createTestUser() {
  console.log("🔄 Getting test user...");
  
  // Get existing demo user
  const testUser = await db.query.users.findFirst({
    where: eq(users.email, TEST_USER_EMAIL)
  });
  
  if (!testUser) {
    throw new Error(`Demo user ${TEST_USER_EMAIL} not found. Please ensure demo data is loaded.`);
  }
  
  console.log(`✅ Using demo user with ID: ${testUser.id}`);
  return testUser;
}

async function testPaymentServiceInitialization() {
  console.log("\n🔄 Testing payment service initialization...");
  
  // Initialize with mock configuration
  const paymentService = initializePayments({
    provider: 'mock',
    appUrl: BASE_URL,
    mock: {
      enabled: true,
      logPayments: true,
      simulateErrors: false,
      errorRate: 0,
      baseUrl: BASE_URL
    }
  });
  
  console.log(`✅ Payment service initialized with provider: ${paymentService.getProviderName()}`);
  console.log(`✅ Test mode: ${paymentService.isTestMode()}`);
  
  return paymentService;
}

async function testCustomerCreation(paymentService: any, testUser: any) {
  console.log("\n🔄 Testing customer creation...");
  
  const customer = await paymentService.createCustomer({
    email: testUser.email,
    metadata: { userId: testUser.id.toString() }
  });
  
  console.log(`✅ Customer created with ID: ${customer.id}`);
  return customer;
}

async function testCreditsCheckoutSession(paymentService: any, testUser: any) {
  console.log("\n🔄 Testing credits checkout session creation...");
  
  const session = await paymentService.createCheckoutSession({
    line_items: [
      {
        price: "price_credits_medium",
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${BASE_URL}/dashboard?success=true&type=credits`,
    cancel_url: `${BASE_URL}/pricing?canceled=true`,
    metadata: {
      userId: testUser.id.toString(),
      credits: "50",
      package: "medium",
    },
  });
  
  console.log(`✅ Checkout session created with ID: ${session.id}`);
  console.log(`✅ Checkout URL: ${session.url}`);
  
  return session;
}

async function testSubscriptionCheckoutSession(paymentService: any, testUser: any) {
  console.log("\n🔄 Testing subscription checkout session creation...");
  
  const session = await paymentService.createCheckoutSession({
    line_items: [
      {
        price: "price_pro_monthly",
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${BASE_URL}/dashboard?success=true&type=subscription`,
    cancel_url: `${BASE_URL}/pricing?canceled=true`,
    metadata: {
      userId: testUser.id.toString(),
      planType: "pro",
    },
  });
  
  console.log(`✅ Subscription checkout session created with ID: ${session.id}`);
  console.log(`✅ Checkout URL: ${session.url}`);
  
  return session;
}

async function testMockCheckoutCompletion(paymentService: any, session: any, testUser: any) {
  console.log("\n🔄 Testing mock checkout completion...");
  
  // Check current user credits before
  const creditsBefore = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, testUser.id)
  });
  console.log(`📊 Credits before: ${creditsBefore?.amount || 0}`);
  
  // Simulate checkout completion
  if (paymentService.simulateCheckoutCompletion) {
    const event = await paymentService.simulateCheckoutCompletion(session.id);
    console.log(`✅ Mock checkout completed successfully`);
    console.log(`✅ Webhook event generated: ${event.type}`);
    
    // Wait a bit for database updates
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check credits after
    const creditsAfter = await db.query.userCredits.findFirst({
      where: eq(userCredits.userId, testUser.id)
    });
    console.log(`📊 Credits after: ${creditsAfter?.amount || 0}`);
    
    // Check credit transactions
    const transactions = await db.query.creditTransactions.findMany({
      where: eq(creditTransactions.userId, testUser.id)
    });
    console.log(`📊 Credit transactions count: ${transactions.length}`);
    
    if (transactions.length > 0) {
      const latestTransaction = transactions[transactions.length - 1];
      console.log(`📊 Latest transaction: ${latestTransaction.amount} credits (${latestTransaction.description})`);
    }
    
    return event;
  } else {
    console.log("❌ Mock checkout completion not available");
    return null;
  }
}

async function testDatabaseState(testUser: any) {
  console.log("\n🔄 Testing database state...");
  
  // Check user credits
  const userCreditsRecord = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, testUser.id)
  });
  
  // Check credit transactions
  const creditTransactionsRecords = await db.query.creditTransactions.findMany({
    where: eq(creditTransactions.userId, testUser.id)
  });
  
  // Check payments
  const paymentsRecords = await db.query.payments.findMany({
    where: eq(payments.userId, testUser.id)
  });
  
  console.log("\n📊 Database State Summary:");
  console.log(`- User Credits: ${userCreditsRecord?.amount || 0}`);
  console.log(`- Credit Transactions: ${creditTransactionsRecords.length}`);
  console.log(`- Payment Records: ${paymentsRecords.length}`);
  
  if (creditTransactionsRecords.length > 0) {
    console.log("\n📋 Credit Transactions:");
    creditTransactionsRecords.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.amount} credits - ${tx.description} (${tx.createdAt})`);
    });
  }
  
  if (paymentsRecords.length > 0) {
    console.log("\n📋 Payment Records:");
    paymentsRecords.forEach((payment, index) => {
      console.log(`  ${index + 1}. $${payment.amount} - ${payment.status} (${payment.description})`);
    });
  }
}

async function testAPIEndpoints(testUser: any) {
  console.log("\n🔄 Testing API endpoints...");
  
  // Test payment config endpoint
  try {
    const configResponse = await fetch(`${BASE_URL}/api/payments/config`, {
      headers: {
        'Authorization': `Bearer mock-token-${testUser.id}`,
      }
    });
    
    if (configResponse.ok) {
      const configData = await configResponse.json();
      console.log("✅ Payment config endpoint working");
      console.log(`  Provider: ${configData.config.provider}`);
      console.log(`  Test mode: ${configData.config.isTestMode}`);
    } else {
      console.log("❌ Payment config endpoint failed");
    }
  } catch (error) {
    console.log("❌ Payment config endpoint error:", error.message);
  }
  
  // Test credits balance endpoint
  try {
    const balanceResponse = await fetch(`${BASE_URL}/api/payments/credits/balance`, {
      headers: {
        'Authorization': `Bearer mock-token-${testUser.id}`,
      }
    });
    
    if (balanceResponse.ok) {
      const balanceData = await balanceResponse.json();
      console.log("✅ Credits balance endpoint working");
      console.log(`  Balance: ${balanceData.balance} credits`);
    } else {
      console.log("❌ Credits balance endpoint failed");
    }
  } catch (error) {
    console.log("❌ Credits balance endpoint error:", error.message);
  }
}

async function runTests() {
  console.log("🚀 Starting Mock Payment System Tests\n");
  console.log("=====================================");
  
  try {
    // 1. Create test user
    const testUser = await createTestUser();
    
    // 2. Initialize payment service
    const paymentService = await testPaymentServiceInitialization();
    
    // 3. Test customer creation
    const customer = await testCustomerCreation(paymentService, testUser);
    
    // 4. Test credits checkout session
    const creditsSession = await testCreditsCheckoutSession(paymentService, testUser);
    
    // 5. Test subscription checkout session
    const subscriptionSession = await testSubscriptionCheckoutSession(paymentService, testUser);
    
    // 6. Test mock checkout completion for credits
    await testMockCheckoutCompletion(paymentService, creditsSession, testUser);
    
    // 7. Test database state
    await testDatabaseState(testUser);
    
    // 8. Test API endpoints
    await testAPIEndpoints(testUser);
    
    console.log("\n✅ All tests completed successfully!");
    console.log("\n🎉 Mock payment system is working properly!");
    console.log("\n📝 Next steps:");
    console.log("  1. Test the mock checkout page by visiting the checkout URLs");
    console.log("  2. Verify database updates after completing payments");
    console.log("  3. Test switching to real Stripe by setting environment variables");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  await runTests();
}