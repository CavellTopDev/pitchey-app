# Disconnect Deno Deploy from GitHub

## Why This is Needed
Deno Deploy is still trying to deploy your repository even though we've removed all Deno files. This causes failed deployment notifications.

## Steps to Disconnect

### Option 1: Via Deno Dashboard (Recommended)
1. Go to: https://dash.deno.com
2. Sign in with your GitHub account
3. Find the project: **pitchey-backend-fresh**
4. Click on the project
5. Go to **Settings** tab
6. Scroll to **Git Integration** section
7. Click **Disconnect from GitHub**
8. Confirm the disconnection

### Option 2: Via GitHub App Settings
1. Go to: https://github.com/settings/installations
2. Find **Deno Deploy** in the list
3. Click **Configure**
4. Under **Repository access**, find **pitchey-app**
5. Click the **X** to remove access
6. Click **Save**

### Option 3: Revoke All Deno Access (Nuclear Option)
1. Go to: https://github.com/settings/installations
2. Find **Deno Deploy**
3. Click **Uninstall** or **Revoke**
4. This will disconnect ALL repositories from Deno

## Verification
After disconnecting, check that:
- No more Deno Deploy status checks appear on commits
- No failed deployment notifications from Deno
- GitHub commits only show Cloudflare deployment status

## Alternative: Keep for Monitoring
If you want to keep the integration but stop deployments:
1. Create a file: `.denodeploy.json`
2. Add: `{"exclude": true}`
3. This tells Deno to skip this repository