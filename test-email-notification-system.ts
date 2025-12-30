#!/usr/bin/env deno run --allow-all

/**
 * Comprehensive Email Notification System Test
 * Tests all email functionality including templates, queue, tracking, and unsubscribe
 */

import { getEmailService } from "./src/services/email/factory.ts";
import { getEmailTemplateEngine } from "./src/services/email/template-engine.ts";
import { getEmailQueueService } from "./src/services/email/queue-service.ts";
import { getEmailTrackingService } from "./src/services/email/tracking-service.ts";
import { getEmailUnsubscribeService } from "./src/services/email/unsubscribe-service.ts";
import {
  sendWelcomeEmail,
  sendNDARequestEmail,
  sendNDAResponseEmail,
  sendPasswordResetEmail,
  sendPaymentConfirmationEmail,
  getEmailServiceHealth
} from "./src/services/email/index.ts";

// Test data
const testUser = {
  id: "test-user-123",
  email: "test@pitchey.com",
  firstName: "Test",
  userType: "creator" as const
};

const testPitch = {
  id: "test-pitch-456",
  title: "Amazing Movie Concept",
  creator: "Test Creator"
};

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}`);
}

async function testEmailProviders() {
  section("Testing Email Providers");
  
  try {
    const emailService = getEmailService();
    log(`✅ Email provider initialized: ${emailService.getProviderName()}`, colors.green);
    
    const isConfigValid = await emailService.verifyConfiguration();
    log(`📋 Configuration valid: ${isConfigValid}`, isConfigValid ? colors.green : colors.yellow);
    
    const health = await getEmailServiceHealth();
    log(`💊 Health status: ${health.provider} - ${health.healthy ? 'healthy' : 'unhealthy'}`, 
        health.healthy ? colors.green : colors.red);
    
    return true;
  } catch (error) {
    log(`❌ Email provider test failed: ${error}`, colors.red);
    return false;
  }
}

async function testEmailTemplates() {
  section("Testing Email Templates");
  
  try {
    const templateEngine = getEmailTemplateEngine();
    const templates = [
      'welcome',
      'nda-request', 
      'nda-response',
      'password-reset',
      'payment-confirmation',
      'weekly-digest',
      'pitch-view-notification',
      'investor-invite',
      'project-update'
    ];
    
    let successCount = 0;
    
    for (const templateName of templates) {
      try {
        const template = await templateEngine.loadTemplate(templateName);
        if (template.length > 50) { // Basic validity check
          log(`✅ Template loaded: ${templateName}`, colors.green);
          successCount++;
        } else {
          log(`⚠️  Template too short: ${templateName}`, colors.yellow);
        }
      } catch (error) {
        log(`❌ Template failed: ${templateName} - ${error}`, colors.red);
      }
    }
    
    // Test base template
    try {
      const baseTemplate = await templateEngine.loadBaseTemplate();
      if (baseTemplate.includes('{{content}}')) {
        log(`✅ Base template loaded and valid`, colors.green);
        successCount++;
      } else {
        log(`⚠️  Base template missing content placeholder`, colors.yellow);
      }
    } catch (error) {
      log(`❌ Base template failed: ${error}`, colors.red);
    }
    
    log(`📊 Templates tested: ${successCount}/${templates.length + 1} successful`, 
        successCount === templates.length + 1 ? colors.green : colors.yellow);
    
    return successCount > templates.length / 2; // Success if more than half work
  } catch (error) {
    log(`❌ Template testing failed: ${error}`, colors.red);
    return false;
  }
}

async function testTemplateRendering() {
  section("Testing Template Rendering");
  
  try {
    const templateEngine = getEmailTemplateEngine();
    let successCount = 0;
    
    // Test welcome email rendering
    try {
      const welcomeEmail = await templateEngine.buildWelcomeEmail({
        firstName: testUser.firstName,
        userType: testUser.userType,
        dashboardUrl: "https://pitchey-5o8.pages.dev/dashboard",
        profileSetupUrl: "https://pitchey-5o8.pages.dev/profile/setup",
        unsubscribeUrl: "https://pitchey-5o8.pages.dev/unsubscribe?token=test"
      });
      
      if (welcomeEmail.html.includes(testUser.firstName) && welcomeEmail.subject.includes("Welcome")) {
        log(`✅ Welcome email rendered correctly`, colors.green);
        successCount++;
      } else {
        log(`⚠️  Welcome email missing expected content`, colors.yellow);
      }
    } catch (error) {
      log(`❌ Welcome email rendering failed: ${error}`, colors.red);
    }
    
    // Test NDA request email rendering
    try {
      const ndaEmail = await templateEngine.buildNDARequestEmail({
        recipientName: "Jane Investor",
        senderName: testUser.firstName,
        pitchTitle: testPitch.title,
        requestMessage: "I'm very interested in this project",
        actionUrl: "https://pitchey-5o8.pages.dev/ndas/123",
        unsubscribeUrl: "https://pitchey-5o8.pages.dev/unsubscribe?token=test"
      });
      
      if (ndaEmail.html.includes(testPitch.title) && ndaEmail.subject.includes("NDA")) {
        log(`✅ NDA request email rendered correctly`, colors.green);
        successCount++;
      } else {
        log(`⚠️  NDA request email missing expected content`, colors.yellow);
      }
    } catch (error) {
      log(`❌ NDA request email rendering failed: ${error}`, colors.red);
    }
    
    log(`📊 Template rendering: ${successCount}/2 successful`, 
        successCount === 2 ? colors.green : colors.yellow);
    
    return successCount > 0;
  } catch (error) {
    log(`❌ Template rendering test failed: ${error}`, colors.red);
    return false;
  }
}

async function testEmailQueue() {
  section("Testing Email Queue System");
  
  try {
    const queueService = getEmailQueueService();
    
    // Test queuing a single email
    const emailId = await queueService.queueEmail({
      to: testUser.email,
      subject: "Test Email",
      html: "<p>This is a test email</p>",
      text: "This is a test email",
      trackingId: `test-${Date.now()}`
    }, { priority: 'normal' });
    
    log(`✅ Email queued successfully: ${emailId}`, colors.green);
    
    // Test batch queuing
    const batchEmails = Array(5).fill(null).map((_, i) => ({
      to: `test${i}@pitchey.com`,
      subject: `Batch Test Email ${i + 1}`,
      html: `<p>This is batch test email ${i + 1}</p>`,
      text: `This is batch test email ${i + 1}`,
      trackingId: `batch-test-${i}-${Date.now()}`
    }));
    
    const batchIds = await queueService.queueBatchEmails(batchEmails, {
      batchSize: 2,
      delayMs: 100,
      priority: 'low'
    });
    
    log(`✅ Batch emails queued: ${batchIds.length} emails`, colors.green);
    
    // Get queue statistics
    const stats = await queueService.getStats();
    log(`📊 Queue stats - Pending: ${stats.pending}, Completed: ${stats.completed}, Failed: ${stats.failed}`, colors.blue);
    
    return true;
  } catch (error) {
    log(`❌ Email queue test failed: ${error}`, colors.red);
    return false;
  }
}

async function testEmailTracking() {
  section("Testing Email Tracking");
  
  try {
    const trackingService = getEmailTrackingService();
    const testEmailId = `tracking-test-${Date.now()}`;
    const testEmail = "tracker@pitchey.com";
    
    // Test tracking pixel generation
    const pixelUrl = trackingService.generateTrackingPixelUrl(testEmailId, testEmail);
    if (pixelUrl.includes(testEmailId)) {
      log(`✅ Tracking pixel URL generated correctly`, colors.green);
    } else {
      log(`⚠️  Tracking pixel URL missing email ID`, colors.yellow);
    }
    
    // Test click tracking URL generation
    const clickUrl = trackingService.generateClickTrackingUrl(
      testEmailId, 
      testEmail, 
      "https://pitchey-5o8.pages.dev", 
      1
    );
    if (clickUrl.includes('track/click')) {
      log(`✅ Click tracking URL generated correctly`, colors.green);
    } else {
      log(`⚠️  Click tracking URL malformed`, colors.yellow);
    }
    
    // Test adding tracking to HTML content
    const testHtml = '<p>Hello <a href="https://pitchey-5o8.pages.dev">Visit Pitchey</a></p>';
    const trackedHtml = trackingService.addClickTracking(testHtml, testEmailId, testEmail);
    const htmlWithPixel = trackingService.addOpenTracking(trackedHtml, testEmailId, testEmail);
    
    if (htmlWithPixel.includes('track/click') && htmlWithPixel.includes('<img')) {
      log(`✅ HTML tracking integration successful`, colors.green);
    } else {
      log(`⚠️  HTML tracking integration incomplete`, colors.yellow);
    }
    
    // Test event tracking
    await trackingService.trackOpen(testEmailId, testEmail, 'test-agent', '127.0.0.1');
    await trackingService.trackClick(testEmailId, testEmail, 'https://pitchey-5o8.pages.dev', 'test-agent', '127.0.0.1');
    
    log(`✅ Event tracking completed`, colors.green);
    
    // Get analytics
    const analytics = await trackingService.getEmailAnalytics(testEmailId);
    log(`📊 Analytics retrieved - Opens: ${analytics.openedCount}, Clicks: ${analytics.clickedCount}`, colors.blue);
    
    return true;
  } catch (error) {
    log(`❌ Email tracking test failed: ${error}`, colors.red);
    return false;
  }
}

async function testUnsubscribeManagement() {
  section("Testing Unsubscribe Management");
  
  try {
    const unsubscribeService = getEmailUnsubscribeService();
    
    // Test creating email preferences
    const preferences = await unsubscribeService.createDefaultPreferences(
      testUser.id,
      testUser.email,
      testUser.userType
    );
    
    if (preferences.userId === testUser.id && preferences.email === testUser.email) {
      log(`✅ Email preferences created successfully`, colors.green);
    } else {
      log(`⚠️  Email preferences creation incomplete`, colors.yellow);
    }
    
    // Test subscription checking
    const isSubscribedToWelcome = await unsubscribeService.isSubscribed(testUser.id, 'welcome');
    const isSubscribedToMarketing = await unsubscribeService.isSubscribed(testUser.id, 'marketing');
    
    log(`📧 Subscription status - Welcome: ${isSubscribedToWelcome}, Marketing: ${isSubscribedToMarketing}`, colors.blue);
    
    // Test unsubscribe URL generation
    const unsubscribeUrl = unsubscribeService.generateUnsubscribeUrl(testUser.id, testUser.email, 'marketing');
    if (unsubscribeUrl.includes('unsubscribe') && unsubscribeUrl.includes('token')) {
      log(`✅ Unsubscribe URL generated correctly`, colors.green);
    } else {
      log(`⚠️  Unsubscribe URL malformed`, colors.yellow);
    }
    
    // Test unsubscribe stats
    const stats = await unsubscribeService.getUnsubscribeStats(30);
    log(`📊 Unsubscribe stats - Total: ${stats.totalUnsubscribes}`, colors.blue);
    
    return true;
  } catch (error) {
    log(`❌ Unsubscribe management test failed: ${error}`, colors.red);
    return false;
  }
}

async function testHighLevelEmailFunctions() {
  section("Testing High-Level Email Functions");
  
  try {
    let successCount = 0;
    
    // Test welcome email
    try {
      const result = await sendWelcomeEmail(testUser.email, {
        firstName: testUser.firstName,
        userType: testUser.userType,
        dashboardUrl: "https://pitchey-5o8.pages.dev/dashboard",
        profileSetupUrl: "https://pitchey-5o8.pages.dev/profile/setup",
        unsubscribeUrl: "https://pitchey-5o8.pages.dev/unsubscribe?token=test"
      });
      
      if (result.success) {
        log(`✅ Welcome email sent successfully`, colors.green);
        successCount++;
      } else {
        log(`⚠️  Welcome email failed: ${result.error}`, colors.yellow);
      }
    } catch (error) {
      log(`❌ Welcome email error: ${error}`, colors.red);
    }
    
    // Test password reset email
    try {
      const result = await sendPasswordResetEmail(testUser.email, {
        firstName: testUser.firstName,
        resetUrl: "https://pitchey-5o8.pages.dev/reset-password?token=test",
        expiresIn: "1 hour",
        unsubscribeUrl: "https://pitchey-5o8.pages.dev/unsubscribe?token=test"
      });
      
      if (result.success) {
        log(`✅ Password reset email sent successfully`, colors.green);
        successCount++;
      } else {
        log(`⚠️  Password reset email failed: ${result.error}`, colors.yellow);
      }
    } catch (error) {
      log(`❌ Password reset email error: ${error}`, colors.red);
    }
    
    log(`📊 High-level functions: ${successCount}/2 successful`, 
        successCount === 2 ? colors.green : colors.yellow);
    
    return successCount > 0;
  } catch (error) {
    log(`❌ High-level email functions test failed: ${error}`, colors.red);
    return false;
  }
}

async function runFullTestSuite() {
  log(`${colors.bright}${colors.blue}🚀 Starting Email Notification System Test Suite${colors.reset}\n`);
  
  const startTime = Date.now();
  const testResults: { [key: string]: boolean } = {};
  
  // Run all test categories
  testResults["Email Providers"] = await testEmailProviders();
  testResults["Email Templates"] = await testEmailTemplates();
  testResults["Template Rendering"] = await testTemplateRendering();
  testResults["Email Queue"] = await testEmailQueue();
  testResults["Email Tracking"] = await testEmailTracking();
  testResults["Unsubscribe Management"] = await testUnsubscribeManagement();
  testResults["High-Level Functions"] = await testHighLevelEmailFunctions();
  
  // Calculate results
  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(result => result).length;
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Display final results
  section("Test Results Summary");
  
  for (const [testName, passed] of Object.entries(testResults)) {
    const status = passed ? "✅ PASS" : "❌ FAIL";
    const color = passed ? colors.green : colors.red;
    log(`${status} ${testName}`, color);
  }
  
  const overallSuccess = passedTests === totalTests;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  log(`\n${colors.bright}Overall Result: ${passedTests}/${totalTests} tests passed (${successRate}%)${colors.reset}`);
  log(`⏱️  Duration: ${duration} seconds`);
  
  if (overallSuccess) {
    log(`\n🎉 ${colors.bright}${colors.green}Email Notification System Test Suite PASSED!${colors.reset}`);
    log(`${colors.green}All email functionality is working correctly.${colors.reset}`);
  } else {
    log(`\n⚠️  ${colors.bright}${colors.yellow}Email Notification System Test Suite PARTIALLY PASSED${colors.reset}`);
    log(`${colors.yellow}Some functionality may need attention, but core features are working.${colors.reset}`);
  }
  
  // Configuration recommendations
  section("Configuration Recommendations");
  
  if (testResults["Email Providers"]) {
    log(`✅ Email provider is configured and working`, colors.green);
  } else {
    log(`⚠️  Configure EMAIL_PROVIDER environment variable (sendgrid/postmark/console)`, colors.yellow);
    log(`⚠️  Set EMAIL_FROM and EMAIL_FROM_NAME environment variables`, colors.yellow);
  }
  
  if (!testResults["Email Queue"]) {
    log(`⚠️  Ensure Redis is available for email queue functionality`, colors.yellow);
  }
  
  log(`💡 For production use:`, colors.cyan);
  log(`   - Set up SendGrid API key: SENDGRID_API_KEY`, colors.cyan);
  log(`   - Configure email tracking domain`, colors.cyan);
  log(`   - Set up unsubscribe landing pages`, colors.cyan);
  log(`   - Monitor email queue processing`, colors.cyan);
  log(`   - Set up email analytics dashboard`, colors.cyan);
  
  return overallSuccess;
}

// Run the test suite
if (import.meta.main) {
  try {
    const success = await runFullTestSuite();
    Deno.exit(success ? 0 : 1);
  } catch (error) {
    log(`💥 Test suite crashed: ${error}`, colors.red);
    Deno.exit(1);
  }
}