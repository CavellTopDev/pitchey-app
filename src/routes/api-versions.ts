/**
 * API Versioning Routes
 * Provides version management and backward compatibility endpoints
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { ApiVersioningService } from "../middleware/versioning.middleware.ts";
import { telemetry } from "../utils/telemetry.ts";

// Get API version information
export const getVersionInfo: RouteHandler = ApiVersioningService.getVersionInfo();

// Get migration guide between versions
export const getMigrationGuide: RouteHandler = ApiVersioningService.getMigrationGuide();

// Check version compatibility
export const checkCompatibility: RouteHandler = async (request, url) => {
  try {
    const clientVersion = url.searchParams.get("client_version");
    const serverVersion = "v4";
    
    if (!clientVersion) {
      return errorResponse("Missing client_version parameter", 400);
    }

    const isCompatible = checkVersionCompatibility(clientVersion, serverVersion);
    const recommendations = getVersionRecommendations(clientVersion);

    return successResponse({
      client_version: clientVersion,
      server_version: serverVersion,
      compatible: isCompatible,
      recommendations,
      support_status: getSupportStatus(clientVersion)
    });

  } catch (error) {
    telemetry.logger.error("Check compatibility error", error);
    return errorResponse("Failed to check version compatibility", 500);
  }
};

// Get version changelog
export const getChangelog: RouteHandler = async (request, url) => {
  try {
    const version = url.searchParams.get("version") || "all";
    
    const changelog = {
      "v4.0": {
        release_date: "2025-11-15",
        type: "major",
        changes: [
          "Complete modular architecture transformation",
          "Advanced search and filtering capabilities",
          "Real-time WebSocket integration",
          "Comprehensive error handling and monitoring",
          "Database performance optimization",
          "Complete API documentation and testing suite"
        ],
        breaking_changes: [
          "Reorganized route structure for modularity",
          "Enhanced error response format",
          "Updated authentication flow"
        ],
        deprecations: [
          "Legacy v1 and v2 authentication methods will be removed in v5.0"
        ]
      },
      "v3.4": {
        release_date: "2025-11-10",
        type: "minor",
        changes: [
          "Enhanced database schema for frontend compatibility",
          "Improved WebSocket connection management",
          "Added comprehensive monitoring endpoints",
          "Performance optimizations for search queries"
        ],
        bug_fixes: [
          "Fixed database field mapping inconsistencies",
          "Resolved CORS issues in WebSocket connections",
          "Improved error logging for debugging"
        ]
      },
      "v3.0": {
        release_date: "2025-10-01",
        type: "major",
        changes: [
          "JWT authentication implementation",
          "Advanced search with faceted filtering",
          "Real-time notifications via WebSocket",
          "Comprehensive analytics dashboard",
          "NDA workflow automation"
        ],
        breaking_changes: [
          "Authentication moved to JWT tokens",
          "Search API restructured for better performance",
          "WebSocket endpoints added for real-time features"
        ]
      },
      "v2.0": {
        release_date: "2025-08-01",
        type: "major",
        changes: [
          "Enhanced user management",
          "Investment tracking system",
          "Production company features",
          "Improved pitch management"
        ],
        breaking_changes: [
          "User profile structure updated",
          "Investment API redesigned"
        ]
      },
      "v1.0": {
        release_date: "2025-06-01",
        type: "major",
        changes: [
          "Initial API release",
          "Basic pitch management",
          "User authentication",
          "Simple search functionality"
        ]
      }
    };

    if (version === "all") {
      return successResponse({ changelog });
    } else {
      const versionChangelog = changelog[version as keyof typeof changelog];
      if (!versionChangelog) {
        return errorResponse(`Changelog not found for version ${version}`, 404);
      }
      return successResponse({ 
        version, 
        changelog: versionChangelog 
      });
    }

  } catch (error) {
    telemetry.logger.error("Get changelog error", error);
    return errorResponse("Failed to get changelog", 500);
  }
};

// Get API feature matrix across versions
export const getFeatureMatrix: RouteHandler = async (request, url) => {
  try {
    const featureMatrix = {
      features: {
        authentication: {
          v1: { available: true, method: "basic", deprecated: true },
          v2: { available: true, method: "token", deprecated: true },
          v3: { available: true, method: "jwt", deprecated: false },
          v4: { available: true, method: "jwt_enhanced", deprecated: false }
        },
        search: {
          v1: { available: true, type: "basic", deprecated: true },
          v2: { available: true, type: "filtered", deprecated: true },
          v3: { available: true, type: "advanced", deprecated: false },
          v4: { available: true, type: "comprehensive", deprecated: false }
        },
        websocket: {
          v1: { available: false },
          v2: { available: false },
          v3: { available: true, features: ["notifications"], deprecated: false },
          v4: { available: true, features: ["notifications", "real-time", "rooms"], deprecated: false }
        },
        monitoring: {
          v1: { available: false },
          v2: { available: true, type: "basic", deprecated: true },
          v3: { available: true, type: "enhanced", deprecated: false },
          v4: { available: true, type: "comprehensive", deprecated: false }
        },
        analytics: {
          v1: { available: false },
          v2: { available: true, type: "basic", deprecated: true },
          v3: { available: true, type: "advanced", deprecated: false },
          v4: { available: true, type: "comprehensive", deprecated: false }
        },
        documentation: {
          v1: { available: false },
          v2: { available: true, type: "basic", deprecated: true },
          v3: { available: true, type: "openapi", deprecated: false },
          v4: { available: true, type: "comprehensive", deprecated: false }
        }
      },
      compatibility_matrix: {
        v1: { supports: ["v1"], upgrades_to: ["v2", "v3", "v4"] },
        v2: { supports: ["v1", "v2"], upgrades_to: ["v3", "v4"] },
        v3: { supports: ["v2", "v3"], upgrades_to: ["v4"] },
        v4: { supports: ["v3", "v4"], upgrades_to: [] }
      }
    };

    return successResponse(featureMatrix);

  } catch (error) {
    telemetry.logger.error("Get feature matrix error", error);
    return errorResponse("Failed to get feature matrix", 500);
  }
};

// Get deprecation notices
export const getDeprecationNotices: RouteHandler = async (request, url) => {
  try {
    const deprecationNotices = [
      {
        id: "auth-v1-v2",
        severity: "high",
        affected_versions: ["v1", "v2"],
        feature: "Legacy authentication",
        deprecation_date: "2024-01-01",
        sunset_date: "2025-06-01",
        replacement: "JWT Bearer token authentication",
        migration_guide: "/docs/migration/auth-jwt",
        timeline: {
          "2024-01-01": "Deprecation announced",
          "2024-06-01": "Migration tools available",
          "2024-12-01": "Warning headers added to responses",
          "2025-03-01": "Rate limiting applied to legacy auth",
          "2025-06-01": "Complete removal"
        }
      },
      {
        id: "search-v1",
        severity: "medium",
        affected_versions: ["v1"],
        feature: "Basic search API",
        deprecation_date: "2024-06-01",
        sunset_date: "2025-12-01",
        replacement: "Advanced search with faceted filtering",
        migration_guide: "/docs/migration/search-advanced",
        timeline: {
          "2024-06-01": "Deprecation announced",
          "2024-09-01": "Performance degradation warnings",
          "2025-01-01": "Query limits applied",
          "2025-06-01": "Legacy search marked read-only",
          "2025-12-01": "Complete removal"
        }
      }
    ];

    const activeNotices = deprecationNotices.filter(notice => {
      const sunsetDate = new Date(notice.sunset_date);
      return sunsetDate > new Date();
    });

    return successResponse({
      active_deprecations: activeNotices.length,
      notices: activeNotices,
      total_deprecated_features: deprecationNotices.length
    });

  } catch (error) {
    telemetry.logger.error("Get deprecation notices error", error);
    return errorResponse("Failed to get deprecation notices", 500);
  }
};

// Helper functions

function checkVersionCompatibility(clientVersion: string, serverVersion: string): boolean {
  const clientMajor = parseInt(clientVersion.split('.')[0].replace('v', ''));
  const serverMajor = parseInt(serverVersion.split('.')[0].replace('v', ''));
  
  // Allow clients within 1 major version
  return Math.abs(serverMajor - clientMajor) <= 1;
}

function getVersionRecommendations(clientVersion: string): string[] {
  const recommendations: string[] = [];
  
  const clientMajor = parseInt(clientVersion.split('.')[0].replace('v', ''));
  
  if (clientMajor < 3) {
    recommendations.push("Upgrade to v3+ for improved security and performance");
    recommendations.push("Consider migrating to JWT authentication");
  }
  
  if (clientMajor < 4) {
    recommendations.push("Upgrade to v4 for latest features and optimizations");
    recommendations.push("Take advantage of modular architecture improvements");
  }
  
  if (clientMajor === 4) {
    recommendations.push("You're using the latest version - stay updated for new features");
  }
  
  return recommendations;
}

function getSupportStatus(version: string): string {
  const versionNum = parseInt(version.replace('v', ''));
  
  if (versionNum < 2) return "unsupported";
  if (versionNum === 2) return "deprecated";
  if (versionNum === 3) return "maintenance";
  if (versionNum === 4) return "active";
  
  return "unknown";
}