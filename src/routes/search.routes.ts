/**
 * Comprehensive Search API Routes
 * Handles all search functionality including pitches, users, suggestions, and filters
 */

import { SearchService } from "../services/search.service.ts";
import { SimpleBrowseService } from "../services/simple-browse.service.ts"; 
import { AdvancedSearchService } from "../services/advanced-search.service.ts";
import { successResponse, errorResponse } from "../utils/response-helpers.ts";

// Search pitches with advanced filtering
export async function handlePitchSearch(request: Request, userId?: number): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Parse search filters from query parameters
    const filters = {
      query: searchParams.get('q') || searchParams.get('query') || '',
      titleOnly: searchParams.get('titleOnly') === 'true',
      loglineOnly: searchParams.get('loglineOnly') === 'true',
      descriptionOnly: searchParams.get('descriptionOnly') === 'true',
      
      // Array filters
      genres: searchParams.getAll('genre').filter(Boolean),
      formats: searchParams.getAll('format').filter(Boolean),
      budgetRanges: searchParams.getAll('budgetRange').filter(Boolean),
      stages: searchParams.getAll('stage').filter(Boolean),
      statuses: searchParams.getAll('status').filter(Boolean),
      creatorTypes: searchParams.getAll('creatorType').filter(Boolean),
      
      // Numeric filters
      minViews: searchParams.get('minViews') ? parseInt(searchParams.get('minViews')!) : undefined,
      maxViews: searchParams.get('maxViews') ? parseInt(searchParams.get('maxViews')!) : undefined,
      minLikes: searchParams.get('minLikes') ? parseInt(searchParams.get('minLikes')!) : undefined,
      maxLikes: searchParams.get('maxLikes') ? parseInt(searchParams.get('maxLikes')!) : undefined,
      minComments: searchParams.get('minComments') ? parseInt(searchParams.get('minComments')!) : undefined,
      
      // Boolean filters
      hasNDA: searchParams.get('hasNDA') === 'true' ? true : searchParams.get('hasNDA') === 'false' ? false : undefined,
      ndaRequired: searchParams.get('ndaRequired') === 'true',
      seekingInvestment: searchParams.get('seekingInvestment') === 'true',
      hasVideo: searchParams.get('hasVideo') === 'true' ? true : searchParams.get('hasVideo') === 'false' ? false : undefined,
      hasPitchDeck: searchParams.get('hasPitchDeck') === 'true' ? true : searchParams.get('hasPitchDeck') === 'false' ? false : undefined,
      verifiedCreatorsOnly: searchParams.get('verifiedOnly') === 'true',
      
      // Date filters
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      createdInLast: searchParams.get('createdInLast') as any || undefined,
      updatedSince: searchParams.get('updatedSince') || undefined,
      
      // Advanced user filters
      excludeViewed: searchParams.get('excludeViewed') === 'true',
      onlyWatched: searchParams.get('onlyWatched') === 'true',
      similarTo: searchParams.get('similarTo') ? parseInt(searchParams.get('similarTo')!) : undefined,
      recommendedFor: searchParams.get('recommendedFor') ? parseInt(searchParams.get('recommendedFor')!) : undefined,
      
      // Sorting and pagination
      sortBy: searchParams.get('sortBy') as any || 'relevance',
      sortOrder: searchParams.get('sortOrder') as any || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '24'), 100)
    };

    // Remove empty arrays and undefined values
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (Array.isArray(value) && value.length === 0) {
        delete (filters as any)[key];
      }
      if (value === undefined || value === '') {
        delete (filters as any)[key];
      }
    });

    const result = await SearchService.searchPitches(filters, userId);

    return successResponse({
      success: true,
      message: 'Search completed successfully',
      ...result,
      filters: filters // Return applied filters for frontend
    });

  } catch (error) {
    console.error('Error in pitch search:', error);
    return errorResponse('Search failed', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Search users
export async function handleUserSearch(request: Request, userId?: number): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const filters = {
      query: searchParams.get('q') || searchParams.get('query') || '',
      creatorTypes: searchParams.getAll('userType').filter(Boolean),
      verifiedCreatorsOnly: searchParams.get('verifiedOnly') === 'true',
      sortBy: searchParams.get('sortBy') as any || 'relevance',
      sortOrder: searchParams.get('sortOrder') as any || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    };

    const result = await SearchService.searchUsers(filters, userId);

    return successResponse({
      success: true,
      message: 'User search completed successfully',
      ...result,
      filters: filters
    });

  } catch (error) {
    console.error('Error in user search:', error);
    return errorResponse('User search failed', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Browse pitches with tabs (Trending, New, Popular)
export async function handleBrowsePitches(request: Request, userId?: number): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const filters = {
      tab: searchParams.get('tab') as any || 'trending',
      genres: searchParams.getAll('genre').filter(Boolean),
      formats: searchParams.getAll('format').filter(Boolean),
      budgetRanges: searchParams.getAll('budgetRange').filter(Boolean),
      stages: searchParams.getAll('stage').filter(Boolean),
      timeframe: searchParams.get('timeframe') as any || '7d',
      sortBy: searchParams.get('sortBy') as any,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '24'), 100)
    };

    const result = await SimpleBrowseService.browse(filters);
    
    // Ensure result exists and has the expected structure
    if (!result) {
      throw new Error('No result returned from browse service');
    }

    return successResponse({
      success: true,
      message: `${filters.tab || 'trending'} pitches retrieved successfully`,
      items: result.items || [],
      total: result.total || 0,
      page: result.page || 1,
      totalPages: result.totalPages || 0,
      limit: result.limit || 24,
      hasMore: result.hasMore || false,
      filters: filters
    });

  } catch (error) {
    console.error('Error in browse pitches:', error);
    return errorResponse('Browse failed', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Get search suggestions and autocomplete
export async function handleSearchSuggestions(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || url.searchParams.get('query') || '';
    const type = url.searchParams.get('type') as any || 'query';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '8'), 20);

    if (!query || query.length < 2) {
      return successResponse({
        success: true,
        suggestions: [],
        message: 'Query too short for suggestions'
      });
    }

    const suggestions = await SearchService.getSuggestions(query, type);

    return successResponse({
      success: true,
      suggestions: suggestions.slice(0, limit),
      message: 'Suggestions retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting suggestions:', error);
    return errorResponse('Failed to get suggestions', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Get trending searches, genres, formats
export async function handleTrendingSearches(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') as any || '7d';

    const trends = await SearchService.getTrendingSearches(timeframe);

    return successResponse({
      success: true,
      trends,
      message: 'Trending data retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting trending searches:', error);
    return errorResponse('Failed to get trending data', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Save search for later use
export async function handleSaveSearch(request: Request, userId: number): Promise<Response> {
  try {
    const body = await request.json();
    const { name, filters, notifyOnResults = false } = body;

    if (!name || !filters) {
      return errorResponse('Name and filters are required', 400);
    }

    const result = await SearchService.saveSearch(name, filters, userId, notifyOnResults);

    return successResponse({
      success: true,
      search: result,
      message: 'Search saved successfully'
    });

  } catch (error) {
    console.error('Error saving search:', error);
    return errorResponse('Failed to save search', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Get saved searches
export async function handleGetSavedSearches(request: Request, userId: number): Promise<Response> {
  try {
    const searches = await SearchService.getSavedSearches(userId);

    return successResponse({
      success: true,
      searches,
      message: 'Saved searches retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting saved searches:', error);
    return errorResponse('Failed to get saved searches', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Update saved search
export async function handleUpdateSavedSearch(request: Request, userId: number): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchId = parseInt(url.pathname.split('/').pop() || '0');
    const body = await request.json();

    if (!searchId) {
      return errorResponse('Invalid search ID', 400);
    }

    const result = await SearchService.updateSavedSearch(userId, searchId, body);

    if (!result) {
      return errorResponse('Search not found or not authorized', 404);
    }

    return successResponse({
      success: true,
      search: result,
      message: 'Saved search updated successfully'
    });

  } catch (error) {
    console.error('Error updating saved search:', error);
    return errorResponse('Failed to update search', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Delete saved search
export async function handleDeleteSavedSearch(request: Request, userId: number): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchId = parseInt(url.pathname.split('/').pop() || '0');

    if (!searchId) {
      return errorResponse('Invalid search ID', 400);
    }

    const deleted = await SearchService.deleteSavedSearch(userId, searchId);

    if (!deleted) {
      return errorResponse('Search not found or not authorized', 404);
    }

    return successResponse({
      success: true,
      message: 'Saved search deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting saved search:', error);
    return errorResponse('Failed to delete search', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Run saved search
export async function handleRunSavedSearch(request: Request, userId: number): Promise<Response> {
  try {
    const url = new URL(request.url);
    const searchId = parseInt(url.pathname.split('/')[4] || '0');

    if (!searchId) {
      return errorResponse('Invalid search ID', 400);
    }

    const filters = await SearchService.useSavedSearch(userId, searchId);

    if (!filters) {
      return errorResponse('Search not found or not authorized', 404);
    }

    const result = await SearchService.searchPitches(filters, userId);

    return successResponse({
      success: true,
      ...result,
      message: 'Saved search executed successfully'
    });

  } catch (error) {
    console.error('Error running saved search:', error);
    return errorResponse('Failed to run saved search', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Get search history
export async function handleSearchHistory(request: Request, userId: number): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    const history = await SearchService.getSearchHistory(userId, limit);

    return successResponse({
      success: true,
      history,
      message: 'Search history retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting search history:', error);
    return errorResponse('Failed to get search history', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Advanced search with AI interpretation
export async function handleAdvancedSearch(request: Request, userId?: number): Promise<Response> {
  try {
    const body = await request.json();
    const params = {
      ...body,
      // Ensure proper type casting for advanced search params
      page: body.page || 1,
      limit: Math.min(body.limit || 20, 100)
    };

    const result = await AdvancedSearchService.search(params, userId);

    return successResponse({
      success: true,
      ...result,
      message: 'Advanced search completed successfully'
    });

  } catch (error) {
    console.error('Error in advanced search:', error);
    return errorResponse('Advanced search failed', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Find similar content to a pitch
export async function handleSimilarContent(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pitchId = parseInt(url.pathname.split('/')[4] || '0');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    if (!pitchId) {
      return errorResponse('Invalid pitch ID', 400);
    }

    const result = await AdvancedSearchService.findSimilarContent(pitchId, limit);

    return successResponse({
      success: true,
      ...result,
      message: 'Similar content retrieved successfully'
    });

  } catch (error) {
    console.error('Error finding similar content:', error);
    return errorResponse('Failed to find similar content', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Get faceted search results
export async function handleFacetedSearch(request: Request, userId?: number): Promise<Response> {
  try {
    const url = new URL(request.url);
    const facetField = url.searchParams.get('field') as any;
    const baseFilters = Object.fromEntries(url.searchParams.entries());
    
    // Remove the field parameter from base filters
    delete baseFilters.field;

    if (!facetField || !['genre', 'format', 'budgetRange', 'stage'].includes(facetField)) {
      return errorResponse('Valid facet field required (genre, format, budgetRange, stage)', 400);
    }

    const result = await AdvancedSearchService.facetedSearch(baseFilters, facetField, userId);

    return successResponse({
      success: true,
      facets: result,
      message: `${facetField} facets retrieved successfully`
    });

  } catch (error) {
    console.error('Error in faceted search:', error);
    return errorResponse('Faceted search failed', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Get search filters metadata (available genres, formats, etc.)
export async function handleFiltersMetadata(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'pitch';

    // Get available filter values from database
    const metadata = await SearchService.getFiltersMetadata(type as any);

    return successResponse({
      success: true,
      metadata,
      message: 'Filters metadata retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting filters metadata:', error);
    return errorResponse('Failed to get filters metadata', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Export search results
export async function handleExportResults(request: Request, userId: number): Promise<Response> {
  try {
    const body = await request.json();
    const { searchType, filters, format = 'csv' } = body;

    if (!searchType || !filters) {
      return errorResponse('Search type and filters are required', 400);
    }

    if (!['csv', 'json', 'excel'].includes(format)) {
      return errorResponse('Invalid export format. Use csv, json, or excel', 400);
    }

    // For now, return a simple message. In a real implementation,
    // you would generate the actual file and return it
    return successResponse({
      success: true,
      message: 'Export functionality not yet implemented',
      downloadUrl: null // Would contain the download URL in real implementation
    });

  } catch (error) {
    console.error('Error exporting results:', error);
    return errorResponse('Export failed', 500, { 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}