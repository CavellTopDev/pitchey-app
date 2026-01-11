import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserPlus, Search, Filter, MoreVertical, 
  Edit2, Trash2, Mail, Phone, Calendar, Star,
  Briefcase, Shield, CheckCircle, XCircle, Clock,
  Eye, Download, Settings
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import { useBetterAuthStore } from '../../store/betterAuthStore';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department: string;
  joinDate: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
  avatar?: string;
  projects: number;
  rating: number;
  permissions: string[];
  location?: string;
  skills: string[];
  reportsTo?: string;
}

interface FilterOptions {
  department: string;
  role: string;
  status: string;
  skills: string;
}

const departments = ['Production', 'Development', 'Marketing', 'Finance', 'Creative', 'Technical'];
const roles = ['Producer', 'Director', 'Writer', 'Editor', 'Cinematographer', 'Sound Designer', 'VFX Artist'];
const statuses = ['active', 'inactive', 'pending'];

export default function TeamMembers() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const userType = user?.userType || 'production';
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'department' | 'joinDate' | 'rating'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<FilterOptions>({
    department: 'all',
    role: 'all',
    status: 'all',
    skills: 'all'
  });

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      
      // Mock data for development - replace with actual API calls
      setTimeout(() => {
        setTeamMembers([
          {
            id: '1',
            name: 'Sarah Johnson',
            email: 'sarah.j@company.com',
            phone: '+1 555-0101',
            role: 'Senior Producer',
            department: 'Production',
            joinDate: '2023-01-15',
            lastActive: '2024-01-15T14:30:00Z',
            status: 'active',
            projects: 12,
            rating: 4.8,
            permissions: ['manage_projects', 'approve_budgets', 'manage_team'],
            location: 'Los Angeles, CA',
            skills: ['Project Management', 'Budget Planning', 'Team Leadership'],
            reportsTo: 'Executive Producer'
          },
          {
            id: '2',
            name: 'Michael Chen',
            email: 'michael.c@company.com',
            phone: '+1 555-0102',
            role: 'Director',
            department: 'Creative',
            joinDate: '2023-03-20',
            lastActive: '2024-01-15T12:15:00Z',
            status: 'active',
            projects: 8,
            rating: 4.9,
            permissions: ['manage_projects', 'creative_control'],
            location: 'New York, NY',
            skills: ['Directing', 'Cinematography', 'Story Development'],
            reportsTo: 'Creative Director'
          },
          {
            id: '3',
            name: 'Emma Rodriguez',
            email: 'emma.r@company.com',
            role: 'VFX Supervisor',
            department: 'Technical',
            joinDate: '2023-06-10',
            lastActive: '2024-01-15T10:45:00Z',
            status: 'active',
            projects: 15,
            rating: 4.7,
            permissions: ['manage_vfx', 'approve_renders'],
            location: 'Vancouver, BC',
            skills: ['Visual Effects', 'Maya', 'Houdini', 'Compositing']
          },
          {
            id: '4',
            name: 'James Wilson',
            email: 'james.w@company.com',
            role: 'Script Writer',
            department: 'Creative',
            joinDate: '2024-01-05',
            lastActive: '2024-01-14T16:20:00Z',
            status: 'pending',
            projects: 2,
            rating: 4.5,
            permissions: ['edit_scripts'],
            location: 'Austin, TX',
            skills: ['Screenwriting', 'Character Development', 'Dialog']
          },
          {
            id: '5',
            name: 'Lisa Park',
            email: 'lisa.p@company.com',
            phone: '+1 555-0105',
            role: 'Marketing Director',
            department: 'Marketing',
            joinDate: '2022-11-30',
            lastActive: '2024-01-10T09:30:00Z',
            status: 'inactive',
            projects: 20,
            rating: 4.6,
            permissions: ['manage_campaigns', 'approve_marketing'],
            location: 'Chicago, IL',
            skills: ['Digital Marketing', 'Social Media', 'Brand Strategy']
          },
          {
            id: '6',
            name: 'Alex Thompson',
            email: 'alex.t@company.com',
            phone: '+1 555-0106',
            role: 'Sound Engineer',
            department: 'Technical',
            joinDate: '2023-08-15',
            lastActive: '2024-01-15T11:00:00Z',
            status: 'active',
            projects: 6,
            rating: 4.4,
            permissions: ['manage_audio', 'edit_sound'],
            location: 'Nashville, TN',
            skills: ['Audio Engineering', 'Pro Tools', 'Music Production']
          },
          {
            id: '7',
            name: 'Maria Garcia',
            email: 'maria.g@company.com',
            role: 'Editor',
            department: 'Production',
            joinDate: '2023-04-12',
            lastActive: '2024-01-15T13:45:00Z',
            status: 'active',
            projects: 9,
            rating: 4.6,
            permissions: ['edit_content', 'review_cuts'],
            location: 'Miami, FL',
            skills: ['Video Editing', 'Avid', 'Final Cut Pro', 'Color Grading']
          },
          {
            id: '8',
            name: 'David Kumar',
            email: 'david.k@company.com',
            phone: '+1 555-0108',
            role: 'Financial Analyst',
            department: 'Finance',
            joinDate: '2023-02-28',
            lastActive: '2024-01-15T08:30:00Z',
            status: 'active',
            projects: 14,
            rating: 4.3,
            permissions: ['view_financials', 'approve_expenses'],
            location: 'San Francisco, CA',
            skills: ['Financial Analysis', 'Excel', 'Budget Management']
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      setLoading(false);
    }
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    setSelectedMembers(
      selectedMembers.length === filteredMembers.length 
        ? [] 
        : filteredMembers.map(member => member.id)
    );
  };

  const filteredMembers = teamMembers
    .filter(member => {
      const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           member.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDepartment = filters.department === 'all' || member.department === filters.department;
      const matchesRole = filters.role === 'all' || member.role === filters.role;
      const matchesStatus = filters.status === 'all' || member.status === filters.status;
      
      return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      const direction = sortOrder === 'asc' ? 1 : -1;
      
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * direction;
        case 'role':
          return a.role.localeCompare(b.role) * direction;
        case 'department':
          return a.department.localeCompare(b.department) * direction;
        case 'joinDate':
          return (new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()) * direction;
        case 'rating':
          return (a.rating - b.rating) * direction;
        default:
          return 0;
      }
    });

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'inactive': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <CheckCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <DashboardHeader
        user={user}
        userType={userType as any}
        title="Team Members"
        onLogout={logout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Members</h1>
            <p className="text-gray-600">{filteredMembers.length} members in your team</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={() => navigate('/team/invite')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Invite Member
            </button>
            <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search members by name, email, role, or skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border border-gray-300 rounded-lg transition flex items-center gap-2 ${
                showFilters ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                >
                  <option value="all">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={filters.role}
                  onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                >
                  <option value="all">All Roles</option>
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
                >
                  <option value="all">All Status</option>
                  {statuses.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ department: 'all', role: 'all', status: 'all', skills: 'all' })}
                  className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedMembers.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="text-indigo-900">
              {selectedMembers.length} member{selectedMembers.length > 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                Update Roles
              </button>
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                Remove Members
              </button>
            </div>
          </div>
        )}

        {/* Members Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
                      />
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('role')}
                    >
                      Role {sortBy === 'role' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('department')}
                    >
                      Department {sortBy === 'department' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                      onClick={() => handleSort('rating')}
                    >
                      Rating {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => handleSelectMember(member.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{member.name}</div>
                            <div className="text-sm text-gray-600">{member.location}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{member.role}</div>
                        {member.reportsTo && (
                          <div className="text-xs text-gray-600">Reports to {member.reportsTo}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-50 text-purple-700">
                          {member.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {member.email}
                        </div>
                        {member.phone && (
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="w-4 h-4" />
                            {member.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(member.status)}
                          <span className={`text-sm ${
                            member.status === 'active' ? 'text-green-600' :
                            member.status === 'pending' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {member.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Last active {formatRelativeTime(member.lastActive)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-gray-900">{member.rating}</span>
                        </div>
                        <div className="text-xs text-gray-600">{member.projects} projects</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/team/member/${member.id}`)}
                            className="text-indigo-600 hover:text-indigo-500 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-500 transition">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="text-red-600 hover:text-red-500 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-500 transition">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredMembers.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium mb-2">No team members found</p>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}