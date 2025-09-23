import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { users } from "../../../src/db/schema.ts";
import { eq } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  // Get verification status
  async GET(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await db.select({
        companyName: users.companyName,
        companyNumber: users.companyNumber,
        companyWebsite: users.companyWebsite,
        companyVerified: users.companyVerified,
        userType: users.userType,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

      if (!user.length) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        verification: {
          isVerified: user[0].companyVerified,
          companyName: user[0].companyName,
          companyNumber: user[0].companyNumber,
          companyWebsite: user[0].companyWebsite,
          userType: user[0].userType,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching verification status:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Submit verification request
  async POST(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { companyName, companyNumber, companyWebsite, companyAddress } = body;

      // Validate required fields
      if (!companyName || !companyNumber) {
        return new Response(JSON.stringify({ 
          error: "Company name and registration number are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Update user with company information
      await db.update(users)
        .set({
          companyName,
          companyNumber,
          companyWebsite,
          companyAddress,
          companyVerified: false, // Will be set to true after manual verification
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // In production, this would trigger a verification process
      // For now, auto-verify for demo purposes
      setTimeout(async () => {
        await db.update(users)
          .set({
            companyVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      }, 2000);

      return new Response(JSON.stringify({
        success: true,
        message: "Verification request submitted. You will be notified once verified.",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error submitting verification:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};