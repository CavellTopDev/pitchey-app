/**
 * API Versioning Middleware
 * Provides comprehensive API version management and backward compatibility
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";

export type ApiVersion = "v1" | "v2" | "v3" | "v4";

export interface VersionConfig {
  version: ApiVersion;
  deprecated?: boolean;
  deprecationDate?: string;
  sunsetDate?: string;
  supportedUntil?: string;
  migrationGuide?: string;
  changes?: string[];
}

export interface VersionContext {
  requestedVersion: ApiVersion;
  resolvedVersion: ApiVersion;
  isDeprecated: boolean;
  warnings: string[];
}

export class ApiVersioningService {
  private static readonly SUPPORTED_VERSIONS: Map<ApiVersion, VersionConfig> = new Map([
    ["v1", {
      version: "v1",
      deprecated: true,
      deprecationDate: "2024-01-01",
      sunsetDate: "2025-06-01",
      supportedUntil: "2025-06-01",
      migrationGuide: "/docs/migration/v1-to-v2",
      changes: [
        "Legacy authentication format",
        "Limited search capabilities", 
        "Basic error responses"
      ]
    }],
    ["v2", {
      version: "v2",
      deprecated: true,
      deprecationDate: "2024-06-01", 
      sunsetDate: "2025-12-01",
      supportedUntil: "2025-12-01",
      migrationGuide: "/docs/migration/v2-to-v3",
      changes: [
        "Enhanced JWT authentication",
        "Improved search with filters",
        "Structured error responses"
      ]
    }],
    ["v3", {
      version: "v3",
      deprecated: false,
      changes: [
        "Advanced search with faceting",
        "Real-time WebSocket support",
        "Comprehensive monitoring",
        "Database optimization"
      ]
    }],
    ["v4", {
      version: "v4",
      deprecated: false,
      changes: [
        "Modular architecture",
        "Enhanced error handling",
        "Performance optimizations",
        "Complete API documentation"
      ]
    }]
  ]);

  private static readonly CURRENT_VERSION: ApiVersion = "v4";
  private static readonly DEFAULT_VERSION: ApiVersion = "v3"; // For backward compatibility

  /**
   * Extract API version from request
   */
  static extractVersion(request: Request, url: URL): VersionContext {
    let requestedVersion: ApiVersion;
    const warnings: string[] = [];

    // Try to extract version from different sources in priority order:
    
    // 1. URL path (/api/v3/pitches)
    const pathMatch = url.pathname.match(/^\/api\/(v[1-4])\//);
    if (pathMatch) {
      requestedVersion = pathMatch[1] as ApiVersion;
    }
    // 2. Query parameter (?version=v3)
    else if (url.searchParams.has("version")) {
      const versionParam = url.searchParams.get("version") as ApiVersion;
      if (this.SUPPORTED_VERSIONS.has(versionParam)) {
        requestedVersion = versionParam;
      } else {
        requestedVersion = this.DEFAULT_VERSION;
        warnings.push(`Unsupported version parameter: ${versionParam}, defaulting to ${this.DEFAULT_VERSION}`);
      }
    }
    // 3. Accept-Version header
    else if (request.headers.has("Accept-Version")) {
      const headerVersion = request.headers.get("Accept-Version") as ApiVersion;
      if (this.SUPPORTED_VERSIONS.has(headerVersion)) {
        requestedVersion = headerVersion;
      } else {
        requestedVersion = this.DEFAULT_VERSION;
        warnings.push(`Unsupported Accept-Version header: ${headerVersion}, defaulting to ${this.DEFAULT_VERSION}`);
      }
    }
    // 4. API-Version header (alternative naming)
    else if (request.headers.has("API-Version")) {
      const headerVersion = request.headers.get("API-Version") as ApiVersion;
      if (this.SUPPORTED_VERSIONS.has(headerVersion)) {
        requestedVersion = headerVersion;
      } else {
        requestedVersion = this.DEFAULT_VERSION;
        warnings.push(`Unsupported API-Version header: ${headerVersion}, defaulting to ${this.DEFAULT_VERSION}`);
      }
    }
    // 5. Default to current version for new endpoints
    else {
      requestedVersion = this.DEFAULT_VERSION;
    }

    const resolvedVersion = this.resolveVersion(requestedVersion);
    const versionConfig = this.SUPPORTED_VERSIONS.get(resolvedVersion);
    const isDeprecated = versionConfig?.deprecated || false;

    // Add deprecation warnings
    if (isDeprecated && versionConfig) {
      warnings.push(`API version ${resolvedVersion} is deprecated`);
      if (versionConfig.sunsetDate) {
        warnings.push(`This version will be sunset on ${versionConfig.sunsetDate}`);
      }
      if (versionConfig.migrationGuide) {
        warnings.push(`Migration guide: ${versionConfig.migrationGuide}`);
      }
    }

    return {
      requestedVersion,
      resolvedVersion,
      isDeprecated,
      warnings
    };
  }

  /**
   * Resolve version with fallback logic
   */
  private static resolveVersion(requested: ApiVersion): ApiVersion {
    // If requested version is supported, use it
    if (this.SUPPORTED_VERSIONS.has(requested)) {
      return requested;
    }

    // Fallback to default version
    return this.DEFAULT_VERSION;
  }

  /**
   * Create versioning middleware
   */
  static createMiddleware(): RouteHandler {
    return async (request: Request, url: URL, params?: any) => {
      try {
        const versionContext = this.extractVersion(request, url);
        
        // Add version context to request headers for downstream handlers
        const modifiedRequest = new Request(request, {
          headers: new Headers({
            ...Object.fromEntries(request.headers.entries()),
            "X-API-Version": versionContext.resolvedVersion,
            "X-API-Version-Requested": versionContext.requestedVersion,
            "X-API-Version-Deprecated": versionContext.isDeprecated.toString()
          })
        });

        // Log version usage for analytics
        telemetry.logger.info("API Version Usage", {
          requestedVersion: versionContext.requestedVersion,
          resolvedVersion: versionContext.resolvedVersion,
          deprecated: versionContext.isDeprecated,
          path: url.pathname,
          userAgent: request.headers.get("User-Agent")
        });

        // Continue processing - this middleware doesn't terminate the request
        return null; // Let the router continue to find the actual handler
        
      } catch (error) {
        telemetry.logger.error("API Versioning Error", error);
        return errorResponse("Version resolution failed", 500);
      }
    };
  }

  /**
   * Transform response based on API version
   */
  static transformResponse(response: any, version: ApiVersion): any {
    switch (version) {
      case "v1":
        return this.transformToV1(response);
      case "v2":
        return this.transformToV2(response);
      case "v3":
        return this.transformToV3(response);
      case "v4":
      default:
        return response; // Current format
    }
  }

  /**
   * Transform response to v1 format (legacy compatibility)
   */
  private static transformToV1(response: any): any {
    if (response.success !== undefined) {
      // Convert new format to legacy format
      return {
        status: response.success ? "success" : "error",
        data: response.data || response.error,
        timestamp: new Date().toISOString()
      };
    }
    return response;
  }

  /**
   * Transform response to v2 format
   */
  private static transformToV2(response: any): any {
    if (response.success !== undefined) {
      // V2 format with slight modifications
      return {
        success: response.success,
        result: response.data,
        error: response.error,
        meta: {
          timestamp: new Date().toISOString(),
          version: "v2"
        }
      };
    }
    return response;
  }

  /**
   * Transform response to v3 format
   */
  private static transformToV3(response: any): any {
    // V3 is close to current format, minimal changes needed
    return response;
  }

  /**
   * Get version information endpoint
   */
  static getVersionInfo(): RouteHandler {
    return async (request: Request, url: URL) => {
      try {
        const versionContext = this.extractVersion(request, url);
        const allVersions = Array.from(this.SUPPORTED_VERSIONS.entries()).map(([version, config]) => ({
          version,
          ...config
        }));

        return successResponse({
          current: {
            version: this.CURRENT_VERSION,
            requested: versionContext.requestedVersion,
            resolved: versionContext.resolvedVersion
          },
          supported: allVersions,
          deprecation_warnings: versionContext.warnings,
          version_selection: {
            url_path: "/api/v{X}/endpoint",
            query_param: "?version=v{X}",
            header_accept: "Accept-Version: v{X}",
            header_api: "API-Version: v{X}"
          }
        });
      } catch (error) {
        telemetry.logger.error("Get version info error", error);
        return errorResponse("Failed to get version information", 500);
      }
    };
  }

  /**
   * Handle version migration endpoint
   */
  static getMigrationGuide(): RouteHandler {
    return async (request: Request, url: URL) => {
      try {
        const fromVersion = url.searchParams.get("from") as ApiVersion;
        const toVersion = url.searchParams.get("to") as ApiVersion || this.CURRENT_VERSION;

        if (!fromVersion) {
          return errorResponse("Missing 'from' version parameter", 400);
        }

        const migrationSteps = this.generateMigrationGuide(fromVersion, toVersion);

        return successResponse({
          migration: {
            from: fromVersion,
            to: toVersion,
            steps: migrationSteps
          },
          estimated_effort: this.estimateMigrationEffort(fromVersion, toVersion),
          breaking_changes: this.getBreakingChanges(fromVersion, toVersion)
        });

      } catch (error) {
        telemetry.logger.error("Get migration guide error", error);
        return errorResponse("Failed to generate migration guide", 500);
      }
    };
  }

  /**
   * Generate migration steps between versions
   */
  private static generateMigrationGuide(from: ApiVersion, to: ApiVersion): string[] {
    const steps: string[] = [];

    if (from === "v1" && to !== "v1") {
      steps.push(
        "Update authentication to use JWT Bearer tokens",
        "Modify error handling to expect structured error responses",
        "Update search requests to use new filter parameters"
      );
    }

    if (from <= "v2" && to > "v2") {
      steps.push(
        "Implement WebSocket connections for real-time features",
        "Update search endpoints to use advanced filtering",
        "Modify monitoring endpoints for enhanced health checks"
      );
    }

    if (from <= "v3" && to === "v4") {
      steps.push(
        "Update to new modular endpoint structure",
        "Implement enhanced error handling patterns",
        "Use new comprehensive documentation endpoints"
      );
    }

    if (steps.length === 0) {
      steps.push("No migration steps required - versions are compatible");
    }

    return steps;
  }

  /**
   * Estimate migration effort
   */
  private static estimateMigrationEffort(from: ApiVersion, to: ApiVersion): string {
    const fromNum = parseInt(from.substring(1));
    const toNum = parseInt(to.substring(1));
    const versionDiff = toNum - fromNum;

    if (versionDiff === 0) return "No effort required";
    if (versionDiff === 1) return "Low - 1-2 days";
    if (versionDiff === 2) return "Medium - 3-5 days";
    if (versionDiff >= 3) return "High - 1-2 weeks";

    return "Variable";
  }

  /**
   * Get breaking changes between versions
   */
  private static getBreakingChanges(from: ApiVersion, to: ApiVersion): string[] {
    const changes: string[] = [];

    if (from === "v1" && to !== "v1") {
      changes.push(
        "Authentication header format changed from 'Token' to 'Bearer'",
        "Error response format changed to structured format",
        "Some endpoint paths have changed"
      );
    }

    if (from <= "v2" && to > "v2") {
      changes.push(
        "Search parameter names updated for consistency",
        "Pagination format standardized across all endpoints"
      );
    }

    return changes;
  }
}