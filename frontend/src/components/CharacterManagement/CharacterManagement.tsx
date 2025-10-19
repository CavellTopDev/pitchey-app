import React, { useState, useCallback } from 'react';
import { Plus, Users, AlertCircle, ArrowUpDown } from 'lucide-react';
import { Character } from '../../types/character';
import { CharacterCard } from './CharacterCard';
import { CharacterForm } from './CharacterForm';

interface CharacterManagementProps {
  characters: Character[];
  onChange: (characters: Character[]) => void;
  maxCharacters?: number;
}

export const CharacterManagement: React.FC<CharacterManagementProps> = ({
  characters,
  onChange,
  maxCharacters = 10
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>();
  const [isReordering, setIsReordering] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);

  // Ensure characters have unique IDs
  const normalizedCharacters = characters.map((char, index) => ({
    ...char,
    id: char.id || `char_${index}_${Date.now()}`,
    displayOrder: char.displayOrder ?? index
  }));

  const handleAddCharacter = () => {
    if (normalizedCharacters.length >= maxCharacters) {
      alert(`You can only add up to ${maxCharacters} characters.`);
      return;
    }
    setEditingCharacter(undefined);
    setIsFormOpen(true);
  };

  const handleEditCharacter = (character: Character) => {
    setEditingCharacter(character);
    setIsFormOpen(true);
  };

  const handleSaveCharacter = (character: Character) => {
    let updatedCharacters;
    
    if (editingCharacter) {
      // Update existing character
      updatedCharacters = normalizedCharacters.map(char => 
        char.id === character.id ? character : char
      );
    } else {
      // Add new character
      const newCharacter = {
        ...character,
        displayOrder: normalizedCharacters.length
      };
      updatedCharacters = [...normalizedCharacters, newCharacter];
    }

    onChange(updatedCharacters);
    setIsFormOpen(false);
    setEditingCharacter(undefined);
  };

  const handleDeleteCharacter = (id: string) => {
    if (confirm('Are you sure you want to delete this character?')) {
      const updatedCharacters = normalizedCharacters
        .filter(char => char.id !== id)
        .map((char, index) => ({ ...char, displayOrder: index }));
      onChange(updatedCharacters);
    }
  };

  const handleMoveCharacter = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= normalizedCharacters.length || fromIndex === toIndex) return;
    
    const updatedCharacters = [...normalizedCharacters];
    const [movedCharacter] = updatedCharacters.splice(fromIndex, 1);
    updatedCharacters.splice(toIndex, 0, movedCharacter);
    
    // Update display order
    const reorderedCharacters = updatedCharacters.map((char, index) => ({
      ...char,
      displayOrder: index
    }));
    
    onChange(reorderedCharacters);
  }, [normalizedCharacters, onChange]);

  const handleMoveUp = useCallback((index: number) => {
    handleMoveCharacter(index, index - 1);
  }, [handleMoveCharacter]);

  const handleMoveDown = useCallback((index: number) => {
    handleMoveCharacter(index, index + 1);
  }, [handleMoveCharacter]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
    e.currentTarget.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    e.currentTarget.style.opacity = '1';
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItem(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem !== null && draggedItem !== dropIndex) {
      handleMoveCharacter(draggedItem, dropIndex);
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  }, [draggedItem, handleMoveCharacter]);

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingCharacter(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Characters</h3>
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
            {normalizedCharacters.length}/{maxCharacters}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {normalizedCharacters.length > 1 && (
            <button
              type="button"
              onClick={() => setIsReordering(!isReordering)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isReordering
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={isReordering ? 'Finish reordering' : 'Reorder characters'}
            >
              <ArrowUpDown className="w-4 h-4" />
              {isReordering ? 'Done' : 'Reorder'}
            </button>
          )}
          
          <button
            type="button"
            onClick={handleAddCharacter}
            disabled={normalizedCharacters.length >= maxCharacters}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              normalizedCharacters.length >= maxCharacters
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Character
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className={`p-4 border rounded-lg transition-colors ${
        isReordering 
          ? 'bg-orange-50 border-orange-200' 
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-start gap-3">
          <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
            isReordering ? 'text-orange-600' : 'text-blue-600'
          }`} />
          <div className={`text-sm ${
            isReordering ? 'text-orange-800' : 'text-blue-800'
          }`}>
            <p className="font-medium mb-1">
              {isReordering ? 'Reordering Mode:' : 'Character Management Tips:'}
            </p>
            <ul className={`space-y-1 ${
              isReordering ? 'text-orange-700' : 'text-blue-700'
            }`}>
              {isReordering ? (
                <>
                  <li>• Drag and drop characters to reorder them</li>
                  <li>• Use up/down arrows for precise positioning</li>
                  <li>• Click "Done" when finished reordering</li>
                </>
              ) : (
                <>
                  <li>• Add key characters that drive your story forward</li>
                  <li>• Click "Reorder" to drag and drop characters</li>
                  <li>• Click the edit button to modify character details</li>
                  <li>• Characters help investors understand your story's scope</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Character List */}
      {normalizedCharacters.length > 0 ? (
        <div className="space-y-3">
          {normalizedCharacters.map((character, index) => (
            <CharacterCard
              key={character.id}
              character={character}
              index={index}
              totalCharacters={normalizedCharacters.length}
              onEdit={handleEditCharacter}
              onDelete={handleDeleteCharacter}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              isReordering={isReordering}
              isDragging={draggedItem === index}
              isDragOver={dragOverItem === index}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Characters Added</h4>
          <p className="text-gray-600 mb-4">
            Add characters to help investors understand your story's cast and scope.
          </p>
          <button
            type="button"
            onClick={handleAddCharacter}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Character
          </button>
        </div>
      )}

      {/* Character Form Modal */}
      <CharacterForm
        character={editingCharacter}
        isOpen={isFormOpen}
        onSave={handleSaveCharacter}
        onCancel={handleCancel}
      />
    </div>
  );
};