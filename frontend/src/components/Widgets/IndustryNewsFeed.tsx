import React, { useState, useEffect } from 'react';
import { TrendingUp, ExternalLink, Clock, Star, RefreshCw } from 'lucide-react';
import apiClient from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

interface NewsItem {
  id: string | number;
  title: string;
  excerpt: string;
  source: string;
  link: string;
  date: string;
  relevance: number;
  image?: string;
}

interface NewsWidgetData {
  timestamp: string;
  items: NewsItem[];
  insights?: {
    hot_genres: Array<[string, number]>;
    trending_formats: Array<[string, number]>;
    active_buyers: Array<[string, number]>;
  };
}

export default function IndustryNewsFeed() {
  const [newsData, setNewsData] = useState<NewsWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from backend API
      const response = await apiClient.get('/api/news/industry');
      
      if (response.data.success) {
        setNewsData(response.data.data);
        setLastUpdated(new Date());
      } else {
        // Fallback to static data for demo
        setNewsData({
          timestamp: new Date().toISOString(),
          items: [
            {
              id: 1,
              title: "Netflix Acquires Rights to Bestselling Novel Series for $100M",
              excerpt: "Streaming giant outbids competitors for highly anticipated fantasy adaptation...",
              source: "variety",
              link: "#",
              date: new Date().toISOString(),
              relevance: 9.5,
              image: "/api/placeholder/400/200"
            },
            {
              id: 2,
              title: "A24 Announces Slate of Horror Films for 2025",
              excerpt: "Independent studio doubles down on genre with five new projects...",
              source: "hollywood_reporter",
              link: "#",
              date: new Date().toISOString(),
              relevance: 8.7,
              image: "/api/placeholder/400/200"
            },
            {
              id: 3,
              title: "Box Office: Weekend Sees Surprise Indie Hit",
              excerpt: "Low-budget thriller exceeds expectations with $15M opening...",
              source: "deadline",
              link: "#",
              date: new Date().toISOString(),
              relevance: 7.8,
              image: "/api/placeholder/400/200"
            },
            {
              id: 4,
              title: "Disney+ Greenlights Three New Limited Series",
              excerpt: "Streaming platform expands original content with star-studded productions...",
              source: "variety",
              link: "#",
              date: new Date().toISOString(),
              relevance: 8.2,
              image: "/api/placeholder/400/200"
            },
            {
              id: 5,
              title: "Cannes Market: International Buyers Circle New Sci-Fi Epic",
              excerpt: "Multiple territories bid on rights to upcoming blockbuster...",
              source: "deadline",
              link: "#",
              date: new Date().toISOString(),
              relevance: 7.5,
              image: "/api/placeholder/400/200"
            }
          ],
          insights: {
            hot_genres: [
              ['horror', 12],
              ['sci-fi', 10],
              ['thriller', 8],
              ['drama', 7],
              ['comedy', 5]
            ],
            trending_formats: [
              ['limited series', 15],
              ['feature film', 12],
              ['documentary', 6]
            ],
            active_buyers: [
              ['netflix', 18],
              ['amazon', 14],
              ['apple', 11],
              ['disney', 10],
              ['warner', 8]
            ]
          }
        });
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError('Unable to load industry news');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    
    // Auto-refresh every 5 minutes if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchNews, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getSourceIcon = (source: string) => {
    const colors: Record<string, string> = {
      variety: 'text-red-600',
      hollywood_reporter: 'text-blue-600',
      deadline: 'text-yellow-600',
      default: 'text-gray-600'
    };
    return colors[source] || colors.default;
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading && !newsData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !newsData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center text-gray-500">
          <p>{error}</p>
          <button
            onClick={fetchNews}
            className="mt-2 text-blue-600 hover:text-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Industry News</h2>
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-2 py-1 rounded ${
              autoRefresh ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={fetchNews}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* News Items */}
      <div className="divide-y">
        {newsData?.items.map((item, index) => (
          <div
            key={item.id}
            className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => window.open(item.link, '_blank')}
          >
            <div className="flex gap-4">
              {/* Image */}
              {item.image && index === 0 && (
                <div className="flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-24 h-16 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-medium text-sm line-clamp-2 flex-1">
                    {item.title}
                  </h3>
                  <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0 mt-1" />
                </div>
                
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                  {item.excerpt}
                </p>
                
                <div className="flex items-center gap-3 text-xs">
                  <span className={`font-medium ${getSourceIcon(item.source)}`}>
                    {item.source.replace('_', ' ').toUpperCase()}
                  </span>
                  
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true }) : 'Recently'}
                  </span>
                  
                  <span className={`px-2 py-0.5 rounded text-xs ${getRelevanceColor(item.relevance)}`}>
                    <Star className="h-3 w-3 inline mr-1" />
                    {item.relevance.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insights Footer */}
      {newsData?.insights && (
        <div className="px-6 py-4 bg-gray-50 border-t">
          <div className="grid grid-cols-3 gap-4 text-xs">
            {/* Hot Genres */}
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Hot Genres</h4>
              <div className="space-y-1">
                {newsData.insights.hot_genres.slice(0, 3).map(([genre, count]) => (
                  <div key={genre} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{genre}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Active Buyers */}
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Active Buyers</h4>
              <div className="space-y-1">
                {newsData.insights.active_buyers.slice(0, 3).map(([company, count]) => (
                  <div key={company} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{company}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Trending Formats */}
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Trending</h4>
              <div className="space-y-1">
                {newsData.insights.trending_formats.slice(0, 3).map(([format, count]) => (
                  <div key={format} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{format}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View More Link */}
      <div className="px-6 py-3 border-t bg-gray-50">
        <a
          href="/news"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
        >
          View All Industry News
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}