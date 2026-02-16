import { useState, useEffect } from 'react';
import {
  BarChart3, Eye, Heart, FileText, TrendingUp,
  ArrowUp, ArrowDown, Minus, AlertCircle, RefreshCw
} from 'lucide-react';
import { CreatorService, type CreatorAnalytics } from '../../services/creator.service';
import { PitchService, type Pitch } from '../../services/pitch.service';

interface PitchWithAnalytics {
  id: number;
  title: string;
  genre: string;
  status: string;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  publishedAt?: string;
}

export default function CreatorPitchesAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [pitches, setPitches] = useState<PitchWithAnalytics[]>([]);
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'ndas'>('views');

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsData, allPitches] = await Promise.all([
        CreatorService.getAnalytics(),
        PitchService.getMyPitches()
      ]);
      setAnalytics(analyticsData);

      const published = allPitches
        .filter((p: Pitch) => p.status === 'published')
        .map((p: Pitch) => ({
          id: p.id,
          title: p.title,
          genre: p.genre,
          status: p.status,
          viewCount: p.viewCount ?? 0,
          likeCount: p.likeCount ?? 0,
          ndaCount: p.ndaCount ?? 0,
          publishedAt: p.publishedAt
        }));
      setPitches(published);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const sortedPitches = [...pitches].sort((a, b) => {
    if (sortBy === 'views') return b.viewCount - a.viewCount;
    if (sortBy === 'likes') return b.likeCount - a.likeCount;
    return b.ndaCount - a.ndaCount;
  });

  const totalViews = pitches.reduce((sum, p) => sum + p.viewCount, 0);
  const totalLikes = pitches.reduce((sum, p) => sum + p.likeCount, 0);
  const totalNDAs = pitches.reduce((sum, p) => sum + p.ndaCount, 0);
  const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
              <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
              <div className="h-8 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
          <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded mb-3" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pitch Analytics</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Failed to load analytics</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pitch Analytics</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track performance and engagement metrics for your pitches
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            label="Total Views"
            value={totalViews}
            icon={<Eye className="w-5 h-5 text-blue-600" />}
            bgColor="bg-blue-50"
          />
          <SummaryCard
            label="Total Likes"
            value={totalLikes}
            icon={<Heart className="w-5 h-5 text-pink-600" />}
            bgColor="bg-pink-50"
          />
          <SummaryCard
            label="NDA Requests"
            value={totalNDAs}
            icon={<FileText className="w-5 h-5 text-green-600" />}
            bgColor="bg-green-50"
          />
          <SummaryCard
            label="Engagement Rate"
            value={`${engagementRate}%`}
            icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
            bgColor="bg-purple-50"
          />
        </div>

        {/* Top Performing Pitches from Analytics API */}
        {analytics && analytics.topPitches.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Top Performing Pitches</h2>
              <p className="text-sm text-gray-500 mt-1">Based on overall engagement</p>
            </div>
            <div className="divide-y divide-gray-100">
              {analytics.topPitches.map((tp, idx) => (
                <div key={tp.id} className="p-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{tp.title}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" /> {formatNumber(tp.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" /> {formatNumber(tp.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" /> {tp.ndas}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audience Breakdown */}
        {analytics && analytics.audienceBreakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Audience Breakdown</h2>
              <p className="text-sm text-gray-500 mt-1">Who is viewing your pitches</p>
            </div>
            <div className="p-6">
              <div className="flex gap-6">
                {analytics.audienceBreakdown.map(seg => (
                  <div key={seg.userType} className="flex-1">
                    <div className="text-sm text-gray-600 capitalize mb-1">{seg.userType}s</div>
                    <div className="text-2xl font-bold text-gray-900">{seg.percentage.toFixed(0)}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full ${seg.userType === 'investor' ? 'bg-blue-500' : 'bg-green-500'}`}
                        style={{ width: `${seg.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{seg.count} viewers</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Per-Pitch Performance Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Per-Pitch Performance</h2>
              <p className="text-sm text-gray-500 mt-1">{pitches.length} published pitch{pitches.length !== 1 ? 'es' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'views' | 'likes' | 'ndas')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-500"
              >
                <option value="views">Views</option>
                <option value="likes">Likes</option>
                <option value="ndas">NDA Requests</option>
              </select>
            </div>
          </div>

          {sortedPitches.length === 0 ? (
            <div className="text-center py-16">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No published pitches yet</p>
              <p className="text-gray-400 text-sm mt-1">Publish a pitch to start seeing analytics</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedPitches.map((pitch, idx) => {
                const maxViews = sortedPitches[0]?.viewCount || 1;
                const barWidth = (pitch.viewCount / maxViews) * 100;
                return (
                  <div key={pitch.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-4">
                      <div className="w-8 text-center text-sm font-medium text-gray-400">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{pitch.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{pitch.genre}</span>
                          {pitch.publishedAt && (
                            <span className="text-xs text-gray-400">
                              Published {new Date(pitch.publishedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-purple-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-gray-900">{formatNumber(pitch.viewCount)}</div>
                          <div className="text-xs text-gray-500">Views</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-gray-900">{formatNumber(pitch.likeCount)}</div>
                          <div className="text-xs text-gray-500">Likes</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-gray-900">{pitch.ndaCount}</div>
                          <div className="text-xs text-gray-500">NDAs</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Genre Engagement */}
        {analytics && (analytics.engagementByGenre ?? []).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border mt-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Engagement by Genre</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {(analytics.engagementByGenre ?? []).map(g => (
                <div key={g.genre} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 capitalize">{g.genre}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <span>{formatNumber(g.views)} views</span>
                    <span>{formatNumber(g.likes)} likes</span>
                    <span className="font-medium text-purple-600">{g.conversionRate.toFixed(1)}% conversion</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, bgColor }: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
