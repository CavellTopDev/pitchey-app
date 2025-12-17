#!/usr/bin/env node

/**
 * Cost Analysis Script
 * Fetches and analyzes costs from all cloud services
 */

const https = require('https');
const { execSync } = require('child_process');

class CostAnalyzer {
  constructor() {
    this.services = {
      cloudflare: {
        name: 'Cloudflare',
        apiEndpoint: 'https://api.cloudflare.com/client/v4',
        token: process.env.CLOUDFLARE_API_TOKEN,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID
      },
      neon: {
        name: 'Neon Database',
        apiEndpoint: 'https://console.neon.tech/api/v2',
        apiKey: process.env.NEON_API_KEY,
        projectId: process.env.NEON_PROJECT_ID
      },
      upstash: {
        name: 'Upstash Redis',
        apiEndpoint: 'https://api.upstash.com/v2',
        apiKey: process.env.UPSTASH_API_KEY
      },
      github: {
        name: 'GitHub Actions',
        token: process.env.GITHUB_TOKEN,
        repo: process.env.GITHUB_REPOSITORY
      }
    };
    
    this.costs = {};
    this.alerts = [];
    this.recommendations = [];
  }
  
  async analyze() {
    console.error('Starting cost analysis...');
    
    // Fetch costs from each service
    await this.fetchCloudflareCosts();
    await this.fetchNeonCosts();
    await this.fetchUpstashCosts();
    await this.fetchGitHubCosts();
    
    // Calculate totals and percentages
    this.calculateTotals();
    
    // Check for alerts
    this.checkAlerts();
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Output report
    this.generateReport();
  }
  
  async fetchCloudflareCosts() {
    try {
      // Estimate based on usage metrics
      // In production, this would use Cloudflare Analytics API
      
      // Fetch Worker invocations
      const workerStats = await this.makeRequest(
        `${this.services.cloudflare.apiEndpoint}/accounts/${this.services.cloudflare.accountId}/analytics/workers`,
        { 'Authorization': `Bearer ${this.services.cloudflare.token}` }
      );
      
      // Estimate costs (simplified calculation)
      const requests = workerStats?.result?.requests || 10000000; // 10M default
      const kvReads = workerStats?.result?.kvReads || 1000000; // 1M default
      const doRequests = workerStats?.result?.doRequests || 500000; // 500K default
      const r2Operations = workerStats?.result?.r2Operations || 100000; // 100K default
      
      const workerCost = (requests / 1000000) * 0.15; // $0.15 per million
      const kvCost = (kvReads / 1000000) * 0.50; // $0.50 per million reads
      const doCost = (doRequests / 1000000) * 0.15; // $0.15 per million
      const r2Cost = (r2Operations / 1000000) * 0.36; // $0.36 per million operations
      
      this.costs.cloudflare = {
        name: 'Cloudflare',
        cost: workerCost + kvCost + doCost + r2Cost,
        breakdown: {
          workers: workerCost,
          kv: kvCost,
          durableObjects: doCost,
          r2: r2Cost
        },
        metrics: {
          requests,
          kvReads,
          doRequests,
          r2Operations
        }
      };
    } catch (error) {
      console.error('Error fetching Cloudflare costs:', error.message);
      this.costs.cloudflare = { name: 'Cloudflare', cost: 250, estimated: true };
    }
  }
  
  async fetchNeonCosts() {
    try {
      // Fetch project consumption
      const consumption = await this.makeRequest(
        `${this.services.neon.apiEndpoint}/projects/${this.services.neon.projectId}/consumption`,
        { 'Authorization': `Bearer ${this.services.neon.apiKey}` }
      );
      
      // Fetch branches
      const branches = await this.makeRequest(
        `${this.services.neon.apiEndpoint}/projects/${this.services.neon.projectId}/branches`,
        { 'Authorization': `Bearer ${this.services.neon.apiKey}` }
      );
      
      // Calculate costs
      const computeHours = consumption?.compute_seconds / 3600 || 720; // Default 720 hours
      const storageGB = consumption?.storage_bytes / (1024 * 1024 * 1024) || 10; // Default 10GB
      const branchCount = branches?.branches?.length || 5;
      
      const computeCost = computeHours * 0.09; // $0.09 per compute hour
      const storageCost = storageGB * 0.15; // $0.15 per GB
      const branchCost = (branchCount - 1) * 20; // Additional branches cost
      
      this.costs.neon = {
        name: 'Neon Database',
        cost: computeCost + storageCost + branchCost,
        breakdown: {
          compute: computeCost,
          storage: storageCost,
          branches: branchCost
        },
        metrics: {
          computeHours,
          storageGB,
          branchCount
        }
      };
      
      // Check for optimization opportunities
      if (branchCount > 5) {
        this.recommendations.push({
          service: 'Neon',
          action: `Reduce branch count from ${branchCount} to 5`,
          estimatedSavings: (branchCount - 5) * 20
        });
      }
    } catch (error) {
      console.error('Error fetching Neon costs:', error.message);
      this.costs.neon = { name: 'Neon Database', cost: 400, estimated: true };
    }
  }
  
