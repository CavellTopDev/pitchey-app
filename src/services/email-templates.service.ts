// Email template interfaces and data types
export interface TemplateData {
  [key: string]: any;
}

export interface WelcomeEmailData {
  firstName: string;
  userType: "creator" | "investor" | "production" | "viewer";
  dashboardUrl: string;
  profileSetupUrl: string;
  unsubscribeUrl: string;
}

export interface NDARequestEmailData {
  recipientName: string;
  senderName: string;
  pitchTitle: string;
  requestMessage?: string;
  actionUrl: string;
  unsubscribeUrl: string;
}

export interface NDAResponseEmailData {
  recipientName: string;
  senderName: string;
  pitchTitle: string;
  approved: boolean;
  reason?: string;
  actionUrl: string;
  unsubscribeUrl: string;
}

export interface MessageEmailData {
  recipientName: string;
  senderName: string;
  messageContent: string;
  pitchTitle?: string;
  conversationUrl: string;
  unsubscribeUrl: string;
}

export interface PasswordResetEmailData {
  firstName: string;
  resetUrl: string;
  expiresIn: string;
  unsubscribeUrl: string;
}

export interface PaymentConfirmationEmailData {
  firstName: string;
  paymentType: "subscription" | "credits" | "success_fee";
  amount: string;
  currency: string;
  description: string;
  invoiceUrl?: string;
  receiptUrl?: string;
  unsubscribeUrl: string;
}

export interface WeeklyDigestEmailData {
  firstName: string;
  weekRange: string;
  stats: {
    newPitches: number;
    newFollowers: number;
    messages: number;
    views: number;
  };
  topPitches: Array<{
    title: string;
    views: number;
    url: string;
  }>;
  recommendations: Array<{
    title: string;
    creator: string;
    url: string;
    imageUrl?: string;
  }>;
  unsubscribeUrl: string;
}

export interface PitchViewEmailData {
  creatorName: string;
  pitchTitle: string;
  viewerName: string;
  viewerType: string;
  pitchUrl: string;
  viewTime: string;
  unsubscribeUrl: string;
}

