const express = require('express');
const client = require('prom-client');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 9199;

// Environment variables
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const WORKER_NAME = process.env.WORKER_NAME || 'pitchey-production';
const SCRAPE_INTERVAL = process.env.SCRAPE_INTERVAL || '60';

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    console.error('Missing required environment variables: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID');
    process.exit(1);
}

// Create a Registry
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
    app: 'pitchey',
    environment: 'production'
});

// Collect default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const workerRequestsTotal = new client.Gauge({
    name: 'cloudflare_worker_requests_total',
    help: 'Total number of requests to Cloudflare Worker',
    labelNames: ['worker', 'status_class']
});

const workerRequestDuration = new client.Histogram({
    name: 'cloudflare_worker_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['worker'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const workerMemoryUsage = new client.Gauge({
    name: 'cloudflare_worker_memory_usage_bytes',
    help: 'Memory usage of Cloudflare Worker',
    labelNames: ['worker']
});

const workerCPUTime = new client.Gauge({
    name: 'cloudflare_worker_cpu_time_milliseconds',
    help: 'CPU time used by Cloudflare Worker',
    labelNames: ['worker']
});

const workerErrors = new client.Gauge({
    name: 'cloudflare_worker_errors_total',
    help: 'Total number of worker errors',
    labelNames: ['worker', 'error_type']
});

const zoneRequestsTotal = new client.Gauge({
    name: 'cloudflare_zone_requests_total',
    help: 'Total requests to Cloudflare zone',
    labelNames: ['zone']
});

const zoneBandwidth = new client.Gauge({
    name: 'cloudflare_zone_bandwidth_bytes',
    help: 'Bandwidth usage for Cloudflare zone',
    labelNames: ['zone', 'direction']
});

const cacheHitRate = new client.Gauge({
    name: 'cloudflare_cache_hit_rate_percent',
    help: 'Cache hit rate percentage',
    labelNames: ['zone', 'worker']
});

const edgeResponseStatus = new client.Gauge({
    name: 'cloudflare_edge_response_status_total',
    help: 'Response status codes from edge',
    labelNames: ['zone', 'status_code']
});

const threatsStopped = new client.Gauge({
    name: 'cloudflare_threats_stopped_total',
    help: 'Total threats stopped by Cloudflare',
    labelNames: ['zone', 'threat_type']
});

const pagesBuilds = new client.Gauge({
    name: 'cloudflare_pages_builds_total',
    help: 'Total Cloudflare Pages builds',
    labelNames: ['project', 'status']
});

// Register metrics
register.registerMetric(workerRequestsTotal);
register.registerMetric(workerRequestDuration);
register.registerMetric(workerMemoryUsage);
register.registerMetric(workerCPUTime);
register.registerMetric(workerErrors);
register.registerMetric(zoneRequestsTotal);
register.registerMetric(zoneBandwidth);
register.registerMetric(cacheHitRate);
register.registerMetric(edgeResponseStatus);
register.registerMetric(threatsStopped);
register.registerMetric(pagesBuilds);

// Cloudflare API client
class CloudflareAPI {
    constructor(apiToken, accountId, zoneId) {
        this.apiToken = apiToken;
        this.accountId = accountId;
        this.zoneId = zoneId;
        this.baseURL = 'https://api.cloudflare.com/client/v4';
        
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
    }

    async makeRequest(endpoint, params = {}) {
        try {
            const response = await this.client.get(endpoint, { params });
            if (response.data.success) {
                return response.data.result;
            } else {
                console.error('Cloudflare API error:', response.data.errors);
                return null;
            }
        } catch (error) {
            console.error(`Error making request to ${endpoint}:`, error.message);
            return null;
        }
    }

    async getWorkerMetrics(workerName, since = '2023-01-01T00:00:00Z') {
        const endpoint = `/accounts/${this.accountId}/workers/scripts/${workerName}/metrics`;
        return await this.makeRequest(endpoint, {
            since: since,
            until: new Date().toISOString()
        });
    }

