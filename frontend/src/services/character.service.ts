// Character Service - Frontend integration with character management API
// Provides comprehensive character CRUD and ordering operations

import { apiClient } from '../lib/api-client';
import { API_URL } from '../config';
import type { Character } from '../types/character';

export interface CharacterOrderItem {
  id: number;
  displayOrder: number;
}

export interface CharacterResponse {
  success: boolean;
  data?: {
    character?: Character;
    characters?: Character[];
  };
  message?: string;
  error?: string;
}

export interface CharactersResponse {
  success: boolean;
  data?: {
    characters: Character[];
  };
  message?: string;
  error?: string;
}

class CharacterService {
  /**
   * Get all characters for a pitch
   */
  async getCharacters(pitchId: number): Promise<Character[]> {
    try {
      const response = await apiClient.get(`/api/pitches/${pitchId}/characters`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch characters');
      }

      return response.data.data?.characters || [];
    } catch (error: any) {
      console.error('Error fetching characters:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch characters');
    }
  }

  /**
   * Add a new character to a pitch
   */
  async addCharacter(pitchId: number, character: Omit<Character, 'id' | 'displayOrder'>): Promise<Character> {
    try {
      const response = await apiClient.post(`/api/pitches/${pitchId}/characters`, character);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to add character');
      }

      return response.data.data.character;
    } catch (error: any) {
      console.error('Error adding character:', error);
      throw new Error(error.response?.data?.message || 'Failed to add character');
    }
  }

  /**
   * Update an existing character
   */
  async updateCharacter(pitchId: number, characterId: number, character: Omit<Character, 'id' | 'displayOrder'>): Promise<Character> {
    try {
      const response = await apiClient.put(`/api/pitches/${pitchId}/characters/${characterId}`, character);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update character');
      }

      return response.data.data.character;
    } catch (error: any) {
      console.error('Error updating character:', error);
      throw new Error(error.response?.data?.message || 'Failed to update character');
    }
  }

  /**
   * Delete a character
   */
  async deleteCharacter(pitchId: number, characterId: number): Promise<void> {
    try {
      const response = await apiClient.delete(`/api/pitches/${pitchId}/characters/${characterId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete character');
      }
    } catch (error: any) {
      console.error('Error deleting character:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete character');
    }
  }

  /**
   * Reorder characters with full order specification
   */
  async reorderCharacters(pitchId: number, characterOrders: CharacterOrderItem[]): Promise<Character[]> {
    try {
      const response = await apiClient.post(`/api/pitches/${pitchId}/characters/reorder`, {
        characterOrders
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to reorder characters');
      }

      return response.data.data.characters;
    } catch (error: any) {
      console.error('Error reordering characters:', error);
      throw new Error(error.response?.data?.message || 'Failed to reorder characters');
    }
  }

  /**
   * Move a character up or down by one position
   */
  async moveCharacter(pitchId: number, characterId: number, direction: 'up' | 'down'): Promise<Character[]> {
    try {
      const response = await apiClient.patch(`/api/pitches/${pitchId}/characters/${characterId}/position`, {
        direction
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to move character');
      }

      return response.data.data.characters;
    } catch (error: any) {
      console.error('Error moving character:', error);
      throw new Error(error.response?.data?.message || 'Failed to move character');
    }
  }

  /**
   * Convert frontend Character to API format
   */
  private toApiFormat(character: Partial<Character>) {
    return {
      name: character.name,
      description: character.description,
      age: character.age,
      gender: character.gender,
      actor: character.actor,
      role: character.role,
      relationship: character.relationship,
    };
  }

  /**
   * Convert API response to frontend Character format
   */
  private fromApiFormat(apiCharacter: any): Character {
    return {
      id: apiCharacter.id?.toString() || '',
      name: apiCharacter.name || '',
      description: apiCharacter.description || '',
      age: apiCharacter.age,
      gender: apiCharacter.gender,
      actor: apiCharacter.actor,
      role: apiCharacter.role,
      relationship: apiCharacter.relationship,
      displayOrder: apiCharacter.displayOrder || 0,
    };
  }

  /**
   * Batch character operations for optimistic updates
   */
  async batchUpdateCharacters(pitchId: number, operations: {
    add?: Omit<Character, 'id' | 'displayOrder'>[];
    update?: { id: number; character: Partial<Character> }[];
    delete?: number[];
    reorder?: CharacterOrderItem[];
  }): Promise<Character[]> {
    try {
      // Execute operations in sequence to maintain data consistency
      let characters = await this.getCharacters(pitchId);

      // Handle deletions first
      if (operations.delete?.length) {
        for (const characterId of operations.delete) {
          await this.deleteCharacter(pitchId, characterId);
        }
      }

      // Handle updates
      if (operations.update?.length) {
        for (const { id, character } of operations.update) {
          await this.updateCharacter(pitchId, id, character as Omit<Character, 'id' | 'displayOrder'>);
        }
      }

      // Handle additions
      if (operations.add?.length) {
        for (const character of operations.add) {
          await this.addCharacter(pitchId, character);
        }
      }

      // Handle reordering last
      if (operations.reorder?.length) {
        characters = await this.reorderCharacters(pitchId, operations.reorder);
      } else {
        // Refetch to get updated list
        characters = await this.getCharacters(pitchId);
      }

      return characters;
    } catch (error) {
      console.error('Error in batch character update:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const characterService = new CharacterService();
export default characterService;