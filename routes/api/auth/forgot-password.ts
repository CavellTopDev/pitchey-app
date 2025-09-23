import { Handlers } from "$fresh/server.ts";
import { AuthService } from "../../../src/services/auth.service.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ForgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const handler: Handlers = {
  async POST(req) {
    try {
      const body = await req.json();
      
      // Validate request body
      const validation = ForgotPasswordSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({
          error: "Invalid input",
          details: validation.error.issues,
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { email } = validation.data;

      // Initiate password reset
      await AuthService.initiatePasswordReset(email);

      // Always return success for security (don't reveal if email exists)
      return new Response(JSON.stringify({
        success: true,
        message: "If an account with that email exists, you will receive a password reset link shortly.",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Password reset error:", error);
      
      return new Response(JSON.stringify({
        error: "An error occurred while processing your request. Please try again.",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Handle preflight CORS requests
  async OPTIONS() {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  },
};