# UptimeRobot Setup Guide

## Quick Setup (5 minutes)

### 1. Sign Up
- Go to https://uptimerobot.com
- Create a free account
- Verify your email

### 2. Add Monitors

Click "Add New Monitor" for each:

#### Backend API Monitor
```
Monitor Type: HTTP(s)
Friendly Name: Pitchey Backend API
URL: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```

#### Frontend Monitor
```
Monitor Type: HTTP(s)
Friendly Name: Pitchey Frontend
URL: https://pitchey-5o8.pages.dev
Monitoring Interval: 5 minutes
Monitor Timeout: 30 seconds
```

#### Database Health Check
```
Monitor Type: Keyword
Friendly Name: Pitchey DB Health
URL: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health
Keyword to check: healthy
Alert when: Keyword NOT exists
Monitoring Interval: 5 minutes
```

### 3. Configure Alerts

For each monitor, set up:

1. **Email Alerts**
   - Add your email address
   - Set alert threshold: After 2 fails

2. **SMS Alerts** (Optional - 20 free/month)
   - Add phone number
   - Enable for critical monitors only

3. **Webhook Alerts** (Optional)
   - See webhook setup below

### 4. Create Status Page

1. Go to "Status Pages" → "Add Status Page"
2. Configure:
   ```
   Page Name: Pitchey Status
   Custom Domain: status.pitchey.com (optional)
   Monitors: Select all 3 monitors
   Theme: Choose your preference
   ```

3. Copy the public status page URL

### 5. Advanced Settings

#### Response Time Tracking
For each monitor, enable:
- Response Time Charts
- Average Response Time Alerts (>1000ms)

#### Maintenance Windows
Set up recurring maintenance:
- Every Sunday 2-4 AM for updates
- Disable alerts during this window

## Webhook Integration

### Discord Webhook
```bash
# In your Discord server:
# Server Settings → Integrations → Webhooks → New Webhook
# Copy webhook URL

# Add to UptimeRobot:
# Alert Contact → Add → Web-Hook
# URL: Your Discord webhook URL
# POST Value (JSON):
{
  "content": "🚨 **Pitchey Alert**",
  "embeds": [{
    "title": "*monitorFriendlyName* is *alertTypeFriendlyName*",
    "description": "*alertDetails*",
    "color": "*alertType*" == "1" ? 16711680 : 65280,
    "fields": [
      {"name": "Monitor", "value": "*monitorFriendlyName*", "inline": true},
      {"name": "Status", "value": "*alertTypeFriendlyName*", "inline": true},
      {"name": "Duration", "value": "*alertDuration* seconds", "inline": true},
      {"name": "URL", "value": "*monitorURL*"},
      {"name": "Reason", "value": "*alertDetails*"}
    ],
    "timestamp": "*alertDateTime*"
  }]
}
```

### Slack Webhook
```bash
# In Slack:
# Apps → Incoming Webhooks → Add to Slack
# Copy webhook URL

# Add to UptimeRobot:
# Alert Contact → Add → Web-Hook  
# URL: Your Slack webhook URL
# POST Value (JSON):
{
  "text": "🚨 Alert: *monitorFriendlyName* is *alertTypeFriendlyName*",
  "attachments": [{
    "color": "*alertType*" == "1" ? "danger" : "good",
    "fields": [
      {"title": "Monitor", "value": "*monitorFriendlyName*", "short": true},
      {"title": "Status", "value": "*alertTypeFriendlyName*", "short": true},
      {"title": "URL", "value": "*monitorURL*", "short": false},
      {"title": "Details", "value": "*alertDetails*", "short": false},
      {"title": "Duration", "value": "*alertDuration* seconds", "short": true}
    ],
    "ts": "*alertDateTimeUnix*"
  }]
}
```

## API Integration

Get your API key from Account Settings:

```bash
# Check all monitors
curl -X POST https://api.uptimerobot.com/v2/getMonitors \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "format": "json"
  }'

# Get uptime stats
curl -X POST https://api.uptimerobot.com/v2/getMonitors \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "YOUR_API_KEY",
    "format": "json",
    "custom_uptime_ratios": "7-30-365"
  }'
```

## Dashboard Integration

Add to your frontend footer:

```jsx
// components/StatusBadge.jsx
import { useEffect, useState } from 'react';

export function StatusBadge() {
  const [status, setStatus] = useState('checking');
  
  useEffect(() => {
    // Check backend health
    fetch('https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health')
      .then(res => res.ok ? setStatus('operational') : setStatus('degraded'))
      .catch(() => setStatus('down'));
  }, []);
  
  const statusColors = {
    operational: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
    checking: 'bg-gray-500'
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      <a 
        href="YOUR_UPTIMEROBOT_STATUS_PAGE_URL" 
        target="_blank"
        className="text-sm hover:underline"
      >
        System Status
      </a>
    </div>
  );
}
```

## Monitoring Checklist

- [ ] Created UptimeRobot account
- [ ] Added Backend API monitor
- [ ] Added Frontend monitor
- [ ] Added Database Health monitor
- [ ] Configured email alerts
- [ ] Created public status page
- [ ] Set up webhook (optional)
- [ ] Added status badge to site (optional)

## Free Tier Limits

- 50 monitors
- 5-minute intervals
- 20 SMS alerts/month
- Unlimited email alerts
- 2-month log retention
- API access (2000 requests/day)

## Pro Tips

1. **Use keyword monitoring** for health endpoints
2. **Set proper timeouts** (30s for API, 60s for frontend)
3. **Configure multi-location checks** if available
4. **Use maintenance windows** to avoid false alerts
5. **Monitor from multiple regions** for global coverage

## Support

- Documentation: https://uptimerobot.com/docs/
- Blog: https://blog.uptimerobot.com/
- Status: https://status.uptimerobot.com/