// Base email template with responsive design
export function getBaseTemplate(content: string, title: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  ${preheader ? `<meta name="description" content="${preheader}">` : ''}
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 20px !important; }
      .header { padding: 20px !important; }
      .footer { padding: 20px !important; }
      .button { width: 100% !important; padding: 15px !important; }
      .stats-grid { flex-direction: column !important; }
      .stat-item { margin-bottom: 10px !important; }
      .recommendations { flex-direction: column !important; }
      .recommendation-item { width: 100% !important; margin-bottom: 20px !important; }
    }
    
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #374151;
      background-color: #f9fafb;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      padding: 30px;
      text-align: center;
    }
    
    .logo {
      color: #ffffff;
      font-size: 28px;
      font-weight: bold;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    
    .content {
      padding: 40px 30px;
    }
    
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 20px;
    }
    
    .text {
      font-size: 16px;
      line-height: 1.7;
      color: #374151;
      margin-bottom: 20px;
    }
    
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
      transition: transform 0.2s ease;
    }
    
    .button:hover {
      transform: translateY(-1px);
    }
    
    .button-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 2px solid #e5e7eb;
    }
    
    .highlight-box {
      background-color: #f8fafc;
      border-left: 4px solid #6366f1;
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    
    .stats-grid {
      display: flex;
      gap: 20px;
      margin: 30px 0;
    }
    
    .stat-item {
      flex: 1;
      text-align: center;
      padding: 20px;
      background-color: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .stat-number {
      font-size: 32px;
      font-weight: bold;
      color: #6366f1;
      display: block;
    }
    
    .stat-label {
      font-size: 14px;
      color: #6b7280;
      margin-top: 5px;
    }
    
    .recommendations {
      display: flex;
      gap: 20px;
      margin: 30px 0;
    }
    
    .recommendation-item {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .recommendation-image {
      width: 100%;
      height: 120px;
      background-color: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      font-size: 14px;
    }
    
    .recommendation-content {
      padding: 15px;
    }
    
    .recommendation-title {
      font-weight: 600;
      color: #111827;
      margin-bottom: 5px;
      font-size: 14px;
    }
    
    .recommendation-creator {
      font-size: 12px;
      color: #6b7280;
    }
    
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-text {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    
    .footer-links {
      font-size: 12px;
      color: #9ca3af;
    }
    
    .footer-links a {
      color: #6366f1;
      text-decoration: none;
      margin: 0 10px;
    }
    
    .unsubscribe {
      margin-top: 20px;
      font-size: 12px;
      color: #9ca3af;
    }
    
    .unsubscribe a {
      color: #6b7280;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  ${preheader ? `
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">
    ${preheader}
  </div>
  ` : ''}
  
  <div class="container">
    <div class="header">
      <a href="https://pitchey.com" class="logo">Pitchey</a>
    </div>
    
    <div class="content">
      ${content}
    </div>
    
    <div class="footer">
      <div class="footer-text">
        © ${new Date().getFullYear()} Pitchey. All rights reserved.
      </div>
      <div class="footer-links">
        <a href="https://pitchey.com">Home</a>
        <a href="https://pitchey.com/help">Help</a>
        <a href="https://pitchey.com/privacy">Privacy</a>
        <a href="https://pitchey.com/terms">Terms</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Welcome email template
export function getWelcomeEmailTemplate(data: WelcomeEmailData): { html: string; text: string } {
  const userTypeLabels = {
    creator: "Creator",
    investor: "Investor", 
    production: "Production Company",
    viewer: "Viewer"
  };

  const userTypeMessages = {
    creator: "Start building your portfolio by creating your first pitch.",
    investor: "Discover amazing new projects and connect with talented creators.",
    production: "Find your next big production and manage your development pipeline.",
    viewer: "Explore the latest film and TV projects from emerging creators."
  };

  const content = `
    <div class="greeting">Welcome to Pitchey, ${data.firstName}! 🎬</div>
    
    <div class="text">
      Thank you for joining Pitchey as a <strong>${userTypeLabels[data.userType]}</strong>. 
      You're now part of a growing community of creators, investors, and industry professionals.
    </div>
    
    <div class="text">
      ${userTypeMessages[data.userType]}
    </div>
    
    <div class="highlight-box">
      <strong>Get started in 3 easy steps:</strong>
      <ol style="margin: 10px 0; padding-left: 20px;">
        <li>Complete your profile setup</li>
        <li>Explore the platform features</li>
        <li>Start connecting with the community</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.profileSetupUrl}" class="button">Complete Your Profile</a>
      <br>
      <a href="${data.dashboardUrl}" class="button button-secondary" style="margin-top: 10px;">Go to Dashboard</a>
    </div>
    
    <div class="text">
      If you have any questions, our team is here to help. Just reply to this email or visit our help center.
    </div>
    
    <div class="unsubscribe">
      <a href="${data.unsubscribeUrl}">Unsubscribe from welcome emails</a>
    </div>
  `;

  const html = getBaseTemplate(content, "Welcome to Pitchey!", `Get started as a ${userTypeLabels[data.userType]} on Pitchey`);

  const text = `
Welcome to Pitchey, ${data.firstName}!

Thank you for joining Pitchey as a ${userTypeLabels[data.userType]}. You're now part of a growing community of creators, investors, and industry professionals.

${userTypeMessages[data.userType]}

Get started in 3 easy steps:
1. Complete your profile setup
2. Explore the platform features  
3. Start connecting with the community

Complete your profile: ${data.profileSetupUrl}
Go to your dashboard: ${data.dashboardUrl}

If you have any questions, our team is here to help. Just reply to this email or visit our help center.

Unsubscribe: ${data.unsubscribeUrl}
  `;

  return { html, text };
}

// NDA Request email template
export function getNDARequestEmailTemplate(data: NDARequestEmailData): { html: string; text: string } {
  const content = `
    <div class="greeting">New NDA Request</div>
    
    <div class="text">
      Hi ${data.recipientName},
    </div>
    
    <div class="text">
      <strong>${data.senderName}</strong> has requested NDA access to your pitch 
      "<strong>${data.pitchTitle}</strong>".
    </div>
    
    ${data.requestMessage ? `
    <div class="highlight-box">
      <strong>Message from ${data.senderName}:</strong>
      <p style="margin: 10px 0; font-style: italic;">"${data.requestMessage}"</p>
    </div>
    ` : ''}
    
    <div class="text">
      Please review the request and decide whether to approve or decline access. 
      Once approved, they'll be able to view your protected content.
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.actionUrl}" class="button">Review NDA Request</a>
    </div>
    
    <div class="text" style="font-size: 14px; color: #6b7280;">
      This request will expire in 7 days if no action is taken.
    </div>
    
    <div class="unsubscribe">
      <a href="${data.unsubscribeUrl}">Unsubscribe from NDA notifications</a>
    </div>
  `;

  const html = getBaseTemplate(content, "New NDA Request", `${data.senderName} wants to access your pitch "${data.pitchTitle}"`);

  const text = `
New NDA Request

Hi ${data.recipientName},

${data.senderName} has requested NDA access to your pitch "${data.pitchTitle}".

${data.requestMessage ? `Message from ${data.senderName}: "${data.requestMessage}"` : ''}

Please review the request and decide whether to approve or decline access. Once approved, they'll be able to view your protected content.

Review request: ${data.actionUrl}

This request will expire in 7 days if no action is taken.

Unsubscribe: ${data.unsubscribeUrl}
  `;

  return { html, text };
}

// NDA Response email template
export function getNDAResponseEmailTemplate(data: NDAResponseEmailData): { html: string; text: string } {
  const isApproved = data.approved;
  const status = isApproved ? "Approved" : "Declined";
  const color = isApproved ? "#10b981" : "#ef4444";
  const emoji = isApproved ? "✅" : "❌";

  const content = `
    <div class="greeting">NDA Request ${status} ${emoji}</div>
    
    <div class="text">
      Hi ${data.recipientName},
    </div>
    
    <div class="text">
      <strong>${data.senderName}</strong> has <strong style="color: ${color};">${status.toLowerCase()}</strong> 
      your NDA request for "<strong>${data.pitchTitle}</strong>".
    </div>
    
    ${data.reason ? `
    <div class="highlight-box">
      <strong>Message from ${data.senderName}:</strong>
      <p style="margin: 10px 0; font-style: italic;">"${data.reason}"</p>
    </div>
    ` : ''}
    
    <div class="text">
      ${isApproved 
        ? "You now have access to the protected content and can view the full pitch details."
        : "You can browse other available pitches on the platform or contact the creator directly if you have questions."
      }
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.actionUrl}" class="button" style="background-color: ${color};">
        ${isApproved ? "View Pitch" : "Browse Other Pitches"}
      </a>
    </div>
    
    <div class="unsubscribe">
      <a href="${data.unsubscribeUrl}">Unsubscribe from NDA notifications</a>
    </div>
  `;

  const html = getBaseTemplate(content, `NDA Request ${status}`, `Your NDA request for "${data.pitchTitle}" has been ${status.toLowerCase()}`);

  const text = `
NDA Request ${status}

Hi ${data.recipientName},

${data.senderName} has ${status.toLowerCase()} your NDA request for "${data.pitchTitle}".

${data.reason ? `Message from ${data.senderName}: "${data.reason}"` : ''}

${isApproved 
  ? "You now have access to the protected content and can view the full pitch details."
  : "You can browse other available pitches on the platform or contact the creator directly if you have questions."
}

${isApproved ? "View pitch" : "Browse pitches"}: ${data.actionUrl}

Unsubscribe: ${data.unsubscribeUrl}
  `;

  return { html, text };
}

// Message notification template
export function getMessageEmailTemplate(data: MessageEmailData): { html: string; text: string } {
  const subject = data.pitchTitle 
    ? `New message about "${data.pitchTitle}" from ${data.senderName}`
    : `New message from ${data.senderName}`;

  const content = `
    <div class="greeting">New Message 💬</div>
    
    <div class="text">
      Hi ${data.recipientName},
    </div>
    
    <div class="text">
      You have received a new message from <strong>${data.senderName}</strong>
      ${data.pitchTitle ? ` about your pitch "<strong>${data.pitchTitle}</strong>".` : '.'}
    </div>
    
    <div class="highlight-box">
      <div style="font-style: italic; color: #374151;">
        "${data.messageContent.length > 200 ? data.messageContent.substring(0, 200) + '...' : data.messageContent}"
      </div>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.conversationUrl}" class="button">View Conversation</a>
    </div>
    
    <div class="text" style="font-size: 14px; color: #6b7280;">
      You're receiving this email because you have message notifications enabled. 
      You can update your notification preferences in your account settings.
    </div>
    
    <div class="unsubscribe">
      <a href="${data.unsubscribeUrl}">Unsubscribe from message notifications</a>
    </div>
  `;

  const html = getBaseTemplate(content, subject, `New message from ${data.senderName}`);

  const text = `
New Message

Hi ${data.recipientName},

You have received a new message from ${data.senderName}${data.pitchTitle ? ` about your pitch "${data.pitchTitle}".` : '.'}

Message: "${data.messageContent.length > 200 ? data.messageContent.substring(0, 200) + '...' : data.messageContent}"

View conversation: ${data.conversationUrl}

You're receiving this email because you have message notifications enabled. You can update your notification preferences in your account settings.

Unsubscribe: ${data.unsubscribeUrl}
  `;

  return { html, text };
}

// Password reset template
export function getPasswordResetEmailTemplate(data: PasswordResetEmailData): { html: string; text: string } {
  const content = `
    <div class="greeting">Password Reset Request 🔐</div>
    
    <div class="text">
      Hi ${data.firstName},
    </div>
    
    <div class="text">
      We received a request to reset your password for your Pitchey account. 
      Click the button below to create a new password.
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.resetUrl}" class="button">Reset Password</a>
    </div>
    
    <div class="highlight-box">
      <strong>Important:</strong>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>This link will expire in ${data.expiresIn}</li>
        <li>If you didn't request this reset, you can safely ignore this email</li>
        <li>Your password won't change until you create a new one</li>
      </ul>
    </div>
    
    <div class="text">
      If the button doesn't work, copy and paste this link into your browser:
    </div>
    
    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; word-break: break-all; margin: 15px 0;">
      ${data.resetUrl}
    </div>
    
    <div class="text" style="font-size: 14px; color: #6b7280;">
      If you continue to have problems, please contact our support team.
    </div>
    
    <div class="unsubscribe">
      <a href="${data.unsubscribeUrl}">Unsubscribe from security notifications</a>
    </div>
  `;

  const html = getBaseTemplate(content, "Reset Your Password", "Reset your Pitchey account password");

  const text = `
