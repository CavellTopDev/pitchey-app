import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Filter, Star, MapPin, Calendar, 
  Mail, Phone, Globe, ExternalLink, MessageCircle, FileText,
  CheckCircle, Clock, XCircle, AlertCircle, Eye, Edit2,
  Handshake, Building, Award, TrendingUp, DollarSign
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { config } from '../../config';

interface Collaboration {
  id: string;
  partnerName: string;
  partnerType: 'studio' | 'distributor' | 'investor' | 'agency' | 'vendor' | 'talent';
  status: 'active' | 'pending' | 'completed' | 'paused' | 'cancelled';
  startDate: string;
  endDate?: string;
  projectCount: number;
  totalValue: number;
  description: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  logo?: string;
  location: string;
  rating: number;
  tags: string[];
  lastActivity: string;
  documents: CollaborationDocument[];
  projects: CollaborationProject[];
}

interface CollaborationDocument {
  id: string;
  name: string;
  type: 'contract' | 'nda' | 'proposal' | 'agreement' | 'other';
  uploadedAt: string;
  size: string;
}

interface CollaborationProject {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  budget: number;
}

const partnerTypes = [
  { value: 'studio', label: 'Production Studio', icon: Building },
  { value: 'distributor', label: 'Distributor', icon: TrendingUp },
  { value: 'investor', label: 'Investor', icon: DollarSign },
  { value: 'agency', label: 'Agency', icon: Users },
  { value: 'vendor', label: 'Service Vendor', icon: Handshake },
  { value: 'talent', label: 'Talent Agency', icon: Star }
];

