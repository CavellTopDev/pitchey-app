/**
 * Modular Pitchey Server - Optimized for Deno Deploy
 * Refactored from 516KB monolithic file to modular architecture
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SimpleRouter } from "./src/router/router.ts";
import { telemetry } from "./src/utils/telemetry.ts";
import { validateEnvironment } from "./src/utils/env-validation.ts";
import { getCorsHeaders, getSecurityHeaders } from "./src/utils/response.ts";
import { ErrorHandler } from "./src/middleware/error-handler.ts";
import { MonitoringService } from "./src/services/monitoring.service.ts";

// Import route modules
import * as authRoutes from "./src/routes/auth.ts";
import * as systemRoutes from "./src/routes/system.ts";
import * as pitchRoutes from "./src/routes/pitches.ts";
import * as userRoutes from "./src/routes/users.ts";
import * as analyticsRoutes from "./src/routes/analytics.ts";
import * as ndaRoutes from "./src/routes/ndas.ts";
import * as paymentRoutes from "./src/routes/payments.ts";
import * as creatorRoutes from "./src/routes/creator.ts";
import * as investorRoutes from "./src/routes/investor.ts";
import * as productionRoutes from "./src/routes/production.ts";
import * as messagingRoutes from "./src/routes/messaging.ts";
import * as websocketRoutes from "./src/routes/websocket.ts";
import * as websocketEnhancedRoutes from "./src/routes/websocket-enhanced.ts";
import * as monitoringRoutes from "./src/routes/monitoring.ts";
import * as documentationRoutes from "./src/routes/documentation.ts";
import * as versionRoutes from "./src/routes/api-versions.ts";
import * as performanceRoutes from "./src/routes/performance.ts";
import * as rateLimitRoutes from "./src/routes/rate-limit.ts";
import * as databaseOptimizerRoutes from "./src/routes/database-optimizer.ts";
import * as errorTrackingRoutes from "./src/routes/error-tracking.ts";
import * as apiDocumentationRoutes from "./src/routes/api-documentation.ts";
import * as businessIntelligenceRoutes from "./src/routes/business-intelligence.ts";
import * as machineLearningRoutes from "./src/routes/machine-learning.ts";
import * as dataScienceRoutes from "./src/routes/data-science.ts";
import * as securityComplianceRoutes from "./src/routes/security-compliance.ts";
import * as distributedComputingRoutes from "./src/routes/distributed-computing.ts";
import * as edgeComputingRoutes from "./src/routes/edge-computing.ts";
import * as automationWorkflowRoutes from "./src/routes/automation-workflow.ts";
import { CacheOptimizationService } from "./src/services/cache-optimization.service.ts";
import { ApiVersioningService } from "./src/middleware/versioning.middleware.ts";
import { PerformanceProfiler } from "./src/services/performance-profiler.service.ts";
import { AdvancedRateLimiter } from "./src/middleware/advanced-rate-limit.middleware.ts";
import { WebSocketClusterService } from "./src/services/websocket-cluster.service.ts";
import { DatabaseOptimizerService } from "./src/services/database-optimizer.service.ts";
import { ErrorTrackingService } from "./src/services/error-tracking.service.ts";
import { ApiDocumentationService } from "./src/services/api-documentation.service.ts";
import { BusinessIntelligenceService } from "./src/services/business-intelligence.service.ts";
import { MachineLearningService } from "./src/services/machine-learning.service.ts";
import { DataScienceService } from "./src/services/data-science.service.ts";
import { SecurityComplianceService } from "./src/services/security-compliance.service.ts";
import { DistributedComputingService } from "./src/services/distributed-computing.service.ts";
import { EdgeComputingService } from "./src/services/edge-computing.service.ts";
import { AutomationWorkflowService } from "./src/services/automation-workflow.service.ts";

// Global start time for uptime calculation
const startTime = Date.now();

// Initialize telemetry system
console.log('🔧 Initializing telemetry system...');
console.log('   SENTRY_DSN:', Deno.env.get("SENTRY_DSN") ? '✅ SET' : '❌ MISSING');
console.log('   DENO_ENV:', Deno.env.get("DENO_ENV") || 'undefined');
console.log('   NODE_ENV:', Deno.env.get("NODE_ENV") || 'undefined');
telemetry.initialize();
console.log('✅ Telemetry initialization complete');

// Validate environment variables at startup
console.log('🔍 Validating environment variables...');
const envConfig = validateEnvironment();
console.log('✅ Environment validation complete');

// Create router
const router = new SimpleRouter();

// Enhanced global unhandled error handlers
addEventListener("unhandledrejection", (event) => {
  console.error("🚨 UNHANDLED PROMISE REJECTION:", event.reason);
  telemetry.logger.error("Unhandled promise rejection", event.reason);
  
  // Track unhandled promise rejection
  ErrorTrackingService.getInstance().trackError(event.reason, {
    route: "global",
    method: "unhandled_rejection",
    environment: Deno.env.get("DENO_ENV") || "unknown"
  });
});

addEventListener("error", (event) => {
  console.error("🚨 UNCAUGHT EXCEPTION:", event.error);
  telemetry.logger.error("Uncaught exception", event.error);
  
  // Track uncaught exception
  ErrorTrackingService.getInstance().trackError(event.error, {
    route: "global", 
    method: "uncaught_exception",
    environment: Deno.env.get("DENO_ENV") || "unknown"
  });
});

// Register routes
console.log('🛣️ Registering routes...');

// System routes
router.get("/api/health", systemRoutes.health);
router.get("/api/version", systemRoutes.version);
router.get("/api/config/all", systemRoutes.config);

// Simple test endpoint
router.get("/api/test/simple", (request, url) => {
  return new Response(JSON.stringify({
    success: true,
    message: "Simple test endpoint works",
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...getCorsHeaders() }
  });
});

// Test ML service import
router.get("/api/test/ml", (request, url) => {
  try {
    // Just test if we can import the service
    const MLService = MachineLearningService;
    return new Response(JSON.stringify({
      success: true,
      message: "MachineLearningService import successful",
      hasGetInstance: typeof MLService.getInstance === 'function',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders() }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders() }
    });
  }
});

// Auth routes
router.post("/api/auth/login", authRoutes.login);
router.post("/api/auth/register", authRoutes.register);
router.get("/api/validate-token", authRoutes.validateToken);
router.get("/api/auth/profile", authRoutes.getProfile);

// Portal-specific auth routes (using same handlers with different paths)
router.post("/api/auth/creator/login", authRoutes.login);
router.post("/api/auth/investor/login", authRoutes.login);
router.post("/api/auth/production/login", authRoutes.login);
router.post("/api/auth/creator/register", authRoutes.register);
router.post("/api/auth/investor/register", authRoutes.register);
router.post("/api/auth/production/register", authRoutes.register);

// Pitch routes
router.get("/api/pitches/public", pitchRoutes.getPublicPitches);
router.get("/api/pitches/search", pitchRoutes.searchPitches);
router.get("/api/pitches/trending", pitchRoutes.getTrendingPitches);
router.get("/api/pitches/newest", pitchRoutes.getNewestPitches);
router.get("/api/pitches/featured", pitchRoutes.getFeaturedPitches);
router.get("/api/pitches/browse", pitchRoutes.browsePitches);
router.get("/api/pitches/:id", pitchRoutes.getPitchById);

// Advanced search routes
router.get("/api/search/advanced", pitchRoutes.advancedSearch);
router.get("/api/search/suggestions", pitchRoutes.getSearchSuggestions);
router.get("/api/search/trending", pitchRoutes.getTrendingSearches);
router.get("/api/search/facets", pitchRoutes.facetedSearch);
router.get("/api/pitches/:id/similar", pitchRoutes.findSimilarPitches);

// User management routes
router.get("/api/user/profile", userRoutes.getUserProfile);
router.put("/api/user/profile", userRoutes.updateUserProfile);
router.get("/api/user/settings", userRoutes.getUserSettings);
router.patch("/api/user/settings", userRoutes.updateUserSettings);
router.get("/api/user/preferences", userRoutes.getUserPreferences);
router.put("/api/user/preferences", userRoutes.updateUserPreferences);
router.get("/api/user/notifications", userRoutes.getUserNotifications);
router.get("/api/search/users", userRoutes.searchUsers);
router.get("/api/users/:id", userRoutes.getUserById);

// Analytics routes
router.get("/api/analytics/user", analyticsRoutes.getUserAnalytics);
router.get("/api/analytics/creator", analyticsRoutes.getCreatorAnalytics);
router.get("/api/analytics/platform", analyticsRoutes.getPlatformAnalytics);
router.get("/api/analytics/investment", analyticsRoutes.getInvestmentAnalytics);

// NDA routes
router.post("/api/nda/request", ndaRoutes.requestNda);
router.post("/api/nda/:id/respond", ndaRoutes.respondToNdaRequest);
router.get("/api/nda/requests", ndaRoutes.getUserNdaRequests);
router.get("/api/nda/:id", ndaRoutes.getNdaById);
router.get("/api/nda/stats", ndaRoutes.getNdaStats);
router.get("/api/nda/status/:pitchId", ndaRoutes.checkNdaStatus);

// Payment routes
router.post("/api/payments/invest", paymentRoutes.createInvestment);
router.get("/api/payments/investments", paymentRoutes.getUserInvestments);
router.get("/api/payments/investments/:id", paymentRoutes.getInvestmentById);
router.get("/api/payments/received", paymentRoutes.getReceivedInvestments);
router.post("/api/payments/webhook", paymentRoutes.handlePaymentWebhook);
router.get("/api/payments/methods", paymentRoutes.getPaymentMethods);
router.get("/api/payments/stats", paymentRoutes.getInvestmentStats);

// Creator dashboard routes
router.get("/api/creator/dashboard", creatorRoutes.getCreatorDashboard);
router.get("/api/creator/pitches", creatorRoutes.getCreatorPitches);
router.post("/api/creator/pitches", creatorRoutes.createPitch);
router.put("/api/creator/pitches/:id", creatorRoutes.updatePitch);
router.delete("/api/creator/pitches/:id", creatorRoutes.deletePitch);
router.get("/api/creator/followers", creatorRoutes.getCreatorFollowers);
router.get("/api/creator/stats", creatorRoutes.getCreatorStats);

// Investor dashboard routes
router.get("/api/investor/dashboard", investorRoutes.getInvestorDashboard);
router.get("/api/investor/portfolio", investorRoutes.getInvestmentPortfolio);
router.get("/api/investor/saved-pitches", investorRoutes.getSavedPitches);
router.post("/api/investor/save-pitch", investorRoutes.savePitch);
router.delete("/api/investor/saved-pitches/:pitchId", investorRoutes.removeSavedPitch);
router.get("/api/investor/nda-requests", investorRoutes.getInvestorNdaRequests);
router.get("/api/investor/notifications", investorRoutes.getInvestorNotifications);
router.patch("/api/investor/notifications/:id/read", investorRoutes.markNotificationRead);
router.get("/api/investor/stats", investorRoutes.getInvestorStats);

// Production company routes
router.get("/api/production/dashboard", productionRoutes.getProductionDashboard);
router.get("/api/production/investments", productionRoutes.getProductionInvestments);
router.patch("/api/production/investments/:id", productionRoutes.updateInvestmentStatus);
router.get("/api/production/pipeline", productionRoutes.getAcquisitionPipeline);
router.get("/api/production/analytics", productionRoutes.getProductionAnalytics);

// Messaging and communications routes
router.get("/api/conversations", messagingRoutes.getUserConversations);
router.get("/api/conversations/:id/messages", messagingRoutes.getConversationMessages);
router.post("/api/conversations/send", messagingRoutes.sendMessage);
router.post("/api/conversations/start", messagingRoutes.startConversation);
router.get("/api/notifications", messagingRoutes.getUserNotifications);
router.patch("/api/notifications/:id/read", messagingRoutes.markNotificationRead);
router.patch("/api/notifications/read-all", messagingRoutes.markAllNotificationsRead);
router.get("/api/info-requests", messagingRoutes.getInfoRequests);
router.post("/api/info-requests", messagingRoutes.sendInfoRequest);

// Real-time WebSocket routes (legacy)
router.get("/ws", websocketRoutes.handleWebSocketConnection);
router.get("/api/websocket/stats", websocketRoutes.getWebSocketStats);
router.post("/api/websocket/broadcast", websocketRoutes.sendAdminBroadcast);
router.get("/api/websocket/users/status", websocketRoutes.getUserOnlineStatus);

// Enhanced WebSocket cluster routes
router.get("/ws-enhanced", websocketEnhancedRoutes.handleWebSocketConnection);
router.get("/api/websocket-cluster/metrics", websocketEnhancedRoutes.getWebSocketMetrics);
router.get("/api/websocket-cluster/status", websocketEnhancedRoutes.getClusterStatus);
router.post("/api/websocket-cluster/rooms", websocketEnhancedRoutes.createRoom);
router.post("/api/websocket-cluster/broadcast", websocketEnhancedRoutes.broadcastMessage);
router.post("/api/websocket-cluster/rooms/message", websocketEnhancedRoutes.sendRoomMessage);
router.post("/api/websocket-cluster/users/message", websocketEnhancedRoutes.sendUserMessage);
router.post("/api/websocket-cluster/channels/message", websocketEnhancedRoutes.sendChannelMessage);
router.get("/api/websocket-cluster/connections", websocketEnhancedRoutes.getConnectionDetails);
router.post("/api/websocket-cluster/connections/disconnect", websocketEnhancedRoutes.forceDisconnect);
router.post("/api/websocket-cluster/optimize", websocketEnhancedRoutes.optimizePerformance);

// Monitoring and health check routes
router.get("/api/health", monitoringRoutes.healthCheck);
router.get("/api/monitoring/metrics", monitoringRoutes.getMetrics);
router.get("/api/monitoring/dashboard", monitoringRoutes.getDashboard);
router.get("/api/monitoring/alerts", monitoringRoutes.getAlerts);
router.get("/api/monitoring/errors", monitoringRoutes.getErrorStats);
router.get("/api/monitoring/status", monitoringRoutes.getSystemStatus);
router.get("/api/monitoring/performance", monitoringRoutes.getPerformanceMetrics);
router.get("/api/monitoring/uptime", monitoringRoutes.getUptime);
router.post("/api/monitoring/check", monitoringRoutes.triggerHealthCheck);

// Database optimization routes
router.post("/api/monitoring/optimize-db", monitoringRoutes.optimizeDatabase);
router.get("/api/monitoring/database-stats", monitoringRoutes.getDatabaseStats);

// API documentation routes
router.get("/api/docs", documentationRoutes.getSwaggerUI);
router.get("/api/docs/spec", documentationRoutes.getApiSpec);
router.get("/api/docs/routes", documentationRoutes.getRoutesOverview);
router.get("/api/docs/test", documentationRoutes.getTestingPlayground);

// API versioning routes
router.get("/api/version", versionRoutes.getVersionInfo);
router.get("/api/versions", versionRoutes.getVersionInfo);
router.get("/api/version/migration", versionRoutes.getMigrationGuide);
router.get("/api/version/compatibility", versionRoutes.checkCompatibility);
router.get("/api/version/changelog", versionRoutes.getChangelog);
router.get("/api/version/features", versionRoutes.getFeatureMatrix);
router.get("/api/version/deprecations", versionRoutes.getDeprecationNotices);

// Performance profiling and optimization routes
router.get("/api/performance/analysis", performanceRoutes.getPerformanceAnalysis);
router.get("/api/performance/metrics", performanceRoutes.getRealTimeMetrics);
router.post("/api/performance/profile/start", performanceRoutes.startProfiling);
router.post("/api/performance/profile/end", performanceRoutes.endProfiling);
router.get("/api/performance/recommendations", performanceRoutes.getOptimizationRecommendations);
router.get("/api/performance/benchmarks", performanceRoutes.getPerformanceBenchmarks);
router.post("/api/performance/diagnostics", performanceRoutes.runPerformanceDiagnostics);
router.delete("/api/performance/metrics", performanceRoutes.clearPerformanceMetrics);

// Advanced rate limiting management routes
router.get("/api/rate-limit/stats", rateLimitRoutes.getRateLimitStats);
router.get("/api/rate-limit/clients", rateLimitRoutes.getClientMetrics);
router.post("/api/rate-limit/clients/reset", rateLimitRoutes.resetClient);
router.post("/api/rate-limit/rules", rateLimitRoutes.addRateLimitRule);
router.delete("/api/rate-limit/rules", rateLimitRoutes.removeRateLimitRule);
router.get("/api/rate-limit/config", rateLimitRoutes.getRateLimitConfig);
router.put("/api/rate-limit/adaptive", rateLimitRoutes.updateAdaptiveSettings);
router.post("/api/rate-limit/test", rateLimitRoutes.testRateLimit);

// Database optimization management routes
router.get("/api/database/metrics", databaseOptimizerRoutes.getDatabaseMetrics);
router.get("/api/database/queries", databaseOptimizerRoutes.getQueryAnalysis);
router.get("/api/database/recommendations", databaseOptimizerRoutes.getOptimizationRecommendations);
router.post("/api/database/analyze", databaseOptimizerRoutes.analyzeQuery);
router.post("/api/database/optimize", databaseOptimizerRoutes.applyOptimization);
router.get("/api/database/health", databaseOptimizerRoutes.runHealthCheck);
router.get("/api/database/history", databaseOptimizerRoutes.getOptimizationHistory);
router.put("/api/database/settings", databaseOptimizerRoutes.configureOptimization);

// Advanced error tracking and alerting routes
router.get("/api/errors/metrics", errorTrackingRoutes.getErrorMetrics);
router.get("/api/errors", errorTrackingRoutes.getErrors);
router.get("/api/errors/details", errorTrackingRoutes.getErrorDetails);
router.post("/api/errors/resolve", errorTrackingRoutes.resolveError);
router.post("/api/errors/track", errorTrackingRoutes.trackError);
router.get("/api/errors/alerts/rules", errorTrackingRoutes.getAlertRules);
router.post("/api/errors/alerts/rules", errorTrackingRoutes.addAlertRule);
router.delete("/api/errors/alerts/rules", errorTrackingRoutes.removeAlertRule);
router.get("/api/errors/alerts/channels", errorTrackingRoutes.getAlertChannels);
router.post("/api/errors/alerts/channels", errorTrackingRoutes.addAlertChannel);
router.delete("/api/errors/alerts/channels", errorTrackingRoutes.removeAlertChannel);
router.put("/api/errors/settings", errorTrackingRoutes.updateSettings);
router.get("/api/errors/config", errorTrackingRoutes.getConfiguration);
router.post("/api/errors/test", errorTrackingRoutes.testErrorTracking);

// Comprehensive API documentation automation routes
router.get("/api/docs/metrics", apiDocumentationRoutes.getDocumentationMetrics);
router.get("/api/docs/endpoints", apiDocumentationRoutes.getEndpoints);
router.get("/api/docs/endpoints/details", apiDocumentationRoutes.getEndpointDetails);
router.get("/api/docs/openapi", apiDocumentationRoutes.generateOpenApiSpec);
router.get("/api/docs/postman", apiDocumentationRoutes.generatePostmanCollection);
router.get("/api/docs/markdown", apiDocumentationRoutes.generateMarkdownDocs);
router.post("/api/docs/endpoints", apiDocumentationRoutes.registerEndpoint);
router.put("/api/docs/endpoints", apiDocumentationRoutes.updateEndpoint);
router.delete("/api/docs/endpoints", apiDocumentationRoutes.removeEndpoint);
router.get("/api/docs/validate", apiDocumentationRoutes.validateDocumentation);
router.post("/api/docs/discover", apiDocumentationRoutes.autoDiscoverEndpoints);
router.get("/api/docs/settings", apiDocumentationRoutes.getSettings);
router.put("/api/docs/settings", apiDocumentationRoutes.updateSettings);
router.post("/api/docs/schemas", apiDocumentationRoutes.registerSchema);
router.post("/api/docs/test", apiDocumentationRoutes.testDocumentation);

// Advanced metrics and business intelligence dashboard routes
router.get("/api/bi/overview", businessIntelligenceRoutes.getBusinessOverview);
router.get("/api/bi/metrics", businessIntelligenceRoutes.getMetrics);
router.get("/api/bi/metrics/details", businessIntelligenceRoutes.getMetricDetails);
router.post("/api/bi/metrics/record", businessIntelligenceRoutes.recordMetricValue);
router.post("/api/bi/metrics", businessIntelligenceRoutes.registerMetric);
router.get("/api/bi/dashboards", businessIntelligenceRoutes.getDashboards);
router.get("/api/bi/dashboards/details", businessIntelligenceRoutes.getDashboard);
router.post("/api/bi/dashboards", businessIntelligenceRoutes.createDashboard);
router.put("/api/bi/dashboards", businessIntelligenceRoutes.updateDashboard);
router.get("/api/bi/insights", businessIntelligenceRoutes.getInsights);
router.post("/api/bi/analytics", businessIntelligenceRoutes.performAnalytics);
router.get("/api/bi/export", businessIntelligenceRoutes.exportData);
router.get("/api/bi/reports", businessIntelligenceRoutes.generateReport);
router.get("/api/bi/settings", businessIntelligenceRoutes.getSettings);
router.put("/api/bi/settings", businessIntelligenceRoutes.updateSettings);
router.post("/api/bi/test", businessIntelligenceRoutes.testBusinessIntelligence);

// Advanced machine learning and AI integration routes
router.get("/api/ml/overview", machineLearningRoutes.getMLOverview);
router.get("/api/ml/models", machineLearningRoutes.getModels);
router.post("/api/ml/models", machineLearningRoutes.registerModel);
router.get("/api/ml/models/details", machineLearningRoutes.getModelDetails);
router.put("/api/ml/models", machineLearningRoutes.updateModel);
router.delete("/api/ml/models", machineLearningRoutes.deleteModel);
router.post("/api/ml/models/train", machineLearningRoutes.trainModel);
router.post("/api/ml/predict", machineLearningRoutes.makePrediction);
router.get("/api/ml/predictions", machineLearningRoutes.getPredictions);
router.post("/api/ml/recommendations", machineLearningRoutes.generateRecommendations);
router.post("/api/ml/analyze", machineLearningRoutes.analyzeContent);
router.get("/api/ml/insights", machineLearningRoutes.generateAiInsights);
router.get("/api/ml/automation/rules", machineLearningRoutes.getAutomationRules);
router.post("/api/ml/automation/rules", machineLearningRoutes.createAutomationRule);
router.put("/api/ml/automation/rules", machineLearningRoutes.updateAutomationRule);
router.delete("/api/ml/automation/rules", machineLearningRoutes.deleteAutomationRule);
router.get("/api/ml/settings", machineLearningRoutes.getSettings);
router.put("/api/ml/settings", machineLearningRoutes.updateSettings);
router.post("/api/ml/test", machineLearningRoutes.testMachineLearning);

// Comprehensive data science and analytics pipeline routes
router.get("/api/data-science/overview", dataScienceRoutes.getDataScienceOverview);
router.get("/api/data-science/sources", dataScienceRoutes.getDataSources);
router.post("/api/data-science/sources", dataScienceRoutes.registerDataSource);
router.get("/api/data-science/sources/details", dataScienceRoutes.getDataSourceDetails);
router.put("/api/data-science/sources", dataScienceRoutes.updateDataSource);
router.get("/api/data-science/pipelines", dataScienceRoutes.getPipelines);
router.post("/api/data-science/pipelines", dataScienceRoutes.createPipeline);
router.post("/api/data-science/pipelines/run", dataScienceRoutes.runPipeline);
router.post("/api/data-science/analysis", dataScienceRoutes.performAnalysis);
router.get("/api/data-science/analysis/results", dataScienceRoutes.getAnalysisResults);
router.post("/api/data-science/quality/assess", dataScienceRoutes.assessDataQuality);
router.get("/api/data-science/quality/report", dataScienceRoutes.getQualityReport);
router.post("/api/data-science/visualizations", dataScienceRoutes.createVisualization);
router.get("/api/data-science/visualizations", dataScienceRoutes.getVisualization);
router.post("/api/data-science/streams", dataScienceRoutes.createStream);
router.get("/api/data-science/streams/metrics", dataScienceRoutes.getStreamMetrics);
router.post("/api/data-science/export", dataScienceRoutes.exportData);
router.get("/api/data-science/export/status", dataScienceRoutes.getExportStatus);
router.post("/api/data-science/insights", dataScienceRoutes.generateInsights);
router.get("/api/data-science/settings", dataScienceRoutes.getSettings);
router.put("/api/data-science/settings", dataScienceRoutes.updateSettings);
router.post("/api/data-science/test", dataScienceRoutes.testDataScience);

// Advanced security and compliance framework routes
router.get("/api/security/overview", securityComplianceRoutes.getSecurityOverview);
router.get("/api/security/policies", securityComplianceRoutes.getSecurityPolicies);
router.post("/api/security/policies", securityComplianceRoutes.createSecurityPolicy);
router.put("/api/security/policies", securityComplianceRoutes.updateSecurityPolicy);
router.get("/api/security/threats", securityComplianceRoutes.getThreatDetections);
router.post("/api/security/threats/report", securityComplianceRoutes.reportThreat);
router.post("/api/security/threats/respond", securityComplianceRoutes.respondToThreat);
router.get("/api/security/compliance", securityComplianceRoutes.getComplianceFrameworks);
router.post("/api/security/compliance", securityComplianceRoutes.createComplianceFramework);
router.post("/api/security/compliance/assess", securityComplianceRoutes.assessCompliance);
router.get("/api/security/incidents", securityComplianceRoutes.getSecurityIncidents);
router.post("/api/security/incidents", securityComplianceRoutes.createSecurityIncident);
router.put("/api/security/incidents/status", securityComplianceRoutes.updateIncidentStatus);
router.get("/api/security/vulnerabilities", securityComplianceRoutes.getVulnerabilityAssessments);
router.post("/api/security/vulnerabilities/scan", securityComplianceRoutes.runVulnerabilityAssessment);
router.get("/api/security/vulnerabilities/details", securityComplianceRoutes.getAssessmentDetails);
router.get("/api/security/metrics", securityComplianceRoutes.getSecurityMetrics);
router.post("/api/security/reports", securityComplianceRoutes.generateSecurityReport);
router.get("/api/security/dashboard", securityComplianceRoutes.getSecurityDashboard);
router.get("/api/security/settings", securityComplianceRoutes.getSettings);
router.put("/api/security/settings", securityComplianceRoutes.updateSettings);
router.post("/api/security/test", securityComplianceRoutes.testSecurityCompliance);

// Distributed computing and microservices orchestration routes
router.get("/api/distributed/overview", distributedComputingRoutes.getDistributedOverview);
router.get("/api/distributed/nodes", distributedComputingRoutes.getClusterNodes);
router.post("/api/distributed/nodes", distributedComputingRoutes.registerClusterNode);
router.put("/api/distributed/nodes/status", distributedComputingRoutes.updateNodeStatus);
router.get("/api/distributed/nodes/details", distributedComputingRoutes.getNodeDetails);
router.get("/api/distributed/services", distributedComputingRoutes.getMicroservices);
router.post("/api/distributed/services/deploy", distributedComputingRoutes.deployMicroservice);
router.post("/api/distributed/services/scale", distributedComputingRoutes.scaleService);
router.put("/api/distributed/services", distributedComputingRoutes.updateMicroservice);
router.get("/api/distributed/services/details", distributedComputingRoutes.getServiceDetails);
router.get("/api/distributed/tasks", distributedComputingRoutes.getTasks);
router.post("/api/distributed/tasks/schedule", distributedComputingRoutes.scheduleTask);
router.post("/api/distributed/tasks/execute", distributedComputingRoutes.executeTask);
router.get("/api/distributed/tasks/details", distributedComputingRoutes.getTaskDetails);
router.post("/api/distributed/discovery", distributedComputingRoutes.discoverServices);
router.post("/api/distributed/discovery/register", distributedComputingRoutes.registerServiceDiscovery);
router.delete("/api/distributed/discovery/unregister", distributedComputingRoutes.unregisterServiceDiscovery);
router.post("/api/distributed/locks/acquire", distributedComputingRoutes.acquireLock);
router.post("/api/distributed/locks/release", distributedComputingRoutes.releaseLock);
router.post("/api/distributed/locks/renew", distributedComputingRoutes.renewLock);
router.post("/api/distributed/load-balancer/select", distributedComputingRoutes.selectOptimalNode);
router.get("/api/distributed/metrics", distributedComputingRoutes.getClusterMetrics);
router.get("/api/distributed/status", distributedComputingRoutes.getClusterStatus);
router.get("/api/distributed/settings", distributedComputingRoutes.getSettings);
router.put("/api/distributed/settings", distributedComputingRoutes.updateSettings);
router.post("/api/distributed/test", distributedComputingRoutes.testDistributedComputing);

// Advanced content delivery and edge computing routes
router.get("/api/edge/overview", edgeComputingRoutes.getEdgeOverview);
router.get("/api/edge/nodes", edgeComputingRoutes.getEdgeNodes);
router.post("/api/edge/nodes/deploy", edgeComputingRoutes.deployEdgeNode);
router.get("/api/edge/nodes/optimal", edgeComputingRoutes.getOptimalNode);
router.get("/api/edge/distributions", edgeComputingRoutes.getDistributions);
router.post("/api/edge/distributions", edgeComputingRoutes.createDistribution);
router.post("/api/edge/distributions/invalidate", edgeComputingRoutes.invalidateContent);
router.get("/api/edge/distributions/analytics", edgeComputingRoutes.getDistributionAnalytics);
router.get("/api/edge/functions", edgeComputingRoutes.getEdgeFunctions);
router.post("/api/edge/functions/deploy", edgeComputingRoutes.deployEdgeFunction);
router.post("/api/edge/functions/invoke", edgeComputingRoutes.invokeEdgeFunction);
router.get("/api/edge/functions/metrics", edgeComputingRoutes.getFunctionMetrics);
router.post("/api/edge/optimize/image", edgeComputingRoutes.optimizeImage);
router.get("/api/edge/optimize/settings", edgeComputingRoutes.getOptimizationSettings);
router.get("/api/edge/streaming", edgeComputingRoutes.getStreamingConfigs);
router.post("/api/edge/streaming", edgeComputingRoutes.createStreamingConfig);
router.get("/api/edge/metrics", edgeComputingRoutes.getGlobalMetrics);
router.get("/api/edge/status", edgeComputingRoutes.getGlobalStatus);
router.get("/api/edge/settings", edgeComputingRoutes.getSettings);
router.put("/api/edge/settings", edgeComputingRoutes.updateSettings);
router.post("/api/edge/test", edgeComputingRoutes.testEdgeComputing);

// Intelligent automation and workflow management routes
router.get("/api/automation/overview", automationWorkflowRoutes.getAutomationOverview);
router.get("/api/automation/workflows", automationWorkflowRoutes.getWorkflows);
router.post("/api/automation/workflows", automationWorkflowRoutes.createWorkflow);
router.post("/api/automation/workflows/execute", automationWorkflowRoutes.executeWorkflow);
router.get("/api/automation/workflows/details", automationWorkflowRoutes.getWorkflowDetails);
router.get("/api/automation/workflows/templates", automationWorkflowRoutes.getWorkflowTemplates);
router.get("/api/automation/rules", automationWorkflowRoutes.getAutomationRules);
router.post("/api/automation/rules", automationWorkflowRoutes.createAutomationRule);
router.post("/api/automation/rules/execute", automationWorkflowRoutes.executeAutomationRule);
router.get("/api/automation/tasks", automationWorkflowRoutes.getScheduledTasks);
router.post("/api/automation/tasks/schedule", automationWorkflowRoutes.scheduleTask);
router.get("/api/automation/tasks/details", automationWorkflowRoutes.getTaskDetails);
router.get("/api/automation/optimization", automationWorkflowRoutes.getProcessOptimizations);
router.post("/api/automation/optimization/analyze", automationWorkflowRoutes.analyzeProcess);
router.get("/api/automation/optimization/recommendations", automationWorkflowRoutes.getOptimizationRecommendations);
router.get("/api/automation/integrations", automationWorkflowRoutes.getIntegrations);
router.post("/api/automation/integrations/register", automationWorkflowRoutes.registerIntegration);
router.post("/api/automation/integrations/test", automationWorkflowRoutes.testIntegration);
router.get("/api/automation/analytics", automationWorkflowRoutes.getWorkflowAnalytics);
router.get("/api/automation/metrics", automationWorkflowRoutes.getAutomationMetrics);
router.get("/api/automation/status", automationWorkflowRoutes.getSystemStatus);
router.get("/api/automation/settings", automationWorkflowRoutes.getSettings);
router.put("/api/automation/settings", automationWorkflowRoutes.updateSettings);
router.post("/api/automation/test", automationWorkflowRoutes.testAutomationWorkflow);

console.log(`✅ Registered ${router.routes.length} routes`);

// Initialize advanced services
console.log('🔧 Initializing advanced services...');
console.log('   ⚡ Performance profiler: enabled');
console.log('   💾 Cache optimization: enabled');
console.log('   📊 Real-time metrics: enabled');
console.log('   🛡️ Advanced rate limiting: enabled');
console.log('   🔗 WebSocket clustering: enabled');
console.log('   🤖 Machine learning & AI: enabled');
console.log('   🧠 Business intelligence: enabled');
console.log('   📊 Data science pipeline: enabled');
console.log('   🔒 Security & compliance: enabled');
console.log('   ⚡ Distributed computing: enabled');
console.log('   🌐 Edge computing & CDN: enabled');
console.log('   🤖 Intelligent automation & workflows: enabled');

// Initialize services
AdvancedRateLimiter.initialize();
WebSocketClusterService.initialize({
  enableClustering: true,
  nodeAddress: Deno.env.get("NODE_ADDRESS") || "localhost",
  nodePort: parseInt(Deno.env.get("PORT") || "8001"),
  capabilities: ["websocket", "rooms", "messaging", "clustering"]
});

// Initialize database optimization service
DatabaseOptimizerService.initialize({
  autoOptimization: true,
  optimizationThreshold: 10,
  maxOptimizationsPerHour: 20,
  analysisDepth: "medium",
  enableBackgroundAnalysis: true
});

// Initialize error tracking service
const errorTracker = ErrorTrackingService.getInstance();
errorTracker.initialize({
  maxErrors: 10000,
  retentionDays: 30,
  enableAutoResolution: true,
  autoResolutionHours: 24,
  enableTrendAnalysis: true,
  enableMachineLearning: true
});

// Initialize API documentation service
const apiDocumentation = ApiDocumentationService.getInstance();
apiDocumentation.initialize({
  autoGenerate: true,
  autoValidate: true,
  trackUsage: true,
  generateExamples: true,
  enableVersioning: true,
  outputFormats: ["openapi", "postman", "markdown"],
  updateInterval: 300000 // 5 minutes
});

// Initialize business intelligence service
const businessIntelligence = BusinessIntelligenceService.getInstance();
businessIntelligence.initialize({
  enableRealTimeAnalytics: true,
  enablePredictiveAnalytics: true,
  enableAnomalyDetection: true,
  dataRetentionDays: 365,
  insightRetentionDays: 30,
  autoGenerateInsights: true,
  refreshInterval: 60000, // 1 minute
  maxMetrics: 1000,
  maxDashboards: 100
});

// Initialize machine learning service
const machineLearning = MachineLearningService.getInstance();
machineLearning.initialize({
  enableAutoTraining: true,
  enableRealTimePredictions: true,
  enableContentAnalysis: true,
  enableRecommendations: true,
  enableAutomation: true,
  modelRetentionDays: 90,
  predictionRetentionDays: 30,
  maxModels: 100,
  maxPredictions: 10000,
  autoOptimizeModels: true,
  retrainingInterval: 86400000 // 24 hours
});

// Initialize data science service
const dataScience = DataScienceService.getInstance();
dataScience.initialize({
  enableRealtimeProcessing: true,
  enableDataQuality: true,
  enableVisualization: true,
  enableStatisticalAnalysis: true,
  enableDataProfiler: true,
  maxConcurrentPipelines: 15,
  maxStreamBufferSize: 50000,
  dataRetentionDays: 365,
  visualizationRetentionDays: 90,
  autoOptimizePipelines: true,
  pipelineHealthCheckInterval: 60000,
  streamHealthCheckInterval: 30000
});

// Initialize security compliance service
const securityCompliance = SecurityComplianceService.getInstance();
securityCompliance.initialize({
  enableThreatDetection: true,
  enableVulnerabilityScanning: true,
  enableComplianceMonitoring: true,
  enableIncidentResponse: true,
  enableAuditLogging: true,
  threatDetectionInterval: 30000,
  vulnerabilityScanInterval: 86400000,
  complianceCheckInterval: 3600000,
  maxThreatRetention: 90,
  maxIncidentRetention: 365,
  automaticThreatResponse: true
});

// Initialize distributed computing service
const distributedComputing = DistributedComputingService.getInstance();
distributedComputing.initialize({
  enableServiceDiscovery: true,
  enableServiceMesh: true,
  enableAutoScaling: true,
  enableDistributedLocking: true,
  enableTaskScheduling: true,
  enableHealthChecking: true,
  enableLoadBalancing: true,
  clusterName: "pitchey-cluster",
  dataCenter: "primary",
  maxNodesPerCluster: 100,
  maxServicesPerNode: 20,
  maxTasksPerNode: 50
});

// Initialize edge computing service
const edgeComputing = EdgeComputingService.getInstance();
edgeComputing.initialize({
  enableGlobalCDN: true,
  enableEdgeFunctions: true,
  enableContentOptimization: true,
  enableStreamingServices: true,
  enableImageOptimization: true,
  enableRealtimeMetrics: true,
  maxEdgeNodes: 20,
  maxDistributions: 50,
  maxEdgeFunctions: 100,
  cacheRetentionHours: 24,
  compressionLevel: 6,
  imageQuality: 85,
  streamingBufferSize: 10485760,
  enableIntelligentRouting: true,
  enableFailover: true
});

// Initialize intelligent automation and workflow service
const automationWorkflow = AutomationWorkflowService.getInstance();
automationWorkflow.initialize({
  maxConcurrentWorkflows: 50,
  maxQueueSize: 1000,
  defaultTimeout: 300000,
  enableOptimization: true,
  enableMlScheduling: true,
  enableAdaptiveLearning: true,
  enableProcessMining: true,
  resourcePoolSize: 15,
  retentionDays: 90,
  alertThresholds: {
    errorRate: 0.05,
    latency: 30000,
    queueSize: 800
  }
});

// Warm up cache for better initial performance
CacheOptimizationService.warmUp();

// Request handler with enhanced error handling and monitoring
async function handler(request: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  
  // Start performance profiling for API requests (exclude static assets)
  const shouldProfile = url.pathname.startsWith("/api/") && !url.pathname.includes("/health");
  const profileId = shouldProfile ? PerformanceProfiler.startProfile(`${request.method} ${url.pathname}`) : "";
  
  // Add CORS headers for all requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-user-id",
    "Access-Control-Max-Age": "86400",
  };

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: { ...corsHeaders, ...getSecurityHeaders() }
    });
  }

  // Log request for debugging
  console.log(`${request.method} ${url.pathname}`);

  let response: Response;
  let statusCode = 200;

  try {
    // Apply rate limiting middleware and route handling
    const routeResponse = await AdvancedRateLimiter.middleware(request, async () => {
      return await router.handle(request);
    });
    
    if (routeResponse) {
      statusCode = routeResponse.status;
      
      // Add CORS headers to route responses
      const responseHeaders = new Headers(routeResponse.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      
      response = new Response(routeResponse.body, {
        status: routeResponse.status,
        statusText: routeResponse.statusText,
        headers: responseHeaders
      });
    } else if (url.pathname === "/") {
      // Handle root path
      response = new Response(JSON.stringify({
        message: "Pitchey API v3.4 - Modular Architecture",
        status: "online",
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
        architecture: "modular",
        routes: router.routes.length,
        version: "3.4.0",
        health: "healthy"
      }), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          ...getCorsHeaders(), 
          ...getSecurityHeaders(),
          "Content-Type": "application/json"
        }
      });
    } else {
      // Handle 404
      statusCode = 404;
      response = new Response(JSON.stringify({
        error: "Not Found",
        path: url.pathname,
        method: request.method,
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: { 
          ...corsHeaders, 
          ...getCorsHeaders(), 
          ...getSecurityHeaders(),
          "Content-Type": "application/json"
        }
      });
    }

  } catch (error) {
    statusCode = 500;
    
    // Track the error in our advanced error tracking system
    errorTracker.trackError(error, {
      route: url.pathname,
      method: request.method,
      userAgent: request.headers.get("user-agent") || undefined,
      ip: request.headers.get("x-forwarded-for") || 
          request.headers.get("x-real-ip") || "unknown",
      statusCode: 500
    });
    
    // Use enhanced error handler
    const errorContext = ErrorHandler.createErrorContext(request, url);
    response = await ErrorHandler.handleError(error, errorContext);
    
    // Add CORS headers to error responses
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } finally {
    // Track request metrics for monitoring
    const responseTime = Date.now() - startTime;
    MonitoringService.trackRequest(url.pathname, request.method, responseTime, statusCode);
    
    // End performance profiling
    if (shouldProfile && profileId) {
      PerformanceProfiler.recordMetric(
        profileId, 
        "Request Processing", 
        responseTime, 
        "api",
        { 
          method: request.method, 
          path: url.pathname,
          statusCode,
          success: statusCode < 400
        }
      );
      PerformanceProfiler.endProfile(profileId);
    }
  }

  return response;
}

// Start server
const port = parseInt(envConfig.PORT || "8001");

console.log('🚀 Starting Modular Pitchey Server...');
console.log(`📊 Server Configuration:`);
console.log(`   Port: ${port}`);
console.log(`   Environment: ${envConfig.DENO_ENV || "development"}`);
console.log(`   Database: ${envConfig.DATABASE_URL ? "configured" : "missing"}`);
console.log(`   Telemetry: ${Deno.env.get("SENTRY_DSN") ? "enabled" : "disabled"}`);
console.log(`   Routes: ${router.routes.length} registered`);

serve(handler, { port });

console.log(`✅ Modular server running on http://0.0.0.0:${port}`);
console.log(`🔗 Health check: http://0.0.0.0:${port}/api/health`);
console.log(`📡 Deployed at: ${new Date().toISOString()}`);

console.log('\n🎯 KEY IMPROVEMENTS:');
console.log('   ✅ Reduced from 516KB to modular architecture');
console.log('   ✅ Router-based routing instead of 238 if statements');
console.log('   ✅ Separated route handlers into logical modules');
console.log('   ✅ Optimized for Deno Deploy constraints');
console.log('   ✅ Maintained all core functionality');