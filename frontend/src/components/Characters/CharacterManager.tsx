import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Plus, Edit2, Trash2, GripVertical, Save, X, User, Users, Star, Shield } from 'lucide-react';
import { toast } from 'react-hot-toast';

export interface Character {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  age?: string;
  description: string;
  arc?: string;
  relationships?: string;
  backstory?: string;
  motivation?: string;
  order: number;
}

interface CharacterManagerProps {
  characters: Character[];
  onUpdate: (characters: Character[]) => void;
  maxCharacters?: number;
  readOnly?: boolean;
}

export default function CharacterManager({
  characters: initialCharacters = [],
  onUpdate,
  maxCharacters = 20,
  readOnly = false
}: CharacterManagerProps) {
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state for new/edit character
  const [formData, setFormData] = useState<Partial<Character>>({
    name: '',
    role: 'supporting',
    description: '',
    age: '',
    arc: '',
    relationships: '',
    backstory: '',
    motivation: ''
  });

  useEffect(() => {
    setCharacters(initialCharacters);
  }, [initialCharacters]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || readOnly) return;

    const items = Array.from(characters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order values
    const reorderedCharacters = items.map((char, index) => ({
      ...char,
      order: index
    }));

    setCharacters(reorderedCharacters);
    onUpdate(reorderedCharacters);
    toast.success('Character order updated');
  };

  const handleAdd = () => {
    if (characters.length >= maxCharacters) {
      toast.error(`Maximum ${maxCharacters} characters allowed`);
      return;
    }

    if (!formData.name || !formData.description) {
      toast.error('Name and description are required');
      return;
    }

    const newCharacter: Character = {
      id: `char-${Date.now()}`,
      name: formData.name!,
      role: formData.role as Character['role'],
      description: formData.description!,
      age: formData.age,
      arc: formData.arc,
      relationships: formData.relationships,
      backstory: formData.backstory,
      motivation: formData.motivation,
      order: characters.length
    };

    const updatedCharacters = [...characters, newCharacter];
    setCharacters(updatedCharacters);
    onUpdate(updatedCharacters);
    setShowAddForm(false);
    resetForm();
    toast.success('Character added successfully');
  };

  const handleEdit = (character: Character) => {
    setEditingId(character.id);
    setFormData({
      name: character.name,
      role: character.role,
      description: character.description,
      age: character.age,
      arc: character.arc,
      relationships: character.relationships,
      backstory: character.backstory,
      motivation: character.motivation
    });
  };

  const handleSaveEdit = () => {
    if (!formData.name || !formData.description) {
      toast.error('Name and description are required');
      return;
    }

    const updatedCharacters = characters.map(char =>
      char.id === editingId
        ? {
            ...char,
            name: formData.name!,
            role: formData.role as Character['role'],
            description: formData.description!,
            age: formData.age,
            arc: formData.arc,
            relationships: formData.relationships,
            backstory: formData.backstory,
            motivation: formData.motivation
          }
        : char
    );

    setCharacters(updatedCharacters);
    onUpdate(updatedCharacters);
    setEditingId(null);
    resetForm();
    toast.success('Character updated successfully');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this character?')) return;

    const updatedCharacters = characters
      .filter(char => char.id !== id)
      .map((char, index) => ({ ...char, order: index }));

    setCharacters(updatedCharacters);
    onUpdate(updatedCharacters);
    toast.success('Character deleted');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: 'supporting',
      description: '',
      age: '',
      arc: '',
      relationships: '',
      backstory: '',
      motivation: ''
    });
  };

  const getRoleIcon = (role: Character['role']) => {
    switch (role) {
      case 'protagonist':
        return <Star className="w-4 h-4 text-yellow-500" />;
      case 'antagonist':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'supporting':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'minor':
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleColor = (role: Character['role']) => {
    switch (role) {
      case 'protagonist':
        return 'bg-yellow-100 text-yellow-800';
      case 'antagonist':
        return 'bg-red-100 text-red-800';
      case 'supporting':
        return 'bg-blue-100 text-blue-800';
      case 'minor':
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Characters</h3>
          <p className="text-sm text-gray-600">
            {characters.length} / {maxCharacters} characters
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={characters.length >= maxCharacters}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Character
          </button>
        )}
      </div>

      {/* Character List */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="characters">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-3"
            >
              {characters.sort((a, b) => a.order - b.order).map((character, index) => (
                <Draggable
                  key={character.id}
                  draggableId={character.id}
                  index={index}
                  isDragDisabled={readOnly || editingId === character.id}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`bg-white border rounded-lg p-4 ${
                        snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                      } ${editingId === character.id ? 'border-blue-500' : ''}`}
                    >
                      {editingId === character.id ? (
                        // Edit Form
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-1">Name *</label>
                              <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Character name"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Role *</label>
                              <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as Character['role'] })}
                                className="w-full px-3 py-2 border rounded-lg"
                              >
                                <option value="protagonist">Protagonist</option>
                                <option value="antagonist">Antagonist</option>
                                <option value="supporting">Supporting</option>
                                <option value="minor">Minor</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Age</label>
                              <input
                                type="text"
                                value={formData.age}
                                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="e.g., 35, teenager, elderly"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">Description *</label>
                            <textarea
                              value={formData.description}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                              rows={3}
                              placeholder="Brief character description..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">Character Arc</label>
                            <textarea
                              value={formData.arc}
                              onChange={(e) => setFormData({ ...formData, arc: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                              rows={2}
                              placeholder="How does this character change throughout the story?"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">Motivation</label>
                            <input
                              type="text"
                              value={formData.motivation}
                              onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                              placeholder="What drives this character?"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">Relationships</label>
                            <textarea
                              value={formData.relationships}
                              onChange={(e) => setFormData({ ...formData, relationships: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                              rows={2}
                              placeholder="Key relationships with other characters..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">Backstory</label>
                            <textarea
                              value={formData.backstory}
                              onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg"
                              rows={2}
                              placeholder="Relevant background information..."
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingId(null);
                                resetForm();
                              }}
                              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Display Mode
                        <div className="flex items-start gap-4">
                          {!readOnly && (
                            <div
                              {...provided.dragHandleProps}
                              className="mt-1 cursor-move"
                            >
                              <GripVertical className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {getRoleIcon(character.role)}
                                  <h4 className="font-semibold">{character.name}</h4>
                                  {character.age && (
                                    <span className="text-sm text-gray-600">({character.age})</span>
                                  )}
                                  <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(character.role)}`}>
                                    {character.role}
                                  </span>
                                </div>
                                <p className="text-gray-700">{character.description}</p>
                                
                                {character.arc && (
                                  <div className="mt-2">
                                    <span className="text-sm font-medium text-gray-600">Arc:</span>
                                    <p className="text-sm text-gray-700">{character.arc}</p>
                                  </div>
                                )}
                                
                                {character.motivation && (
                                  <div className="mt-1">
                                    <span className="text-sm font-medium text-gray-600">Motivation:</span>
                                    <span className="text-sm text-gray-700 ml-1">{character.motivation}</span>
                                  </div>
                                )}
                                
                                {character.relationships && (
                                  <div className="mt-1">
                                    <span className="text-sm font-medium text-gray-600">Relationships:</span>
                                    <p className="text-sm text-gray-700">{character.relationships}</p>
                                  </div>
                                )}
                                
                                {character.backstory && (
                                  <div className="mt-1">
                                    <span className="text-sm font-medium text-gray-600">Backstory:</span>
                                    <p className="text-sm text-gray-700">{character.backstory}</p>
                                  </div>
                                )}
                              </div>
                              
                              {!readOnly && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEdit(character)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                    title="Edit character"
                                  >
                                    <Edit2 className="w-4 h-4 text-blue-600" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(character.id)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                    title="Delete character"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Character Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Character</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Character name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Character['role'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="protagonist">Protagonist</option>
                    <option value="antagonist">Antagonist</option>
                    <option value="supporting">Supporting</option>
                    <option value="minor">Minor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Age</label>
                  <input
                    type="text"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., 35, teenager, elderly"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Brief character description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Character Arc</label>
                <textarea
                  value={formData.arc}
                  onChange={(e) => setFormData({ ...formData, arc: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="How does this character change throughout the story?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Motivation</label>
                <input
                  type="text"
                  value={formData.motivation}
                  onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="What drives this character?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Relationships</label>
                <textarea
                  value={formData.relationships}
                  onChange={(e) => setFormData({ ...formData, relationships: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Key relationships with other characters..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Backstory</label>
                <textarea
                  value={formData.backstory}
                  onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Relevant background information..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Add Character
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}