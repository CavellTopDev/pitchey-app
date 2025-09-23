import React, { useState, useEffect } from 'react';
import { BookmarkPlus, Bookmark, Edit2, Trash2, Play, Clock, Bell, BellOff } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

interface SavedSearch {
  id: number;
  userId: number;
  name: string;
  description?: string;
  filters: any;
  useCount: number;
  lastUsed?: Date;
  isPublic: boolean;
  notifyOnResults: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SavedSearchesProps {
  onLoadSearch?: (filters: any) => void;
  currentFilters?: any;
  className?: string;
}

export const SavedSearches: React.FC<SavedSearchesProps> = ({
  onLoadSearch,
  currentFilters,
  className = ""
}) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    notifyOnResults: false,
    isPublic: false,
  });

  // Load saved searches
  const loadSavedSearches = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/search/saved');
      if (response.success) {
        setSavedSearches(response.savedSearches);
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedSearches();
  }, []);

  // Save current search
  const handleSaveSearch = async () => {
    if (!saveForm.name.trim() || !currentFilters) return;

    try {
      const response = await apiClient.post('/api/search/saved', {
        name: saveForm.name.trim(),
        description: saveForm.description.trim() || undefined,
        filters: currentFilters,
        notifyOnResults: saveForm.notifyOnResults,
        isPublic: saveForm.isPublic,
      });

      if (response.success) {
        setSavedSearches(prev => [response.savedSearch, ...prev]);
        setShowSaveDialog(false);
        setSaveForm({
          name: '',
          description: '',
          notifyOnResults: false,
          isPublic: false,
        });
      }
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  // Update saved search
  const handleUpdateSearch = async () => {
    if (!editingSearch || !saveForm.name.trim()) return;

    try {
      const response = await apiClient.put(`/api/search/saved/${editingSearch.id}`, {
        name: saveForm.name.trim(),
        description: saveForm.description.trim() || undefined,
        filters: editingSearch.filters,
        notifyOnResults: saveForm.notifyOnResults,
        isPublic: saveForm.isPublic,
      });

      if (response.success) {
        setSavedSearches(prev =>
          prev.map(search =>
            search.id === editingSearch.id ? response.savedSearch : search
          )
        );
        setEditingSearch(null);
        setSaveForm({
          name: '',
          description: '',
          notifyOnResults: false,
          isPublic: false,
        });
      }
    } catch (error) {
      console.error('Failed to update search:', error);
    }
  };

  // Delete saved search
  const handleDeleteSearch = async (searchId: number) => {
    if (!confirm('Are you sure you want to delete this saved search?')) return;

    try {
      const response = await apiClient.delete(`/api/search/saved/${searchId}`);
      if (response.success) {
        setSavedSearches(prev => prev.filter(search => search.id !== searchId));
      }
    } catch (error) {
      console.error('Failed to delete search:', error);
    }
  };

  // Load saved search
  const handleLoadSearch = async (search: SavedSearch) => {
    try {
      const response = await apiClient.post(`/api/search/saved/${search.id}`);
      if (response.success && onLoadSearch) {
        onLoadSearch(response.filters);
      }
    } catch (error) {
      console.error('Failed to load search:', error);
    }
  };

  // Toggle notifications
  const handleToggleNotifications = async (search: SavedSearch) => {
    try {
      const response = await apiClient.put(`/api/search/saved/${search.id}`, {
        ...search,
        notifyOnResults: !search.notifyOnResults,
      });

      if (response.success) {
        setSavedSearches(prev =>
          prev.map(s =>
            s.id === search.id ? { ...s, notifyOnResults: !s.notifyOnResults } : s
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
    }
  };

  // Start editing
  const startEditing = (search: SavedSearch) => {
    setEditingSearch(search);
    setSaveForm({
      name: search.name,
      description: search.description || '',
      notifyOnResults: search.notifyOnResults,
      isPublic: search.isPublic,
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingSearch(null);
    setSaveForm({
      name: '',
      description: '',
      notifyOnResults: false,
      isPublic: false,
    });
  };

  // Format filters for display
  const formatFilters = (filters: any) => {
    const parts = [];
    if (filters.query) parts.push(`"${filters.query}"`);
    if (filters.genres?.length) parts.push(`${filters.genres.length} genres`);
    if (filters.formats?.length) parts.push(`${filters.formats.length} formats`);
    if (filters.budgetMin || filters.budgetMax) parts.push('budget range');
    if (filters.creatorType && filters.creatorType !== 'any') parts.push(filters.creatorType);
    
    return parts.length > 0 ? parts.join(', ') : 'No filters';
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const canSaveCurrentSearch = currentFilters && Object.keys(currentFilters).some(key => {
    const value = currentFilters[key];
    return value !== undefined && value !== null && 
           (Array.isArray(value) ? value.length > 0 : true);
  });

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Saved Searches</h3>
        {canSaveCurrentSearch && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <BookmarkPlus className="h-4 w-4" />
            Save Current Search
          </button>
        )}
      </div>

      {/* Saved Searches List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-gray-100 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : savedSearches.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Bookmark className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No saved searches yet</p>
          <p className="text-sm">Save your search filters for quick access later</p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedSearches.map(search => (
            <div
              key={search.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900 truncate">
                      {search.name}
                    </h4>
                    {search.notifyOnResults && (
                      <Bell className="h-3 w-3 text-blue-500" />
                    )}
                    {search.isPublic && (
                      <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded">
                        Public
                      </span>
                    )}
                  </div>
                  
                  {search.description && (
                    <p className="text-sm text-gray-600 mb-2">{search.description}</p>
                  )}
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Filters: {formatFilters(search.filters)}</div>
                    <div className="flex items-center gap-4">
                      <span>Used {search.useCount} times</span>
                      {search.lastUsed && (
                        <span>Last used {formatDate(search.lastUsed)}</span>
                      )}
                      <span>Created {formatDate(search.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggleNotifications(search)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title={search.notifyOnResults ? 'Disable notifications' : 'Enable notifications'}
                  >
                    {search.notifyOnResults ? (
                      <Bell className="h-4 w-4" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => startEditing(search)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit search"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteSearch(search.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete search"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => handleLoadSearch(search)}
                    className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    <Play className="h-3 w-3" />
                    Use
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Save Search</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter search name..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={saveForm.notifyOnResults}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, notifyOnResults: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Notify me of new results
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={saveForm.isPublic}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Make search public
                  </span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSearch}
                disabled={!saveForm.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Save Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Search Dialog */}
      {editingSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Search</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={saveForm.notifyOnResults}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, notifyOnResults: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Notify me of new results
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={saveForm.isPublic}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Make search public
                  </span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={cancelEditing}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSearch}
                disabled={!saveForm.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Update Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};