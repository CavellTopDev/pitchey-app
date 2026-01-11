/**
 * Console Analysis Crawler using Crawl4AI
 * Analyzes console logs across the platform to identify patterns and issues
 */

import { apiClient } from '../lib/api-client';

interface ConsoleLogEntry {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  stack?: string;
  timestamp: string;
  context?: {
    portal?: string;
    route?: string;
    component?: string;
    userId?: string;
  };
}

interface ConsolePattern {
  pattern: string;
  regex: RegExp;
  category: 'null-reference' | 'network' | 'type-error' | 'auth' | 'websocket' | 'data-validation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
}

interface AnalysisResult {
  url: string;
  timestamp: string;
  summary: {
    totalLogs: number;
    errors: number;
    warnings: number;
    info: number;
  };
  patterns: {
    [key: string]: {
      count: number;
      severity: string;
      examples: ConsoleLogEntry[];
      recommendation: string;
    };
  };
  mockDiscrepancies: {
    issue: string;
    location: string;
    expected: any;
    actual: any;
    fix: string;
  }[];
  recommendations: {
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    issue: string;
    solution: string;
    effort: 'quick' | 'moderate' | 'significant';
  }[];
}

export class ConsoleAnalysisCrawler {
  private patterns: ConsolePattern[] = [
    {
      pattern: 'Cannot read property',
      regex: /Cannot read propert(?:y|ies) ['"]?(\w+)['"]? of (null|undefined)/,
      category: 'null-reference',
      severity: 'high',
      description: 'Attempting to access property of null/undefined object',
      recommendation: 'Add optional chaining (?.) and default values'
    },
    {
      pattern: 'is not a function',
      regex: /(\w+)\.(\w+) is not a function/,
      category: 'type-error',
      severity: 'high',
      description: 'Method called on wrong data type',
      recommendation: 'Validate data types before method calls'
    },
    {
      pattern: 'Failed to fetch',
      regex: /Failed to fetch|fetch.*failed|NetworkError/i,
      category: 'network',
      severity: 'medium',
      description: 'Network request failed',
      recommendation: 'Add retry logic with exponential backoff'
    },
    {
      pattern: '401 Unauthorized',
      regex: /401|Unauthorized|Authentication failed/,
      category: 'auth',
      severity: 'critical',
      description: 'Authentication failure',
      recommendation: 'Check Better Auth session and include credentials'
    },
    {
      pattern: '403 Forbidden',
      regex: /403|Forbidden|Access denied/,
      category: 'auth',
      severity: 'high',
      description: 'Authorization failure',
      recommendation: 'Verify user permissions and portal access'
    },
    {
      pattern: 'WebSocket connection failed',
      regex: /WebSocket.*failed|ws.*error|connection.*closed/i,
      category: 'websocket',
      severity: 'medium',
      description: 'WebSocket connection issue',
      recommendation: 'Implement reconnection with exponential backoff'
    },
    {
      pattern: '.map is not a function',
      regex: /(\w+)\.map is not a function/,
      category: 'data-validation',
      severity: 'high',
      description: 'Array method called on non-array',
      recommendation: 'Validate data is array before mapping'
    },
    {
      pattern: 'Invalid date',
      regex: /Invalid [Dd]ate|Invalid time value/,
      category: 'data-validation',
      severity: 'low',
      description: 'Date parsing failure',
      recommendation: 'Validate date strings before parsing'
    },
    {
      pattern: 'Expected array but got',
      regex: /Expected array but got (\w+)/,
      category: 'type-error',
      severity: 'medium',
      description: 'Type mismatch between expected and actual',
      recommendation: 'Update type definitions and add runtime validation'
    },
    {
      pattern: 'Maximum call stack exceeded',
      regex: /Maximum call stack size exceeded/,
      category: 'type-error',
      severity: 'critical',
      description: 'Infinite recursion or circular reference',
      recommendation: 'Check for circular dependencies and recursive calls'
    }
  ];

  /**
   * Crawl a URL and analyze console output
   */
  async crawlAndAnalyze(url: string, options: {
    portal?: string;
    authenticate?: boolean;
    credentials?: { email: string; password: string };
    waitTime?: number;
  } = {}): Promise<AnalysisResult> {
    try {
      // Call Crawl4AI endpoint to analyze the page
      const response = await apiClient.post('/api/crawl/analyze-console', {
        url,
        options: {
          extractConsole: true,
          waitForSelector: '[data-page-loaded]',
          waitTime: options.waitTime || 5000,
          executeScript: this.getConsoleInterceptScript(),
          authenticate: options.authenticate,
          credentials: options.credentials,
          portal: options.portal
        }
      });

      const consoleLogs: ConsoleLogEntry[] = response.data.consoleLogs || [];
      
      return this.analyzeConsoleLogs(consoleLogs, url);
    } catch (error) {
      console.error('Crawl4AI analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze console logs from multiple URLs
   */
  async analyzePortalRoutes(portal: string, routes: string[]): Promise<{
    portal: string;
    routes: AnalysisResult[];
    aggregated: AnalysisResult;
  }> {
    const results: AnalysisResult[] = [];
    
    for (const route of routes) {
      const url = `${window.location.origin}${route}`;
      const result = await this.crawlAndAnalyze(url, {
        portal,
        authenticate: portal !== 'public'
      });
      results.push(result);
    }

    // Aggregate results
    const aggregated = this.aggregateResults(results);

    return {
      portal,
      routes: results,
      aggregated
    };
  }

  /**
   * Compare mock implementations with real behavior
   */
  async compareMockVsReal(): Promise<{
    discrepancies: any[];
    recommendations: string[];
  }> {
    const mockPatterns = await this.extractMockPatterns();
    const realPatterns = await this.extractRealPatterns();
    
    const discrepancies = [];
    const recommendations = [];

    // Compare data structures
    for (const [key, mockValue] of Object.entries(mockPatterns)) {
      const realValue = realPatterns[key];
      
      if (JSON.stringify(mockValue) !== JSON.stringify(realValue)) {
        discrepancies.push({
          field: key,
          mock: mockValue,
          real: realValue,
          issue: this.identifyDiscrepancyType(mockValue, realValue)
        });

        recommendations.push(this.generateRecommendation(key, mockValue, realValue));
      }
    }

    return { discrepancies, recommendations };
  }

  /**
   * Script to inject for console monitoring
   */
  private getConsoleInterceptScript(): string {
    return `
      (function() {
        const logs = [];
        const originalConsole = {
          log: console.log,
          error: console.error,
          warn: console.warn,
          info: console.info,
          debug: console.debug
        };

        // Helper to get stack trace
        function getStackTrace() {
          const err = new Error();
          return err.stack || '';
        }

        // Helper to get component context
        function getComponentContext() {
          // Try to find React component name from stack
          const stack = getStackTrace();
          const componentMatch = stack.match(/at (\\w+Component|\\w+Page|\\w+View|\\w+Modal)/);
          
          return {
            component: componentMatch ? componentMatch[1] : undefined,
            url: window.location.href,
            portal: window.location.pathname.split('/')[1] || 'public',
            route: window.location.pathname
          };
        }

        // Intercept console methods
        ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
          console[method] = function(...args) {
            const entry = {
              type: method,
              message: args.map(arg => {
                try {
                  return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                } catch {
                  return String(arg);
                }
              }).join(' '),
              timestamp: new Date().toISOString(),
              stack: method === 'error' ? getStackTrace() : undefined,
              context: getComponentContext()
            };
            
            logs.push(entry);
            
            // Call original method
            originalConsole[method].apply(console, args);
          };
        });

        // Listen for unhandled errors
        window.addEventListener('error', (event) => {
          logs.push({
            type: 'error',
            message: event.message,
            timestamp: new Date().toISOString(),
            stack: event.error?.stack,
            context: {
              ...getComponentContext(),
              source: event.filename,
              line: event.lineno,
              column: event.colno
            }
          });
        });

        // Listen for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
          logs.push({
            type: 'error',
            message: 'Unhandled Promise Rejection: ' + event.reason,
            timestamp: new Date().toISOString(),
            stack: event.reason?.stack,
            context: getComponentContext()
          });
        });

        // Return logs after page loads
        setTimeout(() => {
          window.__consoleLogs = logs;
        }, 5000);

        return logs;
      })();
    `;
  }

  /**
   * Analyze collected console logs
   */
  private analyzeConsoleLogs(logs: ConsoleLogEntry[], url: string): AnalysisResult {
    const result: AnalysisResult = {
      url,
      timestamp: new Date().toISOString(),
      summary: {
        totalLogs: logs.length,
        errors: logs.filter(l => l.type === 'error').length,
        warnings: logs.filter(l => l.type === 'warn').length,
        info: logs.filter(l => l.type === 'info').length
      },
      patterns: {},
      mockDiscrepancies: [],
      recommendations: []
    };

    // Analyze patterns
    for (const log of logs) {
      for (const pattern of this.patterns) {
        if (pattern.regex.test(log.message)) {
          if (!result.patterns[pattern.pattern]) {
            result.patterns[pattern.pattern] = {
              count: 0,
              severity: pattern.severity,
              examples: [],
              recommendation: pattern.recommendation
            };
          }
          
          result.patterns[pattern.pattern].count++;
          
          if (result.patterns[pattern.pattern].examples.length < 3) {
            result.patterns[pattern.pattern].examples.push(log);
          }
        }
      }
    }

    // Check for mock discrepancies
    result.mockDiscrepancies = this.detectMockDiscrepancies(logs);

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result);

    return result;
  }

  /**
   * Detect discrepancies between mock and real implementations
   */
  private detectMockDiscrepancies(logs: ConsoleLogEntry[]): any[] {
    const discrepancies = [];

    // Check for type mismatches
    const typeMismatches = logs.filter(log => 
      /TypeError|is not a function|Cannot read property/.test(log.message)
    );

    for (const mismatch of typeMismatches) {
      // Extract details from error message
      const propertyMatch = mismatch.message.match(/Cannot read propert(?:y|ies) ['"]?(\w+)['"]?/);
      const functionMatch = mismatch.message.match(/(\w+)\.(\w+) is not a function/);

      if (propertyMatch) {
        discrepancies.push({
          issue: 'Property access on null/undefined',
          location: mismatch.context?.component || 'Unknown',
          expected: `Object with property '${propertyMatch[1]}'`,
          actual: 'null or undefined',
          fix: `Add optional chaining: obj?.${propertyMatch[1]}`
        });
      }

      if (functionMatch) {
        discrepancies.push({
          issue: 'Method called on wrong type',
          location: mismatch.context?.component || 'Unknown',
          expected: 'Function',
          actual: 'Non-function value',
          fix: `Validate type before calling: typeof obj.${functionMatch[2]} === 'function'`
        });
      }
    }

    // Check for data structure mismatches
    const mapErrors = logs.filter(log => /\.map is not a function/.test(log.message));
    
    for (const error of mapErrors) {
      const match = error.message.match(/(\w+)\.map is not a function/);
      if (match) {
        discrepancies.push({
          issue: 'Array method on non-array',
          location: error.context?.component || 'Unknown',
          expected: 'Array',
          actual: 'Object or other type',
          fix: `Check if array: Array.isArray(${match[1]}) ? ${match[1]}.map(...) : []`
        });
      }
    }

    return discrepancies;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(result: AnalysisResult): any[] {
    const recommendations = [];

    // High error count
    if (result.summary.errors > 10) {
      recommendations.push({
        priority: 'critical',
        category: 'error-handling',
        issue: `High error count (${result.summary.errors} errors)`,
        solution: 'Implement global error boundaries and comprehensive error logging',
        effort: 'moderate'
      });
    }

    // Null reference errors
    if (result.patterns['Cannot read property']?.count > 5) {
      recommendations.push({
        priority: 'high',
        category: 'data-validation',
        issue: 'Frequent null reference errors',
        solution: 'Add TypeScript strict mode and use optional chaining throughout',
        effort: 'significant'
      });
    }

    // Network errors
    const networkPatterns = Object.keys(result.patterns).filter(p => 
      p.includes('fetch') || p.includes('Network')
    );
    
    if (networkPatterns.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'network',
        issue: 'Network request failures',
        solution: 'Implement retry logic with exponential backoff and offline handling',
        effort: 'moderate'
      });
    }

    // Auth errors
    if (result.patterns['401 Unauthorized'] || result.patterns['403 Forbidden']) {
      recommendations.push({
        priority: 'critical',
        category: 'authentication',
        issue: 'Authentication/authorization failures',
        solution: 'Review Better Auth integration and ensure credentials are included',
        effort: 'quick'
      });
    }

    // WebSocket issues
    if (result.patterns['WebSocket connection failed']) {
      recommendations.push({
        priority: 'medium',
        category: 'realtime',
        issue: 'WebSocket connection problems',
        solution: 'Implement robust reconnection logic with fallback to polling',
        effort: 'moderate'
      });
    }

    // Mock discrepancies
    if (result.mockDiscrepancies.length > 3) {
      recommendations.push({
        priority: 'high',
        category: 'testing',
        issue: `${result.mockDiscrepancies.length} mock/real discrepancies found`,
        solution: 'Update test mocks to match production API responses',
        effort: 'moderate'
      });
    }

    return recommendations;
  }

  /**
   * Extract patterns from mock implementations
   */
  private async extractMockPatterns(): Promise<any> {
    // This would analyze test files to understand mock structure
    const response = await apiClient.get('/api/crawl/extract-mocks');
    return response.data;
  }

  /**
   * Extract patterns from real implementations
   */
  private async extractRealPatterns(): Promise<any> {
    // This would analyze production responses
    const response = await apiClient.get('/api/crawl/extract-real');
    return response.data;
  }

  /**
   * Identify the type of discrepancy
   */
  private identifyDiscrepancyType(mock: any, real: any): string {
    if (typeof mock !== typeof real) {
      return `Type mismatch: mock is ${typeof mock}, real is ${typeof real}`;
    }
    
    if (Array.isArray(mock) && !Array.isArray(real)) {
      return 'Mock expects array, real returns object';
    }
    
    if (!Array.isArray(mock) && Array.isArray(real)) {
      return 'Mock expects object, real returns array';
    }
    
    if (mock === null && real !== null) {
      return 'Mock returns null, real returns data';
    }
    
    return 'Structure mismatch';
  }

  /**
   * Generate recommendation for fixing discrepancy
   */
  private generateRecommendation(field: string, mock: any, real: any): string {
    const type = this.identifyDiscrepancyType(mock, real);
    
    if (type.includes('array')) {
      return `Update mock for '${field}' to match real API structure. Use Array.isArray() check.`;
    }
    
    if (type.includes('Type mismatch')) {
      return `Fix type definition for '${field}'. Mock type doesn't match production.`;
    }
    
    return `Align mock implementation of '${field}' with production API response.`;
  }

  /**
   * Aggregate multiple analysis results
   */
  private aggregateResults(results: AnalysisResult[]): AnalysisResult {
    const aggregated: AnalysisResult = {
      url: 'aggregated',
      timestamp: new Date().toISOString(),
      summary: {
        totalLogs: 0,
        errors: 0,
        warnings: 0,
        info: 0
      },
      patterns: {},
      mockDiscrepancies: [],
      recommendations: []
    };

    // Aggregate summaries
    for (const result of results) {
      aggregated.summary.totalLogs += result.summary.totalLogs;
      aggregated.summary.errors += result.summary.errors;
      aggregated.summary.warnings += result.summary.warnings;
      aggregated.summary.info += result.summary.info;

      // Aggregate patterns
      for (const [pattern, data] of Object.entries(result.patterns)) {
        if (!aggregated.patterns[pattern]) {
          aggregated.patterns[pattern] = { ...data };
        } else {
          aggregated.patterns[pattern].count += data.count;
          aggregated.patterns[pattern].examples.push(...data.examples.slice(0, 1));
        }
      }

      // Collect all discrepancies
      aggregated.mockDiscrepancies.push(...result.mockDiscrepancies);
    }

    // Generate aggregated recommendations
    aggregated.recommendations = this.generateRecommendations(aggregated);

    return aggregated;
  }

  /**
   * Generate a comprehensive report
   */
  async generateComprehensiveReport(): Promise<void> {
    console.log('🔍 Starting comprehensive console analysis...');

    const portals = ['public', 'creator', 'investor', 'production'];
    const allResults = [];

    for (const portal of portals) {
      const routes = this.getPortalRoutes(portal);
      const result = await this.analyzePortalRoutes(portal, routes);
      allResults.push(result);
    }

    // Compare mock vs real
    const comparison = await this.compareMockVsReal();

    // Generate final report
    const report = {
      timestamp: new Date().toISOString(),
      portals: allResults,
      mockVsReal: comparison,
      topIssues: this.identifyTopIssues(allResults),
      actionPlan: this.generateActionPlan(allResults, comparison)
    };

    // Save report
    await apiClient.post('/api/reports/console-analysis', report);

    console.log('✅ Console analysis complete!');
    console.log('📊 Report saved to database');
  }

  /**
   * Get routes for a portal
   */
  private getPortalRoutes(portal: string): string[] {
    const routes: { [key: string]: string[] } = {
      public: ['/', '/browse', '/search', '/marketplace'],
      creator: ['/creator/dashboard', '/creator/pitches', '/creator/analytics'],
      investor: ['/investor/dashboard', '/investor/portfolio', '/investor/discover'],
      production: ['/production/dashboard', '/production/projects', '/production/analytics']
    };

    return routes[portal] || [];
  }

  /**
   * Identify top issues across all portals
   */
  private identifyTopIssues(results: any[]): any[] {
    const allPatterns: { [key: string]: number } = {};

    for (const portalResult of results) {
      for (const [pattern, data] of Object.entries(portalResult.aggregated.patterns)) {
        allPatterns[pattern] = (allPatterns[pattern] || 0) + (data as any).count;
      }
    }

    return Object.entries(allPatterns)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));
  }

  /**
   * Generate action plan based on findings
   */
  private generateActionPlan(results: any[], comparison: any): any[] {
    const actions = [];

    // Priority 1: Fix critical errors
    actions.push({
      priority: 1,
      task: 'Fix authentication errors',
      description: 'Ensure Better Auth cookies are included in all API requests',
      effort: '2 hours',
      impact: 'High'
    });

    // Priority 2: Add error boundaries
    actions.push({
      priority: 2,
      task: 'Implement error boundaries',
      description: 'Add React error boundaries to catch and handle component errors',
      effort: '4 hours',
      impact: 'High'
    });

    // Priority 3: Update mocks
    if (comparison.discrepancies.length > 0) {
      actions.push({
        priority: 3,
        task: 'Update test mocks',
        description: 'Align mock data structures with production API responses',
        effort: '1 day',
        impact: 'Medium'
      });
    }

    // Priority 4: Add data validation
    actions.push({
      priority: 4,
      task: 'Add data validation',
      description: 'Implement runtime type checking and default values',
      effort: '2 days',
      impact: 'Medium'
    });

    return actions;
  }
}

// Export singleton instance
export const consoleAnalyzer = new ConsoleAnalysisCrawler();