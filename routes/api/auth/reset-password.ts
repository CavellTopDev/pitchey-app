import { Handlers } from "$fresh/server.ts";
import { AuthService } from "../../../src/services/auth.service.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const handler: Handlers = {
  async POST(req) {
    try {
      const body = await req.json();
      
      // Validate request body
      const validation = ResetPasswordSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({
          error: "Invalid input",
          details: validation.error.issues,
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { token, password } = validation.data;

      // Reset password
      const result = await AuthService.resetPassword(token, password);

      return new Response(JSON.stringify({
        success: true,
        message: "Password has been reset successfully. Please log in with your new password.",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Password reset error:", error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("Invalid or expired")) {
          return new Response(JSON.stringify({
            error: "Invalid or expired reset token. Please request a new password reset.",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      
      return new Response(JSON.stringify({
        error: "An error occurred while resetting your password. Please try again.",
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