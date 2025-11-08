import { db } from "../src/db/client.ts";
import { sessions, users } from "../src/db/schema.ts";
import { eq, and, gte } from "npm:drizzle-orm@0.35.3";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-in-production";

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createToken(userId: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  const jwt = await create(
    { alg: "HS256", typ: "JWT" },
    { 
      userId, 
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    },
    key,
  );

  return jwt;
}

export async function verifyToken(token: string): Promise<number | null> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    const payload = await verify(token, key);
    
    if (payload.userId && typeof payload.userId === "number") {
      // Verify session in database
      const session = await db.select()
        .from(sessions)
        .where(and(
          eq(sessions.token, token),
          gte(sessions.expiresAt, new Date())
        ))
        .limit(1);

      if (session.length > 0) {
        return payload.userId;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

export async function createSession(userId: number, ipAddress?: string, userAgent?: string): Promise<string> {
  const token = await createToken(userId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    token,
    ipAddress,
    userAgent,
    expiresAt,
  });

  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function getUserFromToken(token: string) {
  const userId = await verifyToken(token);
  if (!userId) return null;

  const user = await db.select({
    id: users.id,
    email: users.email,
    username: users.username,
    userType: users.userType,
    firstName: users.firstName,
    lastName: users.lastName,
    companyName: users.companyName,
    companyVerified: users.companyVerified,
    subscriptionTier: users.subscriptionTier,
  })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

  return user[0] || null;
}