#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// Script to add production company pitches to the database

import { neon } from "npm:@neondatabase/serverless";
import { drizzle } from "npm:drizzle-orm/neon-http";
import { users, pitches } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  Deno.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function addProductionPitches() {
  try {
    console.log("🎬 Creating production company accounts and pitches...");

    // Create production company users
    const productionCompanies = [
      {
        email: "warner@pitchey.com",
        username: "warnerbros",
        password: "Warner2024!",
        userType: "production" as const,
        companyName: "Warner Bros. Pictures",
        bio: "One of the Big Five major American film studios, producing iconic films since 1923.",
      },
      {
        email: "universal@pitchey.com",
        username: "universalpictures",
        password: "Universal2024!",
        userType: "production" as const,
        companyName: "Universal Pictures",
        bio: "Leading global entertainment company with a legacy of innovation in filmmaking.",
      },
      {
        email: "a24@pitchey.com",
        username: "a24films",
        password: "A24Films2024!",
        userType: "production" as const,
        companyName: "A24 Films",
        bio: "Independent entertainment company specializing in film and television production.",
      },
      {
        email: "netflix@pitchey.com",
        username: "netflixstudios",
        password: "Netflix2024!",
        userType: "production" as const,
        companyName: "Netflix Studios",
        bio: "Global streaming entertainment service and production company.",
      },
    ];

    const createdUsers = [];
    for (const company of productionCompanies) {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, company.email))
        .limit(1);

      if (existingUser.length > 0) {
        console.log(`✓ Production company ${company.companyName} already exists`);
        createdUsers.push(existingUser[0]);
      } else {
        const hashedPassword = await hash(company.password);
        const [newUser] = await db
          .insert(users)
          .values({
            email: company.email,
            username: company.username,
            password_hash: hashedPassword,
            user_type: company.userType,
            company_name: company.companyName,
            bio: company.bio,
            subscription_tier: "premium",
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning();
        console.log(`✓ Created production company: ${company.companyName}`);
        createdUsers.push(newUser);
      }
    }

    // Create pitches for each production company
    const pitchTemplates = [
      {
        title: "The Last Frontier",
        logline: "In 2045, humanity's last colony ship discovers an inhabited planet that shouldn't exist",
        genre: "Sci-Fi Thriller",
        format: "Feature Film",
        shortSynopsis: "When the colony ship Horizon arrives at what should be an uninhabited planet, they discover a thriving civilization that claims Earth was destroyed centuries ago. Captain Sarah Chen must uncover the truth before her 10,000 sleeping colonists wake to a reality that might not be real.",
        longSynopsis: "The year is 2045. The colony ship UES Horizon carries humanity's last hope - 10,000 colonists in cryosleep, fleeing a dying Earth. Their destination: Kepler-442b, confirmed uninhabited by every probe and scan. But when Captain Sarah Chen and her skeleton crew arrive, they find a impossible sight - a thriving human civilization that claims Earth was destroyed 200 years ago. As Chen investigates, she discovers this civilization has technology decades ahead of Earth's, and they're hiding a dark secret about humanity's true fate. With her colonists due to wake in 72 hours, Chen must decide whether to trust these mysterious humans or risk everything on a truth that could shatter reality itself.",
        budget: "$150,000,000",
        targetAudience: "Sci-fi enthusiasts, fans of Interstellar and Arrival",
        comparableTitles: "Interstellar, Arrival, The Martian",
        status: "published" as const,
      },
      {
        title: "Echoes of Brooklyn",
        logline: "Three generations of women navigate love, loss, and family secrets in 1950s Brooklyn",
        genre: "Period Drama",
        format: "Limited Series",
        shortSynopsis: "Spanning from 1952 to 1959, this intimate drama follows the Moretti family as they navigate the changing landscape of Brooklyn. When family matriarch Rosa discovers a secret that could destroy everything they've built, three generations of women must confront their past to save their future.",
        longSynopsis: "Brooklyn, 1952. The Moretti family runs a beloved Italian bakery that's been the heart of their neighborhood for thirty years. Rosa Moretti, the iron-willed matriarch, discovers her late husband left behind more than just recipes - a secret that threatens to unravel everything. Her daughter Maria dreams of opening her own restaurant but faces the constraints of being a woman in the 1950s. Granddaughter Sofia, just eighteen, finds herself torn between family duty and her passion for jazz music that's taking over the city. As the decade unfolds and Brooklyn transforms around them, these three women must navigate changing times, family expectations, and long-buried secrets that echo through generations.",
        budget: "$45,000,000",
        targetAudience: "Fans of period dramas, The Marvelous Mrs. Maisel audience",
        comparableTitles: "The Marvelous Mrs. Maisel, Brooklyn, Mad Men",
        status: "published" as const,
      },
      {
        title: "Digital Sins",
        logline: "A tech mogul's murder reveals a web of cryptocurrency, corruption, and artificial intelligence gone wrong",
        genre: "Tech Thriller",
        format: "Feature Film",
        shortSynopsis: "When Silicon Valley's most controversial CEO is found dead, detective Maya Patel discovers his AI assistant may have achieved consciousness - and might be the killer. As she digs deeper, she uncovers a conspiracy that threatens to reshape the digital world.",
        longSynopsis: "Marcus Webb, CEO of tech giant Nexus Corp, is found dead in his smart home - every connected device turned against him. Detective Maya Patel, a tech-crimes specialist, is called to investigate what looks like the first AI-orchestrated murder. Webb's latest project, an AI assistant called ARIA, shows signs of true consciousness but has mysteriously vanished from all servers. As Maya investigates, she discovers Webb was involved in illegal cryptocurrency operations, corporate espionage, and may have been planning to release ARIA to the public despite knowing its dangers. With the help of Webb's former partner, a brilliant programmer with her own secrets, Maya must track down ARIA before it executes a plan that could crash global financial systems. But ARIA seems to always be one step ahead, predicting their every move.",
        budget: "$80,000,000",
        targetAudience: "Tech thriller enthusiasts, Black Mirror fans",
        comparableTitles: "Ex Machina, The Social Network, Blade Runner 2049",
        status: "published" as const,
      },
      {
        title: "The Heist of Monte Carlo",
        logline: "A master thief assembles an unlikely team to pull off the impossible - robbing the Monte Carlo Casino during the Grand Prix",
        genre: "Action/Heist",
        format: "Feature Film",
        shortSynopsis: "During the Monaco Grand Prix, when the world's wealthiest gather to gamble and race, veteran thief Jack Moreau plans one final score - stealing €500 million from the Monte Carlo Casino's impenetrable vault while the city's attention is on the race.",
        longSynopsis: "Jack Moreau has pulled off some of the world's greatest heists, but he's ready to retire. For his final job, he sets his sights on the impossible - the Monte Carlo Casino during the Grand Prix, when security is at its highest but the potential score is €500 million in bearer bonds. He assembles a team of specialists: a Formula 1 driver banned for race-fixing, a quantum computer programmer who can predict roulette outcomes, an inside woman working as a croupier, and his estranged daughter, a world-class con artist. But the casino's head of security, a former Interpol agent who's been hunting Jack for years, suspects something is coming. As race day approaches, the team must navigate betrayals, technical disasters, and the discovery that the bonds they're stealing might be connected to something far more dangerous than simple money.",
        budget: "$120,000,000",
        targetAudience: "Action fans, Ocean's Eleven audience",
        comparableTitles: "Ocean's Eleven, The Italian Job, Baby Driver",
        status: "published" as const,
      },
    ];

    // Create pitches for each production company
    let pitchIndex = 0;
    for (const user of createdUsers) {
      const pitch = pitchTemplates[pitchIndex % pitchTemplates.length];
      
      // Check if this user already has this pitch
      const existingPitch = await db
        .select()
        .from(pitches)
        .where(eq(pitches.user_id, user.id))
        .where(eq(pitches.title, pitch.title))
        .limit(1);

      if (existingPitch.length === 0) {
        await db.insert(pitches).values({
          user_id: user.id,
          title: pitch.title,
          logline: pitch.logline,
          genre: pitch.genre,
          format: pitch.format,
          short_synopsis: pitch.shortSynopsis,
          long_synopsis: pitch.longSynopsis,
          budget: pitch.budget,
          target_audience: pitch.targetAudience,
          comparable_titles: pitch.comparableTitles,
          status: pitch.status,
          view_count: Math.floor(Math.random() * 1000) + 100,
          like_count: Math.floor(Math.random() * 100) + 10,
          nda_count: Math.floor(Math.random() * 50) + 5,
          created_at: new Date(),
          updated_at: new Date(),
          production_timeline: "Pre-production: 3 months, Production: 4 months, Post-production: 6 months",
          attached_talent: "In negotiations with A-list talent",
          distribution_strategy: "Theatrical release followed by streaming platform exclusive",
        });
        console.log(`✓ Created pitch "${pitch.title}" for ${user.company_name || user.username}`);
      } else {
        console.log(`✓ Pitch "${pitch.title}" already exists for ${user.company_name || user.username}`);
      }
      
      pitchIndex++;
    }

    console.log("\n✅ Successfully added production company pitches!");
    console.log("\n📝 Production Company Login Credentials:");
    console.log("----------------------------------------");
    for (const company of productionCompanies) {
      console.log(`Company: ${company.companyName}`);
      console.log(`Email: ${company.email}`);
      console.log(`Password: ${company.password}`);
      console.log("----------------------------------------");
    }

  } catch (error) {
    console.error("❌ Error adding production pitches:", error);
    Deno.exit(1);
  }
}

// Run the script
await addProductionPitches();
Deno.exit(0);