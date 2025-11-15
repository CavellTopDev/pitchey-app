/**
 * Router types for modular route handling
 */

export interface RouteHandler {
  (request: Request, url: URL, params?: Record<string, string>): Promise<Response>;
}

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  middleware?: RouteHandler[];
}

export interface Router {
  routes: Route[];
  add(method: string, path: string, handler: RouteHandler, middleware?: RouteHandler[]): void;
  handle(request: Request): Promise<Response | null>;
}

export interface RouteContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  user?: any;
  userId?: number;
}