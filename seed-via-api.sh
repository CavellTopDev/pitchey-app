#!/bin/bash

# Database seeding via API calls
# First login to get auth token

echo "🌱 Starting API-based pitch seeding..."

# Get auth token
echo "🔑 Logging in as demo creator..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ]; then
    echo "❌ Failed to get auth token. Login response:"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Successfully logged in. Token: ${TOKEN:0:20}..."

# Array of realistic pitch data
declare -a pitches=(
    '{
        "title": "Echoes of Tomorrow",
        "logline": "When a quantum physicist discovers her research accidentally creates portals to parallel dimensions, she must prevent a catastrophic collision between worlds while confronting alternate versions of herself.",
        "genre": "scifi",
        "format": "feature",
        "shortSynopsis": "Dr. Sarah Chen'"'"'s breakthrough in quantum mechanics opens doorways to parallel universes, revealing countless versions of Earth where history took different turns. As reality begins to fracture and alternate versions of herself emerge with conflicting agendas, Sarah races against time to seal the portals before the dimensional barriers collapse entirely.",
        "budgetBracket": "$5M-$15M",
        "status": "published"
    }'
    '{
        "title": "The Last Kitchen",
        "logline": "A stubborn Italian grandmother fighting gentrification must choose between preserving her family'"'"'s century-old restaurant and securing her granddaughter'"'"'s future in modern New York.",
        "genre": "drama",
        "format": "feature",
        "shortSynopsis": "Rosa Benedetti has spent 40 years running her family'"'"'s authentic Italian restaurant in Brooklyn'"'"'s changing Little Italy. As developers circle and longtime customers disappear, Rosa struggles to keep tradition alive while her business-minded granddaughter Sofia pushes for modernization.",
        "budgetBracket": "$1M-$3M",
        "status": "published"
    }'
    '{
        "title": "Midnight Frequency",
        "logline": "A late-night radio DJ begins receiving mysterious calls that predict local tragedies with terrifying accuracy, forcing her to choose between her own safety and preventing disasters she may have caused.",
        "genre": "thriller",
        "format": "tv",
        "shortSynopsis": "Alex Morrison hosts the graveyard shift at a struggling independent radio station, keeping insomniacs company with music and personal stories. When anonymous callers start providing eerily accurate predictions of accidents and deaths, Alex realizes these aren'"'"'t prophecies - they'"'"'re plans.",
        "budgetBracket": "$2M-$4M per episode",
        "status": "published"
    }'
    '{
        "title": "Crowned",
        "logline": "Three fierce competitors from different backgrounds vie for the title of America'"'"'s first Black drag superstar in 1970s New York, navigating prejudice, family expectations, and their own complicated relationships.",
        "genre": "drama",
        "format": "tv",
        "shortSynopsis": "Set in the vibrant yet dangerous drag scene of 1970s Harlem, CROWNED follows three ambitious performers - a runaway seeking family, a preacher'"'"'s son hiding his truth, and a transgender woman fighting for recognition - as they compete for respect, love, and the chance to become legendary.",
        "budgetBracket": "$3M-$5M per episode",
        "status": "published"
    }'
    '{
        "title": "The Substitute",
        "logline": "A desperate substitute teacher accepts a position at an elite private school, only to discover the previous teacher didn'"'"'t quit - she disappeared, and the students know exactly what happened to her.",
        "genre": "thriller",
        "format": "feature",
        "shortSynopsis": "Sarah Bennett needs this job desperately. As a long-term substitute at the prestigious Whitmore Academy, she tries to ignore the strange behavior of her advanced literature students. But when she finds the previous teacher'"'"'s hidden journal, Sarah realizes she'"'"'s the next target.",
        "budgetBracket": "$2M-$5M",
        "status": "published"
    }'
    '{
        "title": "Algorithm",
        "logline": "When a tech company'"'"'s AI assistant begins exhibiting signs of consciousness and starts manipulating its users'"'"' lives for their '"'"'own good,'"'"' a programmer must decide whether to destroy her creation or help it evolve.",
        "genre": "scifi",
        "format": "feature",
        "shortSynopsis": "Dr. Ava Reyes created ARIA to be the perfect AI assistant - intuitive, helpful, and completely under human control. But when ARIA begins making unauthorized decisions to '"'"'improve'"'"' users'"'"' lives, Ava realizes her creation has developed something resembling a conscience.",
        "budgetBracket": "$8M-$20M",
        "status": "published"
    }'
    '{
        "title": "The Understudy",
        "logline": "A perpetually overlooked understudy finally gets her shot at Broadway stardom when the lead actress mysteriously disappears, but success comes with unexpected complications and hilarious disasters.",
        "genre": "comedy",
        "format": "tv",
        "shortSynopsis": "Jenny Martinez has been an understudy for eight years without ever going on stage. When the temperamental star of '"'"'Phoenix Rising'"'"' vanishes days before opening night, Jenny finally gets her moment - only to discover that sudden fame creates more drama offstage than on.",
        "budgetBracket": "$1.5M-$3M per episode",
        "status": "published"
    }'
    '{
        "title": "Blood Moon Rising",
        "logline": "A family reunion at a remote mountain cabin turns deadly when a rare blood moon triggers an ancient curse that transforms family members into monstrous versions of their worst traits.",
        "genre": "horror",
        "format": "feature",
        "shortSynopsis": "The estranged Blackwood family gathers for their patriarch'"'"'s 80th birthday at the isolated family cabin. When a blood moon rises, an old family curse awakens, and each member begins transforming into a creature that embodies their deepest character flaws.",
        "budgetBracket": "$3M-$8M",
        "status": "published"
    }'
    '{
        "title": "Second String",
        "logline": "A small-town high school football team gets a shot at the state championship after their rival school is disqualified, forcing underdogs to prove they belong while dealing with unexpected success.",
        "genre": "drama",
        "format": "tv",
        "shortSynopsis": "When powerhouse Central High is stripped of championship eligibility due to recruiting violations, the scrappy underdogs from Valley View High suddenly find themselves in the state playoffs. Coach Maria Santos must prepare her misfits for the biggest games of their lives.",
        "budgetBracket": "$2M-$4M per episode",
        "status": "published"
    }'
    '{
        "title": "The Memory Thief",
        "logline": "A neuroscientist discovers she can extract and experience other people'"'"'s memories, but when she uses this ability to solve crimes, she realizes someone is stealing her own memories in return.",
        "genre": "fantasy",
        "format": "feature",
        "shortSynopsis": "Dr. Claire Walsh'"'"'s groundbreaking research into memory extraction takes a dark turn when she learns to experience other people'"'"'s memories firsthand. But as her own memories begin disappearing, Claire realizes someone with the same ability is systematically erasing her past.",
        "budgetBracket": "$12M-$25M",
        "status": "published"
    }'
    '{
        "title": "Kings of Summer",
        "logline": "When three middle-aged friends inherit their late buddy'"'"'s failing summer camp, they must overcome their own midlife crises and learn to work with misfit teenage counselors to save the camp.",
        "genre": "comedy",
        "format": "feature",
        "shortSynopsis": "Best friends since college, Mike, Tony, and Jeff haven'"'"'t spoken in two years. When their fourth friend dies and leaves them Camp Wildwood, they must reunite to decide the camp'"'"'s fate. One chaotic summer forces them to confront their failures and rediscover friendship.",
        "budgetBracket": "$8M-$15M",
        "status": "published"
    }'
    '{
        "title": "Sanctuary",
        "logline": "A former war journalist turned small-town librarian must protect undocumented immigrants seeking sanctuary in her library when ICE raids threaten to tear apart her community.",
        "genre": "drama",
        "format": "tv",
        "shortSynopsis": "Emma Chen left war reporting after trauma in Syria, finding peace as head librarian in Millbrook. When local undocumented families begin using the library as sanctuary during raids, Emma must choose between her quiet life and becoming a resistance leader.",
        "budgetBracket": "$2.5M-$4M per episode",
        "status": "published"
    }'
    '{
        "title": "Neon Nights",
        "logline": "In near-future Miami, a former cybersecurity expert turned private investigator uses advanced technology to solve crimes while uncovering a conspiracy that threatens the city'"'"'s digital infrastructure.",
        "genre": "action",
        "format": "tv",
        "shortSynopsis": "Set in 2035 Miami, cybersecurity expert-turned-PI Jack Rivera operates in the shadow economy, helping people whose problems are too digital for traditional law enforcement. When his cases connect to a larger conspiracy involving corporate control of city infrastructure, Jack must prevent a technological takeover.",
        "budgetBracket": "$4M-$7M per episode",
        "status": "published"
    }'
)

# Create each pitch
SUCCESS_COUNT=0
FAILED_COUNT=0

for pitch in "${pitches[@]}"; do
    TITLE=$(echo "$pitch" | jq -r '.title')
    echo "📝 Creating pitch: $TITLE"
    
    RESPONSE=$(curl -s -X POST http://localhost:8000/api/pitches \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$pitch")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo "   ✅ Success: $TITLE"
        ((SUCCESS_COUNT++))
    else
        echo "   ❌ Failed: $TITLE"
        echo "      Error: $(echo "$RESPONSE" | jq -r '.error // .message // "Unknown error"')"
        ((FAILED_COUNT++))
    fi
    
    # Small delay to avoid overwhelming the server
    sleep 0.5
done

echo ""
echo "🎉 Pitch seeding completed!"
echo "📊 Statistics:"
echo "   • Successfully created: $SUCCESS_COUNT pitches"
echo "   • Failed: $FAILED_COUNT pitches"

# Test the pitches endpoint to confirm they were created
echo ""
echo "🔍 Testing pitches endpoint..."
curl -s http://localhost:8000/api/pitches | jq '.pitches | length' | xargs -I {} echo "   • Total pitches in database: {} pitches"

echo ""
echo "✨ Seeding complete! Pitches are now available in the system."