Password Reset Request

Hi ${data.firstName},

We received a request to reset your password for your Pitchey account. Click the link below to create a new password.

Reset your password: ${data.resetUrl}

Important:
- This link will expire in ${data.expiresIn}
- If you didn't request this reset, you can safely ignore this email
- Your password won't change until you create a new one

If you continue to have problems, please contact our support team.

Unsubscribe: ${data.unsubscribeUrl}
  `;

  return { html, text };
}

// Payment confirmation template
export function getPaymentConfirmationEmailTemplate(data: PaymentConfirmationEmailData): { html: string; text: string } {
  const paymentTypeLabels = {
    subscription: "Subscription Payment",
    credits: "Credit Purchase", 
    success_fee: "Success Fee Payment"
  };

  const content = `
    <div class="greeting">Payment Confirmed ✅</div>
    
    <div class="text">
      Hi ${data.firstName},
    </div>
    
    <div class="text">
      Your ${paymentTypeLabels[data.paymentType].toLowerCase()} has been successfully processed.
    </div>
    
    <div class="highlight-box">
      <h3 style="margin: 0 0 15px 0; color: #111827;">Payment Details</h3>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span>Amount:</span>
        <strong>${data.amount} ${data.currency}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span>Type:</span>
        <strong>${paymentTypeLabels[data.paymentType]}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Description:</span>
        <strong>${data.description}</strong>
      </div>
    </div>
    
    ${data.invoiceUrl || data.receiptUrl ? `
    <div style="text-align: center; margin: 30px 0;">
      ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="button">View Invoice</a>` : ''}
      ${data.receiptUrl ? `<a href="${data.receiptUrl}" class="button button-secondary" style="margin-left: 10px;">Download Receipt</a>` : ''}
    </div>
    ` : ''}
    
    <div class="text">
      Thank you for your payment. Your account has been updated and you can now enjoy your new features or credits.
    </div>
    
    <div class="text" style="font-size: 14px; color: #6b7280;">
      If you have any questions about this payment, please contact our support team.
    </div>
    
    <div class="unsubscribe">
      <a href="${data.unsubscribeUrl}">Unsubscribe from payment notifications</a>
    </div>
  `;

  const html = getBaseTemplate(content, "Payment Confirmation", `Your payment of ${data.amount} ${data.currency} has been confirmed`);

  const text = `
Payment Confirmed

Hi ${data.firstName},

Your ${paymentTypeLabels[data.paymentType].toLowerCase()} has been successfully processed.

Payment Details:
- Amount: ${data.amount} ${data.currency}
- Type: ${paymentTypeLabels[data.paymentType]}
- Description: ${data.description}

${data.invoiceUrl ? `View invoice: ${data.invoiceUrl}` : ''}
${data.receiptUrl ? `Download receipt: ${data.receiptUrl}` : ''}

Thank you for your payment. Your account has been updated and you can now enjoy your new features or credits.

If you have any questions about this payment, please contact our support team.

Unsubscribe: ${data.unsubscribeUrl}
  `;

  return { html, text };
}

