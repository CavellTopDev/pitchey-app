/**
 * Comprehensive Financial Email Templates
 * Professional HTML email templates for all investment and transaction notifications
 */

// Base email template with modern styling
const baseTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; 
      padding: 0; 
      background-color: #f8fafc; 
      color: #334155;
      line-height: 1.6;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: white; 
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      padding: 32px 24px; 
      text-align: center; 
    }
    .header h1 { 
      margin: 0; 
      font-size: 28px; 
      font-weight: 600; 
    }
    .header .subtitle {
      margin: 8px 0 0 0;
      font-size: 16px;
      opacity: 0.9;
    }
    .content { 
      padding: 32px 24px; 
    }
    .content h2 { 
      color: #1e293b; 
      margin-top: 0; 
      font-size: 20px; 
      font-weight: 600;
    }
    .content p { 
      color: #475569; 
      margin-bottom: 16px; 
    }
    .highlight-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 1px solid #0284c7;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .highlight-amount {
      font-size: 32px;
      font-weight: bold;
      color: #0284c7;
      margin: 0;
    }
    .highlight-label {
      font-size: 14px;
      color: #64748b;
      margin: 4px 0 0 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 24px 0;
    }
    .info-item {
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .info-item strong {
      color: #1e293b;
      display: block;
      margin-bottom: 4px;
    }
    .button { 
      display: inline-block; 
      background: #667eea; 
      color: white; 
      padding: 14px 28px; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 500; 
      margin: 20px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background: #5b6ee6;
    }
    .button-secondary {
      background: #64748b;
    }
    .button-success {
      background: #059669;
    }
    .button-warning {
      background: #d97706;
    }
    .button-danger {
      background: #dc2626;
    }
    .alert {
      padding: 16px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .alert-success {
      background: #f0fdf4;
      border: 1px solid #22c55e;
      color: #15803d;
    }
    .alert-warning {
      background: #fffbeb;
      border: 1px solid #f59e0b;
      color: #d97706;
    }
    .alert-danger {
      background: #fef2f2;
      border: 1px solid #ef4444;
      color: #dc2626;
    }
    .transaction-summary {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .transaction-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .transaction-item:last-child {
      border-bottom: none;
    }
    .footer { 
      background: #f1f5f9; 
      padding: 24px; 
      text-align: center; 
      color: #64748b; 
      font-size: 14px; 
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .security-notice {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .security-notice strong {
      color: #92400e;
    }
    @media only screen and (max-width: 600px) {
      .container { margin: 10px; }
      .header { padding: 24px 20px; }
      .content { padding: 24px 20px; }
      .info-grid { grid-template-columns: 1fr; }
      .highlight-amount { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    {{content}}
    <div class="footer">
      <p>
        This email was sent by <strong>Pitchey</strong><br>
        <a href="{{unsubscribeUrl}}">Unsubscribe</a> | 
        <a href="{{preferencesUrl}}">Email Preferences</a> | 
        <a href="{{supportUrl}}">Support</a>
      </p>
      <p>© 2024 Pitchey. All rights reserved.</p>
      <p style="font-size: 12px; color: #94a3b8;">
        For security, never share your account credentials. If you didn't expect this email, please contact support.
      </p>
    </div>
  </div>
</body>
</html>`;

// Investment Confirmation Email
export const investmentConfirmationTemplate = `
<div class="header">
  <h1>🎉 Investment Confirmed!</h1>
  <p class="subtitle">Your investment has been successfully processed</p>
</div>
<div class="content">
  <p>Congratulations! Your investment in "<strong>{{pitchTitle}}</strong>" has been confirmed and processed successfully.</p>
  
  <div class="highlight-box">
    <p class="highlight-amount">{{amount}}</p>
    <p class="highlight-label">Investment Amount</p>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <strong>Project</strong>
      {{pitchTitle}}
    </div>
    <div class="info-item">
      <strong>Creator</strong>
      {{creatorName}}
    </div>
    <div class="info-item">
      <strong>Investment Type</strong>
      {{investmentType}}
    </div>
    <div class="info-item">
      <strong>Transaction ID</strong>
      {{transactionId}}
    </div>
  </div>

  <div class="alert alert-success">
    <strong>What happens next?</strong>
    <ul>
      <li><strong>Documentation:</strong> Legal documents will be sent within 2-3 business days</li>
      <li><strong>Updates:</strong> You'll receive regular project updates from the creator</li>
      <li><strong>Portfolio:</strong> Track your investment performance in your dashboard</li>
      <li><strong>Communication:</strong> Direct communication channel with the project team</li>
    </ul>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="{{portfolioUrl}}" class="button button-success">View Your Portfolio</a>
  </div>

  <p>Thank you for supporting <strong>{{creatorName}}</strong>'s vision! Your investment helps bring creative projects to life.</p>
  
  <p><em>Questions? Contact our investor relations team at <a href="mailto:investors@pitchey.com">investors@pitchey.com</a></em></p>
</div>`;

// ROI Distribution Email
export const roiDistributionTemplate = `
<div class="header">
  <h1>💰 ROI Distribution Received</h1>
  <p class="subtitle">{{period}} distribution processed</p>
</div>
<div class="content">
  <p>Great news! You've received a return on investment distribution from your portfolio.</p>
  
  <div class="highlight-box">
    <p class="highlight-amount">{{amount}}</p>
    <p class="highlight-label">Distribution Amount ({{percentage}}% of total)</p>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <strong>Project</strong>
      {{pitchTitle}}
    </div>
    <div class="info-item">
      <strong>Distribution Type</strong>
      {{distributionType}}
    </div>
    <div class="info-item">
      <strong>Period</strong>
      {{period}}
    </div>
    <div class="info-item">
      <strong>Transaction ID</strong>
      {{transactionId}}
    </div>
  </div>

  <div class="transaction-summary">
    <h3 style="margin-top: 0; color: #1e293b;">Distribution Breakdown</h3>
    <div class="transaction-item">
      <span>Total Distribution Pool</span>
      <span><strong>{{totalDistribution}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Your Share ({{percentage}}%)</span>
      <span><strong>{{amount}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Investment Amount</span>
      <span>{{investmentAmount}}</span>
    </div>
    <div class="transaction-item">
      <span style="color: #059669;"><strong>ROI This Period</strong></span>
      <span style="color: #059669;"><strong>{{roiPercentage}}%</strong></span>
    </div>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="{{walletUrl}}" class="button">View Transaction</a>
    <a href="{{portfolioUrl}}" class="button button-secondary">Portfolio Details</a>
  </div>

  <p>This distribution has been automatically deposited into your Pitchey wallet and will appear in your account within 1-2 business days.</p>
</div>`;

// Transaction Alert Email
export const transactionAlertTemplate = `
<div class="header">
  <h1>🔔 Transaction Update</h1>
  <p class="subtitle">{{transactionType}} notification</p>
</div>
<div class="content">
  <p>We're writing to notify you about a transaction on your account.</p>
  
  <div class="transaction-summary">
    <h3 style="margin-top: 0; color: #1e293b;">Transaction Details</h3>
    <div class="transaction-item">
      <span>Transaction Type</span>
      <span><strong>{{transactionType}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Amount</span>
      <span><strong>{{amount}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Status</span>
      <span class="{{statusClass}}"><strong>{{status}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Reference</span>
      <span>{{reference}}</span>
    </div>
    <div class="transaction-item">
      <span>Date & Time</span>
      <span>{{timestamp}}</span>
    </div>
  </div>

  {{#if isSuccess}}
  <div class="alert alert-success">
    <strong>Transaction Completed Successfully</strong><br>
    Your {{transactionType}} has been processed and your account has been updated accordingly.
  </div>
  {{/if}}

  {{#if isFailed}}
  <div class="alert alert-danger">
    <strong>Transaction Failed</strong><br>
    {{failureReason}}. Please contact support if you need assistance.
  </div>
  {{/if}}

  {{#if isPending}}
  <div class="alert alert-warning">
    <strong>Transaction Processing</strong><br>
    Your transaction is currently being processed. You'll receive another notification once it's complete.
  </div>
  {{/if}}

  <div style="text-align: center; margin: 32px 0;">
    <a href="{{transactionUrl}}" class="button">View Transaction Details</a>
    {{#if isFailed}}
    <a href="{{supportUrl}}" class="button button-secondary">Contact Support</a>
    {{/if}}
  </div>

  <div class="security-notice">
    <strong>Security Notice:</strong> If you didn't authorize this transaction, please contact our support team immediately at <a href="mailto:security@pitchey.com">security@pitchey.com</a>
  </div>
</div>`;

// Monthly Statement Email
export const monthlyStatementTemplate = `
<div class="header">
  <h1>📊 Monthly Statement</h1>
  <p class="subtitle">{{month}} {{year}} Portfolio Summary</p>
</div>
<div class="content">
  <p>Hi {{userName}}, here's your monthly investment portfolio statement.</p>
  
  <div class="info-grid">
    <div class="info-item">
      <strong>Total Portfolio Value</strong>
      {{totalValue}}
    </div>
    <div class="info-item">
      <strong>Monthly Return</strong>
      <span style="color: {{returnColor}};">{{monthlyReturn}}</span>
    </div>
    <div class="info-item">
      <strong>Total Invested</strong>
      {{totalInvested}}
    </div>
    <div class="info-item">
      <strong>Available Balance</strong>
      {{availableBalance}}
    </div>
  </div>

  <h3>Transaction Summary</h3>
  <div class="transaction-summary">
    <div class="transaction-item">
      <span>New Investments</span>
      <span><strong>{{newInvestments}} ({{newInvestmentAmount}})</strong></span>
    </div>
    <div class="transaction-item">
      <span>ROI Distributions</span>
      <span><strong>{{distributions}} ({{distributionAmount}})</strong></span>
    </div>
    <div class="transaction-item">
      <span>Deposits</span>
      <span><strong>{{deposits}} ({{depositAmount}})</strong></span>
    </div>
    <div class="transaction-item">
      <span>Withdrawals</span>
      <span><strong>{{withdrawals}} ({{withdrawalAmount}})</strong></span>
    </div>
  </div>

  {{#if topPerformers}}
  <h3>Top Performing Investments</h3>
  <div class="transaction-summary">
    {{#each topPerformers}}
    <div class="transaction-item">
      <span>{{title}}</span>
      <span style="color: #059669;"><strong>+{{roi}}%</strong></span>
    </div>
    {{/each}}
  </div>
  {{/if}}

  <div style="text-align: center; margin: 32px 0;">
    <a href="{{portfolioUrl}}" class="button">View Full Portfolio</a>
    <a href="{{downloadUrl}}" class="button button-secondary">Download PDF</a>
  </div>

  <p>Keep up the great work! Your diversified investment strategy is helping build a stronger creative community.</p>
</div>`;

// Security Alert Email
export const securityAlertTemplate = `
<div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
  <h1>🚨 Security Alert</h1>
  <p class="subtitle">Unusual activity detected on your account</p>
</div>
<div class="content">
  <div class="alert alert-danger">
    <strong>Security Alert: {{alertType}}</strong><br>
    We've detected unusual activity on your account that requires your attention.
  </div>

  <h3>Alert Details</h3>
  <div class="transaction-summary">
    <div class="transaction-item">
      <span>Alert Type</span>
      <span><strong>{{alertType}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Severity</span>
      <span style="color: #dc2626;"><strong>{{severity}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Detected At</span>
      <span>{{detectedAt}}</span>
    </div>
    <div class="transaction-item">
      <span>Risk Score</span>
      <span style="color: #dc2626;"><strong>{{riskScore}}/100</strong></span>
    </div>
  </div>

  <h3>Activity Summary</h3>
  <p><strong>{{description}}</strong></p>
  
  {{#if evidencePoints}}
  <ul>
    {{#each evidencePoints}}
    <li>{{this}}</li>
    {{/each}}
  </ul>
  {{/if}}

  {{#if affectedTransactions}}
  <h3>Affected Transactions</h3>
  <div class="transaction-summary">
    {{#each affectedTransactions}}
    <div class="transaction-item">
      <span>{{description}}</span>
      <span><strong>{{amount}}</strong></span>
    </div>
    {{/each}}
  </div>
  {{/if}}

  <div style="text-align: center; margin: 32px 0;">
    <a href="{{reviewUrl}}" class="button button-danger">Review Activity</a>
    <a href="{{securityUrl}}" class="button button-secondary">Security Settings</a>
  </div>

  <div class="security-notice">
    <strong>Immediate Actions Required:</strong>
    <ol>
      <li>Review your recent account activity</li>
      <li>Verify all transactions are authorized</li>
      <li>Update your password if necessary</li>
      <li>Contact us if you don't recognize this activity</li>
    </ol>
  </div>

  <p style="text-align: center; margin: 32px 0;">
    <strong>Need Help?</strong><br>
    Contact our security team immediately: <a href="mailto:security@pitchey.com">security@pitchey.com</a><br>
    Or call our 24/7 security hotline: <strong>1-800-PITCHEY</strong>
  </p>
</div>`;

// Investment Opportunity Match Email
export const opportunityMatchTemplate = `
<div class="header">
  <h1>🎯 Perfect Match Found!</h1>
  <p class="subtitle">{{matchScore}}% compatibility with your preferences</p>
</div>
<div class="content">
  <p>We've found an exciting investment opportunity that matches your investment criteria perfectly!</p>
  
  <div class="highlight-box">
    <h2 style="margin: 0; color: #1e293b;">"{{pitchTitle}}"</h2>
    <p style="margin: 8px 0 0 0; color: #64748b;">by {{creatorName}}</p>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <strong>Match Score</strong>
      {{matchScore}}%
    </div>
    <div class="info-item">
      <strong>Genre</strong>
      {{genre}}
    </div>
    <div class="info-item">
      <strong>Funding Goal</strong>
      {{fundingGoal}}
    </div>
    <div class="info-item">
      <strong>Investment Deadline</strong>
      {{deadline}}
    </div>
  </div>

  <h3>Why This Matches Your Preferences</h3>
  <ul>
    {{#each reasons}}
    <li>{{this}}</li>
    {{/each}}
  </ul>

  {{#if urgency}}
  <div class="alert alert-warning">
    <strong>Time Sensitive:</strong> This opportunity has limited time or spots remaining. Consider reviewing soon to secure your position.
  </div>
  {{/if}}

  <div style="text-align: center; margin: 32px 0;">
    <a href="{{opportunityUrl}}" class="button">View Opportunity</a>
    <a href="{{creatorProfileUrl}}" class="button button-secondary">Creator Profile</a>
  </div>

  <div class="transaction-summary">
    <h3 style="margin-top: 0; color: #1e293b;">Quick Stats</h3>
    <div class="transaction-item">
      <span>Previous Success Rate</span>
      <span><strong>{{successRate}}%</strong></span>
    </div>
    <div class="transaction-item">
      <span>Average ROI</span>
      <span style="color: #059669;"><strong>{{averageROI}}%</strong></span>
    </div>
    <div class="transaction-item">
      <span>Risk Level</span>
      <span><strong>{{riskLevel}}</strong></span>
    </div>
  </div>

  <p><em>This recommendation is based on your investment history, preferences, and portfolio diversification goals.</em></p>
</div>`;

// Payment Failure Email
export const paymentFailureTemplate = `
<div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
  <h1>❌ Payment Issue</h1>
  <p class="subtitle">Action required to complete your transaction</p>
</div>
<div class="content">
  <div class="alert alert-danger">
    <strong>Payment Failed:</strong> We were unable to process your payment. Your investment is currently on hold.
  </div>

  <h3>Transaction Details</h3>
  <div class="transaction-summary">
    <div class="transaction-item">
      <span>Transaction</span>
      <span><strong>{{transactionType}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Amount</span>
      <span><strong>{{amount}}</strong></span>
    </div>
    <div class="transaction-item">
      <span>Payment Method</span>
      <span>{{paymentMethod}}</span>
    </div>
    <div class="transaction-item">
      <span>Failure Reason</span>
      <span style="color: #dc2626;"><strong>{{failureReason}}</strong></span>
    </div>
  </div>

  <h3>Next Steps</h3>
  <ol>
    <li><strong>Check your payment method:</strong> Ensure your card has sufficient funds and hasn't expired</li>
    <li><strong>Update payment information:</strong> Add a new payment method or update existing details</li>
    <li><strong>Retry payment:</strong> Complete your investment once payment issues are resolved</li>
  </ol>

  {{#if isRecurring}}
  <div class="alert alert-warning">
    <strong>Recurring Investment Affected:</strong> We've detected {{failureCount}} recent payment failures. Please update your payment method to continue your recurring investment plan.
  </div>
  {{/if}}

  <div style="text-align: center; margin: 32px 0;">
    <a href="{{paymentMethodsUrl}}" class="button button-danger">Update Payment Method</a>
    <a href="{{retryUrl}}" class="button">Retry Payment</a>
  </div>

  <p><strong>Questions?</strong> Our support team is here to help: <a href="mailto:billing@pitchey.com">billing@pitchey.com</a></p>
</div>`;

// Tax Document Ready Email
export const taxDocumentTemplate = `
<div class="header">
  <h1>📋 Tax Documents Ready</h1>
  <p class="subtitle">{{year}} Investment Tax Summary</p>
</div>
<div class="content">
  <p>Your {{year}} tax documents are now available for download.</p>
  
  <div class="info-grid">
    <div class="info-item">
      <strong>Total Invested</strong>
      {{totalInvested}}
    </div>
    <div class="info-item">
      <strong>Total Returns</strong>
      {{totalReturns}}
    </div>
    <div class="info-item">
      <strong>Net Gain/Loss</strong>
      <span style="color: {{gainLossColor}};">{{netGainLoss}}</span>
    </div>
    <div class="info-item">
      <strong>Taxable Amount</strong>
      {{taxableAmount}}
    </div>
  </div>

  <div class="transaction-summary">
    <h3 style="margin-top: 0; color: #1e293b;">Available Documents</h3>
    {{#each documents}}
    <div class="transaction-item">
      <span>{{name}}</span>
      <span><a href="{{downloadUrl}}" class="button-link">Download</a></span>
    </div>
    {{/each}}
  </div>

  <div class="alert alert-warning">
    <strong>Important:</strong> Please consult with a tax professional for advice on how these investments affect your tax situation. This summary is for informational purposes only.
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="{{taxCenterUrl}}" class="button">View Tax Center</a>
    <a href="{{downloadAllUrl}}" class="button button-secondary">Download All Documents</a>
  </div>

  <p><em>Tax documents will remain available in your account for at least 7 years as required by law.</em></p>
</div>`;

// Export all templates
export const financialEmailTemplates = {
  base: baseTemplate,
  investmentConfirmation: investmentConfirmationTemplate,
  roiDistribution: roiDistributionTemplate,
  transactionAlert: transactionAlertTemplate,
  monthlyStatement: monthlyStatementTemplate,
  securityAlert: securityAlertTemplate,
  opportunityMatch: opportunityMatchTemplate,
  paymentFailure: paymentFailureTemplate,
  taxDocument: taxDocumentTemplate
};

// Template compilation helper
export function compileEmailTemplate(templateName: keyof typeof financialEmailTemplates, variables: Record<string, any>): string {
  let template = financialEmailTemplates[templateName];
  
  if (templateName !== 'base') {
    // Wrap content templates in base template
    template = baseTemplate.replace('{{content}}', template);
  }
  
  // Replace variables
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

// Template validation helper
export function validateTemplateVariables(templateName: keyof typeof financialEmailTemplates, variables: Record<string, any>): { isValid: boolean; missingVariables: string[] } {
  const template = financialEmailTemplates[templateName];
  const requiredVars = template.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/[{}]/g, '')) || [];
  const missingVariables = requiredVars.filter(varName => !(varName in variables));
  
  return {
    isValid: missingVariables.length === 0,
    missingVariables
  };
}