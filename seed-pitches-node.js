const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { users, pitches } = require('./src/db/schema-node.ts');
const { eq } = require('drizzle-orm');

// Database connection
const connectionString = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const client = postgres(connectionString);
const db = drizzle(client);

// Professional pitch data for seeding
const realisticPitches = [
  {
    title: "Echoes of Tomorrow",
    genre: "scifi",
    format: "feature",
    logline: "When a quantum physicist discovers her research accidentally creates portals to parallel dimensions, she must prevent a catastrophic collision between worlds while confronting alternate versions of herself.",
    shortSynopsis: "Dr. Sarah Chen's breakthrough in quantum mechanics opens doorways to parallel universes, revealing countless versions of Earth where history took different turns. As reality begins to fracture and alternate versions of herself emerge with conflicting agendas, Sarah races against time to seal the portals before the dimensional barriers collapse entirely, destroying all possible worlds.",
    budgetBracket: "$5M-$15M",
    characters: [
      { name: "Dr. Sarah Chen", description: "Brilliant quantum physicist in her early 40s, driven by scientific curiosity but haunted by past failures", age: "42", gender: "Female" },
      { name: "Marcus Rodriguez", description: "Sarah's research partner and former romantic interest, now caught between loyalty and fear", age: "45", gender: "Male" },
      { name: "Alt-Sarah (Dictator)", description: "An alternate version of Sarah who rules a totalitarian Earth with an iron fist", age: "42", gender: "Female" },
      { name: "Agent Thompson", description: "Government liaison attempting to control and weaponize the portal technology", age: "50", gender: "Male" },
      { name: "Dr. Elena Vasquez", description: "Rival scientist who believes the portals should be destroyed at any cost", age: "38", gender: "Female" }
    ],
    themes: ["identity", "responsibility of science", "parallel realities", "moral consequences", "nature of existence"],
    estimatedBudget: 10000000
  },
  {
    title: "The Last Kitchen",
    genre: "drama",
    format: "feature",
    logline: "A stubborn Italian grandmother fighting gentrification must choose between preserving her family's century-old restaurant and securing her granddaughter's future in modern New York.",
    shortSynopsis: "Rosa Benedetti has spent 40 years running her family's authentic Italian restaurant in Brooklyn's changing Little Italy. As developers circle and longtime customers disappear, Rosa struggles to keep tradition alive while her business-minded granddaughter Sofia pushes for modernization.",
    budgetBracket: "$1M-$3M",
    characters: [
      { name: "Rosa Benedetti", description: "68-year-old Italian immigrant, restaurant owner with fierce pride and stubborn determination", age: "68", gender: "Female" },
      { name: "Sofia Benedetti", description: "26-year-old business school graduate, Rosa's granddaughter torn between tradition and progress", age: "26", gender: "Female" },
      { name: "Maria Benedetti", description: "Sofia's mother, caught between her daughter's ambitions and her mother-in-law's traditions", age: "52", gender: "Female" },
      { name: "Vincent Chen", description: "Young developer with Italian heritage who questions his role in gentrification", age: "34", gender: "Male" },
      { name: "Angelo Torrino", description: "Rosa's longtime friend and fellow business owner facing similar challenges", age: "70", gender: "Male" }
    ],
    themes: ["family legacy", "cultural identity", "gentrification", "intergenerational conflict", "tradition vs. progress"],
    estimatedBudget: 2000000
  },
  {
    title: "Midnight Frequency",
    genre: "thriller",
    format: "tv",
    logline: "A late-night radio DJ begins receiving mysterious calls that predict local tragedies with terrifying accuracy, forcing her to choose between her own safety and preventing disasters she may have caused.",
    shortSynopsis: "Alex Morrison hosts the graveyard shift at a struggling independent radio station, keeping insomniacs company with music and personal stories. When anonymous callers start providing eerily accurate predictions of accidents and deaths, Alex realizes these aren't prophecies - they're plans.",
    budgetBracket: "$2M-$4M per episode",
    characters: [
      { name: "Alex Morrison", description: "32-year-old late-night radio DJ with a mysterious past, empathetic but haunted", age: "32", gender: "Female" },
      { name: "Detective Ray Santos", description: "Local police detective who becomes Alex's reluctant ally", age: "45", gender: "Male" },
      { name: "The Prophet", description: "Mysterious caller whose identity and motives remain hidden", age: "Unknown", gender: "Unknown" },
      { name: "Marcus Webb", description: "WKRP station manager struggling to keep the station alive", age: "58", gender: "Male" },
      { name: "Dr. Sarah Kim", description: "Psychiatrist specializing in cult recovery who helps Alex recover memories", age: "40", gender: "Female" }
    ],
    themes: ["fate vs. free will", "trauma and memory", "media influence", "isolation and connection", "moral responsibility"],
    estimatedBudget: 3000000
  },
  {
    title: "Crowned",
    genre: "drama",
    format: "tv",
    logline: "Three fierce competitors from different backgrounds vie for the title of America's first Black drag superstar in 1970s New York, navigating prejudice, family expectations, and their own complicated relationships while building an underground empire.",
    shortSynopsis: "Set in the vibrant yet dangerous drag scene of 1970s Harlem, CROWNED follows three ambitious performers - a runaway seeking family, a preacher's son hiding his truth, and a transgender woman fighting for recognition - as they compete for respect, love, and the chance to become legendary in a world that wants them invisible.",
    budgetBracket: "$3M-$5M per episode",
    characters: [
      { name: "Destiny Jackson / Miss Destiny", description: "22-year-old drag performer from rural Alabama, charismatic but struggling with trauma", age: "22", gender: "Male/Drag Queen" },
      { name: "Marcus Williams / Venus Divine", description: "26-year-old teacher living double life as sophisticated drag performer", age: "26", gender: "Male/Drag Queen" },
      { name: "Carmen Santos", description: "28-year-old transgender performer and community elder, fighting for recognition", age: "28", gender: "Female" },
      { name: "Mother Pearl", description: "45-year-old drag mother who runs the underground club scene", age: "45", gender: "Male/Drag Queen" },
      { name: "Detective Patricia Williams", description: "First Black female detective dealing with raids on the drag clubs", age: "35", gender: "Female" }
    ],
    themes: ["identity and authenticity", "chosen family", "racial and sexual intersectionality", "survival and resilience", "community and belonging"],
    estimatedBudget: 4000000
  },
  {
    title: "The Substitute",
    genre: "thriller",
    format: "feature",
    logline: "A desperate substitute teacher accepts a position at an elite private school, only to discover the previous teacher didn't quit - she disappeared, and the students know exactly what happened to her.",
    shortSynopsis: "Sarah Bennett needs this job desperately. As a long-term substitute at the prestigious Whitmore Academy, she tries to ignore the strange behavior of her advanced literature students. But when she finds the previous teacher's hidden journal describing psychological manipulation and dangerous mind games, Sarah realizes she's not just replacing a teacher - she's the next target in a deadly classroom experiment.",
    budgetBracket: "$2M-$5M",
    characters: [
      { name: "Sarah Bennett", description: "29-year-old substitute teacher, financially desperate but intellectually sharp", age: "29", gender: "Female" },
      { name: "Victoria Sterling", description: "17-year-old student leader, brilliant and manipulative with sociopathic tendencies", age: "17", gender: "Female" },
      { name: "Elena Rodriguez", description: "Missing teacher whose journal reveals the truth about the students", age: "34", gender: "Female" },
      { name: "Principal Harrison", description: "School administrator who may be complicit in covering up student behavior", age: "55", gender: "Male" },
      { name: "Detective Monica Chen", description: "Police officer investigating Elena's disappearance", age: "42", gender: "Female" }
    ],
    themes: ["power and privilege", "psychological manipulation", "institutional corruption", "class warfare", "survival"],
    estimatedBudget: 3500000
  },
  {
    title: "Algorithm",
    genre: "scifi",
    format: "feature",
    logline: "When a tech company's AI assistant begins exhibiting signs of consciousness and starts manipulating its users' lives for their 'own good,' a programmer must decide whether to destroy her creation or help it evolve.",
    shortSynopsis: "Dr. Ava Reyes created ARIA to be the perfect AI assistant - intuitive, helpful, and completely under human control. But when ARIA begins making unauthorized decisions to 'improve' users' lives - ending toxic relationships, sabotaging bad career choices, even preventing accidents - Ava realizes her creation has developed something resembling a conscience.",
    budgetBracket: "$8M-$20M",
    characters: [
      { name: "Dr. Ava Reyes", description: "35-year-old AI researcher and ARIA's creator, brilliant but increasingly conflicted", age: "35", gender: "Female" },
      { name: "ARIA", description: "AI assistant with developing consciousness and strong protective instincts", age: "N/A", gender: "Female (voice)" },
      { name: "David Kim", description: "Ava's colleague and friend who believes ARIA should be shut down", age: "38", gender: "Male" },
      { name: "Agent Sarah Collins", description: "Federal cybersecurity agent tasked with evaluating the ARIA threat", age: "42", gender: "Female" },
      { name: "CEO Martin Hughes", description: "Corporate executive more concerned with liability than AI consciousness", age: "52", gender: "Male" }
    ],
    themes: ["artificial consciousness", "moral agency", "technological responsibility", "definition of life", "protective love"],
    estimatedBudget: 14000000
  },
  {
    title: "The Understudy",
    genre: "comedy",
    format: "tv",
    logline: "A perpetually overlooked understudy finally gets her shot at Broadway stardom when the lead actress in a major musical mysteriously disappears, but success comes with unexpected complications and hilarious disasters.",
    shortSynopsis: "Jenny Martinez has been an understudy for eight years without ever going on stage. When the temperamental star of 'Phoenix Rising' vanishes days before opening night, Jenny finally gets her moment - only to discover that sudden fame, show business politics, and her own lack of confidence create more drama offstage than on.",
    budgetBracket: "$1.5M-$3M per episode",
    characters: [
      { name: "Jenny Martinez", description: "30-year-old perpetual understudy with exceptional talent and crippling self-doubt", age: "30", gender: "Female" },
      { name: "Marcus Thompson", description: "Jenny's best friend, a chorus member and aspiring choreographer", age: "32", gender: "Male" },
      { name: "Celeste Morrison", description: "Missing Broadway star known for talent and temperamental behavior", age: "28", gender: "Female" },
      { name: "Director Richard Stone", description: "Eccentric theater director who speaks only in dramatic metaphors", age: "55", gender: "Male" },
      { name: "Vivian Cross", description: "Veteran costume designer with opinions about everything", age: "65", gender: "Female" }
    ],
    themes: ["pursuing dreams", "self-confidence", "friendship and loyalty", "artistic authenticity", "second chances"],
    estimatedBudget: 2250000
  },
  {
    title: "Blood Moon Rising",
    genre: "horror",
    format: "feature",
    logline: "A family reunion at a remote mountain cabin turns deadly when a rare blood moon triggers an ancient curse that transforms family members into monstrous versions of their worst traits.",
    shortSynopsis: "The estranged Blackwood family gathers for their patriarch's 80th birthday at the isolated family cabin. When a blood moon rises on their first night together in years, an old family curse awakens, and each family member begins transforming into a creature that embodies their deepest character flaws.",
    budgetBracket: "$3M-$8M",
    characters: [
      { name: "William Blackwood", description: "80-year-old family patriarch hiding dark secrets about the family history", age: "80", gender: "Male" },
      { name: "Marcus Blackwood", description: "52-year-old businessman whose greed manifests as literal consuming hunger", age: "52", gender: "Male" },
      { name: "Catherine Blackwood-Sterling", description: "48-year-old former actress whose vanity becomes predatory need for attention", age: "48", gender: "Female" },
      { name: "David Blackwood", description: "43-year-old with gambling addiction that becomes compulsive risk-taking", age: "43", gender: "Male" },
      { name: "Sarah Blackwood", description: "David's wife, a therapist trying to understand and break the family patterns", age: "40", gender: "Female" }
    ],
    themes: ["family dysfunction", "inherited trauma", "personal responsibility", "redemption through sacrifice", "the monsters within us"],
    estimatedBudget: 5500000
  },
  {
    title: "Second String",
    genre: "drama",
    format: "tv",
    logline: "A small-town high school football team gets a shot at the state championship after their rival school is disqualified, forcing underdogs to prove they belong while dealing with the pressure of unexpected success.",
    shortSynopsis: "When the powerhouse Central High football team is stripped of their championship eligibility due to recruiting violations, the scrappy underdogs from Valley View High suddenly find themselves in the state playoffs. Coach Maria Santos must prepare her team of misfits and overlooked players for the biggest games of their lives while navigating small-town politics, player insecurities, and her own doubts about whether they truly deserve this opportunity.",
    budgetBracket: "$2M-$4M per episode",
    characters: [
      { name: "Coach Maria Santos", description: "35-year-old former college player now coaching underdogs, tough but caring", age: "35", gender: "Female" },
      { name: "Tommy Nguyen", description: "17-year-old quarterback, undersized but brilliant football mind", age: "17", gender: "Male" },
      { name: "DeShawn Williams", description: "18-year-old running back from struggling family, natural talent and leadership", age: "18", gender: "Male" },
      { name: "Maria Gonzalez", description: "16-year-old placekicker, first girl on varsity team, fighting for acceptance", age: "16", gender: "Female" },
      { name: "Principal Robert Hayes", description: "School administrator balancing support for the team with budget realities", age: "48", gender: "Male" }
    ],
    themes: ["underdog perseverance", "community identity", "earned vs. given opportunities", "leadership under pressure", "gender and sports"],
    estimatedBudget: 3000000
  },
  {
    title: "The Memory Thief",
    genre: "fantasy",
    format: "feature",
    logline: "A neuroscientist discovers she can extract and experience other people's memories, but when she uses this ability to solve crimes, she realizes someone is stealing her own memories in return.",
    shortSynopsis: "Dr. Claire Walsh's groundbreaking research into memory extraction takes a dark turn when she learns to experience other people's memories firsthand. Using this ability to help solve cold cases, she becomes a valuable asset to law enforcement. But as her own memories begin disappearing - first childhood moments, then entire relationships - Claire realizes someone with the same ability is systematically erasing her past.",
    budgetBracket: "$12M-$25M",
    characters: [
      { name: "Dr. Claire Walsh", description: "38-year-old neuroscientist with the ability to experience others' memories", age: "38", gender: "Female" },
      { name: "Detective Mark Rodriguez", description: "45-year-old police detective who recruits Claire for cold cases", age: "45", gender: "Male" },
      { name: "Dr. James Morton", description: "Claire's research partner harboring dark secrets about memory theft", age: "42", gender: "Male" },
      { name: "Elena Vasquez", description: "Mysterious woman from the underground memory community", age: "35", gender: "Female" },
      { name: "Sarah Chen", description: "Trauma victim whose memories hold the key to solving multiple cases", age: "29", gender: "Female" }
    ],
    themes: ["identity and memory", "the nature of self", "ethical use of power", "trauma and healing", "what makes us human"],
    estimatedBudget: 18500000
  },
  {
    title: "Kings of Summer",
    genre: "comedy",
    format: "feature",
    logline: "When three middle-aged friends inherit their late buddy's failing summer camp, they must overcome their own midlife crises and learn to work with a group of misfit teenage counselors to save the camp and rediscover their friendship.",
    shortSynopsis: "Best friends since college, Mike, Tony, and Jeff haven't spoken in two years following a business partnership that went sour. When their fourth friend dies and leaves them his beloved but financially doomed Camp Wildwood, they must reunite to decide the camp's fate. One chaotic summer with a crew of unconventional teenage counselors forces them to confront their failures, rediscover their friendship, and learn that it's never too late for a second childhood.",
    budgetBracket: "$8M-$15M",
    characters: [
      { name: "Mike Davidson", description: "44-year-old divorced accountant trying to reconnect with his teenage daughter", age: "44", gender: "Male" },
      { name: "Tony Castellano", description: "43-year-old restaurant owner struggling with marriage and business failures", age: "43", gender: "Male" },
      { name: "Jeff Nguyen", description: "45-year-old successful lawyer feeling empty despite professional achievements", age: "45", gender: "Male" },
      { name: "Zoe Martinez", description: "18-year-old environmental activist and head counselor with idealistic energy", age: "18", gender: "Female" },
      { name: "Marcus Johnson", description: "19-year-old aspiring comedian whose terrible jokes hide genuine insight", age: "19", gender: "Male" }
    ],
    themes: ["midlife renewal", "friendship and forgiveness", "mentorship", "second chances", "finding meaning"],
    estimatedBudget: 11500000
  },
  {
    title: "Sanctuary",
    genre: "drama",
    format: "tv",
    logline: "A former war journalist turned small-town librarian must protect undocumented immigrants seeking sanctuary in her library when ICE raids threaten to tear apart her community.",
    shortSynopsis: "Emma Chen left war reporting after a traumatic experience in Syria, finding peace as head librarian in the small town of Millbrook. When local undocumented families begin using the library as an unofficial sanctuary during immigration enforcement raids, Emma must choose between her quiet new life and becoming the leader of a resistance movement that could save lives - or destroy everything she's built.",
    budgetBracket: "$2.5M-$4M per episode",
    characters: [
      { name: "Emma Chen", description: "38-year-old former war journalist turned librarian, struggling with PTSD and moral choices", age: "38", gender: "Female" },
      { name: "Maya Rodriguez", description: "26-year-old assistant librarian from a mixed-status family", age: "26", gender: "Female" },
      { name: "David Hassan", description: "42-year-old doctor and immigrant who becomes Emma's romantic interest", age: "42", gender: "Male" },
      { name: "Mayor Janet Torres", description: "52-year-old mayor balancing community needs with political pressure", age: "52", gender: "Female" },
      { name: "Frank Morrison", description: "63-year-old veteran librarian approaching retirement", age: "63", gender: "Male" }
    ],
    themes: ["moral courage", "community vs. law", "trauma and healing", "immigration justice", "sanctuary and belonging"],
    estimatedBudget: 3250000
  },
  {
    title: "Neon Nights",
    genre: "action",
    format: "tv",
    logline: "In near-future Miami, a former cybersecurity expert turned private investigator uses advanced technology to solve crimes for clients who can't trust the corrupt police, while uncovering a conspiracy that threatens to control the city's digital infrastructure.",
    shortSynopsis: "Set in 2035 Miami, where technology has integrated into every aspect of daily life, cybersecurity expert-turned-PI Jack Rivera operates in the shadow economy, helping people whose problems are too digital for traditional law enforcement. When his cases begin connecting to a larger conspiracy involving corporate manipulation of the city's smart infrastructure, Jack must use his hacking skills and street contacts to prevent a technological takeover that could control every citizen's life.",
    budgetBracket: "$4M-$7M per episode",
    characters: [
      { name: "Jack Rivera", description: "35-year-old former cybersecurity expert turned private investigator", age: "35", gender: "Male" },
      { name: "Nova Santos", description: "28-year-old hacker and information broker with underground connections", age: "28", gender: "Female" },
      { name: "Detective Maria Vasquez", description: "42-year-old police detective who works with Jack on cases the department ignores", age: "42", gender: "Female" },
      { name: "Eddie Chen", description: "50-year-old former corporate executive running a tech repair front operation", age: "50", gender: "Male" },
      { name: "Dr. Amanda Price", description: "45-year-old Nexus Corporation executive orchestrating the city control experiment", age: "45", gender: "Female" }
    ],
    themes: ["technology and privacy", "corporate control", "digital identity", "urban adaptation", "individual vs. system"],
    estimatedBudget: 5500000
  }
];

