import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Film, Award, TrendingUp, Star,
  Search, Filter, MapPin, Calendar, Eye,
  Heart, MessageSquare, Briefcase, Play,
  ChevronRight, UserPlus, Check, Clock,
  Video, Edit3, Camera, Zap, Target
} from 'lucide-react';
import { InvestorNavigation } from '../../components/InvestorNavigation';
import { useAuthStore } from '../../store/authStore';

interface Creator {
  id: string;
  name: string;
  avatar?: string;
  role: 'director' | 'writer' | 'producer' | 'writer-director' | 'multi-role';
  location?: string;
  experience: 'emerging' | 'established' | 'veteran';
  followStatus: 'following' | 'not-following';
  bio: string;
  stats: {
    totalPitches: number;
    activePitches: number;
    fundedProjects: number;
    successRate: number;
    totalRaised: number;
    viewCount: number;
    followerCount: number;
  };
  genres: string[];
  skills: string[];
  currentProjects: {
    id: string;
    title: string;
    stage: 'pitch' | 'development' | 'pre-production' | 'production';
    genre: string;
    seekingAmount: number;
    percentageFunded: number;
  }[];
  achievements: {
    title: string;
    type: 'award' | 'festival' | 'milestone';
    year: number;
  }[];
  lastActive?: string;
  verified: boolean;
}

