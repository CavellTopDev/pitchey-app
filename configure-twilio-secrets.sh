#!/bin/bash

# Configure Twilio Secrets for Cloudflare Workers
# User's provided credentials (from conversation)

echo "🔐 Configuring Twilio Secrets for Cloudflare Workers"
echo "================================================"

# Set the Twilio API Key and Secret provided by the user
echo "Setting TWILIO_API_KEY_SID..."
npx wrangler secret put TWILIO_API_KEY_SID
# When prompted, enter the API Key SID provided by the user

echo "Setting TWILIO_API_KEY_SECRET..."
npx wrangler secret put TWILIO_API_KEY_SECRET
# When prompted, enter the API Key Secret provided by the user

# These need to be obtained from user's Twilio account
echo ""
echo "⚠️  You also need to set these from your Twilio account:"
echo ""
echo "1. TWILIO_ACCOUNT_SID (from Twilio Console)"
echo "   npx wrangler secret put TWILIO_ACCOUNT_SID"
echo ""
echo "2. TWILIO_AUTH_TOKEN (from Twilio Console)"
echo "   npx wrangler secret put TWILIO_AUTH_TOKEN"
echo ""
echo "3. TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID"
echo "   npx wrangler secret put TWILIO_FROM_NUMBER"
echo "   # Format: +1234567890"
echo ""
echo "📱 Get these values from: https://console.twilio.com"
echo ""
echo "After setting all secrets, deploy with:"
echo "npx wrangler deploy"