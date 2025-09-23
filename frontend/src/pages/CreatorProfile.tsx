import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, User, Film, Calendar, MapPin, Globe, Mail, Phone,
  Heart, Eye, Shield, Star, CheckCircle, ArrowLeft, Share2,
  MessageSquare, Bookmark, UserPlus, UserCheck, TrendingUp
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import FollowButton from '../components/FollowButton';

interface CreatorData {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email: string;
  phone?: string;
  bio?: string;
  location?: string;
  website?: string;
  userType: 'creator' | 'production' | 'investor';
  joinedDate: string;
  followers: number;
  following: number;
  pitchesCount: number;
  viewsCount: number;
  verified?: boolean;
  profileImage?: string;
  coverImage?: string;
  specialties?: string[];
  awards?: string[];
}

interface CreatorPitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  status: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  ndaRequired: boolean;
}

const CreatorProfile = () => {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [pitches, setPitches] = useState<CreatorPitch[]>([]);
  const [activeTab, setActiveTab] = useState<'pitches' | 'about' | 'contact'>('pitches');
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreatorData();
    fetchCreatorPitches();
  }, [creatorId]);

  const fetchCreatorData = async () => {
    // In production, this should fetch real data from API based on creatorId from URL params
    // For now using mock data - remove hardcoded fallback ID
    if (!creatorId) {
      console.error('No creator ID provided');
      setLoading(false);
      return;
    }
    
    // Mock data - in production, fetch from API
    setCreator({
      id: parseInt(creatorId),
      username: 'alexchen',
      firstName: 'Alex',
      lastName: 'Chen',
      companyName: 'Visionary Films',
      email: 'alex.chen@visionaryfilms.com',
      phone: '+1 (555) 123-4567',
      bio: 'Award-winning filmmaker and producer with over 15 years of experience in creating compelling narratives that resonate with global audiences. Specializing in sci-fi and drama genres.',
      location: 'Los Angeles, CA',
      website: 'https://visionaryfilms.com',
      userType: 'creator',
      joinedDate: '2023-01-15',
      followers: 1247,
      following: 89,
      pitchesCount: 12,
      viewsCount: 45678,
      verified: true,
      specialties: ['Feature Films', 'TV Series', 'Documentaries', 'Sci-Fi', 'Drama'],
      awards: ['Sundance Film Festival 2022', 'Cannes Selection 2021', 'Emmy Nominee 2020']
    });
    setLoading(false);
  };

  const fetchCreatorPitches = async () => {
    // Mock data - in production, fetch from API
    setPitches([
      {
        id: 1,
        title: 'Quantum Leap',
        logline: 'A scientist discovers a way to travel through time but gets stuck jumping between different versions of his life.',
        genre: 'Sci-Fi',
        format: 'Feature Film',
        status: 'published',
        viewCount: 1234,
        likeCount: 89,
        createdAt: '2024-01-15',
        ndaRequired: true
      },
      {
        id: 2,
        title: 'The Last Garden',
        logline: 'In a world where nature has been extinct for decades, a young botanist discovers the last hidden garden on Earth.',
        genre: 'Drama',
        format: 'Limited Series',
        status: 'published',
        viewCount: 987,
        likeCount: 76,
        createdAt: '2024-02-20',
        ndaRequired: false
      }
    ]);
  };

  const handleFollowToggle = () => {
    setIsFollowing(!isFollowing);
    // In production, call API to follow/unfollow
  };

  const handleContactCreator = () => {
    // In production, open messaging modal or navigate to messages
    alert('Opening message composer...');
  };

  const handleShareProfile = () => {
    // Copy profile URL to clipboard
    navigator.clipboard.writeText(window.location.href);
    alert('Profile link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Creator Not Found</h2>
          <p className="text-gray-600 mb-4">This creator profile doesn't exist.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Cover Image */}
      <div className="relative h-64 bg-gradient-to-br from-purple-400 via-purple-600 to-indigo-700">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Info */}
      <div className="max-w-6xl mx-auto px-4 -mt-24 relative z-10">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              {/* Profile Image */}
              <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center text-white">
                {creator.userType === 'production' ? (
                  <Building2 className="w-12 h-12" />
                ) : (
                  <User className="w-12 h-12" />
                )}
              </div>

              {/* Creator Info */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {creator.companyName || `${creator.firstName} ${creator.lastName}`}
                  </h1>
                  {creator.verified && (
                    <CheckCircle className="w-6 h-6 text-blue-500" />
                  )}
                </div>
                <p className="text-gray-600 mb-2">@{creator.username}</p>
                <p className="text-gray-700 max-w-2xl mb-4">{creator.bio}</p>
                
                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="font-bold text-gray-900">{creator.followers.toLocaleString()}</span>
                    <span className="text-gray-600 ml-1">Followers</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-900">{creator.following}</span>
                    <span className="text-gray-600 ml-1">Following</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-900">{creator.pitchesCount}</span>
                    <span className="text-gray-600 ml-1">Pitches</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-900">{creator.viewsCount.toLocaleString()}</span>
                    <span className="text-gray-600 ml-1">Total Views</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <FollowButton
                creatorId={creator.id}
                variant="default"
                className="min-w-[120px]"
              />
              <button
                onClick={handleContactCreator}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </button>
              <button
                onClick={handleShareProfile}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t mt-6 pt-6">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('pitches')}
                className={`pb-2 border-b-2 font-medium transition-colors ${
                  activeTab === 'pitches'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Pitches ({creator.pitchesCount})
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`pb-2 border-b-2 font-medium transition-colors ${
                  activeTab === 'about'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('contact')}
                className={`pb-2 border-b-2 font-medium transition-colors ${
                  activeTab === 'contact'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Contact
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'pitches' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pitches.map((pitch) => (
                <div key={pitch.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center relative">
                    <Film className="w-12 h-12 text-white" />
                    {pitch.ndaRequired && (
                      <span className="absolute top-2 right-2 bg-white/20 backdrop-blur px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        NDA Required
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{pitch.title}</h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pitch.logline}</p>
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <span>{pitch.genre}</span>
                      <span>{pitch.format}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {pitch.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          {pitch.likeCount}
                        </span>
                      </div>
                      <Link
                        to={`/pitch/${pitch.id}`}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">About {creator.companyName || `${creator.firstName}`}</h2>
              
              {/* Specialties */}
              {creator.specialties && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {creator.specialties.map((specialty, index) => (
                      <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Awards */}
              {creator.awards && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Awards & Recognition</h3>
                  <div className="space-y-2">
                    {creator.awards.map((award, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-gray-700">{award}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {new Date(creator.joinedDate).toLocaleDateString()}</span>
                </div>
                {creator.location && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{creator.location}</span>
                  </div>
                )}
                {creator.website && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Globe className="w-4 h-4" />
                    <a href={creator.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700">
                      {creator.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Contact Information</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="text-gray-900">{creator.email}</p>
                  </div>
                </div>
                
                {creator.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="text-gray-900">{creator.phone}</p>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={handleContactCreator}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Send Message
                  </button>
                </div>

                <p className="text-sm text-gray-500 text-center mt-4">
                  All communications are subject to NDA agreements where applicable
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatorProfile;