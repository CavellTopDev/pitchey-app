// Lighthouse CI Configuration for Performance Testing

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:5173',
        'http://localhost:5173/portal',
        'http://localhost:5173/marketplace'
      ],
      
      // Number of runs for each URL (more runs = more accurate results)
      numberOfRuns: 3,
      
      // Additional Lighthouse settings
      settings: {
        // Throttling settings
        throttling: {
          rttMs: 150,
          throughputKbps: 1.6 * 1024,
          cpuSlowdownMultiplier: 4,
        },
        
        // Emulation settings
        emulatedFormFactor: 'desktop',
        
        // Skip certain audits that may not be relevant
        skipAudits: [
          'uses-http2',
          'uses-long-cache-ttl',
          'uses-text-compression'
        ]
      }
    },
    
    assert: {
      assertions: {
        // Performance thresholds
        'categories:performance': ['error', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        
        // Specific metric thresholds
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        
        // Resource optimization
        'unused-css-rules': ['warn', { maxLength: 10 }],
        'unused-javascript': ['warn', { maxLength: 10 }],
        
        // Security
        'is-on-https': 'off', // Disabled for local development
        'redirects-http': 'off' // Disabled for local development
      }
    },
    
    upload: {
      // Upload results for sharing (use temporary storage for CI)
      target: 'temporary-public-storage',
      
      // Or upload to specific service if configured
      // target: 'lhci',
      // serverBaseUrl: process.env.LHCI_SERVER_BASE_URL,
      // token: process.env.LHCI_TOKEN
    },
    
    server: {
      // Optional: Configure LHCI server for result storage
      // port: 9001,
      // storage: {
      //   storageMethod: 'sql',
      //   sqlDialect: 'sqlite',
      //   sqlDatabasePath: './lhci.db'
      // }
    },
    
    wizard: {
      // Disable wizard prompts in CI
      enabled: false
    }
  }
};

// Environment-specific configurations
if (process.env.NODE_ENV === 'production') {
  module.exports.ci.collect.url = [
    'https://pitchey.pages.dev',
    'https://pitchey.pages.dev/portal',
    'https://pitchey.pages.dev/marketplace'
  ];
  
  // Stricter thresholds for production
  module.exports.ci.assert.assertions['categories:performance'][1].minScore = 0.8;
  module.exports.ci.assert.assertions['first-contentful-paint'][1].maxNumericValue = 1500;
  module.exports.ci.assert.assertions['largest-contentful-paint'][1].maxNumericValue = 2500;
}

if (process.env.NODE_ENV === 'staging') {
  module.exports.ci.collect.url = [
    'https://pitchey-staging.pages.dev',
    'https://pitchey-staging.pages.dev/portal',
    'https://pitchey-staging.pages.dev/marketplace'
  ];
}