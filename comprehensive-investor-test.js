#!/usr/bin/env node

// Comprehensive Investor Portal Test Suite
// Tests all API endpoints, authentication, and functionality

const API_BASE = 'http://localhost:8001';
const DEMO_CREDENTIALS = {
    email: 'sarah.investor@demo.com',
    password: 'Demo123'
};

let currentToken = null;
let testResults = [];

class InvestorPortalTester {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.successes = [];
        this.totalTests = 0;
        this.passedTests = 0;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        console.log(logEntry);
        
        testResults.push({ timestamp, message, type });
        
        switch(type) {
            case 'error':
                this.errors.push(message);
                break;
            case 'warning':
                this.warnings.push(message);
                break;
            case 'success':
                this.successes.push(message);
                this.passedTests++;
                break;
        }
        this.totalTests++;
    }

    async makeAPICall(endpoint, method = 'GET', data = null, requireAuth = false) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (requireAuth && currentToken) {
                headers['Authorization'] = `Bearer ${currentToken}`;
            }

            const config = {
                method,
                headers
            };

            if (data) {
                config.body = JSON.stringify(data);
            }

            const response = await fetch(`${API_BASE}${endpoint}`, config);
            let responseData;
            
            try {
                responseData = await response.json();
            } catch (e) {
                responseData = { error: 'Invalid JSON response', rawText: await response.text() };
            }
            
            return {
                status: response.status,
                data: responseData,
                success: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            };
        } catch (error) {
            return {
                status: 0,
                data: { error: error.message },
                success: false,
                networkError: true
            };
        }
    }

    async testLogin() {
        this.log('Testing Investor Login...', 'info');
        
        try {
            const result = await this.makeAPICall('/api/auth/investor/login', 'POST', DEMO_CREDENTIALS);
            
            if (result.success && result.data.token) {
                currentToken = result.data.token;
                this.log(`Login successful! User: ${result.data.user.username} (${result.data.user.companyName})`, 'success');
                this.log(`Token received: ${currentToken.substring(0, 50)}...`, 'info');
                
                // Verify token structure
                const tokenParts = currentToken.split('.');
                if (tokenParts.length !== 3) {
                    this.log('Token format invalid - not a proper JWT', 'warning');
                }
                
                return true;
            } else {
                this.log(`Login failed: ${result.data.message || 'Unknown error'} (Status: ${result.status})`, 'error');
                if (result.data.details) {
                    this.log(`Details: ${JSON.stringify(result.data.details)}`, 'error');
                }
                return false;
            }
        } catch (error) {
            this.log(`Login error: ${error.message}`, 'error');
            return false;
        }
    }

    async testCoreEndpoints() {
        this.log('Testing core API endpoints...', 'info');
        
        const coreEndpoints = [
            { path: '/api/pitches', method: 'GET', name: 'Get All Pitches', critical: true },
            { path: '/api/pitches/search?query=movie', method: 'GET', name: 'Search Pitches' },
            { path: '/api/pitches/featured', method: 'GET', name: 'Featured Pitches' },
            { path: '/api/genres', method: 'GET', name: 'Get Genres', critical: true },
            { path: '/api/dashboard/stats', method: 'GET', name: 'Dashboard Stats', critical: true },
            { path: '/api/dashboard/recent-pitches', method: 'GET', name: 'Recent Pitches' },
            { path: '/api/dashboard/trending', method: 'GET', name: 'Trending Pitches' }
        ];

        for (const endpoint of coreEndpoints) {
            this.log(`Testing ${endpoint.name} (${endpoint.method} ${endpoint.path})...`, 'info');
            
            const result = await this.makeAPICall(endpoint.path, endpoint.method, null, true);
            
            if (result.networkError) {
                this.log(`Network error for ${endpoint.name}: ${result.data.error}`, 'error');
            } else if (result.success) {
                this.log(`${endpoint.name}: Success (${result.status})`, 'success');
                
                // Check response structure
                if (result.data && typeof result.data === 'object') {
                    if (Array.isArray(result.data)) {
                        this.log(`  → Returned ${result.data.length} items`, 'info');
                    } else if (result.data.data && Array.isArray(result.data.data)) {
                        this.log(`  → Returned ${result.data.data.length} items`, 'info');
                    }
                } else {
                    this.log(`  → Unexpected response format`, 'warning');
                }
            } else {
                const severity = endpoint.critical ? 'error' : 'warning';
                this.log(`${endpoint.name}: Failed (${result.status}) - ${result.data.message || result.data.error || 'Unknown error'}`, severity);
                
                if (result.status === 401) {
                    this.log(`  → Authentication issue detected`, 'error');
                } else if (result.status === 404) {
                    this.log(`  → Endpoint not found`, 'error');
                } else if (result.status === 500) {
                    this.log(`  → Server error`, 'error');
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async testInvestorSpecificEndpoints() {
        this.log('Testing investor-specific endpoints...', 'info');
        
        const investorEndpoints = [
            { path: '/api/investor/portfolio', method: 'GET', name: 'Investment Portfolio' },
            { path: '/api/investor/saved-pitches', method: 'GET', name: 'Saved Pitches' },
            { path: '/api/investor/followed-creators', method: 'GET', name: 'Followed Creators' },
            { path: '/api/investor/investment-history', method: 'GET', name: 'Investment History' },
            { path: '/api/investor/nda-requests', method: 'GET', name: 'NDA Requests' },
            { path: '/api/investor/analytics', method: 'GET', name: 'Investment Analytics' },
            { path: '/api/investor/recommendations', method: 'GET', name: 'Investment Recommendations' },
            { path: '/api/investor/watchlist', method: 'GET', name: 'Investment Watchlist' }
        ];

        for (const endpoint of investorEndpoints) {
            this.log(`Testing ${endpoint.name} (${endpoint.method} ${endpoint.path})...`, 'info');
            
            const result = await this.makeAPICall(endpoint.path, endpoint.method, null, true);
            
            if (result.success) {
                this.log(`${endpoint.name}: Success (${result.status})`, 'success');
            } else {
                this.log(`${endpoint.name}: Failed (${result.status}) - ${result.data.message || result.data.error || 'Unknown error'}`, 'warning');
                
                // Check if endpoint exists but returns expected empty data
                if (result.status === 404) {
                    this.log(`  → Endpoint not implemented yet`, 'warning');
                } else if (result.status === 200 && (!result.data || (Array.isArray(result.data) && result.data.length === 0))) {
                    this.log(`  → Returns empty data (expected for new user)`, 'info');
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async testUserManagementEndpoints() {
        this.log('Testing user management endpoints...', 'info');
        
        const userEndpoints = [
            { path: '/api/user/profile', method: 'GET', name: 'User Profile', critical: true },
            { path: '/api/user/preferences', method: 'GET', name: 'User Preferences' },
            { path: '/api/notifications', method: 'GET', name: 'Notifications' },
            { path: '/api/user/settings', method: 'GET', name: 'User Settings' }
        ];

        for (const endpoint of userEndpoints) {
            this.log(`Testing ${endpoint.name} (${endpoint.method} ${endpoint.path})...`, 'info');
            
            const result = await this.makeAPICall(endpoint.path, endpoint.method, null, true);
            
            if (result.success) {
                this.log(`${endpoint.name}: Success (${result.status})`, 'success');
                
                // Validate user profile data
                if (endpoint.name === 'User Profile' && result.data) {
                    const user = result.data.user || result.data;
                    if (user.email === DEMO_CREDENTIALS.email) {
                        this.log(`  → Profile data matches login credentials`, 'success');
                    } else {
                        this.log(`  → Profile data mismatch: expected ${DEMO_CREDENTIALS.email}, got ${user.email}`, 'error');
                    }
                }
            } else {
                const severity = endpoint.critical ? 'error' : 'warning';
                this.log(`${endpoint.name}: Failed (${result.status}) - ${result.data.message || result.data.error || 'Unknown error'}`, severity);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async testSearchAndFilterEndpoints() {
        this.log('Testing search and filter functionality...', 'info');
        
        const searchTests = [
            { path: '/api/pitches/search?query=action', name: 'Search by genre' },
            { path: '/api/pitches/search?query=movie', name: 'Search by keyword' },
            { path: '/api/pitches/search?budget_min=100000', name: 'Filter by minimum budget' },
            { path: '/api/pitches/search?budget_max=1000000', name: 'Filter by maximum budget' },
            { path: '/api/pitches/search?genre=action', name: 'Filter by genre' },
            { path: '/api/pitches/search?status=active', name: 'Filter by status' },
            { path: '/api/pitches/search?sort=created_at&order=desc', name: 'Sort by date' },
            { path: '/api/pitches/search?sort=budget&order=asc', name: 'Sort by budget' }
        ];

        for (const test of searchTests) {
            this.log(`Testing ${test.name} (${test.path})...`, 'info');
            
            const result = await this.makeAPICall(test.path, 'GET', null, true);
            
            if (result.success) {
                this.log(`${test.name}: Success (${result.status})`, 'success');
                
                const itemCount = Array.isArray(result.data) ? result.data.length : 
                                 (result.data.data && Array.isArray(result.data.data)) ? result.data.data.length : 'unknown';
                this.log(`  → Returned ${itemCount} results`, 'info');
            } else {
                this.log(`${test.name}: Failed (${result.status}) - ${result.data.message || result.data.error || 'Unknown error'}`, 'warning');
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async testNDAWorkflow() {
        this.log('Testing NDA workflow...', 'info');
        
        // First get available pitches
        const pitchesResult = await this.makeAPICall('/api/pitches', 'GET', null, true);
        
        if (!pitchesResult.success) {
            this.log('Cannot test NDA workflow: Failed to get pitches', 'error');
            return;
        }

        const pitches = Array.isArray(pitchesResult.data) ? pitchesResult.data : pitchesResult.data.data || [];
        
        if (pitches.length === 0) {
            this.log('Cannot test NDA workflow: No pitches available', 'warning');
            return;
        }

        const testPitch = pitches[0];
        this.log(`Testing NDA workflow with pitch: ${testPitch.title || testPitch.id}`, 'info');

        // Test NDA request
        const ndaRequestResult = await this.makeAPICall('/api/nda/request', 'POST', {
            pitchId: testPitch.id,
            message: 'Test NDA request from automated testing'
        }, true);

        if (ndaRequestResult.success) {
            this.log('NDA request: Success', 'success');
        } else {
            this.log(`NDA request: Failed (${ndaRequestResult.status}) - ${ndaRequestResult.data.message || 'Unknown error'}`, 'warning');
        }

        // Test getting NDA status
        const ndaStatusResult = await this.makeAPICall(`/api/nda/status/${testPitch.id}`, 'GET', null, true);
        
        if (ndaStatusResult.success) {
            this.log('NDA status check: Success', 'success');
        } else {
            this.log(`NDA status check: Failed (${ndaStatusResult.status})`, 'warning');
        }

        // Test getting user's NDAs
        const userNdasResult = await this.makeAPICall('/api/investor/nda-requests', 'GET', null, true);
        
        if (userNdasResult.success) {
            this.log('User NDAs: Success', 'success');
        } else {
            this.log(`User NDAs: Failed (${userNdasResult.status})`, 'warning');
        }
    }

    async testErrorHandling() {
        this.log('Testing error handling...', 'info');
        
        const errorTests = [
            { path: '/api/nonexistent', expected: 404, name: 'Non-existent endpoint' },
            { path: '/api/pitches/99999', expected: 404, name: 'Non-existent pitch' },
            { path: '/api/pitches', method: 'POST', data: {}, expected: 400, name: 'Invalid POST data' },
            { path: '/api/pitches/search?query=', expected: [200, 400], name: 'Empty search query' }
        ];

        for (const test of errorTests) {
            this.log(`Testing ${test.name}...`, 'info');
            
            const result = await this.makeAPICall(test.path, test.method || 'GET', test.data, true);
            
            const expectedStatuses = Array.isArray(test.expected) ? test.expected : [test.expected];
            
            if (expectedStatuses.includes(result.status)) {
                this.log(`${test.name}: Correctly returned ${result.status}`, 'success');
            } else {
                this.log(`${test.name}: Expected ${test.expected}, got ${result.status}`, 'warning');
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async runComprehensiveTest() {
        console.log('🚀 Starting Comprehensive Investor Portal Test Suite');
        console.log('=' .repeat(80));
        
        try {
            // Test 1: Authentication
            this.log('🔐 PHASE 1: Authentication Testing', 'info');
            const loginSuccess = await this.testLogin();
            if (!loginSuccess) {
                this.log('❌ Test suite aborted: Login failed', 'error');
                return this.generateReport();
            }

            // Test 2: Core endpoints
            this.log('📊 PHASE 2: Core Endpoints Testing', 'info');
            await this.testCoreEndpoints();

            // Test 3: Investor-specific endpoints
            this.log('💼 PHASE 3: Investor-Specific Endpoints Testing', 'info');
            await this.testInvestorSpecificEndpoints();

            // Test 4: User management
            this.log('👤 PHASE 4: User Management Testing', 'info');
            await this.testUserManagementEndpoints();

            // Test 5: Search and filters
            this.log('🔍 PHASE 5: Search and Filter Testing', 'info');
            await this.testSearchAndFilterEndpoints();

            // Test 6: NDA workflow
            this.log('📋 PHASE 6: NDA Workflow Testing', 'info');
            await this.testNDAWorkflow();

            // Test 7: Error handling
            this.log('⚠️ PHASE 7: Error Handling Testing', 'info');
            await this.testErrorHandling();

            // Generate final report
            return this.generateReport();

        } catch (error) {
            this.log(`❌ Test suite error: ${error.message}`, 'error');
            return this.generateReport();
        }
    }

    generateReport() {
        console.log('\n' + '=' .repeat(80));
        console.log('🏁 COMPREHENSIVE TEST REPORT');
        console.log('=' .repeat(80));
        
        const successRate = this.totalTests > 0 ? (this.passedTests / this.totalTests * 100).toFixed(1) : 0;
        
        console.log(`📊 Overall Results:`);
        console.log(`   Total Tests: ${this.totalTests}`);
        console.log(`   Passed: ${this.passedTests}`);
        console.log(`   Failed: ${this.totalTests - this.passedTests}`);
        console.log(`   Success Rate: ${successRate}%`);
        
        console.log(`\n❌ Critical Errors (${this.errors.length}):`);
        this.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
        
        console.log(`\n⚠️ Warnings (${this.warnings.length}):`);
        this.warnings.forEach((warning, index) => {
            console.log(`   ${index + 1}. ${warning}`);
        });
        
        console.log(`\n✅ Key Successes (${this.successes.length}):`);
        this.successes.slice(0, 10).forEach((success, index) => {
            console.log(`   ${index + 1}. ${success}`);
        });
        
        if (this.successes.length > 10) {
            console.log(`   ... and ${this.successes.length - 10} more successes`);
        }

        // Recommendations
        console.log('\n🔧 RECOMMENDATIONS:');
        
        if (this.errors.length > 0) {
            console.log('   • Address critical errors immediately');
            console.log('   • Verify backend services are running correctly');
            console.log('   • Check database connectivity and schema');
        }
        
        if (this.warnings.length > 0) {
            console.log('   • Review warning items for potential improvements');
            console.log('   • Implement missing investor-specific features');
            console.log('   • Enhance error handling and user feedback');
        }
        
        console.log('   • Test frontend navigation manually');
        console.log('   • Verify WebSocket functionality');
        console.log('   • Test responsive design on different devices');
        
        console.log('\n' + '=' .repeat(80));
        
        return {
            totalTests: this.totalTests,
            passedTests: this.passedTests,
            successRate: parseFloat(successRate),
            errors: this.errors,
            warnings: this.warnings,
            successes: this.successes
        };
    }
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
    // Node.js environment
    const fetch = require('node-fetch');
    global.fetch = fetch;
    
    const tester = new InvestorPortalTester();
    tester.runComprehensiveTest().then(report => {
        process.exit(report.errors.length > 0 ? 1 : 0);
    });
}

module.exports = InvestorPortalTester;