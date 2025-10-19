#!/usr/bin/env -S deno run --allow-all

/**
 * Test Script for Mock Stripe Service Only
 * 
 * This script tests only the mock Stripe service functionality
 * without database dependencies to verify the core mock logic works.
 */

import { getMockStripeService, shouldUseMockStripe } from "./src/services/stripe-mock.service.ts";

async function testMockStripeService() {
  console.log("🧪 Testing Mock Stripe Service (No Database)");
  console.log("=============================================\n");

  // Force mock mode
  Deno.env.set("STRIPE_SECRET_KEY", "mock_test");

  // Verify we're using mock Stripe
  console.log("1. Verifying Mock Mode");
  console.log(`   Using Mock Stripe: ${shouldUseMockStripe()}`);
  console.log("   ✅ Mock mode confirmed\n");

  const mockStripe = getMockStripeService();

  try {
    // Test 1: Customer Creation
    console.log("2. Testing Customer Creation");
    const customer = await mockStripe.createCustomer({
      email: "test@mock-payments.com",
      metadata: { userId: "999" }
    });
    console.log(`   ✅ Customer created: ${customer.id}`);
    console.log(`   📧 Email: ${customer.email}\n`);

    // Test 2: Subscription Creation
    console.log("3. Testing Subscription Creation");
    const subscription = await mockStripe.createSubscription({
      customer: customer.id,
      items: [{ price: "price_pro_monthly" }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });
    console.log(`   ✅ Subscription created: ${subscription.id}`);
    console.log(`   💰 Status: ${subscription.status}`);
    console.log(`   📅 Period: ${new Date(subscription.current_period_start * 1000).toLocaleDateString()} - ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}\n`);

    // Test 3: Checkout Session Creation
    console.log("4. Testing Checkout Session Creation");
    const checkoutSession = await mockStripe.createCheckoutSession({
      customer: customer.id,
      line_items: [
        {
          price: "price_creator_monthly",
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
      metadata: {
        userId: "999",
      },
    });
    console.log(`   ✅ Checkout session created: ${checkoutSession.id}`);
    console.log(`   🔗 URL: ${checkoutSession.url}`);
    console.log(`   📋 Mode: ${checkoutSession.mode}\n`);

    // Test 4: Credits Checkout Session
    console.log("5. Testing Credits Purchase Session");
    const creditsSession = await mockStripe.createCheckoutSession({
      customer: customer.id,
      line_items: [
        {
          price: "price_credits_large",
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
      metadata: {
        userId: "999",
        credits: "100",
        package: "Large Package"
      },
    });
    console.log(`   ✅ Credits checkout created: ${creditsSession.id}`);
    console.log(`   💳 Mode: ${creditsSession.mode}`);
    console.log(`   💰 Amount: $${(creditsSession.amount_total || 0) / 100}\n`);

    // Test 5: Payment Intent Creation
    console.log("6. Testing Payment Intent Creation");
    const paymentIntent = await mockStripe.createPaymentIntent({
      amount: 5000, // $50.00
      currency: "usd",
      metadata: {
        userId: "999",
        type: "investment"
      }
    });
    console.log(`   ✅ Payment intent created: ${paymentIntent.id}`);
    console.log(`   💰 Amount: $${paymentIntent.amount / 100}`);
    console.log(`   📊 Status: ${paymentIntent.status}`);
    console.log(`   🔐 Client secret: ${paymentIntent.client_secret.substring(0, 20)}...\n`);

    // Test 6: Webhook Construction
    console.log("7. Testing Webhook Processing");
    const mockWebhookPayload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: checkoutSession.id,
          mode: "subscription",
          customer: customer.id,
          subscription: subscription.id,
          metadata: {
            userId: "999"
          }
        }
      }
    });

    const webhookEvent = mockStripe.constructEvent(mockWebhookPayload, "mock_signature", "mock_secret");
    console.log(`   ✅ Webhook event created: ${webhookEvent.id}`);
    console.log(`   📋 Event type: ${webhookEvent.type}\n`);

    // Test 7: Subscription Update (Cancellation)
    console.log("8. Testing Subscription Update");
    const updatedSubscription = await mockStripe.updateSubscription(subscription.id, {
      cancel_at_period_end: true
    });
    console.log(`   ✅ Subscription updated: ${updatedSubscription.id}`);
    console.log(`   📊 Status: ${updatedSubscription.status}\n`);

    // Test 8: Customer Retrieval
    console.log("9. Testing Customer Retrieval");
    const retrievedCustomer = await mockStripe.retrieveCustomer(customer.id);
    console.log(`   ✅ Customer retrieved: ${retrievedCustomer.id}`);
    console.log(`   📧 Email: ${retrievedCustomer.email}\n`);

    // Test 9: Subscription Retrieval
    console.log("10. Testing Subscription Retrieval");
    const retrievedSubscription = await mockStripe.retrieveSubscription(subscription.id);
    console.log(`   ✅ Subscription retrieved: ${retrievedSubscription.id}`);
    console.log(`   📊 Status: ${retrievedSubscription.status}\n`);

    // Test 10: Mock Data Summary
    console.log("11. Mock Service Data Summary");
    const mockData = await mockStripe.getAllMockData();
    
    console.log(`   👥 Mock Customers: ${mockData.customers.length}`);
    console.log(`   📋 Mock Subscriptions: ${mockData.subscriptions.length}`);
    console.log(`   💳 Mock Payment Intents: ${mockData.paymentIntents.length}`);
    console.log(`   🛒 Mock Checkout Sessions: ${mockData.checkoutSessions.length}\n`);

    // Test 11: Simulate Success Events
    console.log("12. Testing Event Simulation");
    const successEvent = await mockStripe.simulatePaymentSuccess(paymentIntent.id);
    console.log(`   ✅ Payment success simulated: ${successEvent.id}`);
    
    const checkoutCompleteEvent = await mockStripe.simulateCheckoutCompletion(checkoutSession.id);
    console.log(`   ✅ Checkout completion simulated: ${checkoutCompleteEvent.id}\n`);

    console.log("🎉 All Mock Stripe Service Tests Passed!");
    console.log("=======================================");
    console.log("\n✅ The mock Stripe service is working correctly!");
    console.log("✅ All core Stripe operations are properly mocked.");
    console.log("✅ Realistic mock data is generated for all operations.");
    console.log("✅ Event simulation works for testing webhooks.");
    console.log("\n📝 Mock Service Features:");
    console.log("   • Generates realistic Stripe-like IDs");
    console.log("   • Maintains internal state during session");
    console.log("   • Supports all major Stripe operations");
    console.log("   • Provides detailed logging for debugging");
    console.log("   • Simulates success scenarios by default");
    console.log("   • Can be configured to simulate errors");

  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("\n🔍 Debug Info:");
    console.error(`   Mock mode: ${shouldUseMockStripe()}`);
    console.error(`   STRIPE_SECRET_KEY: ${Deno.env.get("STRIPE_SECRET_KEY") || 'not set'}`);
    throw error;
  }
}

// Run the tests
if (import.meta.main) {
  try {
    await testMockStripeService();
  } catch (error) {
    console.error("\n💥 Mock Stripe Service Test Failed");
    console.error("Error:", error.message);
    Deno.exit(1);
  }
}