    async getZoneAnalytics(since = '2023-01-01T00:00:00Z') {
        if (!this.zoneId) return null;
        
        const endpoint = `/zones/${this.zoneId}/analytics/dashboard`;
        return await this.makeRequest(endpoint, {
            since: since,
            until: new Date().toISOString()
        });
    }

    async getWorkerAnalytics(workerName) {
        const endpoint = `/accounts/${this.accountId}/workers/scripts/${workerName}/usage-model`;
        return await this.makeRequest(endpoint);
    }

    async getPagesBuilds(projectName) {
        const endpoint = `/accounts/${this.accountId}/pages/projects/${projectName}/deployments`;
        return await this.makeRequest(endpoint);
    }

    async getAccountAnalytics() {
        const endpoint = `/accounts/${this.accountId}/analytics/dashboard`;
        return await this.makeRequest(endpoint);
    }
}

// Initialize Cloudflare API client
const cloudflareAPI = new CloudflareAPI(CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID);

// Data collection functions
async function collectWorkerMetrics() {
    console.log(`Collecting worker metrics for ${WORKER_NAME}...`);
    
    try {
        // Get metrics for the last hour
        const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
        const metrics = await cloudflareAPI.getWorkerMetrics(WORKER_NAME, oneHourAgo);
        
        if (metrics && metrics.length > 0) {
            // Process the latest metrics
            const latest = metrics[metrics.length - 1];
            
            // Update request metrics
            if (latest.requests) {
                workerRequestsTotal.set(
                    { worker: WORKER_NAME, status_class: '2xx' },
                    latest.requests.success || 0
                );
                workerRequestsTotal.set(
                    { worker: WORKER_NAME, status_class: '4xx' },
                    latest.requests.clientError || 0
                );
                workerRequestsTotal.set(
                    { worker: WORKER_NAME, status_class: '5xx' },
                    latest.requests.serverError || 0
                );
            }
            
            // Update duration metrics
            if (latest.duration && latest.duration.average) {
                workerRequestDuration.observe(
                    { worker: WORKER_NAME },
                    latest.duration.average / 1000 // Convert ms to seconds
                );
            }
            
            // Update resource usage
            if (latest.memoryUsage) {
                workerMemoryUsage.set(
                    { worker: WORKER_NAME },
                    latest.memoryUsage.average || 0
                );
            }
            
            if (latest.cpuTime) {
                workerCPUTime.set(
                    { worker: WORKER_NAME },
                    latest.cpuTime.average || 0
                );
            }
            
            // Update error metrics
            if (latest.errors) {
                workerErrors.set(
                    { worker: WORKER_NAME, error_type: 'script' },
                    latest.errors.script || 0
                );
                workerErrors.set(
                    { worker: WORKER_NAME, error_type: 'timeout' },
                    latest.errors.timeout || 0
                );
                workerErrors.set(
                    { worker: WORKER_NAME, error_type: 'internal' },
                    latest.errors.internal || 0
                );
            }
            
            console.log('Worker metrics updated successfully');
        } else {
            console.warn('No worker metrics available');
        }
        
    } catch (error) {
        console.error('Error collecting worker metrics:', error.message);
    }
}

