import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Clock, MessageSquare, Star, Eye,
  CheckCircle, XCircle, AlertCircle, Filter,
  Search, Calendar, User, ArrowRight, ChevronDown,
  ThumbsUp, ThumbsDown, Edit, ExternalLink, Download
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';

interface PitchReview {
  id: string;
  pitchId: string;
  pitchTitle: string;
  reviewer: {
    id: string;
    name: string;
    avatar?: string;
    type: 'investor' | 'production' | 'industry-expert';
    company?: string;
  };
  status: 'pending' | 'in-progress' | 'completed' | 'requesting-changes';
  overallRating?: number;
  submittedDate: string;
  reviewedDate?: string;
  estimatedCompletion?: string;
  summary?: string;
  feedback: {
    strengths?: string[];
    improvements?: string[];
    questions?: string[];
    marketability?: number;
    creativity?: number;
    feasibility?: number;
    commercialViability?: number;
  };
  isPublic: boolean;
  priority: 'low' | 'medium' | 'high';
  reviewType: 'general' | 'investment' | 'production' | 'script';
}

interface ReviewFilters {
  status: 'all' | 'pending' | 'in-progress' | 'completed' | 'requesting-changes';
  reviewType: 'all' | 'general' | 'investment' | 'production' | 'script';
  rating: 'all' | 'high' | 'medium' | 'low';
  timeRange: '7d' | '30d' | '90d' | 'all';
}

