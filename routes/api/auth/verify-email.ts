import { Handlers } from "$fresh/server.ts";
import { AuthService } from "../../../src/services/auth.service.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const VerifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const handler: Handlers = {
  async POST(req) {
    try {
      const body = await req.json();
      
      // Validate request body
      const validation = VerifyEmailSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({
          error: "Invalid input",
          details: validation.error.issues,
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { token } = validation.data;

      // Verify email
      const user = await AuthService.verifyEmail(token);

      return new Response(JSON.stringify({
        success: true,
        message: "Email verified successfully! Your account is now active.",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: true,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Email verification error:", error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("Invalid token")) {
          return new Response(JSON.stringify({
            error: "Invalid or expired verification token. Please request a new verification email.",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      
      return new Response(JSON.stringify({
        error: "An error occurred while verifying your email. Please try again.",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Also handle GET requests for email verification links from emails
  async GET(req) {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");

      if (!token) {
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invalid Verification Link - Pitchey</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .error { color: #ef4444; }
                .button { background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
              </style>
            </head>
            <body>
              <h1 class="error">Invalid Verification Link</h1>
              <p>The verification link is invalid or missing required parameters.</p>
              <a href="${Deno.env.get("BASE_URL") || "https://pitchey.com"}" class="button">Go to Home</a>
            </body>
          </html>
        `, {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Verify email
      const user = await AuthService.verifyEmail(token);

      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email Verified - Pitchey</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
              .success { color: #10b981; }
              .button { background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1 class="success">Email Verified Successfully!</h1>
            <p>Welcome to Pitchey, ${user.firstName || user.username}! Your email has been verified and your account is now active.</p>
            <p>You can now log in and start using all features of the platform.</p>
            <a href="${Deno.env.get("BASE_URL") || "https://pitchey.com"}/login" class="button">Log In</a>
          </body>
        </html>
      `, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });

    } catch (error) {
      console.error("Email verification error:", error);
      
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Verification Failed - Pitchey</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #ef4444; }
              .button { background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1 class="error">Verification Failed</h1>
            <p>The verification token is invalid or has expired. Please request a new verification email.</p>
            <a href="${Deno.env.get("BASE_URL") || "https://pitchey.com"}/login" class="button">Go to Login</a>
          </body>
        </html>
      `, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }
  },

  // Handle preflight CORS requests
  async OPTIONS() {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  },
};