/**
 * Enhanced Search Results Component
 * Advanced display of search results with AI insights, filters, and multiple view modes
 */

import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  List, 
  Filter, 
  SortAsc, 
  Eye, 
  Heart, 
  FileText, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  MapPin,
  Users,
  Award,
  Sparkles,
  BarChart3,
  Target,
  AlertCircle,
  CheckCircle,
  Star,
  Download,
  Share,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';

interface SearchResult {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  titleImage?: string;
  budgetBracket?: string;
  estimatedBudget?: number;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  status: string;
  createdAt: string;
  publishedAt?: string;
  
  // Enhanced fields
  relevanceScore?: number;
  semanticScore?: number;
  trendingScore?: number;
  completenessScore?: number;
  marketViability?: number;
  
  // AI insights
  aiSummary?: string;
  keyStrengths?: string[];
  marketPosition?: string;
  estimatedROI?: number;
  opportunityScore?: number;
  riskFactors?: string[];
  
  // Content flags
  hasLookbook: boolean;
  hasScript: boolean;
  hasTrailer: boolean;
  hasPitchDeck: boolean;
  
  // Creator info
  creator: {
    id: number;
    username: string;
    userType: string;
    companyName?: string;
    companyVerified: boolean;
    location?: string;
  };
}

interface SearchInsights {
  queryInterpretation: string;
  suggestedRefinements: string[];
  marketTrends: string[];
}

interface SearchResultsProps {
  results: SearchResult[];
  total: number;
  loading: boolean;
  searchInsights?: SearchInsights;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSort: (sortBy: string, order: string) => void;
  onFilter: (filters: any) => void;
  onResultClick: (result: SearchResult) => void;
  currentQuery?: string;
  appliedFilters?: any;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'relevance' | 'newest' | 'trending' | 'views' | 'completeness' | 'budget_high';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant', icon: Target },
  { value: 'trending', label: 'Trending', icon: TrendingUp },
  { value: 'newest', label: 'Newest', icon: Calendar },
  { value: 'views', label: 'Most Viewed', icon: Eye },
  { value: 'completeness', label: 'Most Complete', icon: CheckCircle },
  { value: 'budget_high', label: 'Highest Budget', icon: DollarSign },
];

