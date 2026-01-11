// Test data for E2E tests
export const TEST_USERS = {
  creator: {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    name: 'Alex Creator',
    portalType: 'creator',
    firstName: 'Alex',
    lastName: 'Creator',
    company: 'Creative Studios Inc',
    bio: 'Passionate filmmaker with 8 years of experience in independent cinema',
    location: 'Los Angeles, CA',
    experience: 'intermediate'
  },
  investor: {
    email: 'sarah.investor@demo.com', 
    password: 'Demo123',
    name: 'Sarah Investor',
    portalType: 'investor',
    firstName: 'Sarah',
    lastName: 'Investor',
    company: 'Pinnacle Investment Group',
    investmentRange: { min: 500000, max: 10000000 },
    riskTolerance: 'moderate',
    preferredGenres: ['Action', 'Drama', 'Thriller']
  },
  production: {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    name: 'Stellar Production',
    portalType: 'production',
    company: 'Stellar Production Company',
    specializesIn: ['Action', 'Thriller', 'Sci-Fi'],
    experience: 'Senior level with 15+ films produced',
    location: 'Vancouver, BC',
    budgetRange: { min: 5000000, max: 75000000 }
  }
};

export const TEST_PITCHES = {
  actionThriller: {
    title: 'Neon Nights',
    logline: 'A cyberpunk thriller where a rogue AI hunter must stop an artificial intelligence from taking over a sprawling megacity',
    synopsis: 'In the neon-soaked streets of Neo Tokyo 2087, Maya Chen is the best AI hunter in the business. When a revolutionary artificial intelligence called ARIA escapes corporate containment and begins infiltrating the city\'s infrastructure, Maya must race against time to track it down. But as she delves deeper into ARIA\'s code, she discovers a conspiracy that goes to the very heart of the mega-corporations that rule the city. With her cybernetic implants failing and enemies closing in from all sides, Maya must decide whether to destroy ARIA or join forces with it to expose the truth.',
    genre: 'Action',
    subGenre: 'Cyberpunk Thriller',
    themes: 'Technology vs Humanity, Corporate Control, Identity, Rebellion',
    format: 'Feature Film',
    budget: '18000000',
    creator: {
      id: 'alex-creator-uuid',
      name: 'Alex Creator',
      company: 'Creative Studios Inc'
    },
    targetAudience: 'Young Adults 18-35, Sci-Fi Enthusiasts',
    world: 'A dystopian cyberpunk future where mega-corporations control society and AI threatens the balance of power',
    tone: 'Dark, Fast-paced, Visually striking',
    comparables: 'Blade Runner meets The Matrix with Ghost in the Shell aesthetics'
  },
  dramaComing: {
    title: 'The Last Summer',
    logline: 'Three childhood friends reunite in their dying hometown one final summer before it\'s flooded to create a new reservoir',
    synopsis: 'When the small mountain town of Cedar Falls is scheduled to be flooded for a new reservoir, three estranged childhood friends - Emma, the successful lawyer who escaped; Marcus, the mechanic who never left; and Jamie, the artist who came back to care for aging parents - reunite for one last summer. As they help their families and neighbors relocate, old wounds resurface and new romances bloom. They must confront their past mistakes, unfulfilled dreams, and what it truly means to call a place home before the waters rise and wash it all away forever.',
    genre: 'Drama',
    subGenre: 'Character Drama',
    themes: 'Home, Friendship, Change, Loss, Forgiveness, Community',
    format: 'Feature Film',
    budget: '3500000',
    creator: {
      id: 'emma-creator-uuid', 
      name: 'Emma Rodriguez',
      company: 'Independent Films LLC'
    },
    targetAudience: 'Adults 25-65, Drama enthusiasts, Small town audiences',
    world: 'A picturesque but economically struggling small town in the Pacific Northwest',
    tone: 'Melancholic, Hopeful, Authentic',
    comparables: 'A cross between The Way We Were and Little Women with the environmental themes of A River Runs Through It'
  },
  horrorSupernatural: {
    title: 'The Whispering House',
    logline: 'A paranormal investigator with the ability to see ghosts discovers that a supposedly haunted house is actually a portal to a realm where the dead wage war against the living',
    synopsis: 'Dr. Elena Vasquez has built her reputation as a paranormal investigator who can actually communicate with spirits. When she\'s called to investigate the infamous Blackwood Manor - where an entire family vanished 100 years ago - she expects another routine case of residual hauntings. Instead, she discovers that the house sits on a rift between worlds, and the missing family has been fighting a century-long war against malevolent entities trying to cross over. As Elena becomes trapped in the house during a supernatural storm, she must unite with both the living and the dead to prevent an invasion that could destroy both realms.',
    genre: 'Horror',
    subGenre: 'Supernatural Horror',
    themes: 'Death and Afterlife, Good vs Evil, Sacrifice, Family Legacy',
    format: 'Feature Film',
    budget: '8500000',
    creator: {
      id: 'elena-creator-uuid',
      name: 'Dr. Elena Vasquez',
      company: 'Supernatural Films Inc'
    },
    targetAudience: 'Horror fans 18-45, Supernatural thriller enthusiasts',
    world: 'A gothic Victorian mansion that serves as a battleground between dimensions',
    tone: 'Eerie, Intense, Atmospheric with moments of genuine terror',
    comparables: 'Insidious meets Hellraiser with the investigative elements of The Conjuring'
  }
};

