import { drizzle } from 'npm:drizzle-orm/postgres-js';
import postgres from 'npm:postgres';
import { pitches } from './src/db/schema.ts';

const sql = postgres(Deno.env.get('DATABASE_URL') || 'postgresql://postgres:password@localhost:5432/pitchey');
const db = drizzle(sql);

console.log('🎬 Creating production company pitches...');

try {
  const productionPitches = [
    {
      userId: 1003, // stellar production
      title: "The Crown Legacy",
      logline: "A prestigious production about power, family, and legacy in modern aristocracy",
      genre: "drama",
      format: "tv",
      shortSynopsis: "Following three generations of a powerful family as they navigate scandal, tradition, and the changing world around them.",
      budgetBracket: "high",
      estimatedBudget: "15000000",
      status: "published",
      viewCount: 450,
      likeCount: 89,
      requireNDA: false,
      aiUsed: false,
      themes: ["power", "family", "tradition", "scandal"],
      characters: [
        { name: "Victoria Sterling", description: "Matriarch of the Sterling dynasty" },
        { name: "James Sterling", description: "Ambitious heir to the empire" },
        { name: "Eleanor Cross", description: "Investigative journalist uncovering family secrets" }
      ],
      visibilitySettings: {
        showBudget: true,
        showLocation: true,
        showCharacters: true,
        showShortSynopsis: true
      },
      targetAudience: "Adults 25-54, fans of prestige drama",
      productionTimeline: "Q3 2025 - Q2 2026"
    },
    {
      userId: 1003,
      title: "Neon Nights",
      logline: "A high-octane action thriller set in the underground racing scene of Tokyo",
      genre: "action",
      format: "feature",
      shortSynopsis: "An undercover cop infiltrates the most dangerous racing syndicate in Asia, but loses himself in the neon-lit underworld.",
      budgetBracket: "high",
      estimatedBudget: "75000000",
      status: "published",
      viewCount: 892,
      likeCount: 234,
      requireNDA: true,
      aiUsed: false,
      themes: ["identity", "loyalty", "adrenaline", "redemption"],
      characters: [
        { name: "Kai Nakamura", description: "Undercover detective torn between duty and brotherhood" },
        { name: "Ryu Tanaka", description: "Legendary street racer and syndicate leader" },
        { name: "Yuki Chen", description: "Brilliant mechanic with a mysterious past" }
      ],
      visibilitySettings: {
        showBudget: false,
        showLocation: true,
        showCharacters: true,
        showShortSynopsis: true
      },
      targetAudience: "18-35 year olds, action movie enthusiasts",
      productionTimeline: "Pre-production Q1 2025, Principal Photography Q2-Q3 2025"
    },
    {
      userId: 1003,
      title: "Echoes of Tomorrow",
      logline: "A mind-bending sci-fi series where memories can be traded like currency",
      genre: "sci-fi",
      format: "tv",
      shortSynopsis: "In 2075, memories are the ultimate commodity. When a memory broker discovers a conspiracy that could erase human history, she must choose between profit and humanity's future.",
      budgetBracket: "high",
      estimatedBudget: "20000000",
      status: "published",
      viewCount: 567,
      likeCount: 145,
      requireNDA: false,
      aiUsed: false,
      themes: ["memory", "identity", "capitalism", "humanity"],
      characters: [
        { name: "Dr. Maya Chen", description: "Memory broker with a hidden agenda" },
        { name: "Atlas Corporation", description: "The monopoly controlling memory trade" },
        { name: "The Forgotten", description: "Rebels fighting to preserve authentic memories" }
      ],
      visibilitySettings: {
        showBudget: true,
        showLocation: false,
        showCharacters: true,
        showShortSynopsis: true
      },
      targetAudience: "Sci-fi enthusiasts, Black Mirror fans",
      productionTimeline: "Development through 2025"
    },
    {
      userId: 1003,
      title: "The Last Symphony",
      logline: "A biographical masterpiece about the world's greatest unheard composer",
      genre: "drama",
      format: "feature",
      shortSynopsis: "The untold story of Amelia Hartford, a deaf composer who revolutionized classical music through vibrations and visual representations of sound.",
      budgetBracket: "medium",
      estimatedBudget: "35000000",
      status: "published",
      viewCount: 423,
      likeCount: 198,
      requireNDA: false,
      aiUsed: false,
      themes: ["perseverance", "art", "disability", "innovation"],
      characters: [
        { name: "Amelia Hartford", description: "Deaf composer breaking all barriers" },
        { name: "Thomas Whitmore", description: "Traditional conductor who becomes her champion" },
        { name: "Sarah Hartford", description: "Supportive sister and interpreter" }
      ],
      visibilitySettings: {
        showBudget: true,
        showLocation: true,
        showCharacters: true,
        showShortSynopsis: true
      },
      targetAudience: "Adult audiences, music lovers, awards season viewers",
      productionTimeline: "Q4 2025 - Q2 2026"
    },
    {
      userId: 1003,
      title: "Midnight Heist",
      logline: "Eight strangers, one casino, and the perfect crime that goes perfectly wrong",
      genre: "thriller",
      format: "feature",
      shortSynopsis: "A master thief assembles a team of specialists for one last job, but when the heist begins, they discover they're not stealing money - they're stealing evidence that could topple governments.",
      budgetBracket: "medium",
      estimatedBudget: "45000000",
      status: "published",
      viewCount: 678,
      likeCount: 167,
      requireNDA: true,
      aiUsed: false,
      themes: ["trust", "betrayal", "justice", "greed"],
      characters: [
        { name: "Jack 'Ace' Morgan", description: "Master thief with one foot in retirement" },
        { name: "Isabella Cruz", description: "Hacker with a personal vendetta" },
        { name: "The Client", description: "Mysterious figure orchestrating everything" }
      ],
      visibilitySettings: {
        showBudget: false,
        showLocation: false,
        showCharacters: true,
        showShortSynopsis: true
      },
      targetAudience: "Thriller fans, heist movie enthusiasts",
      productionTimeline: "Pre-production now, filming Q2 2025"
    }
  ];

  // Insert production company pitches
  const result = await db.insert(pitches).values(productionPitches).returning();
  
  console.log('✅ Created production company pitches:');
  result.forEach(pitch => {
    console.log(`  - ${pitch.title} (ID: ${pitch.id})`);
  });
  
  console.log(`\n🎉 Successfully created ${result.length} production company pitches!`);
  console.log('🎨 These will appear with PURPLE glow in the marketplace');
  
} catch (error) {
  console.error('❌ Error creating production pitches:', error);
} finally {
  await sql.end();
}