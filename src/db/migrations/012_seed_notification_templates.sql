-- Seed notification templates for all notification categories
-- This provides a comprehensive set of pre-built templates

-- Investment Alert Templates
INSERT INTO notification_templates (name, type, category, subject_template, body_template, html_template, variables) VALUES 
(
    'new_investor_interest',
    'email',
    'investment',
    'New Investor Interest in {{pitch_title}}',
    'Great news! {{investor_name}} has shown interest in your pitch "{{pitch_title}}". They would like to review your project materials.',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#2563eb;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f9fafb}.button{display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>New Investor Interest</h1></div><div class="content"><p>Great news! <strong>{{investor_name}}</strong> has shown interest in your pitch "<strong>{{pitch_title}}</strong>".</p><p>They would like to review your project materials and potentially move forward with investment discussions.</p><a href="{{action_url}}" class="button">View Investor Profile</a><p>This is an excellent opportunity to showcase your project. Make sure your pitch materials are up-to-date and compelling.</p></div><div class="footer"><p>Best regards,<br>The Pitchey Team</p></div></div></body></html>',
    '{"pitch_title": "string", "investor_name": "string", "action_url": "string"}'::jsonb
),
(
    'funding_milestone_reached',
    'email',
    'investment',
    'Congratulations! {{pitch_title}} reached {{milestone}}% funding',
    'Exciting news! Your pitch "{{pitch_title}}" has reached {{milestone}}% of its funding goal. Total raised: {{amount_raised}}.',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#059669;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f9fafb}.milestone{font-size:48px;font-weight:bold;color:#059669;text-align:center;margin:20px 0}.button{display:inline-block;padding:12px 24px;background:#059669;color:white;text-decoration:none;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>Funding Milestone Reached!</h1></div><div class="content"><div class="milestone">{{milestone}}%</div><p>Exciting news! Your pitch "<strong>{{pitch_title}}</strong>" has reached <strong>{{milestone}}%</strong> of its funding goal.</p><p><strong>Total raised:</strong> {{amount_raised}}</p><a href="{{action_url}}" class="button">View Campaign Progress</a><p>Keep the momentum going! Share this milestone with your network to attract more investors.</p></div><div class="footer"><p>Best regards,<br>The Pitchey Team</p></div></div></body></html>',
    '{"pitch_title": "string", "milestone": "number", "amount_raised": "string", "action_url": "string"}'::jsonb
),

-- Project Update Templates
(
    'nda_approval_notification',
    'email',
    'project',
    'NDA Approved for {{pitch_title}}',
    'Your NDA for "{{pitch_title}}" has been approved by {{approver_name}}. You can now access the full project details.',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#059669;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f9fafb}.status{font-size:24px;font-weight:bold;color:#059669;text-align:center;margin:20px 0}.button{display:inline-block;padding:12px 24px;background:#059669;color:white;text-decoration:none;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>NDA Approved</h1></div><div class="content"><div class="status">✓ APPROVED</div><p>Great news! Your NDA for "<strong>{{pitch_title}}</strong>" has been approved by <strong>{{approver_name}}</strong>.</p><p>You can now access the full project details, including confidential materials and financial projections.</p><a href="{{action_url}}" class="button">Access Project Details</a><p>Remember to respect the confidentiality terms outlined in the NDA agreement.</p></div><div class="footer"><p>Best regards,<br>The Pitchey Team</p></div></div></body></html>',
    '{"pitch_title": "string", "approver_name": "string", "action_url": "string"}'::jsonb
),
(
    'pitch_status_change',
    'email',
    'project',
    'Status Update: {{pitch_title}} is now {{new_status}}',
    'Your pitch "{{pitch_title}}" status has been updated to {{new_status}}. {{status_message}}',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#2563eb;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f9fafb}.status{font-size:20px;font-weight:bold;color:#2563eb;text-align:center;margin:20px 0;text-transform:uppercase}.button{display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>Status Update</h1></div><div class="content"><p>Your pitch "<strong>{{pitch_title}}</strong>" status has been updated.</p><div class="status">{{new_status}}</div><p>{{status_message}}</p><a href="{{action_url}}" class="button">View Pitch Details</a></div><div class="footer"><p>Best regards,<br>The Pitchey Team</p></div></div></body></html>',
    '{"pitch_title": "string", "new_status": "string", "status_message": "string", "action_url": "string"}'::jsonb
),

-- System Alert Templates
(
    'security_alert',
    'email',
    'system',
    'Security Alert: {{alert_type}} detected',
    'We detected {{alert_type}} on your account. {{alert_message}} Please review your account security.',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#dc2626;color:white;padding:20px;text-align:center}.content{padding:20px;background:#fef2f2;border:1px solid #fecaca}.alert{font-size:18px;font-weight:bold;color:#dc2626;margin:20px 0}.button{display:inline-block;padding:12px 24px;background:#dc2626;color:white;text-decoration:none;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>🚨 Security Alert</h1></div><div class="content"><div class="alert">{{alert_type}} Detected</div><p>{{alert_message}}</p><p>If this was not you, please secure your account immediately by changing your password and enabling two-factor authentication.</p><a href="{{action_url}}" class="button">Review Account Security</a><p>For your security, we recommend:</p><ul><li>Using a strong, unique password</li><li>Enabling two-factor authentication</li><li>Regularly reviewing account activity</li></ul></div><div class="footer"><p>Best regards,<br>The Pitchey Security Team</p></div></div></body></html>',
    '{"alert_type": "string", "alert_message": "string", "action_url": "string"}'::jsonb
),
(
    'maintenance_notification',
    'email',
    'system',
    'Scheduled Maintenance: {{maintenance_date}}',
    'Pitchey will undergo scheduled maintenance on {{maintenance_date}} from {{start_time}} to {{end_time}}. {{maintenance_details}}',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#f59e0b;color:white;padding:20px;text-align:center}.content{padding:20px;background:#fffbeb;border:1px solid #fed7aa}.maintenance-info{background:white;padding:15px;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>🔧 Scheduled Maintenance</h1></div><div class="content"><p>We will be performing scheduled maintenance to improve your Pitchey experience.</p><div class="maintenance-info"><strong>Date:</strong> {{maintenance_date}}<br><strong>Time:</strong> {{start_time}} - {{end_time}}<br><strong>Duration:</strong> {{duration}}</div><p>{{maintenance_details}}</p><p>We apologize for any inconvenience and appreciate your patience as we work to enhance the platform.</p></div><div class="footer"><p>Best regards,<br>The Pitchey Team</p></div></div></body></html>',
    '{"maintenance_date": "string", "start_time": "string", "end_time": "string", "duration": "string", "maintenance_details": "string"}'::jsonb
),