export default function InvestorCreators() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'director' | 'writer' | 'producer'>('all');
  const [filterExperience, setFilterExperience] = useState<'all' | 'emerging' | 'established' | 'veteran'>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'successRate' | 'followerCount'>('trending');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [filteredCreators, setFilteredCreators] = useState<Creator[]>([]);

  useEffect(() => {
    loadCreators();
  }, []);

  useEffect(() => {
    filterAndSortCreators();
  }, [creators, searchQuery, filterRole, filterExperience, sortBy]);

  const loadCreators = async () => {
    try {
      // Simulated creators data
      setTimeout(() => {
        setCreators([
          {
            id: '1',
            name: 'Alex Thompson',
            role: 'writer-director',
            location: 'Los Angeles, CA',
            experience: 'established',
            followStatus: 'following',
            bio: 'Award-winning filmmaker with a passion for character-driven sci-fi narratives',
            stats: {
              totalPitches: 12,
              activePitches: 3,
              fundedProjects: 5,
              successRate: 78,
              totalRaised: 8500000,
              viewCount: 45000,
              followerCount: 2340
            },
            genres: ['Sci-Fi', 'Drama', 'Thriller'],
            skills: ['Directing', 'Screenwriting', 'Cinematography'],
            currentProjects: [
              {
                id: 'p1',
                title: 'The Quantum Paradox',
                stage: 'development',
                genre: 'Sci-Fi Thriller',
                seekingAmount: 2500000,
                percentageFunded: 65
              },
              {
                id: 'p2',
                title: 'Echo Chamber',
                stage: 'pitch',
                genre: 'Psychological Thriller',
                seekingAmount: 1200000,
                percentageFunded: 30
              }
            ],
            achievements: [
              {
                title: 'Best Director - Sundance',
                type: 'award',
                year: 2023
              },
              {
                title: 'Cannes Film Festival Selection',
                type: 'festival',
                year: 2022
              }
            ],
            lastActive: '2 hours ago',
            verified: true
          },
          {
            id: '2',
            name: 'Sarah Mitchell',
            role: 'producer',
            location: 'New York, NY',
            experience: 'veteran',
            followStatus: 'following',
            bio: 'Emmy-nominated producer specializing in prestige drama and limited series',
            stats: {
              totalPitches: 18,
              activePitches: 2,
              fundedProjects: 11,
              successRate: 85,
              totalRaised: 25000000,
              viewCount: 62000,
              followerCount: 4580
            },
            genres: ['Drama', 'Historical', 'Biography'],
            skills: ['Production Management', 'Budget Planning', 'Talent Relations'],
            currentProjects: [
              {
                id: 'p3',
                title: 'The Last Monarch',
                stage: 'pre-production',
                genre: 'Historical Drama',
                seekingAmount: 5000000,
                percentageFunded: 80
              }
            ],
            achievements: [
              {
                title: 'Emmy Nomination - Best Limited Series',
                type: 'award',
                year: 2024
              },
              {
                title: '10+ Funded Projects',
                type: 'milestone',
                year: 2023
              }
            ],
            lastActive: '1 day ago',
            verified: true
          },
          {
            id: '3',
            name: 'Marcus Chen',
            role: 'director',
            location: 'Austin, TX',
            experience: 'emerging',
            followStatus: 'not-following',
            bio: 'Visionary director bringing fresh perspectives to genre filmmaking',
            stats: {
              totalPitches: 4,
              activePitches: 2,
              fundedProjects: 1,
              successRate: 60,
              totalRaised: 850000,
              viewCount: 12000,
              followerCount: 890
            },
            genres: ['Horror', 'Thriller', 'Mystery'],
            skills: ['Directing', 'Visual Effects', 'Storyboarding'],
            currentProjects: [
              {
                id: 'p4',
                title: 'Midnight Protocol',
                stage: 'pitch',
                genre: 'Tech Horror',
                seekingAmount: 750000,
                percentageFunded: 20
              }
            ],
            achievements: [
              {
                title: 'SXSW Audience Choice',
                type: 'festival',
                year: 2024
              }
            ],
            lastActive: '3 hours ago',
            verified: false
          },
          {
            id: '4',
            name: 'Emma Rodriguez',
            role: 'writer',
            location: 'Miami, FL',
            experience: 'established',
            followStatus: 'not-following',
            bio: 'Screenwriter crafting compelling narratives with social impact',
            stats: {
              totalPitches: 8,
              activePitches: 1,
              fundedProjects: 3,
              successRate: 72,
              totalRaised: 3200000,
              viewCount: 28000,
              followerCount: 1560
            },
            genres: ['Drama', 'Comedy-Drama', 'Social Issue'],
            skills: ['Screenwriting', 'Story Development', 'Script Doctoring'],
            currentProjects: [
              {
                id: 'p5',
                title: 'Divided Waters',
                stage: 'development',
                genre: 'Environmental Drama',
                seekingAmount: 1800000,
                percentageFunded: 45
              }
            ],
            achievements: [
              {
                title: 'WGA Award Nominee',
                type: 'award',
                year: 2023
              },
              {
                title: 'BlackList Top 10 Script',
                type: 'milestone',
                year: 2022
              }
            ],
            lastActive: '5 hours ago',
            verified: true
          },
          {
            id: '5',
            name: 'David Park',
            role: 'multi-role',
            location: 'Seattle, WA',
            experience: 'emerging',
            followStatus: 'following',
            bio: 'Multi-hyphenate creator pushing boundaries in independent cinema',
            stats: {
              totalPitches: 6,
              activePitches: 3,
              fundedProjects: 2,
              successRate: 65,
              totalRaised: 1500000,
              viewCount: 18000,
              followerCount: 1120
            },
            genres: ['Indie', 'Experimental', 'Documentary'],
            skills: ['Directing', 'Writing', 'Editing', 'Producing'],
            currentProjects: [
              {
                id: 'p6',
                title: 'Urban Legends',
                stage: 'production',
                genre: 'Documentary',
                seekingAmount: 450000,
                percentageFunded: 90
              }
            ],
            achievements: [
              {
                title: 'Tribeca Film Festival - Best New Director',
                type: 'festival',
                year: 2024
              }
            ],
            lastActive: '12 hours ago',
            verified: false
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load creators:', error);
      setLoading(false);
    }
  };

  const filterAndSortCreators = () => {
    let filtered = [...creators];

    // Filter by role
    if (filterRole !== 'all') {
      filtered = filtered.filter(creator => 
        creator.role.includes(filterRole) || creator.role === 'multi-role'
      );
    }

    // Filter by experience
    if (filterExperience !== 'all') {
      filtered = filtered.filter(creator => creator.experience === filterExperience);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(creator =>
        creator.name.toLowerCase().includes(query) ||
        creator.bio.toLowerCase().includes(query) ||
        creator.genres.some(genre => genre.toLowerCase().includes(query)) ||
        creator.skills.some(skill => skill.toLowerCase().includes(query)) ||
        creator.currentProjects.some(project => project.title.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          return b.stats.viewCount - a.stats.viewCount;
        case 'successRate':
          return b.stats.successRate - a.stats.successRate;
        case 'followerCount':
          return b.stats.followerCount - a.stats.followerCount;
        default:
          return 0;
      }
    });

    setFilteredCreators(filtered);
  };

  const handleFollow = (creatorId: string) => {
    setCreators(prev => prev.map(creator =>
      creator.id === creatorId
        ? { 
            ...creator, 
            followStatus: creator.followStatus === 'following' ? 'not-following' : 'following',
            stats: {
              ...creator.stats,
              followerCount: creator.followStatus === 'following' 
                ? creator.stats.followerCount - 1 
                : creator.stats.followerCount + 1
            }
          }
        : creator
    ));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'director':
        return 'text-purple-600 bg-purple-100';
      case 'writer':
        return 'text-blue-600 bg-blue-100';
      case 'producer':
        return 'text-green-600 bg-green-100';
      case 'writer-director':
        return 'text-indigo-600 bg-indigo-100';
      case 'multi-role':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getExperienceColor = (experience: string) => {
    switch (experience) {
      case 'emerging':
        return 'text-yellow-600 bg-yellow-50';
      case 'established':
        return 'text-blue-600 bg-blue-50';
      case 'veteran':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'pitch':
        return Edit3;
      case 'development':
        return Target;
      case 'pre-production':
        return Camera;
      case 'production':
        return Video;
      default:
        return Film;
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <InvestorNavigation
          user={user}
          onLogout={logout}
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading creators...</div>
        </div>
      </div>
    );
  }

  const followingCount = creators.filter(c => c.followStatus === 'following').length;
  const totalActivePitches = creators.reduce((sum, c) => sum + c.stats.activePitches, 0);
  const verifiedCount = creators.filter(c => c.verified).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <InvestorNavigation
        user={user}
        onLogout={logout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Connected Creators</h1>
          <p className="mt-2 text-sm text-gray-600">
            Discover and connect with talented filmmakers and content creators
          </p>
          
          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Heart className="w-8 h-8 text-red-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Following</p>
                  <p className="text-xl font-semibold text-gray-900">{followingCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Film className="w-8 h-8 text-purple-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Active Pitches</p>
                  <p className="text-xl font-semibold text-gray-900">{totalActivePitches}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Check className="w-8 h-8 text-green-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Verified</p>
                  <p className="text-xl font-semibold text-gray-900">{verifiedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <Zap className="w-8 h-8 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-500">Total Creators</p>
                  <p className="text-xl font-semibold text-gray-900">{creators.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search creators, projects, or genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Roles</option>
                <option value="director">Directors</option>
                <option value="writer">Writers</option>
                <option value="producer">Producers</option>
              </select>
              <select
                value={filterExperience}
                onChange={(e) => setFilterExperience(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Experience</option>
                <option value="emerging">Emerging</option>
                <option value="established">Established</option>
                <option value="veteran">Veteran</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="trending">Trending</option>
                <option value="successRate">Success Rate</option>
                <option value="followerCount">Followers</option>
              </select>
            </div>
          </div>
        </div>

        {/* Creators Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCreators.map((creator) => (
            <div key={creator.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                {/* Creator Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {creator.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold text-gray-900">{creator.name}</h3>
                        {creator.verified && (
                          <Check className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(creator.role)}`}>
                          {creator.role.replace('-', ' ')}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getExperienceColor(creator.experience)}`}>
                          {creator.experience}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFollow(creator.id)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      creator.followStatus === 'following'
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {creator.followStatus === 'following' ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3 mr-1" />
                        Follow
                      </>
                    )}
                  </button>
                </div>

                {/* Creator Info */}
                <p className="text-sm text-gray-600 mb-3">{creator.bio}</p>
                {creator.location && (
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <MapPin className="w-3 h-3 mr-1" />
                    {creator.location}
                    {creator.lastActive && (
                      <>
                        <span className="mx-2">•</span>
                        <Clock className="w-3 h-3 mr-1" />
                        Active {creator.lastActive}
                      </>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 py-3 border-y border-gray-200">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{creator.stats.fundedProjects}</p>
                    <p className="text-xs text-gray-500">Funded</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-purple-600">{creator.stats.activePitches}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-600">{creator.stats.successRate}%</p>
                    <p className="text-xs text-gray-500">Success</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{creator.stats.followerCount}</p>
                    <p className="text-xs text-gray-500">Followers</p>
                  </div>
                </div>

                {/* Specializations */}
                <div className="mt-3">
                  <div className="flex flex-wrap gap-1">
                    {creator.genres.map((genre, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Current Projects */}
                {creator.currentProjects.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-2">Current Projects</p>
                    {creator.currentProjects.slice(0, 2).map((project) => {
                      const StageIcon = getStageIcon(project.stage);
                      return (
                        <div key={project.id} className="mb-2 p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <StageIcon className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{project.title}</p>
                                <p className="text-xs text-gray-500">
                                  {project.genre} • {project.stage}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Seeking</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(project.seekingAmount)}
                              </p>
                              <div className="mt-1 w-20 bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-green-500 h-1.5 rounded-full"
                                  style={{ width: `${project.percentageFunded}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{project.percentageFunded}% funded</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Achievements */}
                {creator.achievements.length > 0 && (
                  <div className="mt-3 flex items-center space-x-3">
                    {creator.achievements.slice(0, 2).map((achievement, idx) => (
                      <div key={idx} className="flex items-center text-xs text-gray-600">
                        <Award className="w-3 h-3 text-yellow-500 mr-1" />
                        <span>{achievement.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-sm">
                    <button className="flex items-center text-gray-600 hover:text-purple-600">
                      <Eye className="w-4 h-4 mr-1" />
                      {creator.stats.viewCount.toLocaleString()}
                    </button>
                    <button className="flex items-center text-gray-600 hover:text-purple-600">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Message
                    </button>
                  </div>
                  <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                    View Profile →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredCreators.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No creators found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}