export default function ProductionCollaborations() {
    const { user, logout } = useBetterAuthStore();
  const userType = user?.userType || 'production';
  
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCollaboration, setSelectedCollaboration] = useState<Collaboration | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchCollaborations();
  }, []);

  const fetchCollaborations = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual API call
      setTimeout(() => {
        setCollaborations([
          {
            id: '1',
            partnerName: 'Skyline Studios',
            partnerType: 'studio',
            status: 'active',
            startDate: '2023-06-15',
            projectCount: 3,
            totalValue: 2500000,
            description: 'Strategic partnership for co-production of feature films and streaming content.',
            contactPerson: 'David Miller',
            contactEmail: 'david.miller@skylinestudios.com',
            contactPhone: '+1 555-0123',
            website: 'https://skylinestudios.com',
            location: 'Los Angeles, CA',
            rating: 4.8,
            tags: ['Feature Films', 'Streaming', 'Co-Production'],
            lastActivity: '2024-01-10T14:30:00Z',
            documents: [
              { id: 'd1', name: 'Master Agreement.pdf', type: 'contract', uploadedAt: '2023-06-15T10:00:00Z', size: '2.1 MB' },
              { id: 'd2', name: 'NDA Agreement.pdf', type: 'nda', uploadedAt: '2023-06-16T11:00:00Z', size: '856 KB' }
            ],
            projects: [
              { id: 'p1', name: 'Urban Legends', status: 'active', startDate: '2023-08-01', budget: 850000 },
              { id: 'p2', name: 'Night Shift', status: 'completed', startDate: '2023-02-15', budget: 1200000 },
              { id: 'p3', name: 'Digital Dreams', status: 'planning', startDate: '2024-03-01', budget: 950000 }
            ]
          },
          {
            id: '2',
            partnerName: 'Global Distribution Network',
            partnerType: 'distributor',
            status: 'active',
            startDate: '2023-03-10',
            projectCount: 5,
            totalValue: 4200000,
            description: 'International distribution partnership covering Europe, Asia, and Australia.',
            contactPerson: 'Maria Rodriguez',
            contactEmail: 'maria@globaldist.com',
            contactPhone: '+1 555-0456',
            website: 'https://globaldist.com',
            location: 'New York, NY',
            rating: 4.6,
            tags: ['International', 'Distribution', 'Streaming Rights'],
            lastActivity: '2024-01-08T09:15:00Z',
            documents: [
              { id: 'd3', name: 'Distribution Agreement.pdf', type: 'agreement', uploadedAt: '2023-03-10T14:00:00Z', size: '3.2 MB' }
            ],
            projects: [
              { id: 'p4', name: 'Midnight Express', status: 'completed', startDate: '2023-04-01', budget: 750000 }
            ]
          },
          {
            id: '3',
            partnerName: 'Creative Minds Agency',
            partnerType: 'talent',
            status: 'pending',
            startDate: '2024-01-15',
            projectCount: 0,
            totalValue: 0,
            description: 'Talent representation for upcoming film projects.',
            contactPerson: 'James Thompson',
            contactEmail: 'james@creativeminds.com',
            location: 'Beverly Hills, CA',
            rating: 4.2,
            tags: ['Talent', 'Representation', 'A-List'],
            lastActivity: '2024-01-15T16:00:00Z',
            documents: [],
            projects: []
          },
          {
            id: '4',
            partnerName: 'TechVision VFX',
            partnerType: 'vendor',
            status: 'completed',
            startDate: '2022-11-20',
            endDate: '2023-08-30',
            projectCount: 2,
            totalValue: 650000,
            description: 'Visual effects and post-production services.',
            contactPerson: 'Alex Chen',
            contactEmail: 'alex@techvision.com',
            website: 'https://techvision.com',
            location: 'Vancouver, BC',
            rating: 4.9,
            tags: ['VFX', 'Post-Production', 'CGI'],
            lastActivity: '2023-08-30T17:00:00Z',
            documents: [
              { id: 'd4', name: 'Service Agreement.pdf', type: 'contract', uploadedAt: '2022-11-20T10:30:00Z', size: '1.8 MB' }
            ],
            projects: [
              { id: 'p5', name: 'Space Odyssey', status: 'completed', startDate: '2023-01-15', budget: 400000 },
              { id: 'p6', name: 'Future World', status: 'completed', startDate: '2023-04-20', budget: 250000 }
            ]
          }
        ]);
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to fetch collaborations:', error);
      setLoading(false);
    }
  };

  const filteredCollaborations = collaborations.filter(collaboration => {
    const matchesSearch = collaboration.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collaboration.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collaboration.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'all' || collaboration.partnerType === selectedType;
    const matchesStatus = selectedStatus === 'all' || collaboration.status === selectedStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'completed': return 'text-blue-600 bg-blue-100';
      case 'paused': return 'text-orange-600 bg-orange-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'pending': return Clock;
      case 'completed': return CheckCircle;
      case 'paused': return AlertCircle;
      case 'cancelled': return XCircle;
      default: return AlertCircle;
    }
  };

  const getPartnerTypeIcon = (type: string) => {
    return partnerTypes.find(pt => pt.value === type)?.icon || Building;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const CollaborationCard = ({ collaboration }: { collaboration: Collaboration }) => {
    const StatusIcon = getStatusIcon(collaboration.status);
    const TypeIcon = getPartnerTypeIcon(collaboration.partnerType);

    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <TypeIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{collaboration.partnerName}</h3>
                <p className="text-sm text-gray-600 capitalize">{collaboration.partnerType}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(collaboration.status)}`}>
              <StatusIcon className="w-3 h-3" />
              {collaboration.status}
            </span>
          </div>

          <p className="text-gray-700 text-sm mb-4 line-clamp-2">{collaboration.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-500">Projects</div>
              <div className="font-semibold text-gray-900">{collaboration.projectCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="font-semibold text-green-600">{formatCurrency(collaboration.totalValue)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <MapPin className="w-4 h-4" />
            <span>{collaboration.location}</span>
            <Star className="w-4 h-4 text-yellow-500 ml-2" />
            <span>{collaboration.rating}</span>
          </div>

          <div className="flex flex-wrap gap-1 mb-4">
            {collaboration.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                {tag}
              </span>
            ))}
            {collaboration.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                +{collaboration.tags.length - 3}
              </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCollaboration(collaboration)}
                className="px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-lg transition text-sm"
              >
                <Eye className="w-4 h-4 inline mr-1" />
                View Details
              </button>
              {collaboration.contactEmail && (
                <button
                  onClick={() => window.location.href = `mailto:${collaboration.contactEmail}`}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded transition"
                >
                  <Mail className="w-4 h-4" />
                </button>
              )}
              {collaboration.website && (
                <button
                  onClick={() => window.open(collaboration.website, '_blank')}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded transition"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {new Date(collaboration.lastActivity).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CollaborationDetail = ({ collaboration }: { collaboration: Collaboration }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                {React.createElement(getPartnerTypeIcon(collaboration.partnerType), { 
                  className: "w-8 h-8 text-white" 
                })}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{collaboration.partnerName}</h2>
                <p className="text-gray-600 capitalize">{collaboration.partnerType}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCollaboration(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <XCircle className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="col-span-2">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700">{collaboration.description}</p>
              
              <h3 className="font-semibold text-gray-900 mb-2 mt-4">Contact Information</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span>{collaboration.contactPerson}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{collaboration.contactEmail}</span>
                </div>
                {collaboration.contactPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{collaboration.contactPhone}</span>
                  </div>
                )}
                {collaboration.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <a href={collaboration.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                      {collaboration.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Key Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(collaboration.status)}`}>
                      {collaboration.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Projects</span>
                    <span className="font-semibold">{collaboration.projectCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Value</span>
                    <span className="font-semibold text-green-600">{formatCurrency(collaboration.totalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rating</span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      {collaboration.rating}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date</span>
                    <span>{new Date(collaboration.startDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Projects */}
          {collaboration.projects.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Projects</h3>
              <div className="grid gap-3">
                {collaboration.projects.map(project => (
                  <div key={project.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-gray-600">Started {new Date(project.startDate).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(project.budget)}</div>
                      <div className={`text-xs px-2 py-1 rounded ${getStatusColor(project.status)}`}>
                        {project.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {collaboration.documents.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Documents</h3>
              <div className="space-y-2">
                {collaboration.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <div>
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-sm text-gray-600">
                          {doc.type} • {doc.size} • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button className="px-3 py-1 text-purple-600 hover:bg-purple-50 rounded transition text-sm">
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Collaborations</h1>
            <p className="text-gray-600">Manage partnerships and external collaborations</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 md:mt-0 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Collaboration
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search collaborations, partners, or projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              {partnerTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="flex border rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'text-gray-600'} transition`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'text-gray-600'} transition`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Collaborations Grid/List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredCollaborations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Handshake className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No collaborations found</p>
            <p className="text-gray-400">Start building partnerships with industry professionals</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredCollaborations.map(collaboration => (
              <CollaborationCard key={collaboration.id} collaboration={collaboration} />
            ))}
          </div>
        )}

        {/* Collaboration Detail Modal */}
        {selectedCollaboration && (
          <CollaborationDetail collaboration={selectedCollaboration} />
        )}
      </div>
    </div>
  );
}