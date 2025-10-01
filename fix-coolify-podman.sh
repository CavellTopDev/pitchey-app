#!/bin/bash

# Fix for Coolify installation on systems using Podman with Docker emulation
echo "================================================"
echo "🔧 FIXING COOLIFY FOR PODMAN SYSTEMS"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Detected: Podman with Docker emulation${NC}"
echo "Your system uses Podman instead of Docker daemon."
echo ""

# Check if podman socket is running
echo -e "${BLUE}Checking Podman socket status...${NC}"
systemctl --user status podman.socket 2>/dev/null || echo "Podman socket not running in user mode"

echo ""
echo -e "${YELLOW}Option 1: Enable Podman Docker compatibility${NC}"
echo "Run these commands:"
echo -e "${BLUE}"
cat << 'COMMANDS'
# Enable podman socket for Docker compatibility
systemctl --user enable podman.socket
systemctl --user start podman.socket

# Set Docker host to use Podman socket
export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock

# Make it permanent
echo 'export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock' >> ~/.bashrc
COMMANDS
echo -e "${NC}"

echo ""
echo -e "${YELLOW}Option 2: Use Podman Compose directly (Recommended)${NC}"
echo "Since you have Podman, we can deploy without Coolify:"
echo ""
echo -e "${BLUE}Step 1: Install podman-compose${NC}"
echo "sudo pacman -S podman-compose"
echo ""
echo -e "${BLUE}Step 2: Deploy with Podman${NC}"
echo "podman-compose -f docker-compose.coolify.yml up -d"
echo ""

echo -e "${YELLOW}Option 3: Alternative - Deploy to free cloud services${NC}"
echo "Since Coolify requires Docker daemon, consider these alternatives:"
echo ""
echo "1. ${GREEN}Deno Deploy + Vercel (Recommended)${NC}"
echo "   - Completely free"
echo "   - No server management"
echo "   - Run: ./deploy-mvp-free.sh"
echo ""
echo "2. ${GREEN}Deploy to a VPS with Docker${NC}"
echo "   - Get a $5/month VPS (DigitalOcean, Linode, etc.)"
echo "   - Docker pre-installed on Ubuntu"
echo "   - Then use Coolify normally"
echo ""

echo "================================================"
echo -e "${GREEN}✅ RECOMMENDATION${NC}"
echo "================================================"
echo ""
echo "For local deployment with Podman:"
echo -e "${BLUE}podman-compose -f docker-compose.coolify.yml up -d${NC}"
echo ""
echo "For production deployment:"
echo -e "${BLUE}./deploy-mvp-free.sh${NC} (Uses Deno Deploy + Vercel - completely free!)"
echo ""