# Slack Webhook Setup Guide

Follow these steps to set up Slack notifications for your GitHub Actions:

## 1. Create Slack App
1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. App Name: "Pitchey CI/CD Notifications"
5. Workspace: Select your workspace (or create one with ndlovucavelle@gmail.com)

## 2. Enable Incoming Webhooks
1. In your app settings, click "Incoming Webhooks" in the sidebar
2. Toggle "Activate Incoming Webhooks" to ON
3. Click "Add New Webhook to Workspace"
4. Choose a channel (create #pitchey-notifications if needed)
5. Click "Allow"

## 3. Copy Webhook URL
You'll get a URL that starts with:
```
https://hooks.slack.com/services/[workspace-id]/[channel-id]/[secret-token]
```

## 4. Add to GitHub Secrets
Once you have the webhook URL, run this command:

```bash
gh secret set SLACK_WEBHOOK --body "YOUR_WEBHOOK_URL_HERE"
```

## 5. Test the Setup
After setting the secret, push a commit to trigger workflows and test notifications.

## Alternative: Disable Slack Notifications
If you prefer not to use Slack, run this script to remove Slack from workflows:
```bash
./disable-slack-notifications.sh
```