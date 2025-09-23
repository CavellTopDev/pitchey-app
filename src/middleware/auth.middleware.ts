import { MiddlewareHandlerContext } from "fresh/server.ts";
import { AuthService } from "@/services/auth.service.ts";
import { getCookies } from "$std/http/cookie.ts";

export interface AuthState {
  user?: any;
  session?: any;
}

export async function authMiddleware(
  req: Request,
  ctx: MiddlewareHandlerContext<AuthState>,
) {
  // Get token from cookie
  const cookies = getCookies(req.headers);
  const token = cookies.auth_token;
  
  if (token) {
    const session = await AuthService.verifySession(token);
    if (session) {
      ctx.state.user = session.user;
      ctx.state.session = session;
    }
  }
  
  return await ctx.next();
}

export function requireAuth(
  req: Request,
  ctx: MiddlewareHandlerContext<AuthState>,
) {
  if (!ctx.state.user) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/login" },
    });
  }
  
  return ctx.next();
}

export function requireUserType(types: string[]) {
  return (req: Request, ctx: MiddlewareHandlerContext<AuthState>) => {
    if (!ctx.state.user || !types.includes(ctx.state.user.userType)) {
      return new Response("Unauthorized", { status: 403 });
    }
    
    return ctx.next();
  };
}