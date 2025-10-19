#!/usr/bin/env deno run --allow-all

// Test script for the new email service
// This verifies that the email service works and can switch providers

import { 
  getEmailService, 
  sendWelcomeEmail, 
  sendNDARequestEmail,
  sendPasswordResetEmail,
  getEmailServiceHealth,
  getEmailServiceInfo
} from './src/services/email/index.ts';

async function testEmailService() {
  console.log('🧪 Testing Pitchey Email Service\n');

  try {
    // Test 1: Service initialization
    console.log('1️⃣ Testing service initialization...');
    const emailService = getEmailService();
    console.log('✅ Email service initialized');
    
    // Test 2: Provider info
    console.log('\n2️⃣ Getting provider information...');
    const info = getEmailServiceInfo();
    console.log('📋 Provider info:', JSON.stringify(info, null, 2));
    
    // Test 3: Health check
    console.log('\n3️⃣ Checking service health...');
    const health = await getEmailServiceHealth();
    console.log('🏥 Health status:', JSON.stringify(health, null, 2));
    
    // Test 4: Welcome email
    console.log('\n4️⃣ Testing welcome email...');
    const welcomeResult = await sendWelcomeEmail('test@example.com', {
      firstName: 'John',
      userType: 'creator',
      dashboardUrl: 'https://pitchey.com/dashboard',
      profileSetupUrl: 'https://pitchey.com/profile/setup',
      unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=test123'
    });
    console.log('📧 Welcome email result:', JSON.stringify(welcomeResult, null, 2));
    
    // Test 5: NDA request email
    console.log('\n5️⃣ Testing NDA request email...');
    const ndaResult = await sendNDARequestEmail('creator@example.com', {
      recipientName: 'Jane Creator',
      senderName: 'Mike Investor',
      pitchTitle: 'Amazing Movie Concept',
      requestMessage: 'I would love to learn more about this project.',
      actionUrl: 'https://pitchey.com/nda/requests/123',
      unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=test456'
    });
    console.log('📧 NDA request email result:', JSON.stringify(ndaResult, null, 2));
    
    // Test 6: Password reset email
    console.log('\n6️⃣ Testing password reset email...');
    const passwordResult = await sendPasswordResetEmail('user@example.com', {
      firstName: 'Sarah',
      resetUrl: 'https://pitchey.com/reset-password?token=reset123',
      expiresIn: '24 hours',
      unsubscribeUrl: 'https://pitchey.com/unsubscribe?token=test789'
    });
    console.log('📧 Password reset email result:', JSON.stringify(passwordResult, null, 2));
    
    console.log('\n✅ All email service tests completed successfully!');
    console.log('\n💡 To switch to production email provider:');
    console.log('   1. Set EMAIL_PROVIDER=sendgrid (or postmark)');
    console.log('   2. Set SENDGRID_API_KEY=SG.xxx (or POSTMARK_API_KEY=xxx)');
    console.log('   3. Restart the service');
    console.log('\n🔧 Current provider configuration:');
    console.log(`   Provider: ${info.config?.provider || 'unknown'}`);
    console.log(`   From: ${info.config?.fromName || 'unknown'} <${info.config?.fromEmail || 'unknown'}>`);
    console.log(`   API Keys available: ${JSON.stringify(info.config?.hasApiKey || {})}`);
    
  } catch (error) {
    console.error('❌ Email service test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check that all email service files exist');
    console.error('   2. Verify environment variables are set correctly');
    console.error('   3. Check console output for specific errors');
    throw error;
  }
}

// Environment variable examples
console.log('🌍 Email Service Environment Variables:');
console.log('   EMAIL_PROVIDER =', Deno.env.get('EMAIL_PROVIDER') || 'console (default)');
console.log('   EMAIL_FROM =', Deno.env.get('EMAIL_FROM') || 'noreply@pitchey.com (default)');
console.log('   EMAIL_FROM_NAME =', Deno.env.get('EMAIL_FROM_NAME') || 'Pitchey (default)');
console.log('   SENDGRID_API_KEY =', Deno.env.get('SENDGRID_API_KEY') ? '[SET]' : '[NOT SET]');
console.log('   POSTMARK_API_KEY =', Deno.env.get('POSTMARK_API_KEY') ? '[SET]' : '[NOT SET]');
console.log('');

if (import.meta.main) {
  await testEmailService();
}