export const EnhancedSearchResults: React.FC<SearchResultsProps> = ({
  results,
  total,
  loading,
  searchInsights,
  currentPage,
  totalPages,
  onPageChange,
  onSort,
  onFilter,
  onResultClick,
  currentQuery,
  appliedFilters
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState(false);
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<number>>(new Set());

  // Handle sorting
  const handleSort = (newSortBy: SortOption) => {
    let newOrder = 'desc';
    if (newSortBy === sortBy) {
      newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    }
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    onSort(newSortBy, newOrder);
  };

  // Toggle bookmark
  const toggleBookmark = (resultId: number) => {
    setBookmarkedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };

  // Format budget
  const formatBudget = (budget: number) => {
    if (budget >= 1000000) {
      return `$${(budget / 1000000).toFixed(1)}M`;
    } else if (budget >= 1000) {
      return `$${(budget / 1000).toFixed(0)}K`;
    }
    return `$${budget}`;
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  // Render result card
  const renderResultCard = (result: SearchResult, index: number) => (
    <div
      key={result.id}
      className={`bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer group ${
        viewMode === 'grid' ? 'p-4' : 'p-6 flex items-center space-x-6'
      }`}
      onClick={() => onResultClick(result)}
    >
      {viewMode === 'grid' ? (
        <>
          {/* Header with image and bookmark */}
          <div className="relative mb-4">
            <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden">
              {result.titleImage ? (
                <img
                  src={result.titleImage}
                  alt={result.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark(result.id);
              }}
              className={`absolute top-2 right-2 p-1.5 rounded-full transition-all ${
                bookmarkedItems.has(result.id)
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white/80 text-gray-600 hover:bg-white'
              }`}
            >
              <Bookmark className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-3">
            {/* Title and scores */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {result.title}
                </h3>
                {result.relevanceScore && (
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getScoreColor(result.relevanceScore)}`}>
                    {Math.round(result.relevanceScore)}%
                  </div>
                )}
              </div>
              <p className="text-gray-600 text-sm line-clamp-2 mb-3">{result.logline}</p>
            </div>

            {/* Metadata */}
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg font-medium">
                {result.genre}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-lg font-medium">
                {result.format}
              </span>
              {result.estimatedBudget && (
                <span className="flex items-center space-x-1">
                  <DollarSign className="h-3 w-3" />
                  <span>{formatBudget(result.estimatedBudget)}</span>
                </span>
              )}
            </div>

            {/* AI Insights */}
            {result.keyStrengths && result.keyStrengths.length > 0 && (
              <div className="border-t pt-3">
                <div className="flex items-center space-x-1 mb-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-medium text-gray-700">AI Insights</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.keyStrengths.slice(0, 3).map((strength, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-lg"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats and content flags */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center space-x-3 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Eye className="h-3 w-3" />
                  <span>{result.viewCount}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Heart className="h-3 w-3" />
                  <span>{result.likeCount}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FileText className="h-3 w-3" />
                  <span>{result.ndaCount}</span>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {result.hasScript && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" title="Has Script" />
                )}
                {result.hasTrailer && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" title="Has Trailer" />
                )}
                {result.hasPitchDeck && (
                  <div className="w-2 h-2 bg-purple-500 rounded-full" title="Has Pitch Deck" />
                )}
                {result.hasLookbook && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full" title="Has Lookbook" />
                )}
              </div>
            </div>

            {/* Creator info */}
            <div className="flex items-center space-x-2 pt-2 border-t">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">
                    {result.creator.companyName || result.creator.username}
                  </span>
                  {result.creator.companyVerified && (
                    <Award className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
                {result.creator.location && (
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <MapPin className="h-3 w-3" />
                    <span>{result.creator.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* List view layout */}
          <div className="flex-shrink-0">
            <div className="w-24 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden">
              {result.titleImage ? (
                <img
                  src={result.titleImage}
                  alt={result.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-xl font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                {result.title}
              </h3>
              <div className="flex items-center space-x-2 ml-4">
                {result.relevanceScore && (
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getScoreColor(result.relevanceScore)}`}>
                    {Math.round(result.relevanceScore)}%
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(result.id);
                  }}
                  className={`p-1.5 rounded-lg transition-all ${
                    bookmarkedItems.has(result.id)
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Bookmark className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="text-gray-600 mb-3 line-clamp-2">{result.logline}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
                  {result.genre}
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                  {result.format}
                </span>
                {result.estimatedBudget && (
                  <span className="flex items-center space-x-1 text-sm text-gray-600">
                    <DollarSign className="h-4 w-4" />
                    <span>{formatBudget(result.estimatedBudget)}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Eye className="h-4 w-4" />
                  <span>{result.viewCount}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Heart className="h-4 w-4" />
                  <span>{result.likeCount}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FileText className="h-4 w-4" />
                  <span>{result.ndaCount}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-lg font-medium text-gray-600">Searching with AI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Insights */}
      {searchInsights && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedInsights(!expandedInsights)}
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">AI Search Insights</h3>
                <p className="text-gray-600">{searchInsights.queryInterpretation}</p>
              </div>
            </div>
            {expandedInsights ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </div>

          {expandedInsights && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchInsights.suggestedRefinements.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Suggested Refinements</h4>
                  <ul className="space-y-1">
                    {searchInsights.suggestedRefinements.map((refinement, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{refinement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {searchInsights.marketTrends.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Market Trends</h4>
                  <ul className="space-y-1">
                    {searchInsights.marketTrends.map((trend, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                        <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{trend}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">
            {total.toLocaleString()} results
            {currentQuery && (
              <span className="text-gray-500"> for "{currentQuery}"</span>
            )}
          </span>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Sort Options */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value as SortOption)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all ${
              showFilters
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:border-gray-400'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filters</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className={`${
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' 
            : 'space-y-4'
        }`}>
          {results.map((result, index) => renderResultCard(result, index))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600">Try adjusting your search terms or filters</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-8">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};