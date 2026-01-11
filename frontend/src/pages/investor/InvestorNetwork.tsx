import { useState, useEffect } from 'react';
import { 
  Users, Building2, UserCheck, TrendingUp, 
  Search, Filter, Globe, Award, Star,
  Briefcase, DollarSign, Film, MessageSquare,
  Calendar, MapPin, Link2, Mail, Phone,
  ChevronRight, Plus, Check, X
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';

interface NetworkMember {
  id: string;
  name: string;
  type: 'investor' | 'creator' | 'production';
  avatar?: string;
  title: string;
  company?: string;
  location?: string;
  connectionStatus: 'connected' | 'pending' | 'suggested';
  bio?: string;
  stats: {
    investments?: number;
    portfolio?: number;
    productions?: number;
    pitches?: number;
    successRate?: number;
  };
  interests?: string[];
  mutualConnections?: number;
  joinedDate?: string;
  lastActive?: string;
}

export default function InvestorNetwork() {
    const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'investor' | 'creator' | 'production'>('all');
  const [networkMembers, setNetworkMembers] = useState<NetworkMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<NetworkMember[]>([]);

  useEffect(() => {
    loadNetworkData();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [networkMembers, searchQuery, filterType]);

  const loadNetworkData = async () => {
    try {
      // Simulated network data
      setTimeout(() => {
        setNetworkMembers([
          {
            id: '1',
            name: 'Michael Roberts',
            type: 'investor',
            title: 'Senior Investment Partner',
            company: 'Venture Films Capital',
            location: 'Los Angeles, CA',
            connectionStatus: 'connected',
            bio: 'Focused on emerging filmmakers and innovative storytelling',
            stats: {
              investments: 45,
              portfolio: 28,
              successRate: 72
            },
            interests: ['Sci-Fi', 'Drama', 'Documentary'],
            mutualConnections: 12,
            joinedDate: '2022-03-15',
            lastActive: '2 hours ago'
          },
          {
            id: '2',
            name: 'Sarah Chen',
            type: 'creator',
            title: 'Writer/Director',
            location: 'New York, NY',
            connectionStatus: 'connected',
            bio: 'Award-winning filmmaker specializing in character-driven narratives',
            stats: {
              pitches: 8,
              productions: 3,
              successRate: 60
            },
            interests: ['Thriller', 'Mystery', 'Indie'],
            mutualConnections: 5,
            joinedDate: '2023-01-20',
            lastActive: '1 day ago'
          },
          {
            id: '3',
            name: 'Global Studios Inc.',
            type: 'production',
            title: 'Production Company',
            location: 'Atlanta, GA',
            connectionStatus: 'pending',
            bio: 'Full-service production company with international distribution',
            stats: {
              productions: 150,
              successRate: 85
            },
            interests: ['Action', 'Adventure', 'Franchise'],
            mutualConnections: 8,
            joinedDate: '2021-11-05',
            lastActive: '3 days ago'
          },
          {
            id: '4',
            name: 'David Martinez',
            type: 'investor',
            title: 'Angel Investor',
            company: 'Martinez Holdings',
            location: 'Miami, FL',
            connectionStatus: 'suggested',
            bio: 'Passionate about supporting diverse voices in cinema',
            stats: {
              investments: 23,
              portfolio: 15,
              successRate: 68
            },
            interests: ['Drama', 'Comedy', 'International'],
            mutualConnections: 3,
            joinedDate: '2023-06-10',
            lastActive: '5 hours ago'
          },
          {
            id: '5',
            name: 'Emma Thompson',
            type: 'creator',
            title: 'Producer',
            company: 'Thompson Productions',
            location: 'London, UK',
            connectionStatus: 'connected',
            bio: 'BAFTA-nominated producer with focus on British cinema',
            stats: {
              pitches: 12,
              productions: 7,
              successRate: 75
            },
            interests: ['Period Drama', 'Biography', 'Documentary'],
            mutualConnections: 18,
            joinedDate: '2022-09-01',
            lastActive: '12 hours ago'
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load network data:', error);
      setLoading(false);
    }
  };

  const filterMembers = () => {
    let filtered = [...networkMembers];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(member => member.type === filterType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(query) ||
        member.title.toLowerCase().includes(query) ||
        member.company?.toLowerCase().includes(query) ||
        member.interests?.some(interest => interest.toLowerCase().includes(query))
      );
    }

    setFilteredMembers(filtered);
  };

  const handleConnect = (memberId: string) => {
    setNetworkMembers(prev => prev.map(member =>
      member.id === memberId
        ? { ...member, connectionStatus: 'pending' }
        : member
    ));
  };

  const handleAcceptConnection = (memberId: string) => {
    setNetworkMembers(prev => prev.map(member =>
      member.id === memberId
        ? { ...member, connectionStatus: 'connected' }
        : member
    ));
  };

  const getMemberIcon = (type: string) => {
    switch (type) {
      case 'investor':
        return DollarSign;
      case 'creator':
        return Film;
      case 'production':
        return Building2;
      default:
        return Users;
    }
  };

  const getMemberColor = (type: string) => {
    switch (type) {
      case 'investor':
        return 'text-green-600 bg-green-100';
      case 'creator':
        return 'text-purple-600 bg-purple-100';
      case 'production':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading network...</div>
        </div>
      </div>
    );
  }

  const connectedCount = networkMembers.filter(m => m.connectionStatus === 'connected').length;
  const pendingCount = networkMembers.filter(m => m.connectionStatus === 'pending').length;

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Network</h1>
          <p className="mt-2 text-sm text-gray-600">
            Connect with investors, creators, and production companies
          </p>
          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center">
              <UserCheck className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-gray-700">
                <span className="font-semibold">{connectedCount}</span> Connections
              </span>
            </div>
            <div className="flex items-center">
              <Users className="w-4 h-4 text-yellow-500 mr-1" />
              <span className="text-gray-700">
                <span className="font-semibold">{pendingCount}</span> Pending
              </span>
            </div>
            <div className="flex items-center">
              <Globe className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-gray-700">
                <span className="font-semibold">{networkMembers.length}</span> Total Network
              </span>
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
                  placeholder="Search by name, company, or interests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Types</option>
                <option value="investor">Investors</option>
                <option value="creator">Creators</option>
                <option value="production">Production Companies</option>
              </select>
            </div>
          </div>
        </div>

        {/* Network Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMembers.map((member) => {
            const Icon = getMemberIcon(member.type);
            const colorClass = getMemberColor(member.type);

            return (
              <div key={member.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                        <p className="text-sm text-gray-600">{member.title}</p>
                        {member.company && (
                          <p className="text-sm text-gray-500">{member.company}</p>
                        )}
                        {member.location && (
                          <div className="mt-1 flex items-center text-sm text-gray-500">
                            <MapPin className="w-3 h-3 mr-1" />
                            {member.location}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Connection Status */}
                    <div>
                      {member.connectionStatus === 'connected' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Check className="w-3 h-3 mr-1" />
                          Connected
                        </span>
                      ) : member.connectionStatus === 'pending' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(member.id)}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Connect
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  {member.bio && (
                    <p className="mt-3 text-sm text-gray-600">{member.bio}</p>
                  )}

                  {/* Stats */}
                  <div className="mt-4 flex items-center space-x-4 text-sm">
                    {member.stats.investments !== undefined && (
                      <div>
                        <span className="font-semibold text-gray-900">{member.stats.investments}</span>
                        <span className="text-gray-500 ml-1">Investments</span>
                      </div>
                    )}
                    {member.stats.portfolio !== undefined && (
                      <div>
                        <span className="font-semibold text-gray-900">{member.stats.portfolio}</span>
                        <span className="text-gray-500 ml-1">Portfolio</span>
                      </div>
                    )}
                    {member.stats.productions !== undefined && (
                      <div>
                        <span className="font-semibold text-gray-900">{member.stats.productions}</span>
                        <span className="text-gray-500 ml-1">Productions</span>
                      </div>
                    )}
                    {member.stats.pitches !== undefined && (
                      <div>
                        <span className="font-semibold text-gray-900">{member.stats.pitches}</span>
                        <span className="text-gray-500 ml-1">Pitches</span>
                      </div>
                    )}
                    {member.stats.successRate !== undefined && (
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        <span className="font-semibold text-gray-900">{member.stats.successRate}%</span>
                      </div>
                    )}
                  </div>

                  {/* Interests */}
                  {member.interests && (
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {member.interests.map((interest, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-3">
                      {member.mutualConnections && (
                        <span>{member.mutualConnections} mutual connections</span>
                      )}
                      {member.lastActive && (
                        <span>Active {member.lastActive}</span>
                      )}
                    </div>
                    <button className="text-green-600 hover:text-purple-700 font-medium">
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredMembers.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No network members found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}