-- Analytics Alert Templates
(
    'performance_milestone',
    'email',
    'analytics',
    'Performance Milestone: {{metric_name}} reached {{threshold}}',
    'Congratulations! Your {{metric_name}} has reached {{threshold}}. {{milestone_details}}',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#7c3aed;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f9fafb}.metric{font-size:36px;font-weight:bold;color:#7c3aed;text-align:center;margin:20px 0}.button{display:inline-block;padding:12px 24px;background:#7c3aed;color:white;text-decoration:none;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>🎉 Performance Milestone</h1></div><div class="content"><p>Congratulations! You\'ve reached an important milestone.</p><div class="metric">{{threshold}}</div><p><strong>{{metric_name}}</strong> has reached <strong>{{threshold}}</strong>!</p><p>{{milestone_details}}</p><a href="{{action_url}}" class="button">View Analytics Dashboard</a></div><div class="footer"><p>Best regards,<br>The Pitchey Team</p></div></div></body></html>',
    '{"metric_name": "string", "threshold": "string", "milestone_details": "string", "action_url": "string"}'::jsonb
),

-- Market Intelligence Templates
(
    'market_opportunity',
    'email',
    'market',
    'Market Opportunity: {{opportunity_title}}',
    'New market opportunity identified: {{opportunity_title}}. {{opportunity_description}}',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#0891b2;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f0f9ff;border:1px solid #bae6fd}.opportunity{background:white;padding:15px;border-radius:6px;margin:20px 0;border-left:4px solid #0891b2}.button{display:inline-block;padding:12px 24px;background:#0891b2;color:white;text-decoration:none;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>💡 Market Opportunity</h1></div><div class="content"><p>We\'ve identified a new market opportunity that aligns with your interests:</p><div class="opportunity"><h3>{{opportunity_title}}</h3><p>{{opportunity_description}}</p></div><a href="{{action_url}}" class="button">Explore Opportunity</a><p>Stay ahead of the market with timely intelligence and opportunities.</p></div><div class="footer"><p>Best regards,<br>The Pitchey Intelligence Team</p></div></div></body></html>',
    '{"opportunity_title": "string", "opportunity_description": "string", "action_url": "string"}'::jsonb
),

-- Push notification templates (shorter content)
(
    'new_investor_interest_push',
    'push',
    'investment',
    'New investor interest in {{pitch_title}}',
    '{{investor_name}} is interested in your pitch. Tap to view.',
    NULL,
    '{"pitch_title": "string", "investor_name": "string"}'::jsonb
),
(
    'nda_approval_push',
    'push',
    'project',
    'NDA Approved',
    'Your NDA for {{pitch_title}} has been approved. Tap to access.',
    NULL,
    '{"pitch_title": "string"}'::jsonb
),
(
    'funding_milestone_push',
    'push',
    'investment',
    'Funding milestone reached!',
    '{{pitch_title}} reached {{milestone}}% funding. Tap to celebrate!',
    NULL,
    '{"pitch_title": "string", "milestone": "number"}'::jsonb
),

-- In-app notification templates
(
    'welcome_notification',
    'in_app',
    'system',
    'Welcome to Pitchey!',
    'Welcome to Pitchey! Complete your profile to get started with pitch creation and investment opportunities.',
    NULL,
    '{"user_name": "string", "action_url": "string"}'::jsonb
),
(
    'profile_incomplete',
    'in_app',
    'system',
    'Complete your profile',
    'Your profile is {{completion_percentage}}% complete. Add more details to attract investors and opportunities.',
    NULL,
    '{"completion_percentage": "number", "action_url": "string"}'::jsonb
),

-- Digest templates
(
    'daily_digest',
    'email',
    'system',
    'Your Daily Pitchey Digest - {{date}}',
    'Here\'s what happened in your Pitchey account today: {{summary}}',
    '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#374151;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f9fafb}.digest-item{background:white;padding:15px;margin:10px 0;border-radius:6px;border-left:4px solid #2563eb}.button{display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;margin:20px 0}.footer{padding:20px;text-align:center;color:#666;font-size:12px}</style></head><body><div class="container"><div class="header"><h1>Your Daily Digest</h1><p>{{date}}</p></div><div class="content">{{digest_content}}<a href="{{action_url}}" class="button">View Dashboard</a></div><div class="footer"><p>Best regards,<br>The Pitchey Team</p><p><a href="{{unsubscribe_url}}">Unsubscribe from digests</a></p></div></div></body></html>',
    '{"date": "string", "digest_content": "string", "action_url": "string", "unsubscribe_url": "string"}'::jsonb
);