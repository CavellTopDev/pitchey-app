#!/bin/bash
# Continuous cache warming script

WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Endpoints to warm every 5 minutes
ENDPOINTS=(
  "/api/health"
  "/api/pitches/browse/enhanced"
  "/api/pitches/featured"
  "/api/pitches/trending"
  "/api/auth/status"
)

# Warm all endpoints
for endpoint in "${ENDPOINTS[@]}"; do
  curl -s -o /dev/null "$WORKER_URL$endpoint" &
done

wait

# Log cache warming
echo "$(date): Cache warmed for ${#ENDPOINTS[@]} endpoints"