// Weekly digest template
export function getWeeklyDigestEmailTemplate(data: WeeklyDigestEmailData): { html: string; text: string } {
  const content = `
    <div class="greeting">Your Weekly Pitchey Digest 📊</div>
    
    <div class="text">
      Hi ${data.firstName},
    </div>
    
    <div class="text">
      Here's what happened on Pitchey during ${data.weekRange}.
    </div>
    
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-number">${data.stats.newPitches}</span>
        <div class="stat-label">New Pitches</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${data.stats.newFollowers}</span>
        <div class="stat-label">New Followers</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${data.stats.messages}</span>
        <div class="stat-label">Messages</div>
      </div>
      <div class="stat-item">
        <span class="stat-number">${data.stats.views}</span>
        <div class="stat-label">Pitch Views</div>
      </div>
    </div>
    
    ${data.topPitches.length > 0 ? `
    <h3 style="color: #111827; margin: 40px 0 20px 0;">🔥 Top Performing Pitches</h3>
    ${data.topPitches.map(pitch => `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <a href="${pitch.url}" style="font-weight: 600; color: #111827; text-decoration: none; font-size: 16px;">${pitch.title}</a>
            <div style="color: #6b7280; font-size: 14px; margin-top: 5px;">${pitch.views} views this week</div>
          </div>
        </div>
      </div>
    `).join('')}
    ` : ''}
    
    ${data.recommendations.length > 0 ? `
    <h3 style="color: #111827; margin: 40px 0 20px 0;">💡 Recommended for You</h3>
    <div class="recommendations">
      ${data.recommendations.map(rec => `
        <div class="recommendation-item">
          <div class="recommendation-image">
            ${rec.imageUrl ? `<img src="${rec.imageUrl}" alt="${rec.title}" style="width: 100%; height: 100%; object-fit: cover;">` : 'No Image'}
          </div>
          <div class="recommendation-content">
            <div class="recommendation-title">${rec.title}</div>
            <div class="recommendation-creator">by ${rec.creator}</div>
            <a href="${rec.url}" style="color: #6366f1; text-decoration: none; font-size: 12px;">View Pitch →</a>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 40px 0 30px 0;">
      <a href="https://pitchey.com/dashboard" class="button">Go to Dashboard</a>
    </div>
    
    <div class="unsubscribe">
      <a href="${data.unsubscribeUrl}">Unsubscribe from weekly digest</a>
    </div>
  `;

  const html = getBaseTemplate(content, "Your Weekly Pitchey Digest", `${data.stats.newPitches} new pitches, ${data.stats.views} views this week`);

  const text = `
Your Weekly Pitchey Digest

Hi ${data.firstName},

Here's what happened on Pitchey during ${data.weekRange}.

Weekly Stats:
- New Pitches: ${data.stats.newPitches}
- New Followers: ${data.stats.newFollowers}  
- Messages: ${data.stats.messages}
- Pitch Views: ${data.stats.views}

${data.topPitches.length > 0 ? `
Top Performing Pitches:
${data.topPitches.map(pitch => `- ${pitch.title} (${pitch.views} views) - ${pitch.url}`).join('\n')}
` : ''}

${data.recommendations.length > 0 ? `
Recommended for You:
${data.recommendations.map(rec => `- ${rec.title} by ${rec.creator} - ${rec.url}`).join('\n')}
` : ''}

Go to Dashboard: https://pitchey.com/dashboard

Unsubscribe: ${data.unsubscribeUrl}
  `;

  return { html, text };
}

// Pitch view notification template
export function getPitchViewEmailTemplate(data: PitchViewEmailData): { html: string; text: string } {
  const content = `
    <div class="greeting">Your Pitch Was Viewed! 👀</div>
    
    <div class="text">
      Hi ${data.creatorName},
    </div>
    
    <div class="text">
      Great news! <strong>${data.viewerName}</strong> (${data.viewerType}) just viewed your pitch 
      "<strong>${data.pitchTitle}</strong>".
    </div>
    
    <div class="highlight-box">
      <h3 style="margin: 0 0 15px 0; color: #111827;">View Details</h3>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span>Viewer:</span>
        <strong>${data.viewerName}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span>User Type:</span>
        <strong>${data.viewerType}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Viewed:</span>
        <strong>${data.viewTime}</strong>
      </div>
    </div>
    
    <div class="text">
      This could be a great opportunity to connect! Consider reaching out to introduce yourself and learn more about their interests.
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.pitchUrl}" class="button">View Your Pitch</a>
    </div>
    
    <div class="text" style="font-size: 14px; color: #6b7280;">
      You're receiving this notification because you have pitch view alerts enabled. 
      You can adjust these settings in your notification preferences.
    </div>
    
    <div class="unsubscribe">
      <a href="${data.unsubscribeUrl}">Unsubscribe from view notifications</a>
    </div>
  `;

  const html = getBaseTemplate(content, "Your Pitch Was Viewed!", `${data.viewerName} viewed "${data.pitchTitle}"`);

  const text = `
Your Pitch Was Viewed!

Hi ${data.creatorName},

Great news! ${data.viewerName} (${data.viewerType}) just viewed your pitch "${data.pitchTitle}".

View Details:
- Viewer: ${data.viewerName}
- User Type: ${data.viewerType}
- Viewed: ${data.viewTime}

This could be a great opportunity to connect! Consider reaching out to introduce yourself and learn more about their interests.

View your pitch: ${data.pitchUrl}

You're receiving this notification because you have pitch view alerts enabled. You can adjust these settings in your notification preferences.

Unsubscribe: ${data.unsubscribeUrl}
  `;

  return { html, text };
}

export const EmailTemplates = {
  welcome: getWelcomeEmailTemplate,
  ndaRequest: getNDARequestEmailTemplate,
  ndaResponse: getNDAResponseEmailTemplate,
  message: getMessageEmailTemplate,
  passwordReset: getPasswordResetEmailTemplate,
  paymentConfirmation: getPaymentConfirmationEmailTemplate,
  weeklyDigest: getWeeklyDigestEmailTemplate,
  pitchView: getPitchViewEmailTemplate,
};