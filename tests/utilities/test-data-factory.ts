// COMPREHENSIVE TEST DATA FACTORY
// Provides realistic test data for all Pitchey platform entities
// Supports data variation, relationships, and edge cases

export interface TestDataOptions {
  count?: number;
  variation?: "minimal" | "complete" | "edge-case";
  relationships?: boolean;
  locale?: "en" | "es" | "fr";
}

export class TestDataFactory {
  private static instanceCounter = 0;
  private static getUniqueId() {
    return ++this.instanceCounter;
  }

  // User Data Factories
  static creator(options: TestDataOptions = {}) {
    const id = this.getUniqueId();
    const base = {
      email: `test.creator.${id}@pitchey.test`,
      username: `testcreator${id}`,
      password: "TestPassword123!",
      userType: "creator",
      firstName: "Test",
      lastName: `Creator${id}`,
      phone: "+1-555-000-" + String(1000 + id).slice(-4),
      location: "Los Angeles, CA",
      bio: "Test creator profile for automated testing purposes",
      companyName: `Test Production Company ${id}`,
      emailVerified: true,
      isActive: true,
    };

    if (options.variation === "complete") {
      return {
        ...base,
        companyWebsite: `https://testcompany${id}.com`,
        companyAddress: `${id} Hollywood Blvd, Los Angeles, CA 90028`,
        companyNumber: `TC${String(10000 + id).slice(-5)}`,
        profileImageUrl: `https://cdn.pitchey.test/profiles/creator${id}.jpg`,
        companyVerified: true,
        subscriptionTier: "pro",
        subscriptionStartDate: new Date().toISOString(),
        subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    if (options.variation === "edge-case") {
      return {
        ...base,
        email: `edge+case.creator.${id}@sub.domain.pitchey.test`,
        username: `edge_case_creator_${id}`,
        firstName: "José-María",
        lastName: "O'Connor-Smith",
        location: "São Paulo, Brazil",
        bio: "Test with special characters: café, naïve, résumé, 中文, العربية, русский",
        phone: "+55-11-9999-" + String(1000 + id).slice(-4),
      };
    }

    return base;
  }

  static investor(options: TestDataOptions = {}) {
    const id = this.getUniqueId();
    const base = {
      email: `test.investor.${id}@pitchey.test`,
      username: `testinvestor${id}`,
      password: "TestPassword123!",
      userType: "investor",
      firstName: "Test",
      lastName: `Investor${id}`,
      companyName: `Test Investment Fund ${id}`,
      location: "New York, NY",
      bio: "Test investor profile for automated testing",
      emailVerified: true,
      isActive: true,
    };

    if (options.variation === "complete") {
      return {
        ...base,
        companyWebsite: `https://testfund${id}.com`,
        companyAddress: `${id} Wall Street, New York, NY 10005`,
        companyNumber: `TIF${String(10000 + id).slice(-5)}`,
        profileImageUrl: `https://cdn.pitchey.test/profiles/investor${id}.jpg`,
        companyVerified: true,
        subscriptionTier: "enterprise",
      };
    }

    return base;
  }

  static production(options: TestDataOptions = {}) {
    const id = this.getUniqueId();
    return {
      email: `test.production.${id}@pitchey.test`,
      username: `testproduction${id}`,
      password: "TestPassword123!",
      userType: "production",
      firstName: "Test",
      lastName: `Production${id}`,
      companyName: `Test Production Studio ${id}`,
      location: "Vancouver, BC",
      bio: "Test production company profile",
      emailVerified: true,
      isActive: true,
    };
  }

  // Pitch Data Factories
  static pitch(creatorId?: number, options: TestDataOptions = {}) {
    const id = this.getUniqueId();
    const genres = ["Drama", "Comedy", "Action", "Thriller", "Sci-Fi", "Horror", "Romance", "Documentary"];
    const formats = ["Feature Film", "Short Film", "TV Series", "Web Series", "Documentary", "Animation"];
    const budgets = ["low", "medium", "high"];

    const base = {
      userId: creatorId,
      title: `Test Pitch ${id}`,
      logline: `A compelling test logline for pitch ${id} that captures the essence of the story`,
      genre: genres[id % genres.length],
      format: formats[id % formats.length],
      formatCategory: "Narrative",
      formatSubtype: "Drama",
      shortSynopsis: `Brief synopsis for test pitch ${id}`,
      targetAudience: "18-35 Adults",
      themes: "Testing, Quality Assurance, Automation",
      budgetBracket: budgets[id % budgets.length],
      visibility: "public",
      status: "active",
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
    };

    if (options.variation === "complete") {
      return {
        ...base,
        longSynopsis: `
          This is a comprehensive test pitch designed to validate the Pitchey platform's
          capabilities. Set in a world where quality assurance meets creative storytelling,
          our protagonist must navigate the complex landscape of software testing while
          maintaining their artistic integrity. Through a series of increasingly challenging
          scenarios, they discover that the true test isn't in the code, but in the human
          connections that make technology meaningful.
          
          The story explores themes of perseverance, innovation, and the delicate balance
          between automation and human creativity. With stunning visuals and compelling
          character development, this pitch represents the future of test-driven storytelling.
        `.trim(),
        opener: `FADE IN:\n\nINT. MODERN TESTING LAB - DAY\n\nRows of monitors display cascading code. The hum of servers fills the air...`,
        premise: "What happens when the ultimate test meets the ultimate story?",
        worldDescription: `A near-future world where software testing has evolved into an art form,
          and test automation engineers are the new creative visionaries.`,
        episodeBreakdown: "Single feature-length narrative with potential for sequel",
        estimatedBudget: "2500000.00",
        videoUrl: `https://cdn.pitchey.test/videos/pitch${id}.mp4`,
        posterUrl: `https://cdn.pitchey.test/posters/pitch${id}.jpg`,
        pitchDeckUrl: `https://cdn.pitchey.test/decks/pitch${id}.pdf`,
        additionalMaterials: JSON.stringify({
          scriptSample: `https://cdn.pitchey.test/scripts/pitch${id}_sample.pdf`,
          characterBios: `https://cdn.pitchey.test/characters/pitch${id}_bios.pdf`,
          visualReferences: [
            `https://cdn.pitchey.test/visuals/pitch${id}_ref1.jpg`,
            `https://cdn.pitchey.test/visuals/pitch${id}_ref2.jpg`,
          ],
        }),
      };
    }

    if (options.variation === "edge-case") {
      return {
        ...base,
        title: `🎬 Test Pitch ${id} with émojis & spéciàl chars`,
        logline: "A test with very long content that exceeds typical expectations and includes special characters like café, naïve, résumé, and even some unicode: 🎭🎨🎪",
        genre: "Experimental",
        themes: "Edge Cases, Unicode Testing, Boundary Validation, Character Limits",
        targetAudience: "Niche audience with specific interests",
        budgetBracket: "micro",
        estimatedBudget: "50000.00",
      };
    }

    return base;
  }

  // Character Data Factories
  static character(pitchId: number, options: TestDataOptions = {}) {
    const id = this.getUniqueId();
    const names = [
      "Alex Rivera", "Sam Chen", "Jordan Martinez", "Casey O'Brien", 
      "Morgan Taylor", "Riley Kim", "Avery Johnson", "Quinn Williams"
    ];
    const ages = ["20s", "30s", "40s", "50s", "Teen", "Child", "Elder"];
    const roles = ["Protagonist", "Antagonist", "Supporting", "Minor"];

    const base = {
      pitchId,
      name: names[id % names.length],
      description: `A compelling character for test pitch ${pitchId}`,
      age: ages[id % ages.length],
      role: roles[id % roles.length],
      importance: "Supporting",
      order: id,
    };

    if (options.variation === "complete") {
      return {
        ...base,
        description: `
          ${base.name} is a complex character with a rich backstory. Born into a family of
          test engineers, they've always struggled with the balance between logic and creativity.
          Their journey through this story represents the universal human experience of finding
          one's true calling while honoring family traditions.
          
          Key traits: Analytical mind, creative soul, strong moral compass, tendency to overthink.
          Arc: Starts as a rule-follower, learns to trust intuition and embrace uncertainty.
        `.trim(),
        backstory: "Grew up in a family of software engineers but always dreamed of storytelling",
        motivation: "To prove that technology and art can coexist harmoniously",
        flaws: "Perfectionist tendencies that sometimes paralyze decision-making",
        relationships: "Mentor figure to younger characters, rival to traditionalist colleagues",
      };
    }

    if (options.variation === "edge-case") {
      return {
        ...base,
        name: "Änna-Märía José-Carlos O'Brien-Smith",
        description: "Character with special characters: café, naïve, résumé, and unicode: 🎭👤",
        age: "Timeless",
        role: "Mystical Guide",
      };
    }

    return base;
  }

  // Document Test Files
  static testFiles = {
    validPdf: {
      name: "test-document.pdf",
      type: "application/pdf",
      size: 2048000, // 2MB
      content: new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, // PDF header
        ...new Array(100).fill(0x20), // Padding
      ]),
    },

    validDocx: {
      name: "test-script.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 1024000, // 1MB
      content: new Uint8Array([
        0x50, 0x4B, 0x03, 0x04, // DOCX header (ZIP)
        ...new Array(100).fill(0x00),
      ]),
    },

    validImage: {
      name: "test-poster.jpg",
      type: "image/jpeg",
      size: 512000, // 512KB
      content: new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE0, // JPEG header
        ...new Array(100).fill(0x00),
      ]),
    },

    oversizedFile: {
      name: "huge-file.pdf",
      type: "application/pdf",
      size: 52428800, // 50MB
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    },

    invalidType: {
      name: "malicious.exe",
      type: "application/x-msdownload",
      size: 1000,
      content: new Uint8Array([0x4D, 0x5A]), // EXE header
    },

    emptyFile: {
      name: "empty.pdf",
      type: "application/pdf",
      size: 0,
      content: new Uint8Array([]),
    },

    corruptedPdf: {
      name: "corrupted.pdf",
      type: "application/pdf",
      size: 1000,
      content: new Uint8Array([0x00, 0x00, 0x00, 0x00]), // Invalid header
    },
  };

  // NDA Request Data
  static ndaRequest(pitchId: number, investorId?: number, options: TestDataOptions = {}) {
    const id = this.getUniqueId();
    const base = {
      pitchId,
      userId: investorId,
      message: `Test NDA request ${id} for pitch ${pitchId}`,
      urgency: "medium",
      interestedInInvesting: true,
      estimatedBudget: 100000,
      timeline: "3-6 months",
      status: "pending",
    };

    if (options.variation === "complete") {
      return {
        ...base,
        message: `
          Dear Creator,
          
          I am very interested in learning more about your project. As a representative
          of Test Investment Fund ${id}, I believe this aligns well with our portfolio
          strategy and investment thesis.
          
          We are actively seeking innovative projects in the ${["drama", "comedy", "action"][id % 3]} 
          space and would love to discuss potential partnership opportunities.
          
          Please let me know if you would be willing to share additional materials
          under a mutual NDA.
          
          Best regards,
          Test Investor ${id}
        `.trim(),
        urgency: "high",
        estimatedBudget: 500000,
        timeline: "immediate",
        companyBackground: `Test Investment Fund ${id} is a leading entertainment investment company`,
        previousInvestments: ["Test Film A", "Test Series B", "Test Documentary C"],
      };
    }

    return base;
  }

  // Analytics Event Data
  static analyticsEvent(options: TestDataOptions = {}) {
    const events = [
      "page_view", "pitch_view", "pitch_like", "pitch_save", "nda_request",
      "message_sent", "search", "filter_applied", "session_start"
    ];
    
    const id = this.getUniqueId();
    return {
      eventType: events[id % events.length],
      userId: id,
      pitchId: id,
      sessionId: `test-session-${id}`,
      timestamp: new Date().toISOString(),
      metadata: JSON.stringify({
        test: true,
        browser: "Test Browser",
        platform: "Test Platform", 
        version: "1.0.0",
        ...options,
      }),
    };
  }

  // Investment Data
  static investment(pitchId: number, investorId: number, options: TestDataOptions = {}) {
    const id = this.getUniqueId();
    const statuses = ["pending", "approved", "rejected", "completed"];
    const types = ["pre_seed", "seed", "series_a", "bridge"];

    return {
      pitchId,
      investorId,
      amount: 100000 + (id * 50000),
      currency: "USD",
      type: types[id % types.length],
      status: statuses[id % statuses.length],
      notes: `Test investment ${id} for automated testing`,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  // Notification Data
  static notification(userId: number, options: TestDataOptions = {}) {
    const id = this.getUniqueId();
    const types = [
      "nda_request", "nda_approved", "pitch_liked", "message_received",
      "investment_offer", "deadline_reminder", "system_update"
    ];

    return {
      userId,
      type: types[id % types.length],
      title: `Test Notification ${id}`,
      message: `This is a test notification for user ${userId}`,
      isRead: false,
      priority: "medium",
      metadata: JSON.stringify({ test: true, notificationId: id }),
      createdAt: new Date().toISOString(),
    };
  }

  // Batch Data Generation
  static generateBatch<T>(
    factory: (options?: TestDataOptions) => T,
    count: number,
    options: TestDataOptions = {}
  ): T[] {
    return Array.from({ length: count }, () => factory(options));
  }

  // Relationship Builder
  static buildRelatedData(creatorCount = 3, pitchesPerCreator = 2, charactersPerPitch = 3) {
    const creators = this.generateBatch(this.creator, creatorCount, { variation: "complete" });
    const relationships: any = { creators, pitches: [], characters: [], ndaRequests: [] };

    creators.forEach((creator, creatorIndex) => {
      const creatorPitches = this.generateBatch(
        () => this.pitch(creatorIndex + 1, { variation: "complete" }), 
        pitchesPerCreator
      );
      
      relationships.pitches.push(...creatorPitches);

      creatorPitches.forEach((pitch, pitchIndex) => {
        const pitchCharacters = this.generateBatch(
          () => this.character(pitchIndex + 1, { variation: "complete" }),
          charactersPerPitch
        );
        
        relationships.characters.push(...pitchCharacters);

        // Add some NDA requests
        if (Math.random() > 0.5) {
          relationships.ndaRequests.push(
            this.ndaRequest(pitchIndex + 1, undefined, { variation: "complete" })
          );
        }
      });
    });

    return relationships;
  }

  // Reset counter for fresh test runs
  static reset() {
    this.instanceCounter = 0;
  }
}