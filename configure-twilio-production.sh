#!/bin/bash

# Configure Twilio Secrets for Production
# This script sets up Twilio SMS integration for the notification system

echo "=== Configuring Twilio SMS for Production ==="
echo "This script will configure Twilio secrets for the Cloudflare Worker"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Twilio Configuration (REDACTED for security)
# These values should be obtained from your Twilio Console
# https://console.twilio.com

echo -e "${YELLOW}Setting up Twilio configuration...${NC}"
echo ""

# Note: Replace these with your actual Twilio credentials
TWILIO_ACCOUNT_SID="YOUR_TWILIO_ACCOUNT_SID"
TWILIO_AUTH_TOKEN="YOUR_TWILIO_AUTH_TOKEN"
TWILIO_FROM_NUMBER="+1234567890"  # Your Twilio phone number

# For the demo, we'll use test credentials if available
if [ -f "TWILIO_CREDENTIALS_SECURE.txt" ]; then
    echo -e "${GREEN}✓ Found local Twilio credentials file${NC}"
    source TWILIO_CREDENTIALS_SECURE.txt
fi

# Function to set a secret
set_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    local DISPLAY_VALUE=$3
    
    echo -e "${BLUE}Setting ${SECRET_NAME}...${NC}"
    echo "$SECRET_VALUE" | wrangler secret put "$SECRET_NAME" --name pitchey-optimized
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${SECRET_NAME} configured: ${DISPLAY_VALUE}${NC}"
    else
        echo -e "${RED}✗ Failed to set ${SECRET_NAME}${NC}"
        return 1
    fi
    echo ""
}

# Configure Twilio secrets
echo -e "${YELLOW}1. Configuring Twilio Account SID...${NC}"
set_secret "TWILIO_ACCOUNT_SID" "$TWILIO_ACCOUNT_SID" "${TWILIO_ACCOUNT_SID:0:10}..."

echo -e "${YELLOW}2. Configuring Twilio Auth Token...${NC}"
set_secret "TWILIO_AUTH_TOKEN" "$TWILIO_AUTH_TOKEN" "***hidden***"

echo -e "${YELLOW}3. Configuring Twilio Phone Number...${NC}"
set_secret "TWILIO_FROM_NUMBER" "$TWILIO_FROM_NUMBER" "$TWILIO_FROM_NUMBER"

# Optional: Configure SendGrid for email notifications
echo -e "${YELLOW}4. Configure SendGrid Email? (y/n)${NC}"
read -r CONFIGURE_SENDGRID

if [[ "$CONFIGURE_SENDGRID" == "y" ]]; then
    echo -e "${BLUE}Enter SendGrid API Key:${NC}"
    read -rs SENDGRID_API_KEY
    echo ""
    
    echo -e "${BLUE}Enter SendGrid From Email:${NC}"
    read -r SENDGRID_FROM_EMAIL
    
    set_secret "SENDGRID_API_KEY" "$SENDGRID_API_KEY" "SG.***"
    set_secret "SENDGRID_FROM_EMAIL" "$SENDGRID_FROM_EMAIL" "$SENDGRID_FROM_EMAIL"
fi

# List all configured secrets
echo ""
echo -e "${YELLOW}=== Configured Secrets ===${NC}"
wrangler secret list --name pitchey-optimized

echo ""
echo -e "${GREEN}=== Configuration Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Test SMS delivery: ./test-twilio-sms.sh"
echo "2. Test email delivery: ./test-sendgrid-email.sh"
echo "3. Monitor notifications: wrangler tail"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "- Keep your credentials secure"
echo "- Never commit credentials to git"
echo "- Use environment-specific secrets for staging/production"
echo ""