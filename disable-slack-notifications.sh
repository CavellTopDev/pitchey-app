#!/bin/bash

# Script to disable Slack notifications in GitHub Actions workflows
# This removes action-slack usage to prevent workflow failures

echo "🔄 Disabling Slack notifications in GitHub Actions workflows..."

# Find and comment out Slack notification steps in active workflows
for file in .github/workflows/*.yml; do
    # Skip disabled/backup files
    if [[ "$file" == *".disabled" ]] || [[ "$file" == *".backup" ]]; then
        continue
    fi
    
    if grep -q "action-slack" "$file"; then
        echo "📝 Updating $file"
        
        # Comment out Slack notification steps
        sed -i '
        /- name:.*[Ss]lack\|[Nn]otification/,/^[[:space:]]*$/ {
            /^[[:space:]]*-[[:space:]]*name:/s/^/      # /
            /^[[:space:]]*uses:.*action-slack/s/^/        # /
            /^[[:space:]]*with:/s/^/        # /
            /^[[:space:]]*status:/s/^/          # /
            /^[[:space:]]*text:/s/^/          # /
            /^[[:space:]]*webhook_url:/s/^/          # /
            /^[[:space:]]*if:/s/^/        # /
        }' "$file"
    fi
done

echo "✅ Slack notifications disabled in all active workflows"
echo "💡 Your workflows will now skip Slack steps and won't fail due to missing SLACK_WEBHOOK secret"
echo ""
echo "To re-enable later:"
echo "1. Set up Slack webhook following setup-slack-webhook.md"
echo "2. Uncomment the Slack notification sections in workflow files"