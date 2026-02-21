import React, { useState } from 'react';
import { Star, Eye, Heart, DollarSign, Calendar, Users, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InvestmentOpportunity {
  id: number;
  title: string;
  logline: string;
  genre: string;
  estimatedBudget: number;
  seekingAmount?: number;
  productionStage: string;
  creator: {
    id: number;
    username: string;
    companyName?: string;
  };
  viewCount: number;
  likeCount: number;
  ratingAverage?: number;
  matchScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  expectedROI?: number;
  timeline?: string;
  publishedAt: Date;
}

interface InvestmentOpportunitiesProps {
  opportunities: InvestmentOpportunity[];
  loading?: boolean;
  showMatchScore?: boolean;
  onOpportunityClick?: (opportunity: InvestmentOpportunity) => void;
  onInvestClick?: (opportunity: InvestmentOpportunity) => void;
  className?: string;
}

export default function InvestmentOpportunities({
  opportunities,
  loading = false,
  showMatchScore = true,
  onOpportunityClick,
  onInvestClick,
  className = ''
}: InvestmentOpportunitiesProps) {
  const navigate = useNavigate();
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'match' | 'views' | 'budget' | 'date'>('match');

  // Get unique genres and stages for filters
  const genres = Array.from(new Set(opportunities.map(op => op.genre))).sort();
  const stages = Array.from(new Set(opportunities.map(op => op.productionStage))).sort();

  // Filter and sort opportunities
  const filteredOpportunities = opportunities
    .filter(op => filterGenre === 'all' || op.genre === filterGenre)
    .filter(op => filterStage === 'all' || op.productionStage === filterStage)
    .sort((a, b) => {
      switch (sortBy) {
        case 'match':
          return (b.matchScore || 0) - (a.matchScore || 0);
        case 'views':
          return b.viewCount - a.viewCount;
        case 'budget':
          return b.estimatedBudget - a.estimatedBudget;
        case 'date':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        default:
          return 0;
      }
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'Low':
        return 'bg-green-100 text-green-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'High':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleOpportunityClick = (opportunity: InvestmentOpportunity) => {
    if (onOpportunityClick) {
      onOpportunityClick(opportunity);
    } else {
      void navigate(`/investor/pitch/${opportunity.id}`);
    }
  };

  const handleInvestClick = (e: React.MouseEvent, opportunity: InvestmentOpportunity) => {
    e.stopPropagation();
    if (onInvestClick) {
      onInvestClick(opportunity);
    } else {
      void navigate(`/investor/pitch/${opportunity.id}?tab=invest`);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm ${className}`}>
      {/* Header with Filters */}
      <div className="px-6 py-4 border-b">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Investment Opportunities</h3>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Genre Filter */}
            <select
              value={filterGenre}
              onChange={(e) => setFilterGenre(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Genres</option>
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>

            {/* Stage Filter */}
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stages</option>
              {stages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'match' | 'views' | 'budget' | 'date')}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {showMatchScore && <option value="match">Best Match</option>}
              <option value="views">Most Viewed</option>
              <option value="budget">Highest Budget</option>
              <option value="date">Most Recent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="p-6">
        {filteredOpportunities.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No opportunities found</p>
            <p className="text-sm text-gray-400">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOpportunities.map((opportunity) => (
              <div
                key={opportunity.id}
                onClick={() => handleOpportunityClick(opportunity)}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900 truncate">
                        {opportunity.title}
                      </h4>
                      {showMatchScore && opportunity.matchScore && (
                        <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                          <Star className="w-4 h-4 text-blue-500 fill-current" />
                          <span className="text-sm font-medium text-blue-700">
                            {opportunity.matchScore}% match
                          </span>
                        </div>
                      )}
                      {opportunity.riskLevel && (
                        <span className={`px-2 py-1 text-xs rounded-full ${getRiskColor(opportunity.riskLevel)}`}>
                          {opportunity.riskLevel} Risk
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {opportunity.logline}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {opportunity.genre}
                      </span>
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {opportunity.productionStage}
                      </span>
                      <span>by {opportunity.creator.companyName || opportunity.creator.username}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Total Budget</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(opportunity.estimatedBudget)}
                        </p>
                      </div>
                      {opportunity.seekingAmount && (
                        <div>
                          <p className="text-xs text-gray-500">Seeking</p>
                          <p className="font-semibold text-blue-600">
                            {formatCurrency(opportunity.seekingAmount)}
                          </p>
                        </div>
                      )}
                      {opportunity.expectedROI && (
                        <div>
                          <p className="text-xs text-gray-500">Expected ROI</p>
                          <p className="font-semibold text-green-600">
                            +{opportunity.expectedROI}%
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500">Engagement</p>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {opportunity.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {opportunity.likeCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {opportunity.timeline && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <Calendar className="w-4 h-4" />
                        <span>Production timeline: {opportunity.timeline}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {opportunity.ratingAverage && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span>{opportunity.ratingAverage.toFixed(1)}</span>
                      </div>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {opportunity.viewCount} views
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleOpportunityClick(opportunity)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View Details
                    </button>
                    <button
                      onClick={(e) => handleInvestClick(e, opportunity)}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm rounded-lg hover:shadow-lg transition flex items-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      Invest
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}