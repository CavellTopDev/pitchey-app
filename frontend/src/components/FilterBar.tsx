import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  RotateCcw
} from 'lucide-react';

interface FilterBarProps {
  genres?: string[];
  formats?: string[];
  budgetRanges?: { value: string; label: string; min: number; max: number }[];
  developmentStages?: string[];
  onFiltersChange: (filters: FilterState) => void;
  onSortChange: (sort: SortOption) => void;
  className?: string;
}

export interface FilterState {
  genres: string[];
  formats: string[];
  budgetMin?: number;
  budgetMax?: number;
  developmentStages: string[];
  searchQuery: string;
  creatorTypes: string[];
  hasNDA?: boolean;
  seekingInvestment?: boolean;
}

export interface SortOption {
  field: 'date' | 'views' | 'likes' | 'budget' | 'alphabetical';
  order: 'asc' | 'desc';
}

export default function FilterBar({
  genres = [
    'Action', 'Animation', 'Comedy', 'Documentary', 'Drama',
    'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'
  ],
  formats = [
    'Feature Film', 'Short Film', 'TV Series', 'Limited Series', 'Web Series', 'Documentary'
  ],
  budgetRanges = [
    { value: 'micro', label: 'Micro Budget', min: 0, max: 500000 },
    { value: 'low', label: 'Low Budget', min: 500000, max: 5000000 },
    { value: 'medium', label: 'Medium Budget', min: 5000000, max: 20000000 },
    { value: 'high', label: 'High Budget', min: 20000000, max: 50000000 },
    { value: 'blockbuster', label: 'Blockbuster', min: 50000000, max: 999999999 }
  ],
  developmentStages = [
    'Concept', 'Script Development', 'Pre-Production', 'Financing', 'Production', 'Post-Production', 'Distribution'
  ],
  onFiltersChange,
  onSortChange,
  className = ''
}: FilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Filter state
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState<{ min: number; max: number }>({ min: 0, max: 999999999 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCreatorTypes, setSelectedCreatorTypes] = useState<string[]>([]);
  const [hasNDA, setHasNDA] = useState<boolean | undefined>(undefined);
  const [seekingInvestment, setSeekingInvestment] = useState<boolean | undefined>(undefined);
  
  // Sort state
  const [sortField, setSortField] = useState<SortOption['field']>('date');
  const [sortOrder, setSortOrder] = useState<SortOption['order']>('desc');

  // Budget slider state
  const [budgetSliderValue, setBudgetSliderValue] = useState([0, 100]);

  // Initialize from URL params
  useEffect(() => {
    const genresParam = searchParams.get('genres');
    const formatsParam = searchParams.get('formats');
    const stagesParam = searchParams.get('stages');
    const budgetMinParam = searchParams.get('budgetMin');
    const budgetMaxParam = searchParams.get('budgetMax');
    const searchParam = searchParams.get('q');
    const sortParam = searchParams.get('sort');
    const orderParam = searchParams.get('order');

    if (genresParam) setSelectedGenres(genresParam.split(','));
    if (formatsParam) setSelectedFormats(formatsParam.split(','));
    if (stagesParam) setSelectedStages(stagesParam.split(','));
    if (budgetMinParam && budgetMaxParam) {
      setBudgetRange({ 
        min: parseInt(budgetMinParam), 
        max: parseInt(budgetMaxParam) 
      });
      // Convert to slider values (0-100 scale)
      const minPercent = (parseInt(budgetMinParam) / 100000000) * 100;
      const maxPercent = (parseInt(budgetMaxParam) / 100000000) * 100;
      setBudgetSliderValue([minPercent, maxPercent]);
    }
    if (searchParam) setSearchQuery(searchParam);
    if (sortParam) setSortField(sortParam as SortOption['field']);
    if (orderParam) setSortOrder(orderParam as SortOption['order']);
  }, []);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (selectedGenres.length > 0) params.set('genres', selectedGenres.join(','));
    if (selectedFormats.length > 0) params.set('formats', selectedFormats.join(','));
    if (selectedStages.length > 0) params.set('stages', selectedStages.join(','));
    if (budgetRange.min > 0 || budgetRange.max < 999999999) {
      params.set('budgetMin', budgetRange.min.toString());
      params.set('budgetMax', budgetRange.max.toString());
    }
    if (searchQuery) params.set('q', searchQuery);
    if (sortField !== 'date') params.set('sort', sortField);
    if (sortOrder !== 'desc') params.set('order', sortOrder);

    setSearchParams(params);

    // Notify parent component
    onFiltersChange({
      genres: selectedGenres,
      formats: selectedFormats,
      budgetMin: budgetRange.min,
      budgetMax: budgetRange.max,
      developmentStages: selectedStages,
      searchQuery,
      creatorTypes: selectedCreatorTypes,
      hasNDA,
      seekingInvestment
    });
  }, [selectedGenres, selectedFormats, selectedStages, budgetRange, searchQuery, selectedCreatorTypes, hasNDA, seekingInvestment]);

  // Update sort when it changes
  useEffect(() => {
    onSortChange({ field: sortField, order: sortOrder });
  }, [sortField, sortOrder]);

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  };

  const handleFormatToggle = (format: string) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const handleStageToggle = (stage: string) => {
    setSelectedStages(prev =>
      prev.includes(stage)
        ? prev.filter(s => s !== stage)
        : [...prev, stage]
    );
  };

  const handleBudgetChange = (values: number[]) => {
    setBudgetSliderValue(values);
    // Convert percentage to actual budget values
    const min = Math.floor((values[0] / 100) * 100000000);
    const max = Math.floor((values[1] / 100) * 100000000);
    setBudgetRange({ min, max });
  };

  const formatBudget = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    } else {
      return `$${value}`;
    }
  };

  const clearAllFilters = () => {
    setSelectedGenres([]);
    setSelectedFormats([]);
    setSelectedStages([]);
    setBudgetRange({ min: 0, max: 999999999 });
    setBudgetSliderValue([0, 100]);
    setSearchQuery('');
    setSelectedCreatorTypes([]);
    setHasNDA(undefined);
    setSeekingInvestment(undefined);
    setSortField('date');
    setSortOrder('desc');
    setSearchParams(new URLSearchParams());
  };

  const activeFilterCount = 
    selectedGenres.length + 
    selectedFormats.length + 
    selectedStages.length + 
    selectedCreatorTypes.length +
    (budgetRange.min > 0 || budgetRange.max < 999999999 ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    (hasNDA ? 1 : 0) +
    (seekingInvestment ? 1 : 0);

  return (
    <div className={`bg-white border-b sticky top-0 z-30 ${className}`}>
      {/* Main Filter Bar */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Search Input */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pitches..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            {/* Genre Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'genre' ? null : 'genre')}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                  selectedGenres.length > 0 
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Film className="w-4 h-4" />
                <span>Genre</span>
                {selectedGenres.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {selectedGenres.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>

              {activeDropdown === 'genre' && (
                <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                  {genres.map(genre => (
                    <button
                      key={genre}
                      onClick={() => handleGenreToggle(genre)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <span className="text-sm">{genre}</span>
                      {selectedGenres.includes(genre) && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Format Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'format' ? null : 'format')}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                  selectedFormats.length > 0 
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Format</span>
                {selectedFormats.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {selectedFormats.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>

              {activeDropdown === 'format' && (
                <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                  {formats.map(format => (
                    <button
                      key={format}
                      onClick={() => handleFormatToggle(format)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <span className="text-sm">{format}</span>
                      {selectedFormats.includes(format) && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Sort</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {activeDropdown === 'sort' && (
                <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[200px]">
                  <div className="space-y-1">
                    <button
                      onClick={() => { setSortField('date'); setSortOrder('desc'); setActiveDropdown(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors ${
                        sortField === 'date' && sortOrder === 'desc' ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <span className="text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Newest First
                      </span>
                      {sortField === 'date' && sortOrder === 'desc' && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                    <button
                      onClick={() => { setSortField('date'); setSortOrder('asc'); setActiveDropdown(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors ${
                        sortField === 'date' && sortOrder === 'asc' ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <span className="text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Oldest First
                      </span>
                      {sortField === 'date' && sortOrder === 'asc' && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                    <button
                      onClick={() => { setSortField('views'); setSortOrder('desc'); setActiveDropdown(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors ${
                        sortField === 'views' && sortOrder === 'desc' ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <span className="text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Most Viewed
                      </span>
                      {sortField === 'views' && sortOrder === 'desc' && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                    <button
                      onClick={() => { setSortField('likes'); setSortOrder('desc'); setActiveDropdown(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors ${
                        sortField === 'likes' && sortOrder === 'desc' ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <span className="text-sm flex items-center gap-2">
                        <Heart className="w-4 h-4" />
                        Most Liked
                      </span>
                      {sortField === 'likes' && sortOrder === 'desc' && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                    <button
                      onClick={() => { setSortField('budget'); setSortOrder('desc'); setActiveDropdown(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors ${
                        sortField === 'budget' && sortOrder === 'desc' ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <span className="text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Highest Budget
                      </span>
                      {sortField === 'budget' && sortOrder === 'desc' && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                    <button
                      onClick={() => { setSortField('budget'); setSortOrder('asc'); setActiveDropdown(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-md transition-colors ${
                        sortField === 'budget' && sortOrder === 'asc' ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <span className="text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Lowest Budget
                      </span>
                      {sortField === 'budget' && sortOrder === 'asc' && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                isExpanded || activeFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Advanced</span>
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filters Tags */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-sm text-gray-500">Active filters:</span>
            {selectedGenres.map(genre => (
              <span
                key={genre}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm"
              >
                {genre}
                <button
                  onClick={() => handleGenreToggle(genre)}
                  className="hover:bg-blue-200 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedFormats.map(format => (
              <span
                key={format}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-sm"
              >
                {format}
                <button
                  onClick={() => handleFormatToggle(format)}
                  className="hover:bg-purple-200 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedStages.map(stage => (
              <span
                key={stage}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-sm"
              >
                {stage}
                <button
                  onClick={() => handleStageToggle(stage)}
                  className="hover:bg-green-200 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {(budgetRange.min > 0 || budgetRange.max < 999999999) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-sm">
                Budget: {formatBudget(budgetRange.min)} - {formatBudget(budgetRange.max)}
                <button
                  onClick={() => {
                    setBudgetRange({ min: 0, max: 999999999 });
                    setBudgetSliderValue([0, 100]);
                  }}
                  className="hover:bg-yellow-200 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded Advanced Filters */}
      {isExpanded && (
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Budget Range Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Budget Range
              </label>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{formatBudget(budgetRange.min)}</span>
                  <span className="text-gray-600">{formatBudget(budgetRange.max)}</span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={budgetSliderValue[0]}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      if (newValue < budgetSliderValue[1]) {
                        handleBudgetChange([newValue, budgetSliderValue[1]]);
                      }
                    }}
                    className="absolute w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={budgetSliderValue[1]}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      if (newValue > budgetSliderValue[0]) {
                        handleBudgetChange([budgetSliderValue[0], newValue]);
                      }
                    }}
                    className="absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer"
                  />
                  <div
                    className="absolute h-2 bg-blue-600 rounded-lg"
                    style={{
                      left: `${budgetSliderValue[0]}%`,
                      right: `${100 - budgetSliderValue[1]}%`
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  {budgetRanges.map(range => (
                    <button
                      key={range.value}
                      onClick={() => {
                        setBudgetRange({ min: range.min, max: range.max });
                        const minPercent = (range.min / 100000000) * 100;
                        const maxPercent = (range.max / 100000000) * 100;
                        setBudgetSliderValue([minPercent, Math.min(maxPercent, 100)]);
                      }}
                      className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Development Stage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Development Stage
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {developmentStages.map(stage => (
                  <label
                    key={stage}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStages.includes(stage)}
                      onChange={() => handleStageToggle(stage)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{stage}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Additional Filters
              </label>
              <div className="space-y-3">
                {/* Creator Type Filter */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Creator Type</p>
                  <div className="space-y-1">
                    {['creator', 'production', 'investor'].map(type => (
                      <label
                        key={type}
                        className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1 rounded transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCreatorTypes.includes(type)}
                          onChange={() => {
                            setSelectedCreatorTypes(prev =>
                              prev.includes(type)
                                ? prev.filter(t => t !== type)
                                : [...prev, type]
                            );
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Other Filters */}
                <div className="border-t pt-2">
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={hasNDA === true}
                      onChange={(e) => setHasNDA(e.target.checked ? true : undefined)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Has NDA Protection</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1 rounded transition-colors">
                    <input
                      type="checkbox"
                      checked={seekingInvestment === true}
                      onChange={(e) => setSeekingInvestment(e.target.checked ? true : undefined)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Seeking Investment</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {activeDropdown && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
}