#!/bin/bash

# Podman Local Development Helper Script
# Quick commands for Podman Desktop users

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

case "$1" in
    start)
        echo -e "${GREEN}Starting local development stack with Podman...${NC}"
        podman-compose -f podman-compose.yml up -d
        echo -e "${GREEN}✅ Services started!${NC}"
        echo "PostgreSQL: localhost:5432"
        echo "Redis: localhost:6379"
        echo "MinIO: http://localhost:9000"
        echo "Adminer: http://localhost:8080"
        ;;
    
    stop)
        echo -e "${YELLOW}Stopping services...${NC}"
        podman-compose -f podman-compose.yml down
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;
    
    reset)
        echo -e "${RED}Resetting all data...${NC}"
        podman-compose -f podman-compose.yml down -v
        echo -e "${GREEN}✅ Data cleared${NC}"
        ;;
    
    status)
        echo -e "${GREEN}Service Status:${NC}"
        podman-compose -f podman-compose.yml ps
        ;;
    
    logs)
        service=${2:-all}
        if [ "$service" = "all" ]; then
            podman-compose -f podman-compose.yml logs -f
        else
            podman-compose -f podman-compose.yml logs -f $service
        fi
        ;;
    
    seed)
        echo -e "${GREEN}Seeding database with demo data...${NC}"
        # Wait for PostgreSQL to be ready
        until PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local -c '\q' 2>/dev/null; do
            echo "Waiting for PostgreSQL..."
            sleep 2
        done
        
        # Run migrations
        PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local < src/db/migrations/add-performance-indexes.sql 2>/dev/null || true
        
        # Seed demo users
        PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local << 'EOF'
-- Create demo users
INSERT INTO users (email, username, user_type, company_name, bio, is_active, email_verified) VALUES
('alex.creator@demo.com', 'alexcreator', 'creator', 'Creative Studios', 'Filmmaker', true, true),
('sarah.investor@demo.com', 'sarahinvestor', 'investor', 'Venture Capital', 'Investor', true, true),
('stellar.production@demo.com', 'stellarprod', 'production', 'Stellar Productions', 'Producer', true, true)
ON CONFLICT (email) DO NOTHING;
EOF
        echo -e "${GREEN}✅ Database seeded${NC}"
        ;;
    
    shell)
        service=${2:-postgres}
        echo -e "${GREEN}Entering $service shell...${NC}"
        case "$service" in
            postgres|pg)
                PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local
                ;;
            redis)
                podman exec -it $(podman ps -q -f name=redis) redis-cli
                ;;
            minio)
                echo "MinIO Console: http://localhost:9001"
                echo "Username: minioadmin"
                echo "Password: minioadmin"
                ;;
            *)
                podman exec -it $(podman ps -q -f name=$service) sh
                ;;
        esac
        ;;
    
    *)
        echo "Pitchey Local Development with Podman"
        echo ""
        echo "Usage: ./podman-local.sh [command]"
        echo ""
        echo "Commands:"
        echo "  start    - Start all services"
        echo "  stop     - Stop all services"
        echo "  reset    - Stop and remove all data"
        echo "  status   - Show service status"
        echo "  logs     - View logs (optional: service name)"
        echo "  seed     - Seed database with demo data"
        echo "  shell    - Enter service shell (postgres|redis|minio)"
        echo ""
        echo "Examples:"
        echo "  ./podman-local.sh start"
        echo "  ./podman-local.sh logs postgres"
        echo "  ./podman-local.sh shell redis"
        ;;
esac