async function collectZoneMetrics() {
    if (!CLOUDFLARE_ZONE_ID) {
        console.log('No zone ID configured, skipping zone metrics');
        return;
    }
    
    console.log('Collecting zone analytics...');
    
    try {
        const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
        const analytics = await cloudflareAPI.getZoneAnalytics(oneHourAgo);
        
        if (analytics) {
            // Update zone request metrics
            if (analytics.totals && analytics.totals.requests) {
                zoneRequestsTotal.set(
                    { zone: CLOUDFLARE_ZONE_ID },
                    analytics.totals.requests.all || 0
                );
            }
            
            // Update bandwidth metrics
            if (analytics.totals && analytics.totals.bandwidth) {
                zoneBandwidth.set(
                    { zone: CLOUDFLARE_ZONE_ID, direction: 'all' },
                    analytics.totals.bandwidth.all || 0
                );
            }
            
            // Update cache hit rate
            if (analytics.totals && analytics.totals.requests) {
                const total = analytics.totals.requests.all || 1;
                const cached = analytics.totals.requests.cached || 0;
                const hitRate = (cached / total) * 100;
                
                cacheHitRate.set(
                    { zone: CLOUDFLARE_ZONE_ID, worker: WORKER_NAME },
                    hitRate
                );
            }
            
            // Update response status metrics
            if (analytics.totals && analytics.totals.requests) {
                const statusCodes = analytics.totals.requests.http_status || {};
                Object.entries(statusCodes).forEach(([status, count]) => {
                    edgeResponseStatus.set(
                        { zone: CLOUDFLARE_ZONE_ID, status_code: status },
                        count || 0
                    );
                });
            }
            
            // Update threat metrics
            if (analytics.totals && analytics.totals.threats) {
                Object.entries(analytics.totals.threats).forEach(([threatType, count]) => {
                    threatsStopped.set(
                        { zone: CLOUDFLARE_ZONE_ID, threat_type: threatType },
                        count || 0
                    );
                });
            }
            
            console.log('Zone metrics updated successfully');
        } else {
            console.warn('No zone analytics available');
        }
        
    } catch (error) {
        console.error('Error collecting zone metrics:', error.message);
    }
}

async function collectPagesMetrics() {
    console.log('Collecting Pages build metrics...');
    
    try {
        const builds = await cloudflareAPI.getPagesBuilds('pitchey');
        
        if (builds && builds.length > 0) {
            // Count builds by status
            const buildCounts = builds.reduce((acc, build) => {
                const status = build.latest_stage?.status || 'unknown';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});
            
            // Update metrics
            Object.entries(buildCounts).forEach(([status, count]) => {
                pagesBuilds.set(
                    { project: 'pitchey', status },
                    count
                );
            });
            
            console.log('Pages metrics updated successfully');
        }
        
    } catch (error) {
        console.error('Error collecting Pages metrics:', error.message);
    }
}

// Collect all metrics
async function collectMetrics() {
    console.log('Starting metrics collection...');
    const startTime = Date.now();
    
    await Promise.allSettled([
        collectWorkerMetrics(),
        collectZoneMetrics(),
        collectPagesMetrics()
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`Metrics collection completed in ${duration}ms`);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        worker: WORKER_NAME,
        account_id: CLOUDFLARE_ACCOUNT_ID,
        zone_id: CLOUDFLARE_ZONE_ID || 'not configured'
    });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        console.error('Error serving metrics:', error);
        res.status(500).send('Error generating metrics');
    }
});

// Debug endpoint for raw Cloudflare data
app.get('/debug/worker', async (req, res) => {
    try {
        const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
        const metrics = await cloudflareAPI.getWorkerMetrics(WORKER_NAME, oneHourAgo);
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/debug/zone', async (req, res) => {
    try {
        const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
        const analytics = await cloudflareAPI.getZoneAnalytics(oneHourAgo);
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Cloudflare Exporter listening on port ${port}`);
    console.log(`Worker: ${WORKER_NAME}`);
    console.log(`Account ID: ${CLOUDFLARE_ACCOUNT_ID}`);
    console.log(`Zone ID: ${CLOUDFLARE_ZONE_ID || 'not configured'}`);
    console.log(`Scrape interval: ${SCRAPE_INTERVAL}s`);
    
    // Initial metrics collection
    collectMetrics();
});

// Schedule periodic metrics collection
cron.schedule(`*/${SCRAPE_INTERVAL} * * * * *`, () => {
    collectMetrics();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    process.exit(0);
});
