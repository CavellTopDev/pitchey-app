/**
 * Comprehensive API Documentation Automation Routes
 * Provides endpoints for managing and generating comprehensive API documentation
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { ApiDocumentationService } from "../services/api-documentation.service.ts";
import { telemetry } from "../utils/telemetry.ts";

const apiDocs = ApiDocumentationService.getInstance();

// Get comprehensive documentation metrics and overview
export const getDocumentationMetrics: RouteHandler = async (request, url) => {
  try {
    const metrics = apiDocs.getMetrics();
    const validationIssues = apiDocs.validateDocumentation();
    const settings = apiDocs.getSettings();
    
    // Calculate quality score
    const qualityScore = calculateDocumentationQuality(metrics, validationIssues);
    
    // Get issue breakdown
    const issueBreakdown = validationIssues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return successResponse({
      timestamp: new Date().toISOString(),
      quality_score: qualityScore,
      quality_status: getQualityStatus(qualityScore),
      metrics,
      validation: {
        total_issues: validationIssues.length,
        issue_breakdown: issueBreakdown,
        critical_issues: validationIssues.filter(i => i.severity === "error").length
      },
      capabilities: {
        formats_supported: settings.outputFormats,
        auto_generation: settings.autoGenerate,
        usage_tracking: settings.trackUsage,
        versioning: settings.enableVersioning
      },
      recommendations: generateDocumentationRecommendations(metrics, validationIssues, qualityScore)
    });

  } catch (error) {
    telemetry.logger.error("Documentation metrics error", error);
    return errorResponse("Failed to get documentation metrics", 500);
  }
};

// Get list of documented endpoints with filtering
export const getEndpoints: RouteHandler = async (request, url) => {
  try {
    const tag = url.searchParams.get("tag") || undefined;
    const version = url.searchParams.get("version") || undefined;
    const deprecated = url.searchParams.get("deprecated") === "true" ? true :
                      url.searchParams.get("deprecated") === "false" ? false : undefined;
    const method = url.searchParams.get("method") || undefined;
    const search = url.searchParams.get("search") || undefined;
    
    let endpoints = apiDocs.getEndpoints({ tag, version, deprecated, method });
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      endpoints = endpoints.filter(endpoint => 
        endpoint.path.toLowerCase().includes(searchLower) ||
        endpoint.summary.toLowerCase().includes(searchLower) ||
        endpoint.description.toLowerCase().includes(searchLower) ||
        endpoint.tags.some(t => t.toLowerCase().includes(searchLower))
      );
    }
    
    // Format for response
    const formattedEndpoints = endpoints.map(endpoint => ({
      id: endpoint.id,
      method: endpoint.method.toUpperCase(),
      path: endpoint.path,
      summary: endpoint.summary,
      tags: endpoint.tags,
      version: endpoint.version,
      deprecated: endpoint.deprecated,
      last_modified: new Date(endpoint.lastModified).toISOString(),
      usage: {
        calls: endpoint.usage.calls,
        error_rate: endpoint.usage.calls > 0 
          ? ((endpoint.usage.errors / endpoint.usage.calls) * 100).toFixed(2) + '%'
          : '0%',
        avg_response_time: endpoint.usage.avgResponseTime.toFixed(2) + 'ms',
        popularity: endpoint.usage.popularity.toFixed(2)
      },
      documentation_status: {
        has_description: endpoint.description.length > 10,
        has_examples: endpoint.examples.length > 0,
        has_parameters: endpoint.parameters.length > 0,
        has_security: !!endpoint.security
      }
    }));
    
    // Get summary statistics
    const summary = {
      total: formattedEndpoints.length,
      by_method: formattedEndpoints.reduce((acc, e) => {
        acc[e.method] = (acc[e.method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      by_tag: formattedEndpoints.reduce((acc, e) => {
        e.tags.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>),
      deprecated: formattedEndpoints.filter(e => e.deprecated).length,
      well_documented: formattedEndpoints.filter(e => 
        e.documentation_status.has_description && 
        e.documentation_status.has_examples
      ).length
    };
    
    return successResponse({
      endpoints: formattedEndpoints,
      summary,
      filters: { tag, version, deprecated, method, search },
      available_tags: [...new Set(endpoints.flatMap(e => e.tags))].sort(),
      available_versions: [...new Set(endpoints.map(e => e.version))].sort(),
      available_methods: [...new Set(endpoints.map(e => e.method.toUpperCase()))].sort()
    });

  } catch (error) {
    telemetry.logger.error("Get endpoints error", error);
    return errorResponse("Failed to get endpoints", 500);
  }
};

// Get detailed endpoint documentation
export const getEndpointDetails: RouteHandler = async (request, url) => {
  try {
    const endpointId = url.searchParams.get("endpoint_id");
    const method = url.searchParams.get("method");
    const path = url.searchParams.get("path");
    
    let endpoint;
    if (endpointId) {
      endpoint = apiDocs.getEndpoint(endpointId);
    } else if (method && path) {
      const endpoints = apiDocs.getEndpoints({ method, path });
      endpoint = endpoints.find(e => e.path === path && e.method.toUpperCase() === method.toUpperCase());
    }
    
    if (!endpoint) {
      return errorResponse("Endpoint not found", 404);
    }
    
    // Get validation issues for this specific endpoint
    const allIssues = apiDocs.validateDocumentation();
    const endpointKey = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    const endpointIssues = allIssues.filter(issue => issue.endpoint === endpointKey);
    
    return successResponse({
      endpoint: {
        ...endpoint,
        last_modified_formatted: new Date(endpoint.lastModified).toISOString()
      },
      validation: {
        issues: endpointIssues,
        documentation_score: calculateEndpointDocumentationScore(endpoint, endpointIssues)
      },
      related_endpoints: findRelatedEndpoints(endpoint, apiDocs.getEndpoints()),
      suggestions: generateEndpointSuggestions(endpoint, endpointIssues)
    });

  } catch (error) {
    telemetry.logger.error("Get endpoint details error", error);
    return errorResponse("Failed to get endpoint details", 500);
  }
};

// Generate OpenAPI specification
export const generateOpenApiSpec: RouteHandler = async (request, url) => {
  try {
    const format = url.searchParams.get("format") || "json";
    const includeUsage = url.searchParams.get("include_usage") === "true";
    const minify = url.searchParams.get("minify") === "true";
    
    const spec = apiDocs.generateOpenApiSpec();
    
    // Remove usage stats if not requested
    if (!includeUsage) {
      Object.values(spec.paths).forEach(pathMethods => {
        Object.values(pathMethods as Record<string, any>).forEach((method: any) => {
          delete method['x-usage-stats'];
        });
      });
    }
    
    if (format === "yaml") {
      // Convert to YAML (simplified conversion for demo)
      const yamlContent = JSON.stringify(spec, null, minify ? 0 : 2);
      return new Response(yamlContent, {
        headers: {
          "Content-Type": "application/x-yaml",
          "Content-Disposition": "attachment; filename=openapi.yaml"
        }
      });
    }
    
    return new Response(JSON.stringify(spec, null, minify ? 0 : 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=openapi.json"
      }
    });

  } catch (error) {
    telemetry.logger.error("Generate OpenAPI spec error", error);
    return errorResponse("Failed to generate OpenAPI specification", 500);
  }
};

// Generate Postman collection
export const generatePostmanCollection: RouteHandler = async (request, url) => {
  try {
    const includeExamples = url.searchParams.get("include_examples") !== "false";
    const includeAuth = url.searchParams.get("include_auth") !== "false";
    
    const collection = apiDocs.generatePostmanCollection();
    
    // Remove examples if not requested
    if (!includeExamples) {
      const removeExamples = (items: any[]) => {
        items.forEach(item => {
          if (item.item) {
            removeExamples(item.item);
          } else {
            delete item.response;
          }
        });
      };
      removeExamples(collection.item);
    }
    
    // Remove auth if not requested
    if (!includeAuth) {
      const removeAuth = (items: any[]) => {
        items.forEach(item => {
          if (item.item) {
            removeAuth(item.item);
          } else if (item.request && item.request.header) {
            item.request.header = item.request.header.filter((header: any) => 
              header.key !== "Authorization"
            );
          }
        });
      };
      removeAuth(collection.item);
    }
    
    return new Response(JSON.stringify(collection, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=pitchey-api.postman_collection.json"
      }
    });

  } catch (error) {
    telemetry.logger.error("Generate Postman collection error", error);
    return errorResponse("Failed to generate Postman collection", 500);
  }
};

// Generate Markdown documentation
export const generateMarkdownDocs: RouteHandler = async (request, url) => {
  try {
    const includeUsage = url.searchParams.get("include_usage") !== "false";
    const includeExamples = url.searchParams.get("include_examples") !== "false";
    
    const markdown = apiDocs.generateMarkdownDocs();
    
    // TODO: Filter based on parameters if needed
    
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": "attachment; filename=api-documentation.md"
      }
    });

  } catch (error) {
    telemetry.logger.error("Generate Markdown docs error", error);
    return errorResponse("Failed to generate Markdown documentation", 500);
  }
};

// Register or update endpoint documentation
export const registerEndpoint: RouteHandler = async (request, url) => {
  try {
    const endpointData = await request.json();
    
    // Validate required fields
    const requiredFields = ["path", "method", "summary", "description"];
    for (const field of requiredFields) {
      if (!endpointData[field]) {
        return errorResponse(`Missing required field: ${field}`, 400);
      }
    }
    
    // Set defaults
    const endpoint = {
      path: endpointData.path,
      method: endpointData.method.toLowerCase(),
      summary: endpointData.summary,
      description: endpointData.description,
      tags: endpointData.tags || ["uncategorized"],
      parameters: endpointData.parameters || [],
      requestBody: endpointData.requestBody,
      responses: endpointData.responses || {
        "200": { description: "Success" },
        "400": { description: "Bad Request" },
        "500": { description: "Internal Server Error" }
      },
      security: endpointData.security,
      deprecated: endpointData.deprecated || false,
      version: endpointData.version || "1.0.0",
      examples: endpointData.examples || []
    };
    
    const endpointId = apiDocs.registerEndpoint(endpoint);
    
    return successResponse({
      message: "Endpoint documentation registered successfully",
      endpoint_id: endpointId,
      endpoint: { ...endpoint, id: endpointId }
    });

  } catch (error) {
    telemetry.logger.error("Register endpoint error", error);
    return errorResponse("Failed to register endpoint documentation", 500);
  }
};

// Update existing endpoint documentation
export const updateEndpoint: RouteHandler = async (request, url) => {
  try {
    const endpointId = url.searchParams.get("endpoint_id");
    if (!endpointId) {
      return errorResponse("Endpoint ID is required", 400);
    }
    
    const updates = await request.json();
    const success = apiDocs.updateEndpoint(endpointId, updates);
    
    if (!success) {
      return errorResponse("Endpoint not found", 404);
    }
    
    return successResponse({
      message: "Endpoint documentation updated successfully",
      endpoint_id: endpointId,
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Update endpoint error", error);
    return errorResponse("Failed to update endpoint documentation", 500);
  }
};

// Remove endpoint documentation
export const removeEndpoint: RouteHandler = async (request, url) => {
  try {
    const endpointId = url.searchParams.get("endpoint_id");
    if (!endpointId) {
      return errorResponse("Endpoint ID is required", 400);
    }
    
    const success = apiDocs.removeEndpoint(endpointId);
    
    if (!success) {
      return errorResponse("Endpoint not found", 404);
    }
    
    return successResponse({
      message: "Endpoint documentation removed successfully",
      endpoint_id: endpointId,
      removed_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Remove endpoint error", error);
    return errorResponse("Failed to remove endpoint documentation", 500);
  }
};

// Validate documentation quality
export const validateDocumentation: RouteHandler = async (request, url) => {
  try {
    const includeResolved = url.searchParams.get("include_resolved") === "true";
    const severityFilter = url.searchParams.get("severity") || undefined;
    
    let issues = apiDocs.validateDocumentation();
    
    // Apply severity filter
    if (severityFilter) {
      issues = issues.filter(issue => issue.severity === severityFilter);
    }
    
    // Group issues by endpoint
    const issuesByEndpoint = issues.reduce((acc, issue) => {
      if (!acc[issue.endpoint]) {
        acc[issue.endpoint] = [];
      }
      acc[issue.endpoint].push(issue);
      return acc;
    }, {} as Record<string, typeof issues>);
    
    // Calculate quality metrics
    const totalEndpoints = apiDocs.getEndpoints().length;
    const endpointsWithIssues = Object.keys(issuesByEndpoint).length;
    const qualityScore = totalEndpoints > 0 
      ? ((totalEndpoints - endpointsWithIssues) / totalEndpoints) * 100 
      : 100;
    
    return successResponse({
      validation_summary: {
        total_issues: issues.length,
        endpoints_with_issues: endpointsWithIssues,
        total_endpoints: totalEndpoints,
        quality_score: Math.round(qualityScore),
        issue_breakdown: issues.reduce((acc, issue) => {
          acc[issue.severity] = (acc[issue.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      issues_by_endpoint: issuesByEndpoint,
      top_issues: issues.slice(0, 20), // Most critical issues first
      recommendations: generateValidationRecommendations(issues),
      severity_levels: ["error", "warning", "info"],
      filters: { severity: severityFilter, include_resolved: includeResolved }
    });

  } catch (error) {
    telemetry.logger.error("Validate documentation error", error);
    return errorResponse("Failed to validate documentation", 500);
  }
};

// Auto-discover endpoints from routes
export const autoDiscoverEndpoints: RouteHandler = async (request, url) => {
  try {
    // This would integrate with the router to discover endpoints
    // For now, return a mock response
    const discoveredCount = 0; // apiDocs.autoDiscoverEndpoints(routerRoutes);
    
    return successResponse({
      message: "Auto-discovery completed",
      discovered_endpoints: discoveredCount,
      timestamp: new Date().toISOString(),
      note: "Auto-discovery from routes is not yet implemented - endpoints must be manually registered"
    });

  } catch (error) {
    telemetry.logger.error("Auto-discover endpoints error", error);
    return errorResponse("Failed to auto-discover endpoints", 500);
  }
};

// Get documentation settings
export const getSettings: RouteHandler = async (request, url) => {
  try {
    const settings = apiDocs.getSettings();
    const schemas = apiDocs.getSchemas();
    
    return successResponse({
      settings,
      schemas: {
        total_schemas: Object.keys(schemas).length,
        schema_names: Object.keys(schemas)
      },
      capabilities: {
        auto_generation: settings.autoGenerate,
        auto_validation: settings.autoValidate,
        usage_tracking: settings.trackUsage,
        example_generation: settings.generateExamples,
        versioning: settings.enableVersioning,
        supported_formats: settings.outputFormats
      }
    });

  } catch (error) {
    telemetry.logger.error("Get settings error", error);
    return errorResponse("Failed to get documentation settings", 500);
  }
};

// Update documentation settings
export const updateSettings: RouteHandler = async (request, url) => {
  try {
    const settings = await request.json();
    
    // Validate settings
    if (settings.outputFormats && !Array.isArray(settings.outputFormats)) {
      return errorResponse("outputFormats must be an array", 400);
    }
    
    if (settings.updateInterval && (typeof settings.updateInterval !== "number" || settings.updateInterval < 1000)) {
      return errorResponse("updateInterval must be a number >= 1000", 400);
    }
    
    apiDocs.updateSettings(settings);
    
    return successResponse({
      message: "Documentation settings updated successfully",
      settings: apiDocs.getSettings(),
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Update settings error", error);
    return errorResponse("Failed to update documentation settings", 500);
  }
};

// Register schema for documentation
export const registerSchema: RouteHandler = async (request, url) => {
  try {
    const { name, schema } = await request.json();
    
    if (!name || !schema) {
      return errorResponse("Name and schema are required", 400);
    }
    
    apiDocs.registerSchema(name, schema);
    
    return successResponse({
      message: "Schema registered successfully",
      schema_name: name,
      registered_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Register schema error", error);
    return errorResponse("Failed to register schema", 500);
  }
};

// Test documentation system
export const testDocumentation: RouteHandler = async (request, url) => {
  try {
    const { test_type = "basic" } = await request.json();
    const testResults = [];
    
    switch (test_type) {
      case "basic":
        // Test basic functionality
        const endpoints = apiDocs.getEndpoints();
        testResults.push({
          test: "endpoint_retrieval",
          status: "success",
          result: `Retrieved ${endpoints.length} endpoints`
        });
        
        const metrics = apiDocs.getMetrics();
        testResults.push({
          test: "metrics_calculation",
          status: "success", 
          result: `Coverage: ${metrics.coveragePercentage.toFixed(2)}%`
        });
        break;
        
      case "validation":
        // Test validation system
        const issues = apiDocs.validateDocumentation();
        testResults.push({
          test: "documentation_validation",
          status: "success",
          result: `Found ${issues.length} validation issues`
        });
        break;
        
      case "generation":
        // Test generation capabilities
        const openApiSpec = apiDocs.generateOpenApiSpec();
        testResults.push({
          test: "openapi_generation",
          status: "success",
          result: `Generated spec with ${Object.keys(openApiSpec.paths).length} paths`
        });
        
        const postmanCollection = apiDocs.generatePostmanCollection();
        testResults.push({
          test: "postman_generation",
          status: "success",
          result: `Generated collection with ${postmanCollection.item.length} folders`
        });
        break;
        
      default:
        return errorResponse("Invalid test type", 400);
    }
    
    return successResponse({
      message: "Documentation system test completed",
      test_type,
      results: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Test documentation error", error);
    return errorResponse("Failed to test documentation system", 500);
  }
};

// Helper functions

function calculateDocumentationQuality(metrics: any, issues: any[]): number {
  let score = 100;
  
  // Coverage impact
  score = metrics.coveragePercentage;
  
  // Issues impact
  const errorIssues = issues.filter(i => i.severity === "error").length;
  const warningIssues = issues.filter(i => i.severity === "warning").length;
  
  score -= errorIssues * 10; // 10 points per error
  score -= warningIssues * 3; // 3 points per warning
  
  return Math.max(0, Math.min(100, score));
}

function getQualityStatus(score: number): string {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

function generateDocumentationRecommendations(metrics: any, issues: any[], score: number): string[] {
  const recommendations = [];
  
  if (score < 70) {
    recommendations.push("Documentation quality is below acceptable standards - immediate improvement needed");
  }
  
  if (metrics.coveragePercentage < 80) {
    recommendations.push("Add comprehensive documentation for undocumented endpoints");
  }
  
  const errorIssues = issues.filter(i => i.severity === "error").length;
  if (errorIssues > 0) {
    recommendations.push(`Fix ${errorIssues} critical documentation errors`);
  }
  
  if (metrics.deprecatedEndpoints > 0) {
    recommendations.push("Review and update deprecated endpoint documentation");
  }
  
  const undocumentedEndpoints = metrics.totalEndpoints - metrics.documentedEndpoints;
  if (undocumentedEndpoints > 0) {
    recommendations.push(`Add documentation for ${undocumentedEndpoints} undocumented endpoints`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Documentation quality is excellent - continue maintaining standards");
  }
  
  return recommendations;
}

function calculateEndpointDocumentationScore(endpoint: any, issues: any[]): number {
  let score = 100;
  
  // Check completeness
  if (!endpoint.description || endpoint.description.length < 10) score -= 20;
  if (endpoint.examples.length === 0) score -= 15;
  if (endpoint.parameters.length === 0 && !endpoint.path.includes("/public")) score -= 10;
  if (!endpoint.security && !endpoint.path.includes("/public")) score -= 15;
  
  // Issues impact
  const errorIssues = issues.filter(i => i.severity === "error").length;
  const warningIssues = issues.filter(i => i.severity === "warning").length;
  
  score -= errorIssues * 20;
  score -= warningIssues * 10;
  
  return Math.max(0, Math.min(100, score));
}

function findRelatedEndpoints(endpoint: any, allEndpoints: any[]): any[] {
  return allEndpoints
    .filter(e => 
      e.id !== endpoint.id && 
      (e.path.startsWith(endpoint.path.split('/')[1]) || 
       e.tags.some(tag => endpoint.tags.includes(tag)))
    )
    .slice(0, 5)
    .map(e => ({
      id: e.id,
      method: e.method.toUpperCase(),
      path: e.path,
      summary: e.summary
    }));
}

function generateEndpointSuggestions(endpoint: any, issues: any[]): string[] {
  const suggestions = [];
  
  if (endpoint.description.length < 50) {
    suggestions.push("Consider adding a more detailed description explaining the endpoint's purpose and use cases");
  }
  
  if (endpoint.examples.length === 0) {
    suggestions.push("Add request/response examples to improve developer experience");
  }
  
  if (endpoint.parameters.length > 5) {
    suggestions.push("Consider grouping related parameters or using request body for complex data");
  }
  
  if (endpoint.deprecated && !endpoint.description.includes("alternative")) {
    suggestions.push("Add migration guide or alternative endpoint information");
  }
  
  const errorIssues = issues.filter(i => i.severity === "error");
  if (errorIssues.length > 0) {
    suggestions.push(`Address ${errorIssues.length} critical documentation issues`);
  }
  
  return suggestions;
}

function generateValidationRecommendations(issues: any[]): string[] {
  const recommendations = [];
  
  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  
  if (errorCount > 0) {
    recommendations.push(`Fix ${errorCount} critical errors to improve API security and usability`);
  }
  
  if (warningCount > 10) {
    recommendations.push("Address documentation warnings to improve developer experience");
  }
  
  const missingDescriptions = issues.filter(i => i.issue.includes("description")).length;
  if (missingDescriptions > 5) {
    recommendations.push("Focus on adding comprehensive descriptions for better API understanding");
  }
  
  const missingExamples = issues.filter(i => i.issue.includes("examples")).length;
  if (missingExamples > 5) {
    recommendations.push("Add practical examples to help developers integrate with your API");
  }
  
  return recommendations;
}