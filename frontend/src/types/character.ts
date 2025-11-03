export interface Character {
  id?: string; // Temporary client-side ID for managing state
  name: string;
  description: string;
  age?: string;
  gender?: string;
  actor?: string;
  role?: string; // Character's role/position in the story
  relationship?: string; // Key relationships to other characters
  displayOrder?: number; // For ordering characters
}

export interface CharacterFormData extends Character {
  isEditing?: boolean;
}