export default function CreatorPitchesReview() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<PitchReview[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<PitchReview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ReviewFilters>({
    status: 'all',
    reviewType: 'all',
    rating: 'all',
    timeRange: 'all'
  });
  const [expandedReviews, setExpandedReviews] = useState<string[]>([]);

  useEffect(() => {
    loadReviews();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reviews, filters, searchQuery]);

  const loadReviews = async () => {
    try {
      // Simulate API call - replace with actual API
      setTimeout(() => {
        const mockReviews: PitchReview[] = [
          {
            id: '1',
            pitchId: 'pitch-1',
            pitchTitle: 'The Quantum Paradox',
            reviewer: {
              id: 'rev1',
              name: 'Sarah Chen',
              type: 'investor',
              company: 'Venture Films'
            },
            status: 'completed',
            overallRating: 8,
            submittedDate: '2024-11-15T09:00:00Z',
            reviewedDate: '2024-11-20T14:30:00Z',
            summary: 'Compelling sci-fi concept with strong commercial potential. The parallel universe angle is fresh and the character development is solid.',
            feedback: {
              strengths: [
                'Unique and compelling premise',
                'Strong character development',
                'Clear market appeal',
                'Well-structured three-act story'
              ],
              improvements: [
                'Budget estimates seem optimistic',
                'Need more diversity in casting',
                'Third act could be tightened'
              ],
              questions: [
                'Have you secured any key talent?',
                'What\'s your marketing strategy?',
                'Are there similar projects in development?'
              ],
              marketability: 8,
              creativity: 9,
              feasibility: 7,
              commercialViability: 8
            },
            isPublic: false,
            priority: 'high',
            reviewType: 'investment'
          },
          {
            id: '2',
            pitchId: 'pitch-2',
            pitchTitle: 'Midnight Café',
            reviewer: {
              id: 'rev2',
              name: 'Marcus Rodriguez',
              type: 'production',
              company: 'Silver Screen Studios'
            },
            status: 'in-progress',
            submittedDate: '2024-12-01T10:00:00Z',
            estimatedCompletion: '2024-12-15T17:00:00Z',
            summary: 'Initial review shows promise. Character-driven drama with strong emotional core.',
            feedback: {
              strengths: [
                'Authentic character voices',
                'Strong emotional resonance'
              ],
              improvements: [],
              questions: [
                'Location scouting completed?',
                'Lead actor availability?'
              ],
              marketability: 6,
              creativity: 8,
              feasibility: 8,
              commercialViability: 6
            },
            isPublic: false,
            priority: 'medium',
            reviewType: 'production'
          },
          {
            id: '3',
            pitchId: 'pitch-3',
            pitchTitle: 'The Last Symphony',
            reviewer: {
              id: 'rev3',
              name: 'Dr. Emily Watson',
              type: 'industry-expert',
              company: 'Film Institute'
            },
            status: 'requesting-changes',
            submittedDate: '2024-11-28T15:30:00Z',
            reviewedDate: '2024-12-05T11:00:00Z',
            overallRating: 6,
            summary: 'Solid concept but needs refinement in several areas before it\'s ready for production consideration.',
            feedback: {
              strengths: [
                'Emotionally powerful subject matter',
                'Relevant social themes'
              ],
              improvements: [
                'Pacing issues in second act',
                'Supporting characters need development',
                'Dialogue feels forced in places',
                'Medical accuracy concerns'
              ],
              questions: [
                'Have you consulted with medical experts?',
                'What\'s the target rating?',
                'Any music rights secured?'
              ],
              marketability: 5,
              creativity: 7,
              feasibility: 6,
              commercialViability: 5
            },
            isPublic: false,
            priority: 'medium',
            reviewType: 'script'
          },
          {
            id: '4',
            pitchId: 'pitch-4',
            pitchTitle: 'Ocean\'s Heart',
            reviewer: {
              id: 'rev4',
              name: 'James Thompson',
              type: 'investor',
              company: 'Pacific Ventures'
            },
            status: 'pending',
            submittedDate: '2024-12-08T09:00:00Z',
            estimatedCompletion: '2024-12-22T17:00:00Z',
            feedback: {
              strengths: [],
              improvements: [],
              questions: []
            },
            isPublic: false,
            priority: 'low',
            reviewType: 'general'
          }
        ];
        setReviews(mockReviews);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load reviews:', error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reviews];

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(review =>
        review.pitchTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.reviewer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.reviewer.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(review => review.status === filters.status);
    }

    // Apply review type filter
    if (filters.reviewType !== 'all') {
      filtered = filtered.filter(review => review.reviewType === filters.reviewType);
    }

    // Apply rating filter
    if (filters.rating !== 'all') {
      filtered = filtered.filter(review => {
        if (!review.overallRating) return false;
        if (filters.rating === 'high') return review.overallRating >= 8;
        if (filters.rating === 'medium') return review.overallRating >= 6 && review.overallRating < 8;
        if (filters.rating === 'low') return review.overallRating < 6;
        return true;
      });
    }

    // Apply time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const timeRanges: Record<string, number> = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const rangeMs = timeRanges[filters.timeRange];
      if (rangeMs) {
        const cutoff = new Date(now.getTime() - rangeMs);
        filtered = filtered.filter(review => new Date(review.submittedDate) > cutoff);
      }
    }

    setFilteredReviews(filtered);
  };

  const toggleReviewExpansion = (reviewId: string) => {
    setExpandedReviews(prev =>
      prev.includes(reviewId)
        ? prev.filter(id => id !== reviewId)
        : [...prev, reviewId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'requesting-changes': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in-progress': return Clock;
      case 'pending': return AlertCircle;
      case 'requesting-changes': return XCircle;
      default: return FileText;
    }
  };

  const getReviewerTypeColor = (type: string) => {
    switch (type) {
      case 'investor': return 'bg-purple-100 text-purple-800';
      case 'production': return 'bg-blue-100 text-blue-800';
      case 'industry-expert': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderRatingStars = (rating: number) => {
    return Array.from({ length: 10 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const renderRatingBar = (label: string, value: number) => (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-24">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-900 w-8">{value}/10</span>
    </div>
  );

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pitch Reviews</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track feedback and reviews from industry professionals
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Download className="w-4 h-4 mr-2" />
              Export Reviews
            </button>
            <button
              onClick={() => navigate('/manage-pitches')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              <Eye className="w-4 h-4 mr-2" />
              Request Review
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="requesting-changes">Changes Requested</option>
              </select>

              <select
                value={filters.reviewType}
                onChange={(e) => setFilters(prev => ({ ...prev, reviewType: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="general">General</option>
                <option value="investment">Investment</option>
                <option value="production">Production</option>
                <option value="script">Script</option>
              </select>

              <select
                value={filters.rating}
                onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Ratings</option>
                <option value="high">High (8-10)</option>
                <option value="medium">Medium (6-7)</option>
                <option value="low">Low (1-5)</option>
              </select>

              <select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Time</option>
                <option value="7d">Last Week</option>
                <option value="30d">Last Month</option>
                <option value="90d">Last Quarter</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredReviews.length} of {reviews.length} reviews
          </p>
        </div>

        {/* Reviews List */}
        {filteredReviews.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reviews found</h3>
            <p className="text-gray-600 mb-6">
              {reviews.length === 0 
                ? "You haven't received any pitch reviews yet."
                : "No reviews match your current filters."
              }
            </p>
            <button
              onClick={() => navigate('/manage-pitches')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
            >
              Request Your First Review
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review) => {
              const StatusIcon = getStatusIcon(review.status);
              const isExpanded = expandedReviews.includes(review.id);
              
              return (
                <div key={review.id} className="bg-white rounded-lg shadow-sm border">
                  {/* Header */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {review.pitchTitle}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(review.status)}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {review.status.replace('-', ' ')}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getReviewerTypeColor(review.reviewer.type)}`}>
                            {review.reviewType} review
                          </span>
                        </div>
                        
                        {review.overallRating && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-gray-600">Overall Rating:</span>
                            <div className="flex items-center gap-1">
                              {renderRatingStars(review.overallRating)}
                              <span className="text-sm font-medium text-gray-900 ml-1">
                                {review.overallRating}/10
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {review.summary && (
                          <p className="text-sm text-gray-600 mb-3">
                            {review.summary}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => toggleReviewExpansion(review.id)}
                        className="ml-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Reviewer Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{review.reviewer.name}</p>
                          <p className="text-xs text-gray-500">
                            {review.reviewer.company} • {review.reviewer.type.replace('-', ' ')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Submitted {new Date(review.submittedDate).toLocaleDateString()}</span>
                        </div>
                        {review.reviewedDate && (
                          <div className="flex items-center gap-1 mt-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>Completed {new Date(review.reviewedDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        {review.estimatedCompletion && !review.reviewedDate && (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>Est. completion {new Date(review.estimatedCompletion).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && review.status === 'completed' && (
                    <div className="border-t px-6 py-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Detailed Ratings */}
                        {(review.feedback.marketability || review.feedback.creativity || 
                          review.feedback.feasibility || review.feedback.commercialViability) && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">Detailed Ratings</h4>
                            <div className="space-y-3">
                              {review.feedback.marketability && renderRatingBar('Marketability', review.feedback.marketability)}
                              {review.feedback.creativity && renderRatingBar('Creativity', review.feedback.creativity)}
                              {review.feedback.feasibility && renderRatingBar('Feasibility', review.feedback.feasibility)}
                              {review.feedback.commercialViability && renderRatingBar('Commercial', review.feedback.commercialViability)}
                            </div>
                          </div>
                        )}

                        {/* Feedback Summary */}
                        <div className="space-y-4">
                          {review.feedback.strengths && review.feedback.strengths.length > 0 && (
                            <div>
                              <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                                <ThumbsUp className="w-4 h-4" />
                                Strengths
                              </h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                                {review.feedback.strengths.map((strength, index) => (
                                  <li key={index}>{strength}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {review.feedback.improvements && review.feedback.improvements.length > 0 && (
                            <div>
                              <h4 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
                                <ThumbsDown className="w-4 h-4" />
                                Areas for Improvement
                              </h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                                {review.feedback.improvements.map((improvement, index) => (
                                  <li key={index}>{improvement}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {review.feedback.questions && review.feedback.questions.length > 0 && (
                            <div>
                              <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Questions from Reviewer
                              </h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                                {review.feedback.questions.map((question, index) => (
                                  <li key={index}>{question}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-6 pt-4 border-t flex gap-3">
                        <button
                          onClick={() => navigate(`/pitch/${review.pitchId}`)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Pitch
                        </button>
                        {review.status === 'requesting-changes' && (
                          <button
                            onClick={() => navigate(`/pitch-edit/${review.pitchId}`)}
                            className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Make Changes
                          </button>
                        )}
                        <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Respond
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}