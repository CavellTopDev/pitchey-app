#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Portfolio Population Script for Pitchey v0.2
 * 
 * This script uses the backend API endpoints to populate the portfolio
 * with realistic pitch data, bypassing direct database connection issues.
 */

const API_BASE = "http://localhost:8000";
const DEMO_USER = {
  email: "alex.creator@demo.com",
  password: "Demo123"
};

interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: number;
      email: string;
      username: string;
      userType: string;
    };
  };
  error?: string;
}

interface PitchData {
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis: string;
  themes: string[];
  budgetBracket: string;
  estimatedBudget: number;
}

// Realistic pitch data to create
const PITCH_DATA: PitchData[] = [
  {
    title: "The Last Frontier",
    logline: "A gripping sci-fi thriller about humanity's final stand on Mars.",
    genre: "scifi",
    format: "feature",
    shortSynopsis: "In 2089, Earth's last colony on Mars faces an unprecedented threat when mysterious signals from deep space trigger a series of catastrophic events. As resources dwindle and communication with Earth is severed, colony commander Sarah Chen must unite the fractured survivors to uncover an ancient Martian secret that could either save humanity or doom it forever.",
    themes: ["survival", "humanity", "discovery", "sacrifice"],
    budgetBracket: "$5M-$10M",
    estimatedBudget: 7500000
  },
  {
    title: "Echoes of Tomorrow",
    logline: "A time-travel drama exploring the consequences of changing the past.",
    genre: "drama",
    format: "tv",
    shortSynopsis: "When brilliant physicist Dr. Alex Rivera accidentally discovers time travel, they must navigate the moral implications of altering history while being pursued by a shadowy organization that wants to weaponize the technology.",
    themes: ["time", "consequences", "ethics", "family"],
    budgetBracket: "$2M-$5M",
    estimatedBudget: 3500000
  },
  {
    title: "City of Dreams",
    logline: "A documentary exploring the lives of street artists in New York City.",
    genre: "documentary",
    format: "feature",
    shortSynopsis: "This intimate documentary follows five street artists over the course of a year as they navigate the challenges of creating art in public spaces while fighting for recognition and dealing with city regulations.",
    themes: ["art", "expression", "urban life", "creativity"],
    budgetBracket: "$500K-$1M",
    estimatedBudget: 750000
  },
  {
    title: "The Memory Keeper",
    logline: "A psychological thriller about a woman who can steal and manipulate memories.",
    genre: "thriller",
    format: "feature",
    shortSynopsis: "Lila possesses an extraordinary gift - she can extract and alter human memories. When she's hired to help a wealthy family recover a lost inheritance, she uncovers dark secrets that put her own life in danger.",
    themes: ["memory", "identity", "truth", "power"],
    budgetBracket: "$10M-$20M",
    estimatedBudget: 15000000
  },
  {
    title: "The Art of Silence",
    logline: "A deaf artist's journey to recognition in the competitive world of contemporary art.",
    genre: "drama",
    format: "feature",
    shortSynopsis: "Maya, a talented deaf artist, struggles to make her voice heard in the visual art world. Through innovative use of technology and determination, she challenges perceptions about disability and artistic expression.",
    themes: ["art", "disability", "perseverance", "innovation"],
    budgetBracket: "$1M-$2M",
    estimatedBudget: 1500000
  },
  {
    title: "Neon Nights",
    logline: "A cyberpunk thriller set in a dystopian future where memories are currency.",
    genre: "thriller",
    format: "tv",
    shortSynopsis: "In 2087 Neo-Tokyo, private investigator Jake Nakamura specializes in cases involving stolen memories. When a routine job leads him to uncover a conspiracy that threatens the fabric of society, he must choose between his own survival and exposing the truth.",
    themes: ["cyberpunk", "identity", "technology", "justice"],
    budgetBracket: "$5M-$10M",
    estimatedBudget: 8000000
  },
  {
    title: "The Storyteller's Daughter",
    logline: "A young woman discovers her family's connection to ancient Arabian folklore.",
    genre: "fantasy",
    format: "feature",
    shortSynopsis: "When Layla inherits her grandmother's bookshop in modern-day Baghdad, she discovers that the stories contained within its walls are not just tales, but doorways to other worlds. As she learns to navigate these magical realms, she must protect both worlds from an ancient evil.",
    themes: ["heritage", "magic", "family", "courage"],
    budgetBracket: "$15M-$25M",
    estimatedBudget: 20000000
  },
  {
    title: "Wavelength",
    logline: "A coming-of-age comedy about teenage pirates running an underground radio station.",
    genre: "comedy",
    format: "tv",
    shortSynopsis: "In 1980s suburban America, four misfit teenagers start an illegal radio station from a basement, becoming the voice of their generation while dodging the FCC and dealing with typical teenage problems.",
    themes: ["youth", "rebellion", "friendship", "music"],
    budgetBracket: "$2M-$5M",
    estimatedBudget: 3200000
  },
  {
    title: "The Deep Blue",
    logline: "An underwater thriller about a research team trapped in the ocean's deepest trenches.",
    genre: "thriller",
    format: "feature",
    shortSynopsis: "When a deep-sea research mission goes wrong, marine biologist Dr. Emma Torres and her team find themselves stranded 35,000 feet below the surface. With oxygen running low and mysterious creatures stalking them, they must find a way to survive the abyss.",
    themes: ["survival", "isolation", "discovery", "teamwork"],
    budgetBracket: "$25M-$50M",
    estimatedBudget: 35000000
  },
  {
    title: "Paper Hearts",
    logline: "A romantic drama about two rival poets who fall in love through their competing works.",
    genre: "romance",
    format: "feature",
    shortSynopsis: "In the competitive world of contemporary poetry, rivals Marcus and Sofia discover their hearts speaking the same language through verse. As they navigate their professional rivalry and personal attraction, they learn that the most beautiful poems are written by two hearts beating as one.",
    themes: ["love", "art", "competition", "vulnerability"],
    budgetBracket: "$3M-$8M",
    estimatedBudget: 5500000
  }
];

