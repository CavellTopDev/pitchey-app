export interface Character {
  id?: string; // Temporary client-side ID for managing state
  name: string;
  description: string;
  age?: string;
  gender?: string;
  actor?: string;
  displayOrder?: number; // For ordering characters
}

export interface CharacterFormData extends Character {
  isEditing?: boolean;
}