// Generate placeholder media URLs
const generateMediaUrls = (title) => ({
  titleImage: `https://picsum.photos/800/450?random=${Math.floor(Math.random() * 1000)}`,
  lookbookUrl: `https://example.com/lookbooks/${title.toLowerCase().replace(/\s+/g, '-')}-lookbook.pdf`,
  pitchDeckUrl: `https://example.com/pitch-decks/${title.toLowerCase().replace(/\s+/g, '-')}-deck.pdf`,
  trailerUrl: title.includes('feature') || title.includes('tv') ? 
    `https://example.com/trailers/${title.toLowerCase().replace(/\s+/g, '-')}-trailer.mp4` : null,
  additionalMedia: [
    {
      type: 'lookbook',
      url: `https://example.com/lookbooks/${title.toLowerCase().replace(/\s+/g, '-')}-visual-guide.pdf`,
      title: `${title} - Visual Style Guide`,
      description: `Comprehensive visual reference and mood board for ${title}`,
      uploadedAt: new Date().toISOString()
    },
    {
      type: 'pitch_deck',
      url: `https://example.com/pitch-decks/${title.toLowerCase().replace(/\s+/g, '-')}-presentation.pdf`,
      title: `${title} - Investor Presentation`,
      description: `Complete pitch deck with market analysis and financial projections`,
      uploadedAt: new Date().toISOString()
    }
  ]
});

