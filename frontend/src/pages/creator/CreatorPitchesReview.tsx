import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Clock, Eye, AlertCircle, RefreshCw,
  FileText, Search, ArrowRight
} from 'lucide-react';
import { PitchService, type Pitch } from '../../services/pitch.service';

interface ReviewPitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  status: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function CreatorPitchesReview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pitches, setPitches] = useState<ReviewPitch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadReviewPitches = async () => {
    setLoading(true);
    setError(null);
    try {
      const allPitches = await PitchService.getMyPitches();
      const reviewPitches = allPitches
        .filter((p: Pitch) => p.status === 'under_review')
        .map((p: Pitch) => ({
          id: p.id,
          title: p.title,
          logline: p.logline,
          genre: p.genre,
          format: p.format,
          status: p.status,
          viewCount: p.viewCount ?? 0,
          likeCount: p.likeCount ?? 0,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }));
      setPitches(reviewPitches);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReviewPitches();
  }, []);

  const filteredPitches = pitches.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.logline.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const timeSince = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return formatDate(dateStr);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
              <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-full bg-gray-100 rounded mb-2" />
              <div className="h-4 w-2/3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pitch Reviews</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Failed to load pitches</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={() => { void loadReviewPitches(); }}
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
          <h1 className="text-2xl font-bold text-gray-900">Pitch Reviews</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track pitches currently under review by the platform
          </p>
        </div>

        {/* Search */}
        {pitches.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search pitches under review..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Status Banner */}
        {pitches.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              {pitches.length} pitch{pitches.length !== 1 ? 'es' : ''} currently under review. Reviews typically take 1-3 business days.
            </p>
          </div>
        )}

        {/* Pitch List */}
        {filteredPitches.length === 0 && pitches.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg shadow-sm border">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-6">
              <MessageSquare className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">No Pitches Under Review</h2>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              When you submit a pitch for review, it will appear here. You can track its status and any feedback from reviewers.
            </p>
            <button
              onClick={() => { void navigate('/creator/pitches'); }}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              View My Pitches
            </button>
          </div>
        ) : filteredPitches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No pitches match "{searchTerm}"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPitches.map(pitch => (
              <div key={pitch.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{pitch.title}</h3>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3" />
                          Under Review
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-3">{pitch.logline}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="capitalize">{pitch.genre}</span>
                        <span className="text-gray-300">|</span>
                        <span className="capitalize">{pitch.format}</span>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {pitch.viewCount} views
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>Submitted {timeSince(pitch.updatedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { void navigate(`/creator/pitches/${pitch.id}/edit`); }}
                      className="ml-4 px-4 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition flex items-center gap-1.5 flex-shrink-0"
                    >
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
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
