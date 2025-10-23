#!/bin/bash

API_URL="http://localhost:8001"

echo "🧪 Testing Enhanced Browse Filtering API"
echo "========================================"

echo -e "\n1️⃣ Testing basic browse (no filters):"
curl -s "$API_URL/api/pitches/browse/enhanced?limit=5" | jq '.pagination, .filters'

echo -e "\n2️⃣ Testing genre filter (multiple genres):"
curl -s "$API_URL/api/pitches/browse/enhanced?genre=Action&genre=Drama&limit=5" | jq '.filters.genres, .pagination.total'

echo -e "\n3️⃣ Testing format filter (multiple formats):"
curl -s "$API_URL/api/pitches/browse/enhanced?format=Feature+Film&format=TV+Series&limit=5" | jq '.filters.formats, .pagination.total'

echo -e "\n4️⃣ Testing budget range filter:"
curl -s "$API_URL/api/pitches/browse/enhanced?budgetMin=1000000&budgetMax=10000000&limit=5" | jq '.filters.budgetMin, .filters.budgetMax, .pagination.total'

echo -e "\n5️⃣ Testing search query:"
curl -s "$API_URL/api/pitches/browse/enhanced?q=thriller&limit=5" | jq '.filters.searchQuery, .pagination.total'

echo -e "\n6️⃣ Testing sorting (by views, descending):"
curl -s "$API_URL/api/pitches/browse/enhanced?sort=views&order=desc&limit=3" | jq '.pitches[] | {title: .title, views: .viewCount}'

echo -e "\n7️⃣ Testing sorting (by budget, ascending):"
curl -s "$API_URL/api/pitches/browse/enhanced?sort=budget&order=asc&limit=3" | jq '.pitches[] | {title: .title, budget: .estimatedBudget}'

echo -e "\n8️⃣ Testing combined filters (genre + format + search):"
curl -s "$API_URL/api/pitches/browse/enhanced?genre=Action&format=Feature+Film&q=hero&limit=5" | jq '.filters, .pagination.total'

echo -e "\n9️⃣ Testing pagination (page 2):"
curl -s "$API_URL/api/pitches/browse/enhanced?limit=5&offset=5" | jq '.pagination'

echo -e "\n🔟 Testing development stage filter:"
curl -s "$API_URL/api/pitches/browse/enhanced?stage=Pre-Production&stage=Production&limit=5" | jq '.filters.stages, .pagination.total'

echo -e "\n✅ Enhanced filtering tests complete!"