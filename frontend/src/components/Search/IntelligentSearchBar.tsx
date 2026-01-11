/**
 * Intelligent Search Bar Component
 * Advanced search interface with AI-powered autocomplete, filters, and real-time suggestions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  TrendingUp, 
  Clock, 
  X, 
  Sparkles, 
  Target,
  Sliders,
  ChevronDown,
  Star,
  Zap,
  Brain
} from 'lucide-react';

interface SearchSuggestion {
  query: string;
  type: 'title' | 'genre' | 'creator' | 'autocomplete' | 'trending';
  count?: number;
  relevance?: number;
  highlight?: string;
}

interface QuickFilter {
  id: string;
  label: string;
  value: any;
  count?: number;
  trending?: boolean;
}

interface SearchBarProps {
  onSearch: (query: string, filters?: any) => void;
  onAdvancedSearch: () => void;
  placeholder?: string;
  initialQuery?: string;
  showAdvanced?: boolean;
  enableAI?: boolean;
  className?: string;
}

export const IntelligentSearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onAdvancedSearch,
  placeholder = "Search for projects, creators, genres...",
  initialQuery = '',
  showAdvanced = true,
  enableAI = true,
  className = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<QuickFilter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [aiMode, setAiMode] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch suggestions from API
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}&limit=8`);
      const data = await response.json();
      
      if (data.success && data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch quick filters
  const fetchQuickFilters = useCallback(async () => {
    try {
      const response = await fetch('/api/search/quick-filters');
      const data = await response.json();
      
      if (data.success && data.filters) {
        setQuickFilters(data.filters);
      }
    } catch (error) {
      console.error('Failed to fetch quick filters:', error);
      // Fallback to mock data
      setQuickFilters([
        { id: 'horror', label: 'Horror', value: { genres: ['Horror'] }, count: 234, trending: true },
        { id: 'comedy', label: 'Comedy', value: { genres: ['Comedy'] }, count: 189 },
        { id: 'under-5m', label: 'Under $5M', value: { budgetMax: 5000000 }, count: 156 },
        { id: 'feature', label: 'Feature Film', value: { formats: ['Feature Film'] }, count: 412 },
        { id: 'verified', label: 'Verified Creators', value: { verifiedOnly: true }, count: 98 },
        { id: 'new', label: 'New This Week', value: { dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }, count: 23, trending: true },
      ]);
    }
  }, []);

  // Load search history from localStorage
  const loadSearchHistory = useCallback(() => {
    try {
      const history = localStorage.getItem('pitchey_search_history');
      if (history) {
        setSearchHistory(JSON.parse(history).slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Save search to history
  const saveToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) return;
    
    try {
      const history = [...new Set([searchQuery, ...searchHistory])].slice(0, 10);
      setSearchHistory(history);
      localStorage.setItem('pitchey_search_history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, [searchHistory]);

  // Handle input change with debouncing
  const handleInputChange = (value: string) => {
    setQuery(value);
    setFocusedIndex(-1);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce suggestions fetch
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        fetchSuggestions(value.trim());
      } else {
        setSuggestions([]);
      }
    }, 300);
  };

  // Handle search execution
  const executeSearch = (searchQuery?: string, additionalFilters?: any) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim() && selectedFilters.length === 0) return;
    
    // Combine selected filters
    const combinedFilters = selectedFilters.reduce((acc, filter) => ({
      ...acc,
      ...filter.value
    }), additionalFilters || {});
    
    onSearch(finalQuery, combinedFilters);
    saveToHistory(finalQuery);
    setIsOpen(false);
    
    // Track search analytics
    trackSearchEvent(finalQuery, combinedFilters);
  };

  // Track search analytics
  const trackSearchEvent = async (searchQuery: string, filters: any) => {
    try {
      await fetch('/api/analytics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          filters,
          timestamp: new Date().toISOString(),
          aiMode
        })
      });
    } catch (error) {
      console.error('Failed to track search event:', error);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const itemCount = suggestions.length + searchHistory.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
          const suggestion = suggestions[focusedIndex];
          setQuery(suggestion.query);
          executeSearch(suggestion.query);
        } else if (focusedIndex >= suggestions.length && focusedIndex < itemCount) {
          const historyIndex = focusedIndex - suggestions.length;
          const historyQuery = searchHistory[historyIndex];
          setQuery(historyQuery);
          executeSearch(historyQuery);
        } else {
          executeSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Toggle quick filter
  const toggleFilter = (filter: QuickFilter) => {
    setSelectedFilters(prev => {
      const exists = prev.find(f => f.id === filter.id);
      if (exists) {
        return prev.filter(f => f.id !== filter.id);
      } else {
        return [...prev, filter];
      }
    });
  };

  // Remove filter
  const removeFilter = (filterId: string) => {
    setSelectedFilters(prev => prev.filter(f => f.id !== filterId));
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedFilters([]);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize data
  useEffect(() => {
    fetchQuickFilters();
    loadSearchHistory();
  }, [fetchQuickFilters, loadSearchHistory]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const allSuggestions = [...suggestions, ...searchHistory.map(h => ({ query: h, type: 'history' as const }))];

  return (
    <div ref={searchRef} className={`relative w-full max-w-4xl ${className}`}>
      {/* Search Input */}
      <div className={`relative group ${isOpen ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-300'} rounded-xl bg-white shadow-lg transition-all`}>
        <div className="flex items-center">
          {/* AI Mode Toggle */}
          {enableAI && (
            <button
              onClick={() => setAiMode(!aiMode)}
              className={`p-3 rounded-l-xl transition-colors ${
                aiMode 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                  : 'text-gray-400 hover:text-blue-500'
              }`}
              title={aiMode ? 'AI Search Active' : 'Enable AI Search'}
            >
              {aiMode ? <Sparkles className="h-5 w-5" /> : <Brain className="h-5 w-5" />}
            </button>
          )}

          {/* Search Icon */}
          <div className="p-3 text-gray-400">
            <Search className="h-5 w-5" />
          </div>

          {/* Input Field */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={aiMode ? "Describe what you're looking for in natural language..." : placeholder}
            className={`flex-1 py-3 px-2 bg-transparent border-none focus:outline-none text-lg ${
              aiMode ? 'text-purple-800 placeholder-purple-400' : 'text-gray-900 placeholder-gray-500'
            }`}
          />

          {/* Loading Spinner */}
          {isLoading && (
            <div className="p-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Advanced Search Button */}
          {showAdvanced && (
            <button
              onClick={onAdvancedSearch}
              className="p-3 text-gray-400 hover:text-blue-500 transition-colors"
              title="Advanced Search"
            >
              <Sliders className="h-5 w-5" />
            </button>
          )}

          {/* Search Button */}
          <button
            onClick={() => executeSearch()}
            disabled={!query.trim() && selectedFilters.length === 0}
            className={`px-6 py-3 rounded-r-xl font-medium transition-all ${
              query.trim() || selectedFilters.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Search
          </button>
        </div>

        {/* Selected Filters */}
        {selectedFilters.length > 0 && (
          <div className="px-4 pb-3 border-t border-gray-100">
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <span className="text-xs font-medium text-gray-600">Active filters:</span>
              {selectedFilters.map((filter) => (
                <span
                  key={filter.id}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-lg"
                >
                  <span>{filter.label}</span>
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 ml-2"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dropdown with suggestions and filters */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Quick Filters */}
          {query.length === 0 && quickFilters.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center space-x-2 mb-3">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Quick Filters</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => toggleFilter(filter)}
                    className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                      selectedFilters.find(f => f.id === filter.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{filter.label}</span>
                    {filter.count && (
                      <span className={`text-xs ${
                        selectedFilters.find(f => f.id === filter.id)
                          ? 'text-blue-200'
                          : 'text-gray-500'
                      }`}>
                        {filter.count}
                      </span>
                    )}
                    {filter.trending && (
                      <TrendingUp className="h-3 w-3 text-orange-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Suggestions */}
          {allSuggestions.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              {suggestions.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Suggestions
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`suggestion-${index}`}
                      onClick={() => {
                        setQuery(suggestion.query);
                        executeSearch(suggestion.query);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors ${
                        focusedIndex === index ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-1.5 rounded-lg ${
                          suggestion.type === 'title' ? 'bg-green-100 text-green-600' :
                          suggestion.type === 'genre' ? 'bg-purple-100 text-purple-600' :
                          suggestion.type === 'creator' ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {suggestion.type === 'title' && <Target className="h-3 w-3" />}
                          {suggestion.type === 'genre' && <Star className="h-3 w-3" />}
                          {suggestion.type === 'creator' && <Users className="h-3 w-3" />}
                          {suggestion.type === 'autocomplete' && <Zap className="h-3 w-3" />}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{suggestion.query}</div>
                          <div className="text-xs text-gray-500 capitalize">{suggestion.type}</div>
                        </div>
                      </div>
                      {suggestion.count && (
                        <span className="text-xs text-gray-500">{suggestion.count} results</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Search History */}
              {searchHistory.length > 0 && query.length === 0 && (
                <div className="p-2 border-t border-gray-100">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Recent Searches
                  </div>
                  {searchHistory.map((historyQuery, index) => (
                    <button
                      key={`history-${index}`}
                      onClick={() => {
                        setQuery(historyQuery);
                        executeSearch(historyQuery);
                      }}
                      className={`w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors ${
                        focusedIndex === suggestions.length + index ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">{historyQuery}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {allSuggestions.length === 0 && query.length > 0 && !isLoading && (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No suggestions found</p>
              <p className="text-sm text-gray-400">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};