/**
 * Character Routes Module - Character management for pitches
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { pitchCharacters, pitches } from "../db/schema.ts";
import { eq, desc, and, sql } from "npm:drizzle-orm@0.35.3";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { validateEnvironment } from "../utils/env-validation.ts";

const envConfig = validateEnvironment();
const JWT_SECRET = envConfig.JWT_SECRET;

// Helper function to extract user from JWT token
async function getUserFromToken(request: Request): Promise<any> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No valid authorization header found");
  }

  const token = authHeader.substring(7);
  const payload = await verify(
    token,
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
  );
  
  return payload;
}

// Helper function to validate user owns pitch
async function validatePitchOwnership(userId: number, pitchId: number): Promise<boolean> {
  const pitch = await db
    .select({ userId: pitches.userId })
    .from(pitches)
    .where(eq(pitches.id, pitchId))
    .limit(1);
    
  return pitch[0]?.userId === userId;
}

// Get characters for a pitch
export const getPitchCharacters: RouteHandler = async (request, url) => {
  try {
    const pathParts = url.pathname.split('/');
    const pitchId = parseInt(pathParts[pathParts.indexOf('pitches') + 1]);
    
    if (!pitchId || isNaN(pitchId)) {
      return errorResponse("Invalid pitch ID", 400);
    }

    // Get characters ordered by display_order
    const characters = await db
      .select()
      .from(pitchCharacters)
      .where(eq(pitchCharacters.pitchId, pitchId))
      .orderBy(pitchCharacters.displayOrder);

    return successResponse({ characters });

  } catch (error) {
    telemetry.logger.error("Get pitch characters error", error);
    return errorResponse("Failed to fetch characters", 500);
  }
};

// Add character to a pitch
export const addCharacter: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const pathParts = url.pathname.split('/');
    const pitchId = parseInt(pathParts[pathParts.indexOf('pitches') + 1]);
    
    if (!pitchId || isNaN(pitchId)) {
      return errorResponse("Invalid pitch ID", 400);
    }

    // Validate ownership
    if (!await validatePitchOwnership(user.id, pitchId)) {
      return errorResponse("Unauthorized: You don't own this pitch", 403);
    }

    const body = await request.json();
    const { name, description, age, gender, actor, role, relationship } = body;

    // Validate required fields
    if (!name?.trim() || !description?.trim()) {
      return errorResponse("Character name and description are required", 400);
    }

    // Get the next display order
    const lastOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(display_order), -1)` })
      .from(pitchCharacters)
      .where(eq(pitchCharacters.pitchId, pitchId));
      
    const nextOrder = (lastOrderResult[0]?.maxOrder || -1) + 1;

    // Insert character
    const [newCharacter] = await db
      .insert(pitchCharacters)
      .values({
        pitchId,
        name: name.trim(),
        description: description.trim(),
        age: age?.trim() || null,
        gender: gender?.trim() || null,
        actor: actor?.trim() || null,
        role: role?.trim() || null,
        relationship: relationship?.trim() || null,
        displayOrder: nextOrder,
      })
      .returning();

    return successResponse(newCharacter);

  } catch (error) {
    telemetry.logger.error("Add character error", error);
    return errorResponse("Failed to add character", 500);
  }
};

// Update character
export const updateCharacter: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const pathParts = url.pathname.split('/');
    const pitchId = parseInt(pathParts[pathParts.indexOf('pitches') + 1]);
    const characterId = parseInt(pathParts[pathParts.indexOf('characters') + 1]);
    
    if (!pitchId || isNaN(pitchId) || !characterId || isNaN(characterId)) {
      return errorResponse("Invalid pitch or character ID", 400);
    }

    // Validate ownership
    if (!await validatePitchOwnership(user.id, pitchId)) {
      return errorResponse("Unauthorized: You don't own this pitch", 403);
    }

    const body = await request.json();
    const { name, description, age, gender, actor, role, relationship } = body;

    // Validate required fields
    if (!name?.trim() || !description?.trim()) {
      return errorResponse("Character name and description are required", 400);
    }

    // Update character
    const [updatedCharacter] = await db
      .update(pitchCharacters)
      .set({
        name: name.trim(),
        description: description.trim(),
        age: age?.trim() || null,
        gender: gender?.trim() || null,
        actor: actor?.trim() || null,
        role: role?.trim() || null,
        relationship: relationship?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(pitchCharacters.id, characterId),
        eq(pitchCharacters.pitchId, pitchId)
      ))
      .returning();

    if (!updatedCharacter) {
      return errorResponse("Character not found", 404);
    }

    return successResponse(updatedCharacter);

  } catch (error) {
    telemetry.logger.error("Update character error", error);
    return errorResponse("Failed to update character", 500);
  }
};

// Delete character
export const deleteCharacter: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const pathParts = url.pathname.split('/');
    const pitchId = parseInt(pathParts[pathParts.indexOf('pitches') + 1]);
    const characterId = parseInt(pathParts[pathParts.indexOf('characters') + 1]);
    
    if (!pitchId || isNaN(pitchId) || !characterId || isNaN(characterId)) {
      return errorResponse("Invalid pitch or character ID", 400);
    }

    // Validate ownership
    if (!await validatePitchOwnership(user.id, pitchId)) {
      return errorResponse("Unauthorized: You don't own this pitch", 403);
    }

    // Get the character's display order before deletion
    const characterToDelete = await db
      .select({ displayOrder: pitchCharacters.displayOrder })
      .from(pitchCharacters)
      .where(and(
        eq(pitchCharacters.id, characterId),
        eq(pitchCharacters.pitchId, pitchId)
      ))
      .limit(1);

    if (!characterToDelete[0]) {
      return errorResponse("Character not found", 404);
    }

    // Delete character
    await db
      .delete(pitchCharacters)
      .where(and(
        eq(pitchCharacters.id, characterId),
        eq(pitchCharacters.pitchId, pitchId)
      ));

    // Reorder remaining characters to fill gap
    await db
      .update(pitchCharacters)
      .set({
        displayOrder: sql`display_order - 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(pitchCharacters.pitchId, pitchId),
        sql`display_order > ${characterToDelete[0].displayOrder}`
      ));

    return successResponse({ message: "Character deleted successfully" });

  } catch (error) {
    telemetry.logger.error("Delete character error", error);
    return errorResponse("Failed to delete character", 500);
  }
};

// Reorder characters
export const reorderCharacters: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const pathParts = url.pathname.split('/');
    const pitchId = parseInt(pathParts[pathParts.indexOf('pitches') + 1]);
    
    if (!pitchId || isNaN(pitchId)) {
      return errorResponse("Invalid pitch ID", 400);
    }

    // Validate ownership
    if (!await validatePitchOwnership(user.id, pitchId)) {
      return errorResponse("Unauthorized: You don't own this pitch", 403);
    }

    const body = await request.json();
    const { characterOrders } = body;

    if (!Array.isArray(characterOrders)) {
      return errorResponse("characterOrders must be an array", 400);
    }

    // Validate all character IDs belong to this pitch
    const existingCharacters = await db
      .select({ id: pitchCharacters.id })
      .from(pitchCharacters)
      .where(eq(pitchCharacters.pitchId, pitchId));

    const existingIds = new Set(existingCharacters.map(c => c.id));
    const providedIds = new Set(characterOrders.map(item => item.id));

    if (existingIds.size !== providedIds.size || 
        ![...existingIds].every(id => providedIds.has(id))) {
      return errorResponse("Invalid character order data", 400);
    }

    // Update display orders in a transaction
    await db.transaction(async (tx) => {
      for (const item of characterOrders) {
        await tx
          .update(pitchCharacters)
          .set({
            displayOrder: item.displayOrder,
            updatedAt: new Date(),
          })
          .where(and(
            eq(pitchCharacters.id, item.id),
            eq(pitchCharacters.pitchId, pitchId)
          ));
      }
    });

    // Get updated characters
    const updatedCharacters = await db
      .select()
      .from(pitchCharacters)
      .where(eq(pitchCharacters.pitchId, pitchId))
      .orderBy(pitchCharacters.displayOrder);

    return successResponse({ characters: updatedCharacters });

  } catch (error) {
    telemetry.logger.error("Reorder characters error", error);
    return errorResponse("Failed to reorder characters", 500);
  }
};

// Update character position (move up/down)
export const updateCharacterPosition: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const pathParts = url.pathname.split('/');
    const pitchId = parseInt(pathParts[pathParts.indexOf('pitches') + 1]);
    const characterId = parseInt(pathParts[pathParts.indexOf('characters') + 1]);
    
    if (!pitchId || isNaN(pitchId) || !characterId || isNaN(characterId)) {
      return errorResponse("Invalid pitch or character ID", 400);
    }

    // Validate ownership
    if (!await validatePitchOwnership(user.id, pitchId)) {
      return errorResponse("Unauthorized: You don't own this pitch", 403);
    }

    const body = await request.json();
    const { direction } = body; // 'up' or 'down'

    if (!['up', 'down'].includes(direction)) {
      return errorResponse("Direction must be 'up' or 'down'", 400);
    }

    // Get current character's position
    const currentCharacter = await db
      .select({ displayOrder: pitchCharacters.displayOrder })
      .from(pitchCharacters)
      .where(and(
        eq(pitchCharacters.id, characterId),
        eq(pitchCharacters.pitchId, pitchId)
      ))
      .limit(1);

    if (!currentCharacter[0]) {
      return errorResponse("Character not found", 404);
    }

    const currentOrder = currentCharacter[0].displayOrder;
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;

    // Find the character to swap with
    const targetCharacter = await db
      .select({ id: pitchCharacters.id })
      .from(pitchCharacters)
      .where(and(
        eq(pitchCharacters.pitchId, pitchId),
        eq(pitchCharacters.displayOrder, targetOrder)
      ))
      .limit(1);

    if (!targetCharacter[0]) {
      return errorResponse("Cannot move character in that direction", 400);
    }

    // Swap positions in a transaction
    await db.transaction(async (tx) => {
      // Move current character to target position
      await tx
        .update(pitchCharacters)
        .set({ 
          displayOrder: targetOrder,
          updatedAt: new Date() 
        })
        .where(eq(pitchCharacters.id, characterId));

      // Move target character to current position
      await tx
        .update(pitchCharacters)
        .set({ 
          displayOrder: currentOrder,
          updatedAt: new Date() 
        })
        .where(eq(pitchCharacters.id, targetCharacter[0].id));
    });

    // Get updated characters
    const updatedCharacters = await db
      .select()
      .from(pitchCharacters)
      .where(eq(pitchCharacters.pitchId, pitchId))
      .orderBy(pitchCharacters.displayOrder);

    return successResponse({ characters: updatedCharacters });

  } catch (error) {
    telemetry.logger.error("Update character position error", error);
    return errorResponse("Failed to update character position", 500);
  }
};