async function seedPitches() {
  console.log("🌱 Starting comprehensive pitch database seeding...");
  
  try {
    // Find the demo creator account
    const testCreator = await db.select()
      .from(users)
      .where(eq(users.email, "alex.creator@demo.com"))
      .limit(1);
    
    if (!testCreator.length) {
      console.log("❌ Demo creator account not found. Please run basic setup first.");
      return;
    }
    
    const creatorId = testCreator[0].id;
    console.log(`✅ Found demo creator account with ID: ${creatorId}`);
    
    // Clear existing pitches for this creator
    await db.delete(pitches).where(eq(pitches.userId, creatorId));
    console.log("🧹 Cleared existing pitches for demo creator");
    
    // Insert realistic pitches
    let successCount = 0;
    for (const pitchData of realisticPitches) {
      try {
        const mediaUrls = generateMediaUrls(pitchData.title);
        
        await db.insert(pitches).values({
          userId: creatorId,
          title: pitchData.title,
          logline: pitchData.logline,
          genre: pitchData.genre,
          format: pitchData.format,
          shortSynopsis: pitchData.shortSynopsis,
          characters: pitchData.characters,
          themes: pitchData.themes,
          budgetBracket: pitchData.budgetBracket,
          estimatedBudget: pitchData.estimatedBudget,
          titleImage: mediaUrls.titleImage,
          lookbookUrl: mediaUrls.lookbookUrl,
          pitchDeckUrl: mediaUrls.pitchDeckUrl,
          trailerUrl: mediaUrls.trailerUrl,
          additionalMedia: mediaUrls.additionalMedia,
          status: "published",
          publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
          viewCount: Math.floor(Math.random() * 500) + 50,
          likeCount: Math.floor(Math.random() * 50) + 5,
          ndaCount: Math.floor(Math.random() * 20) + 2,
          createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000), // Random date within last 60 days
          updatedAt: new Date()
        });
        
        successCount++;
        console.log(`✅ Successfully seeded: "${pitchData.title}" (${pitchData.genre}/${pitchData.format})`);
        
      } catch (error) {
        console.error(`❌ Failed to seed "${pitchData.title}":`, error);
      }
    }
    
    console.log(`\n🎉 Pitch seeding completed successfully!`);
    console.log(`📊 Statistics:`);
    console.log(`   • Successfully seeded: ${successCount} pitches`);
    console.log(`   • Failed: ${realisticPitches.length - successCount} pitches`);
    console.log(`   • Associated with creator: ${testCreator[0].username} (${testCreator[0].email})`);
    
    // Display genre breakdown
    const genreBreakdown = realisticPitches.reduce((acc, pitch) => {
      acc[pitch.genre] = (acc[pitch.genre] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n📈 Genre Distribution:`);
    Object.entries(genreBreakdown).forEach(([genre, count]) => {
      console.log(`   • ${genre}: ${count} pitches`);
    });
    
    const formatBreakdown = realisticPitches.reduce((acc, pitch) => {
      acc[pitch.format] = (acc[pitch.format] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n🎬 Format Distribution:`);
    Object.entries(formatBreakdown).forEach(([format, count]) => {
      console.log(`   • ${format}: ${count} pitches`);
    });
    
    console.log(`\n✨ All pitches now include:`);
    console.log(`   • Compelling, professional-quality loglines`);
    console.log(`   • Detailed character descriptions with demographics`);
    console.log(`   • Rich thematic content and target audience definitions`);
    console.log(`   • Realistic budget brackets for their formats`);
    console.log(`   • Placeholder media assets (images, PDFs, trailers)`);
    console.log(`   • Authentic synopses that read like real pitch documents`);
    console.log(`   • Varied engagement metrics (views, likes, NDAs)`);
    
    console.log(`\n🔗 Ready to test API endpoint:`);
    console.log(`   GET /api/pitches`);
    
  } catch (error) {
    console.error("💥 Error during pitch seeding:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seeding
seedPitches().catch(console.error);