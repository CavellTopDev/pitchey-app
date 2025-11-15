/**
 * System Routes Module - Health, Version, Config
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders } from "../utils/response.ts";
import { getEnvironmentHealth } from "../utils/env-validation.ts";
import { telemetry } from "../utils/telemetry.ts";

const startTime = Date.now();

export const health: RouteHandler = async (request, url) => {
  try {
    const envHealth = getEnvironmentHealth();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    const healthData = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: `${uptime}s`,
      environment: envHealth.environment,
      service: "pitchey-backend",
      version: "3.4-modular",
      checks: {
        database: "ok", // Could add actual DB ping here
        environment: envHealth.status,
        telemetry: telemetry.getHealthStatus().initialized ? "ok" : "warning"
      }
    };

    return new Response(JSON.stringify(healthData), {
      status: envHealth.status === "error" ? 503 : 200,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });

  } catch (error) {
    telemetry.logger.error("Health check error", error);
    return new Response(JSON.stringify({
      status: "error",
      timestamp: new Date().toISOString(),
      error: "Health check failed"
    }), {
      status: 500,
      headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
    });
  }
};

export const version: RouteHandler = async (request, url) => {
  return new Response(JSON.stringify({
    version: "3.4-modular",
    buildDate: "2025-11-15",
    environment: Deno.env.get("DENO_ENV") || "development",
    features: [
      "modular-architecture",
      "sentry-telemetry", 
      "redis-caching",
      "websocket-support"
    ]
  }), {
    status: 200,
    headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
  });
};

export const config: RouteHandler = async (request, url) => {
  return new Response(JSON.stringify({
    genres: [
      "Action", "Comedy", "Drama", "Horror", "Sci-Fi", 
      "Romance", "Thriller", "Documentary", "Animation"
    ],
    formats: [
      "Feature Film", "Short Film", "Series", "Documentary", 
      "Web Series", "Music Video"
    ],
    budgetRanges: [
      "Under $100K", "$100K-$500K", "$500K-$1M", 
      "$1M-$5M", "$5M-$20M", "Over $20M"
    ],
    stages: [
      "Script Development", "Pre-Production", "Production", 
      "Post-Production", "Distribution"
    ]
  }), {
    status: 200,
    headers: { ...getCorsHeaders(), ...getSecurityHeaders() }
  });
};