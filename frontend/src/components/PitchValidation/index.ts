/**
 * Pitch Validation System Components
 * Export all validation-related components for easy importing
 */

// Core validation components
export { ValidationDashboard } from './ValidationDashboard';
export { RealTimeValidator, ValidationProgressBar } from './RealTimeValidator';
export { ValidationChartsContainer } from './ValidationCharts';
export { EnhancedPitchForm } from './EnhancedPitchForm';

// Re-export validation types for components that need them
export type {
  ValidationScore,
  ValidationCategories,
  CategoryScore,
  ValidationRecommendation,
  RealTimeValidation,
  ValidationProgress,
  ValidationDashboard as ValidationDashboardData,
  ComparableProject,
  BenchmarkData,
  ScoreTrend
} from '../../types/pitch-validation.types';

// Component configuration types
export interface ValidationComponentConfig {
  pitchId: string;
  showRealTimeValidation?: boolean;
  showDetailedFeedback?: boolean;
  autoAnalyze?: boolean;
  analysisDepth?: 'basic' | 'standard' | 'comprehensive';
}

// Validation service utility functions
export class ValidationService {
  static async analyzePlay(pitchData: any, options: any = {}) {
    const response = await fetch('/api/validation/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pitchData,
        options: {
          depth: 'standard',
          include_market_data: true,
          include_comparables: true,
          include_predictions: true,
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error('Validation analysis failed');
    }

    return response.json();
  }

  static async getScore(pitchId: string) {
    const response = await fetch(`/api/validation/score/${pitchId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get validation score');
    }

    return response.json();
  }

  static async getRecommendations(pitchId: string, filters: any = {}) {
    const params = new URLSearchParams();
    
    if (filters.category) params.set('category', filters.category);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.limit) params.set('limit', filters.limit.toString());

    const response = await fetch(`/api/validation/recommendations/${pitchId}?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to get recommendations');
    }

    return response.json();
  }

  static async getComparables(pitchId: string, filters: any = {}) {
    const params = new URLSearchParams();
    
    if (filters.genre) params.set('genre', filters.genre);
    if (filters.budget_min) params.set('budget_min', filters.budget_min.toString());
    if (filters.budget_max) params.set('budget_max', filters.budget_max.toString());
    if (filters.year_min) params.set('year_min', filters.year_min.toString());
    if (filters.year_max) params.set('year_max', filters.year_max.toString());
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.min_similarity) params.set('min_similarity', filters.min_similarity.toString());

    const response = await fetch(`/api/validation/comparables/${pitchId}?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to get comparable projects');
    }

    return response.json();
  }

  static async getDashboard(pitchId: string) {
    const response = await fetch(`/api/validation/dashboard/${pitchId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get validation dashboard');
    }

    return response.json();
  }

  static async realTimeValidate(pitchId: string, field: string, content: string) {
    const response = await fetch('/api/validation/realtime', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pitchId,
        field,
        content
      })
    });

    if (!response.ok) {
      throw new Error('Real-time validation failed');
    }

    return response.json();
  }

  static async benchmark(pitchId: string, categories: string[], comparisonPool: string = 'all') {
    const response = await fetch('/api/validation/benchmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pitchId,
        categories,
        comparison_pool: comparisonPool
      })
    });

    if (!response.ok) {
      throw new Error('Benchmark analysis failed');
    }

    return response.json();
  }

  static async batchAnalyze(pitches: any[]) {
    const response = await fetch('/api/validation/batch-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pitches })
    });

    if (!response.ok) {
      throw new Error('Batch analysis failed');
    }

    return response.json();
  }
}

// Utility functions for validation scores
export const ValidationUtils = {
  getScoreColor: (score: number): string => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  },

  getScoreLabel: (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Requires Attention';
  },

  getOverallRating: (categories: ValidationCategories): string => {
    const overallScore = Object.values(categories).reduce((sum, cat) => 
      sum + (cat.score * cat.weight / 100), 0
    );
    return ValidationUtils.getScoreLabel(overallScore);
  },

  getTopRecommendations: (recommendations: ValidationRecommendation[], count: number = 3): ValidationRecommendation[] => {
    return recommendations
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return b.estimatedImpact - a.estimatedImpact;
      })
      .slice(0, count);
  },

  calculateCompleteness: (formData: any): number => {
    const requiredFields = ['title', 'logline', 'synopsis', 'genre', 'budget'];
    const completedFields = requiredFields.filter(field => 
      formData[field] && formData[field].toString().trim().length > 0
    );
    return Math.round((completedFields.length / requiredFields.length) * 100);
  },

  formatBudget: (budget: number): string => {
    if (budget >= 1000000000) {
      return `$${(budget / 1000000000).toFixed(1)}B`;
    }
    if (budget >= 1000000) {
      return `$${(budget / 1000000).toFixed(1)}M`;
    }
    if (budget >= 1000) {
      return `$${(budget / 1000).toFixed(0)}K`;
    }
    return `$${budget.toLocaleString()}`;
  },

  getBudgetCategory: (budget: number): string => {
    if (budget < 1000000) return 'Micro Budget';
    if (budget < 5000000) return 'Low Budget';
    if (budget < 25000000) return 'Medium Budget';
    if (budget < 100000000) return 'High Budget';
    return 'Blockbuster';
  },

  getGenreColor: (genre: string): string => {
    const genreColors: Record<string, string> = {
      action: '#FF6B6B',
      comedy: '#4ECDC4',
      drama: '#45B7D1',
      horror: '#8B5CF6',
      thriller: '#F39C12',
      romance: '#E74C3C',
      scifi: '#2ECC71',
      fantasy: '#9B59B6',
      documentary: '#95A5A6'
    };
    return genreColors[genre.toLowerCase()] || '#6C757D';
  }
};

// Custom hooks for validation functionality
import { useState } from 'react';

export const useValidation = (pitchId: string) => {
  const [validationData, setValidationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = async (pitchData: any, options: any = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ValidationService.analyzePlay(pitchData, options);
      setValidationData(result.data);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ValidationService.getDashboard(pitchId);
      setValidationData(result.data);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    validationData,
    loading,
    error,
    analyze,
    refresh
  };
};

// Component prop interfaces for external usage
export interface ValidationComponentProps {
  pitchId: string;
  config?: Partial<ValidationComponentConfig>;
  onValidationComplete?: (data: ValidationScore) => void;
  onError?: (error: string) => void;
  className?: string;
}

export interface PitchFormProps {
  pitchId?: string;
  initialData?: any;
  showValidation?: boolean;
  onSave?: (data: any) => void;
  onSubmit?: (data: any) => void;
  validationConfig?: ValidationComponentConfig;
}

export interface DashboardProps {
  pitchId: string;
  showCharts?: boolean;
  showRecommendations?: boolean;
  showComparisons?: boolean;
  onRecommendationClick?: (recommendation: ValidationRecommendation) => void;
}