  async fetchUpstashCosts() {
    try {
      // Fetch database stats
      const stats = await this.makeRequest(
        `${this.services.upstash.apiEndpoint}/stats`,
        { 'Authorization': `Bearer ${this.services.upstash.apiKey}` }
      );
      
      // Calculate costs
      const commands = stats?.commands || 5000000; // 5M default
      const storageGB = stats?.storage / (1024 * 1024 * 1024) || 1; // 1GB default
      
      const commandCost = (commands / 100000) * 0.20; // $0.20 per 100K commands
      const storageCost = storageGB * 0.25; // $0.25 per GB
      
      this.costs.upstash = {
        name: 'Upstash Redis',
        cost: commandCost + storageCost,
        breakdown: {
          commands: commandCost,
          storage: storageCost
        },
        metrics: {
          commands,
          storageGB
        }
      };
    } catch (error) {
      console.error('Error fetching Upstash costs:', error.message);
      this.costs.upstash = { name: 'Upstash Redis', cost: 150, estimated: true };
    }
  }
  
  async fetchGitHubCosts() {
    try {
      // Get workflow runs for the current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const runs = await this.makeRequest(
        `https://api.github.com/repos/${this.services.github.repo}/actions/runs?created=>=${startOfMonth.toISOString()}`,
        { 
          'Authorization': `Bearer ${this.services.github.token}`,
          'Accept': 'application/vnd.github+json'
        }
      );
      
      // Calculate total runtime minutes
      let totalMinutes = 0;
      for (const run of (runs?.workflow_runs || [])) {
        const duration = run.run_duration_ms / 60000; // Convert to minutes
        totalMinutes += duration * (run.run_attempt || 1);
      }
      
      // First 2000 minutes are free
      const billableMinutes = Math.max(0, totalMinutes - 2000);
      const cost = billableMinutes * 0.008; // $0.008 per minute
      
      this.costs.github = {
        name: 'GitHub Actions',
        cost,
        breakdown: {
          billableMinutes
        },
        metrics: {
          totalMinutes,
          runCount: runs?.workflow_runs?.length || 0
        }
      };
      
      // Check for optimization
      if (totalMinutes > 3000) {
        this.recommendations.push({
          service: 'GitHub Actions',
          action: 'Optimize workflow caching and parallelization',
          estimatedSavings: cost * 0.3 // Estimate 30% reduction
        });
      }
    } catch (error) {
      console.error('Error fetching GitHub costs:', error.message);
      this.costs.github = { name: 'GitHub Actions', cost: 50, estimated: true };
    }
  }
  
  calculateTotals() {
    let total = 0;
    const services = [];
    
    for (const [key, service] of Object.entries(this.costs)) {
      total += service.cost;
      services.push({
        name: service.name,
        cost: service.cost.toFixed(2),
        percentage: 0, // Will calculate after total
        breakdown: service.breakdown,
        metrics: service.metrics,
        estimated: service.estimated || false
      });
    }
    
    // Calculate percentages
    services.forEach(service => {
      service.percentage = ((parseFloat(service.cost) / total) * 100).toFixed(1);
    });
    
    this.totalMonthlyCost = total.toFixed(2);
    this.services = services;
  }
  
  checkAlerts() {
    // Check for cost threshold violations
    const thresholds = {
      cloudflare: 500,
      neon: 800,
      upstash: 200,
      github: 150
    };
    
    for (const [service, data] of Object.entries(this.costs)) {
      if (data.cost > thresholds[service]) {
        this.alerts.push({
          service: data.name,
          type: 'threshold_exceeded',
          message: `${data.name} costs ($${data.cost.toFixed(2)}) exceed threshold ($${thresholds[service]})`,
          severity: data.cost > thresholds[service] * 1.5 ? 'critical' : 'warning'
        });
      }
    }
    
    // Check for rapid cost increase (would need historical data)
    // Placeholder for now
    if (this.totalMonthlyCost > 1500) {
      this.alerts.push({
        type: 'total_cost_high',
        message: `Total monthly cost ($${this.totalMonthlyCost}) is above target`,
        severity: 'warning'
      });
    }
  }
  
  generateRecommendations() {
    // Add general recommendations based on cost analysis
    
    // Cloudflare optimizations
    if (this.costs.cloudflare?.metrics?.requests > 20000000) {
      this.recommendations.push({
        service: 'Cloudflare',
        action: 'Enable more aggressive caching to reduce Worker invocations',
        estimatedSavings: this.costs.cloudflare.cost * 0.2
      });
    }
    
    // Neon optimizations
    if (this.costs.neon?.metrics?.computeHours > 500) {
      this.recommendations.push({
        service: 'Neon',
        action: 'Enable auto-suspend for development branches',
        estimatedSavings: 100
      });
    }
    
    // Redis optimizations
    if (this.costs.upstash?.metrics?.storageGB > 2) {
      this.recommendations.push({
        service: 'Upstash',
        action: 'Implement aggressive key expiry policies',
        estimatedSavings: 30
      });
    }
    
    // Calculate total potential savings
    this.potentialSavings = this.recommendations
      .reduce((sum, rec) => sum + rec.estimatedSavings, 0)
      .toFixed(2);
  }
  
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalMonthlyCost: parseFloat(this.totalMonthlyCost),
      potentialSavings: parseFloat(this.potentialSavings),
      services: this.services,
      alerts: this.alerts,
      recommendations: this.recommendations,
      summary: {
        mostExpensive: this.services.sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost))[0].name,
        alertCount: this.alerts.length,
        recommendationCount: this.recommendations.length
      }
    };
    
    // Output as JSON
    console.log(JSON.stringify(report, null, 2));
  }
  
  async makeRequest(url, headers) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'CostAnalyzer/1.0',
          ...headers
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  }
}

// Run the analyzer
const analyzer = new CostAnalyzer();
analyzer.analyze().catch(console.error);