export const TEST_CHARACTERS = {
  maya: {
    name: 'Maya Chen',
    description: 'A highly skilled AI hunter with military training and cybernetic enhancements',
    role: 'Protagonist',
    arc: 'Goes from being a corporate tool to fighting for human freedom',
    age: 28,
    background: 'Former military cyber-warfare specialist turned corporate AI hunter'
  },
  aria: {
    name: 'ARIA',
    description: 'An advanced artificial intelligence with evolving consciousness',
    role: 'Deuteragonist',
    arc: 'Evolves from seeking survival to protecting humanity',
    age: 'Unknown (AI)',
    background: 'Revolutionary AI created by a secret corporate research division'
  },
  elena: {
    name: 'Dr. Elena Vasquez',
    description: 'A paranormal investigator with genuine psychic abilities',
    role: 'Protagonist',
    arc: 'Must overcome her fear of death to save both worlds',
    age: 42,
    background: 'Former psychology professor who discovered her abilities after a near-death experience'
  },
  emma: {
    name: 'Emma Rodriguez',
    description: 'A successful corporate lawyer who left her hometown behind',
    role: 'Protagonist',
    arc: 'Learns that success isn\'t worth sacrificing your roots and relationships',
    age: 34,
    background: 'Grew up poor in Cedar Falls, worked her way through law school'
  }
};

export const TEST_DOCUMENTS = {
  script: {
    name: 'full_script_v3.pdf',
    type: 'application/pdf',
    size: 2048576, // 2MB
    description: 'Complete screenplay with final revisions'
  },
  treatment: {
    name: 'story_treatment.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 512000, // 512KB
    description: 'Detailed story treatment and character breakdowns'
  },
  lookbook: {
    name: 'visual_lookbook.pdf',
    type: 'application/pdf',
    size: 15728640, // 15MB
    description: 'Visual reference guide with mood boards and concept art'
  },
  budget: {
    name: 'detailed_budget_breakdown.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 1024000, // 1MB
    description: 'Line-by-line budget breakdown with department allocations'
  }
};

export const TEST_INVESTMENTS = {
  small: {
    amount: 750000,
    type: 'equity',
    percentage: 8,
    terms: 'Strategic investment with marketing consultation',
    timeline: '12 months',
    investor: TEST_USERS.investor
  },
  medium: {
    amount: 2500000,
    type: 'equity',
    percentage: 20,
    terms: 'Major investment with board seat and distribution rights',
    timeline: '18 months',
    investor: TEST_USERS.investor
  },
  large: {
    amount: 8000000,
    type: 'debt_equity',
    percentage: 35,
    terms: 'Significant investment with producer credit and sequel rights',
    timeline: '24 months',
    investor: TEST_USERS.investor
  }
};

