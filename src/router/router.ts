/**
 * Lightweight router for Deno Deploy optimization
 */

import { RouteHandler, Route, Router } from "./types.ts";

export class SimpleRouter implements Router {
  routes: Route[] = [];

  add(method: string, path: string, handler: RouteHandler, middleware: RouteHandler[] = []): void {
    this.routes.push({ method, path, handler, middleware });
  }

  async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;

    for (const route of this.routes) {
      if (route.method === method && this.pathMatches(route.path, url.pathname)) {
        const params = this.extractParams(route.path, url.pathname);
        
        // Run middleware first
        for (const middleware of route.middleware) {
          try {
            const middlewareResult = await middleware(request, url, params);
            if (middlewareResult.status >= 400) {
              return middlewareResult; // Middleware rejected request
            }
          } catch (error) {
            console.error("Middleware error:", error);
            return new Response("Internal Server Error", { status: 500 });
          }
        }

        // Run main handler
        try {
          return await route.handler(request, url, params);
        } catch (error) {
          console.error(`Route handler error for ${method} ${route.path}:`, error);
          return new Response("Internal Server Error", { status: 500 });
        }
      }
    }

    return null; // No route matched
  }

  private pathMatches(routePath: string, requestPath: string): boolean {
    if (routePath === requestPath) return true;
    
    // Handle path parameters like /api/users/:id
    const routeParts = routePath.split('/');
    const requestParts = requestPath.split('/');
    
    if (routeParts.length !== requestParts.length) return false;
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) continue; // Parameter
      if (routeParts[i] !== requestParts[i]) return false;
    }
    
    return true;
  }

  private extractParams(routePath: string, requestPath: string): Record<string, string> {
    const params: Record<string, string> = {};
    const routeParts = routePath.split('/');
    const requestParts = requestPath.split('/');
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].slice(1);
        params[paramName] = requestParts[i];
      }
    }
    
    return params;
  }

  get(path: string, handler: RouteHandler, middleware: RouteHandler[] = []): void {
    this.add("GET", path, handler, middleware);
  }

  post(path: string, handler: RouteHandler, middleware: RouteHandler[] = []): void {
    this.add("POST", path, handler, middleware);
  }

  put(path: string, handler: RouteHandler, middleware: RouteHandler[] = []): void {
    this.add("PUT", path, handler, middleware);
  }

  delete(path: string, handler: RouteHandler, middleware: RouteHandler[] = []): void {
    this.add("DELETE", path, handler, middleware);
  }

  patch(path: string, handler: RouteHandler, middleware: RouteHandler[] = []): void {
    this.add("PATCH", path, handler, middleware);
  }
}