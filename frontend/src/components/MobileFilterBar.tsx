import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  ChevronDown, 
  Filter, 
  SlidersHorizontal,
  Check,
  Search,
  DollarSign,
  Calendar,
  TrendingUp,
  Eye,
  Heart,
  Film,
  Layers,
  Menu
} from 'lucide-react';

interface MobileFilterBarProps {
  genres?: string[];
  formats?: string[];
  onFiltersChange: (filters: any) => void;
  onSortChange: (sort: any) => void;
  className?: string;
}

export default function MobileFilterBar({
  genres = [
    'Action', 'Animation', 'Comedy', 'Documentary', 'Drama',
    'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'
  ],
  formats = [
    'Feature Film', 'Short Film', 'TV Series', 'Limited Series', 'Web Series', 'Documentary'
  ],
  onFiltersChange,
  onSortChange,
  className = ''
}: MobileFilterBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>('date');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'filters' | 'sort'>('filters');

  // Handle search changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    onFiltersChange({
      genres: selectedGenres,
      formats: selectedFormats,
      searchQuery: value,
      budgetMin: undefined,
      budgetMax: undefined,
      developmentStages: [],
      creatorTypes: [],
      hasNDA: undefined,
      seekingInvestment: undefined
    });
  }, [selectedGenres, selectedFormats, onFiltersChange]);

  // Handle filter changes
  useEffect(() => {
    onFiltersChange({
      genres: selectedGenres,
      formats: selectedFormats,
      searchQuery,
      budgetMin: undefined,
      budgetMax: undefined,
      developmentStages: [],
      creatorTypes: [],
      hasNDA: undefined,
      seekingInvestment: undefined
    });
  }, [selectedGenres, selectedFormats, searchQuery, onFiltersChange]);

  // Handle sort changes
  const handleSortChange = useCallback((field: string) => {
    setSortField(field);
    onSortChange({ field, order: 'desc' });
    setShowMobileMenu(false);
  }, [onSortChange]);

  const handleGenreToggle = useCallback((genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  }, []);

  const handleFormatToggle = useCallback((format: string) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedGenres([]);
    setSelectedFormats([]);
    setSearchQuery('');
  }, []);

  const activeFilterCount = selectedGenres.length + selectedFormats.length;

  return (
    <>
      {/* Mobile Filter Bar */}
      <div className={`bg-white border-b sticky top-0 z-30 ${className}`}>
        {/* Search Bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search pitches..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Filter Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border whitespace-nowrap text-sm font-medium transition-colors ${
              activeFilterCount > 0
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-white text-blue-500 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Quick Filter Pills */}
          {selectedGenres.length > 0 && (
            <div className="flex gap-2">
              {selectedGenres.slice(0, 2).map(genre => (
                <span
                  key={genre}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium whitespace-nowrap"
                >
                  {genre}
                </span>
              ))}
              {selectedGenres.length > 2 && (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  +{selectedGenres.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Sort Indicator */}
          <button
            onClick={() => {
              setActiveTab('sort');
              setShowMobileMenu(true);
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium whitespace-nowrap"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              {sortField === 'date' && 'Latest'}
              {sortField === 'views' && 'Popular'}
              {sortField === 'likes' && 'Liked'}
              {sortField === 'budget' && 'Budget'}
              {sortField === 'alphabetical' && 'A-Z'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Filter Menu (Full Screen Overlay) */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {activeTab === 'filters' ? 'Filters' : 'Sort By'}
            </h2>
            <button
              onClick={() => setShowMobileMenu(false)}
              className="p-2 -mr-2 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('filters')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'filters'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600'
              }`}
            >
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sort')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'sort'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600'
              }`}
            >
              Sort
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {activeTab === 'filters' ? (
              <div className="space-y-6">
                {/* Genre Section */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Genre</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {genres.map(genre => (
                      <button
                        key={genre}
                        onClick={() => handleGenreToggle(genre)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          selectedGenres.includes(genre)
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-700'
                        }`}
                      >
                        {genre}
                        {selectedGenres.includes(genre) && (
                          <Check className="w-3.5 h-3.5 inline-block ml-1" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format Section */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Format</h3>
                  <div className="space-y-2">
                    {formats.map(format => (
                      <button
                        key={format}
                        onClick={() => handleFormatToggle(format)}
                        className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                          selectedFormats.includes(format)
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-700'
                        }`}
                      >
                        {format}
                        {selectedFormats.includes(format) && (
                          <Check className="w-3.5 h-3.5 float-right mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="w-full py-2 text-red-600 font-medium"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Sort Options */}
                {[
                  { field: 'date', label: 'Latest First', icon: Calendar },
                  { field: 'views', label: 'Most Viewed', icon: Eye },
                  { field: 'likes', label: 'Most Liked', icon: Heart },
                  { field: 'budget', label: 'Budget (High to Low)', icon: DollarSign },
                  { field: 'alphabetical', label: 'Alphabetical (A-Z)', icon: Filter }
                ].map(option => (
                  <button
                    key={option.field}
                    onClick={() => handleSortChange(option.field)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      sortField === option.field
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <option.icon className="w-5 h-5" />
                    <span className="flex-1 text-left font-medium">{option.label}</span>
                    {sortField === option.field && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Apply Button */}
          <div className="sticky bottom-0 bg-white border-t p-4">
            <button
              onClick={() => setShowMobileMenu(false)}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply {activeTab === 'filters' ? 'Filters' : 'Sort'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}