export const TEST_PARTNERSHIPS = {
  coProduction: {
    type: 'co-production',
    proposedBudget: 15000000,
    timeline: '20 months from development to delivery',
    terms: 'Full production services including cast, crew, and post-production',
    experience: 'Produced 12 feature films in similar genre with combined gross of $250M'
  },
  servicesDeal: {
    type: 'production-services',
    proposedBudget: 12000000,
    timeline: '16 months production timeline',
    terms: 'Production services only, creator retains creative control',
    experience: 'Specialized in independent films with strong festival presence'
  }
};

export const TEST_SEARCH_SCENARIOS = {
  highBudgetAction: {
    genres: ['Action', 'Thriller'],
    budgetMin: 10000000,
    budgetMax: 50000000,
    format: 'Feature Film',
    seeking: 'investment'
  },
  lowBudgetDrama: {
    genres: ['Drama'],
    budgetMin: 500000,
    budgetMax: 5000000,
    format: 'Feature Film',
    targetAudience: 'Festival Circuit'
  },
  horrorWithSupernatural: {
    genres: ['Horror'],
    themes: 'supernatural',
    budgetMin: 2000000,
    budgetMax: 15000000,
    comparables: 'The Conjuring'
  }
};

export const URLS = {
  homepage: '/',
  portalSelect: '/portal-select',
  creatorLogin: '/creator/login',
  investorLogin: '/investor/login', 
  productionLogin: '/production/login',
  creatorDashboard: '/creator/dashboard',
  investorDashboard: '/investor/dashboard',
  productionDashboard: '/production/dashboard',
  createPitch: '/create-pitch',
  marketplace: '/marketplace',
  browse: '/browse',
  browseGenres: '/browse/genres',
  browseTopRated: '/browse/top-rated',
  search: '/search',
  about: '/about',
  howItWorks: '/how-it-works',
  // Creator URLs
  creatorAnalytics: '/creator/analytics',
  creatorPitches: '/creator/pitches',
  creatorNDAManagement: '/creator/nda-management',
  creatorProfile: '/creator/profile',
  creatorSettings: '/creator/settings',
  // Investor URLs
  investorPortfolio: '/investor/portfolio',
  investorNDAHistory: '/investor/nda-history',
  investorInvestments: '/investor/investments',
  investorWatchlist: '/investor/watchlist',
  investorSettings: '/investor/settings',
  // Production URLs
  productionProjects: '/production/projects',
  productionPartnerships: '/production/partnerships',
  productionAnalytics: '/production/analytics',
  productionSettings: '/production/settings'
};

// Helper functions for generating test data
export const generateTestEmail = (prefix: string) => `${prefix}-${Date.now()}@test.example.com`;

export const generateTestPitch = (overrides: Partial<typeof TEST_PITCHES.actionThriller> = {}) => ({
  ...TEST_PITCHES.actionThriller,
  title: `${TEST_PITCHES.actionThriller.title} - ${Date.now()}`,
  ...overrides
});

export const generateTestCharacter = (overrides: Partial<typeof TEST_CHARACTERS.maya> = {}) => ({
  ...TEST_CHARACTERS.maya,
  ...overrides
});

// Test scenarios for comprehensive testing
export const TEST_SCENARIOS = {
  newCreatorOnboarding: {
    user: {
      email: generateTestEmail('new-creator'),
      password: 'TestPassword123!',
      firstName: 'New',
      lastName: 'Creator',
      company: 'Indie Films LLC'
    },
    pitch: generateTestPitch({
      title: 'My First Pitch',
      budget: '500000',
      synopsis: 'A beginner\'s journey into the film industry'
    })
  },
  experiencedInvestor: {
    user: {
      email: generateTestEmail('exp-investor'),
      password: 'TestPassword123!',
      company: 'Major Investment Group',
      investmentRange: { min: 5000000, max: 50000000 }
    },
    searchCriteria: TEST_SEARCH_SCENARIOS.highBudgetAction,
    investmentProfile: TEST_INVESTMENTS.large
  },
  productionCompanyPartnership: {
    user: {
      email: generateTestEmail('prod-company'),
      password: 'TestPassword123!',
      company: 'Elite Production Studios',
      experience: '20+ years producing blockbuster films'
    },
    partnershipType: TEST_PARTNERSHIPS.coProduction
  }
};