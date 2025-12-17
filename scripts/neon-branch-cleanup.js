#!/usr/bin/env node

/**
 * Neon Branch Cleanup Script
 * Automatically deletes old preview and inactive branches to reduce costs
 */

const https = require('https');

class NeonBranchCleaner {
  constructor() {
    this.apiKey = process.env.NEON_API_KEY;
    this.projectId = process.env.NEON_PROJECT_ID;
    this.apiEndpoint = 'https://console.neon.tech/api/v2';
    
    if (!this.apiKey || !this.projectId) {
      throw new Error('NEON_API_KEY and NEON_PROJECT_ID must be set');
    }
    
    this.deletedBranches = [];
    this.keptBranches = [];
    this.errors = [];
  }
  
  async cleanup() {
    console.log('Starting Neon branch cleanup...');
    
    try {
      // Fetch all branches
      const branches = await this.listBranches();
      console.log(`Found ${branches.length} branches`);
      
      // Analyze and clean up branches
      for (const branch of branches) {
        await this.processBranch(branch);
      }
      
      // Generate summary
      this.generateSummary();
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      process.exit(1);
    }
  }
  
  async listBranches() {
    const response = await this.makeRequest(
      `GET`,
      `/projects/${this.projectId}/branches`
    );
    
    return response.branches || [];
  }
  
  async processBranch(branch) {
    // Never delete main/primary branches
    if (branch.primary || branch.name === 'main' || branch.name === 'master') {
      console.log(`Keeping primary branch: ${branch.name}`);
      this.keptBranches.push(branch.name);
      return;
    }
    
    const now = Date.now();
    const createdAt = new Date(branch.created_at).getTime();
    const updatedAt = new Date(branch.updated_at).getTime();
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    const idleHours = (now - updatedAt) / (1000 * 60 * 60);
    
    let shouldDelete = false;
    let reason = '';
    
    // Cleanup rules
    if (branch.name.includes('preview-') && ageHours > 4) {
      // Preview branches older than 4 hours
      shouldDelete = true;
      reason = `Preview branch older than 4 hours (${ageHours.toFixed(1)}h)`;
    } else if (branch.name.includes('pr-') && ageHours > 8) {
      // PR branches older than 8 hours
      shouldDelete = true;
      reason = `PR branch older than 8 hours (${ageHours.toFixed(1)}h)`;
    } else if (branch.name.includes('feature-') && idleHours > 24) {
      // Feature branches idle for more than 24 hours
      shouldDelete = true;
      reason = `Feature branch idle for ${idleHours.toFixed(1)} hours`;
    } else if (branch.name.includes('test-') && ageHours > 2) {
      // Test branches older than 2 hours
      shouldDelete = true;
      reason = `Test branch older than 2 hours (${ageHours.toFixed(1)}h)`;
    } else if (!branch.name.includes('production') && !branch.name.includes('staging') && idleHours > 48) {
      // Any non-production/staging branch idle for 48+ hours
      shouldDelete = true;
      reason = `Branch idle for ${idleHours.toFixed(1)} hours`;
    }
    
    if (shouldDelete) {
      try {
        await this.deleteBranch(branch.id, branch.name);
        console.log(`✓ Deleted ${branch.name}: ${reason}`);
        this.deletedBranches.push({
          name: branch.name,
          reason,
          ageHours,
          idleHours,
          computeSavings: this.estimateComputeSavings(ageHours)
        });
      } catch (error) {
        console.error(`✗ Failed to delete ${branch.name}: ${error.message}`);
        this.errors.push({
          branch: branch.name,
          error: error.message
        });
      }
    } else {
      console.log(`Keeping ${branch.name} (age: ${ageHours.toFixed(1)}h, idle: ${idleHours.toFixed(1)}h)`);
      this.keptBranches.push(branch.name);
    }
  }
  
  async deleteBranch(branchId, branchName) {
    // First, check if there are any active endpoints
    const endpoints = await this.makeRequest(
      'GET',
      `/projects/${this.projectId}/branches/${branchId}/endpoints`
    );
    
    // Delete endpoints first if they exist
    if (endpoints && endpoints.endpoints) {
      for (const endpoint of endpoints.endpoints) {
        await this.makeRequest(
          'DELETE',
          `/projects/${this.projectId}/endpoints/${endpoint.id}`
        );
      }
    }
    
    // Now delete the branch
    await this.makeRequest(
      'DELETE',
      `/projects/${this.projectId}/branches/${branchId}`
    );
  }
  
  estimateComputeSavings(hoursActive) {
    // Estimate savings based on compute hours
    // Assuming 0.25 vCPU at $0.09/hour
    const computeHourCost = 0.09 * 0.25;
    return (hoursActive * computeHourCost).toFixed(2);
  }
  
  generateSummary() {
    const totalSavings = this.deletedBranches
      .reduce((sum, b) => sum + parseFloat(b.computeSavings), 0)
      .toFixed(2);
    
    console.log('\n=== Branch Cleanup Summary ===');
    console.log(`Deleted: ${this.deletedBranches.length} branches`);
    console.log(`Kept: ${this.keptBranches.length} branches`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Estimated savings: $${totalSavings}`);
    
    if (this.deletedBranches.length > 0) {
      console.log('\nDeleted branches:');
      this.deletedBranches.forEach(b => {
        console.log(`  - ${b.name}: ${b.reason} (saved ~$${b.computeSavings})`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach(e => {
        console.log(`  - ${e.branch}: ${e.error}`);
      });
    }
    
    // Output for GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::set-output name=deleted-count::${this.deletedBranches.length}`);
      console.log(`::set-output name=savings::${totalSavings}`);
    }
  }
  
  async makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'console.neon.tech',
        path: `/api/v2${path}`,
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch (e) {
              resolve(null);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }
}

// Run the cleaner
const cleaner = new NeonBranchCleaner();
cleaner.cleanup().catch(console.error);