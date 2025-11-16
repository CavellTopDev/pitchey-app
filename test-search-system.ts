#!/usr/bin/env -S deno run --allow-all

/**
 * Comprehensive Search System Test
 * Tests the new search and browse functionality
 */

const BASE_URL = "http://localhost:8001";

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  responseTime?: number;
  details?: any;
}

class SearchSystemTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log("🔍 Starting Comprehensive Search System Tests...\n");

    // Public search tests
    await this.testPitchSearch();
    await this.testUserSearch();
    await this.testBrowseTabs();
    await this.testSearchSuggestions();
    await this.testTrendingSearches();
    await this.testFiltersMetadata();
    await this.testAdvancedSearch();
    await this.testSimilarContent();

    // Print results
    this.printResults();
  }

  private async makeRequest(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<{ response: Response; data: any; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      return { response, data, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw { error, responseTime };
    }
  }

  private async testPitchSearch(): Promise<void> {
    console.log("Testing pitch search functionality...");

    const tests = [
      {
        name: "Basic Pitch Search",
        endpoint: "/api/search/pitches?q=horror"
      },
      {
        name: "Pitch Search with Filters",
        endpoint: "/api/search/pitches?q=action&genre=Action&format=Feature%20Film&limit=5"
      },
      {
        name: "Pitch Search with Sorting",
        endpoint: "/api/search/pitches?sortBy=views&sortOrder=desc&limit=10"
      },
      {
        name: "Pitch Search with Pagination",
        endpoint: "/api/search/pitches?page=1&limit=20"
      },
      {
        name: "Empty Query Search",
        endpoint: "/api/search/pitches?page=1&limit=5"
      }
    ];

    for (const test of tests) {
      try {
        const { data, responseTime } = await this.makeRequest(test.endpoint);
        
        this.results.push({
          name: test.name,
          success: data.success === true,
          responseTime,
          details: {
            totalResults: data.total,
            itemCount: data.items?.length || 0,
            hasFilters: !!data.filters,
            hasFacets: !!data.facets
          }
        });

        console.log(`  ✅ ${test.name} - ${responseTime}ms`);
      } catch (error) {
        this.results.push({
          name: test.name,
          success: false,
          error: error.toString(),
          responseTime: error.responseTime
        });
        console.log(`  ❌ ${test.name} - ${error.toString()}`);
      }
    }
  }

  private async testUserSearch(): Promise<void> {
    console.log("\nTesting user search functionality...");

    const tests = [
      {
        name: "Basic User Search",
        endpoint: "/api/search/users?q=creator"
      },
      {
        name: "User Search with Filters",
        endpoint: "/api/search/users?userType=creator&verifiedOnly=false&limit=5"
      }
    ];

    for (const test of tests) {
      try {
        const { data, responseTime } = await this.makeRequest(test.endpoint);
        
        this.results.push({
          name: test.name,
          success: data.success === true,
          responseTime,
          details: {
            totalResults: data.total,
            itemCount: data.items?.length || 0
          }
        });

        console.log(`  ✅ ${test.name} - ${responseTime}ms`);
      } catch (error) {
        this.results.push({
          name: test.name,
          success: false,
          error: error.toString(),
          responseTime: error.responseTime
        });
        console.log(`  ❌ ${test.name} - ${error.toString()}`);
      }
    }
  }

  private async testBrowseTabs(): Promise<void> {
    console.log("\nTesting browse tabs functionality...");

    const tabs = ['trending', 'new', 'popular'];

    for (const tab of tabs) {
      try {
        const { data, responseTime } = await this.makeRequest(`/api/browse?tab=${tab}&limit=10`);
        
        this.results.push({
          name: `Browse ${tab.charAt(0).toUpperCase() + tab.slice(1)} Tab`,
          success: data.success === true,
          responseTime,
          details: {
            tab,
            itemCount: data.items?.length || 0,
            hasMetadata: !!data.metadata,
            cached: data.cached
          }
        });

        console.log(`  ✅ Browse ${tab} - ${responseTime}ms (${data.items?.length || 0} items)`);
      } catch (error) {
        this.results.push({
          name: `Browse ${tab.charAt(0).toUpperCase() + tab.slice(1)} Tab`,
          success: false,
          error: error.toString(),
          responseTime: error.responseTime
        });
        console.log(`  ❌ Browse ${tab} - ${error.toString()}`);
      }
    }
  }

  private async testSearchSuggestions(): Promise<void> {
    console.log("\nTesting search suggestions...");

    const tests = [
      {
        name: "Query Suggestions",
        endpoint: "/api/search/suggestions?q=action&type=query"
      },
      {
        name: "Genre Suggestions",
        endpoint: "/api/search/suggestions?q=act&type=genre"
      },
      {
        name: "Format Suggestions",
        endpoint: "/api/search/suggestions?q=film&type=format"
      }
    ];

    for (const test of tests) {
      try {
        const { data, responseTime } = await this.makeRequest(test.endpoint);
        
        this.results.push({
          name: test.name,
          success: data.success === true,
          responseTime,
          details: {
            suggestionCount: data.suggestions?.length || 0
          }
        });

        console.log(`  ✅ ${test.name} - ${responseTime}ms (${data.suggestions?.length || 0} suggestions)`);
      } catch (error) {
        this.results.push({
          name: test.name,
          success: false,
          error: error.toString(),
          responseTime: error.responseTime
        });
        console.log(`  ❌ ${test.name} - ${error.toString()}`);
      }
    }
  }

  private async testTrendingSearches(): Promise<void> {
    console.log("\nTesting trending searches...");

    const timeframes = ['24h', '7d', '30d'];

    for (const timeframe of timeframes) {
      try {
        const { data, responseTime } = await this.makeRequest(`/api/search/trending?timeframe=${timeframe}`);
        
        this.results.push({
          name: `Trending Searches (${timeframe})`,
          success: data.success === true,
          responseTime,
          details: {
            timeframe,
            trends: data.trends
          }
        });

        console.log(`  ✅ Trending (${timeframe}) - ${responseTime}ms`);
      } catch (error) {
        this.results.push({
          name: `Trending Searches (${timeframe})`,
          success: false,
          error: error.toString(),
          responseTime: error.responseTime
        });
        console.log(`  ❌ Trending (${timeframe}) - ${error.toString()}`);
      }
    }
  }

  private async testFiltersMetadata(): Promise<void> {
    console.log("\nTesting filters metadata...");

    const tests = [
      {
        name: "Pitch Filters Metadata",
        endpoint: "/api/search/filters?type=pitch"
      },
      {
        name: "User Filters Metadata", 
        endpoint: "/api/search/filters?type=user"
      }
    ];

    for (const test of tests) {
      try {
        const { data, responseTime } = await this.makeRequest(test.endpoint);
        
        this.results.push({
          name: test.name,
          success: data.success === true,
          responseTime,
          details: {
            metadata: data.metadata
          }
        });

        console.log(`  ✅ ${test.name} - ${responseTime}ms`);
      } catch (error) {
        this.results.push({
          name: test.name,
          success: false,
          error: error.toString(),
          responseTime: error.responseTime
        });
        console.log(`  ❌ ${test.name} - ${error.toString()}`);
      }
    }
  }

  private async testAdvancedSearch(): Promise<void> {
    console.log("\nTesting advanced search...");

    const searchBody = {
      query: "action thriller",
      genres: ["Action", "Thriller"],
      sortBy: "relevance",
      page: 1,
      limit: 10
    };

    try {
      const { data, responseTime } = await this.makeRequest("/api/search/advanced", {
        method: "POST",
        body: JSON.stringify(searchBody)
      });
      
      this.results.push({
        name: "Advanced Search POST",
        success: data.success === true,
        responseTime,
        details: {
          itemCount: data.items?.length || 0,
          searchTime: data.searchTime
        }
      });

      console.log(`  ✅ Advanced Search - ${responseTime}ms`);
    } catch (error) {
      this.results.push({
        name: "Advanced Search POST",
        success: false,
        error: error.toString(),
        responseTime: error.responseTime
      });
      console.log(`  ❌ Advanced Search - ${error.toString()}`);
    }
  }

  private async testSimilarContent(): Promise<void> {
    console.log("\nTesting similar content search...");

    try {
      // Use pitch ID 1 as test
      const { data, responseTime } = await this.makeRequest("/api/search/similar/1");
      
      this.results.push({
        name: "Similar Content Search",
        success: data.success === true,
        responseTime,
        details: {
          similarPitches: data.similarPitches?.length || 0,
          relatedUsers: data.relatedUsers?.length || 0
        }
      });

      console.log(`  ✅ Similar Content - ${responseTime}ms`);
    } catch (error) {
      this.results.push({
        name: "Similar Content Search",
        success: false,
        error: error.toString(),
        responseTime: error.responseTime
      });
      console.log(`  ❌ Similar Content - ${error.toString()}`);
    }
  }

  private printResults(): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 SEARCH SYSTEM TEST RESULTS");
    console.log("=".repeat(60));

    const successful = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const percentage = Math.round((successful / total) * 100);

    console.log(`\nOverall: ${successful}/${total} tests passed (${percentage}%)`);

    if (successful === total) {
      console.log("🎉 All tests passed! Search system is working correctly.");
    } else {
      console.log("\n⚠️  Failed tests:");
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  ❌ ${r.name}: ${r.error}`);
        });
    }

    // Performance summary
    const avgResponseTime = this.results
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / 
      this.results.filter(r => r.responseTime).length;

    console.log(`\n⏱️  Average Response Time: ${Math.round(avgResponseTime)}ms`);

    // Detailed results
    console.log("\n📋 Detailed Results:");
    this.results.forEach(result => {
      const status = result.success ? "✅" : "❌";
      const time = result.responseTime ? `${result.responseTime}ms` : "N/A";
      console.log(`  ${status} ${result.name} - ${time}`);
      
      if (result.details && result.success) {
        Object.entries(result.details).forEach(([key, value]) => {
          if (typeof value === 'object') {
            console.log(`    ${key}: ${JSON.stringify(value).substring(0, 100)}`);
          } else {
            console.log(`    ${key}: ${value}`);
          }
        });
      }
    });

    console.log("\n" + "=".repeat(60));
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  const tester = new SearchSystemTester();
  await tester.runAllTests();
}

export { SearchSystemTester };