async function makeRequest(endpoint: string, method: string = "GET", data?: any, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

async function authenticateUser(): Promise<string> {
  console.log("🔑 Authenticating as creator user...");
  
  try {
    const response: AuthResponse = await makeRequest("/api/auth/creator/login", "POST", {
      email: DEMO_USER.email,
      password: DEMO_USER.password
    });
    
    if (!response.success || !response.token) {
      throw new Error(response.error || "Authentication failed");
    }
    
    console.log(`✅ Successfully authenticated as ${response.user.username} (${response.user.userType})`);
    return response.token;
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
    
    // Try to register the user if login fails
    console.log("🔧 Attempting to register user...");
    try {
      await makeRequest("/api/auth/creator/register", "POST", {
        email: DEMO_USER.email,
        password: DEMO_USER.password,
        username: "alex_creator",
        firstName: "Alex",
        lastName: "Creator",
        companyName: "Demo Film Studio",
        bio: "Demo creator account for testing"
      });
      
      console.log("✅ User registered successfully. Now logging in...");
      
      // Try login again
      const response: AuthResponse = await makeRequest("/api/auth/creator/login", "POST", {
        email: DEMO_USER.email,
        password: DEMO_USER.password
      });
      
      if (!response.success || !response.token) {
        throw new Error(response.error || "Authentication failed after registration");
      }
      
      console.log(`✅ Successfully authenticated as ${response.user.username} (${response.user.userType})`);
      return response.token;
    } catch (registerError) {
      console.error("❌ Registration also failed:", registerError.message);
      throw registerError;
    }
  }
}

async function createPitch(pitchData: PitchData, token: string): Promise<void> {
  console.log(`📝 Creating pitch: "${pitchData.title}"`);
  
  try {
    const response = await makeRequest("/api/creator/pitches", "POST", {
      ...pitchData,
      status: "published",
      publishedAt: new Date().toISOString()
    }, token);
    
    if (response.success) {
      console.log(`✅ Successfully created pitch: "${pitchData.title}"`);
    } else {
      console.log(`⚠️  Pitch creation response: ${JSON.stringify(response)}`);
    }
  } catch (error) {
    console.error(`❌ Failed to create pitch "${pitchData.title}":`, error.message);
    throw error;
  }
}

async function checkServerHealth(): Promise<boolean> {
  try {
    console.log("🏥 Checking server health...");
    const response = await fetch(`${API_BASE}/api/health`);
    
    if (response.ok) {
      console.log("✅ Server is healthy and responding");
      return true;
    } else {
      console.log(`⚠️  Server responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Server health check failed:", error.message);
    console.log("💡 Make sure the backend server is running on port 8000");
    console.log("   Run: deno task start");
    return false;
  }
}

async function verifyPortfolioData(token: string): Promise<void> {
  console.log("🔍 Verifying created pitches...");
  
  try {
    const response = await makeRequest("/api/creator/pitches", "GET", undefined, token);
    
    if (response.success && response.data) {
      console.log(`✅ Portfolio verification successful: ${response.data.length} pitches found`);
      
      // Log pitch titles for verification
      response.data.forEach((pitch: any, index: number) => {
        console.log(`   ${index + 1}. ${pitch.title} (${pitch.genre}, ${pitch.format})`);
      });
    } else {
      console.log("⚠️  Could not verify portfolio data");
    }
  } catch (error) {
    console.error("❌ Portfolio verification failed:", error.message);
  }
}

async function main(): Promise<void> {
  console.log("🎬 Starting Pitchey Portfolio Population Script");
  console.log("=" .repeat(50));
  
  try {
    // Check if server is running
    const serverHealthy = await checkServerHealth();
    if (!serverHealthy) {
      throw new Error("Server is not responding. Please start the backend server first.");
    }
    
    // Authenticate user
    const token = await authenticateUser();
    
    console.log("\n📝 Creating pitches...");
    console.log("-".repeat(30));
    
    // Create pitches one by one with small delays to avoid overwhelming the server
    for (let i = 0; i < PITCH_DATA.length; i++) {
      const pitchData = PITCH_DATA[i];
      await createPitch(pitchData, token);
      
      // Add small delay between requests
      if (i < PITCH_DATA.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log("\n🔍 Verification");
    console.log("-".repeat(30));
    await verifyPortfolioData(token);
    
    console.log("\n🎉 Portfolio population completed successfully!");
    console.log("💡 You can now view the portfolio at: http://localhost:3000/creator/portfolio");
    
  } catch (error) {
    console.error("\n❌ Portfolio population failed:");
    console.error(error.message);
    
    console.log("\n🔧 Troubleshooting steps:");
    console.log("1. Ensure the backend server is running: deno task start");
    console.log("2. Check the database connection is working");
    console.log("3. Verify the demo user exists or can be created");
    console.log("4. Check the API endpoints are responding correctly");
    
    Deno.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  await main();
}