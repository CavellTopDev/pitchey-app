import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserPlus, Shield, Mail, Phone, Calendar, 
  MoreVertical, Edit2, Trash2, CheckCircle, XCircle,
  Award, Briefcase, Clock, Star
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { useAuthStore } from '../store/authStore';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'pending';
  avatar?: string;
  projects: number;
  rating: number;
  permissions: string[];
}

const departments = ['Production', 'Development', 'Marketing', 'Finance', 'Creative', 'Technical'];
const roles = ['Producer', 'Director', 'Writer', 'Editor', 'Cinematographer', 'Sound Designer', 'VFX Artist'];

export default function TeamManagement() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const userType = user?.userType || 'production';
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Simulate loading team members
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
          status: 'active',
          projects: 12,
          rating: 4.8,
          permissions: ['manage_projects', 'approve_budgets', 'manage_team']
        },
        {
          id: '2',
          name: 'Michael Chen',
          email: 'michael.c@company.com',
          phone: '+1 555-0102',
          role: 'Director',
          department: 'Creative',
          joinDate: '2023-03-20',
          status: 'active',
          projects: 8,
          rating: 4.9,
          permissions: ['manage_projects', 'creative_control']
        },
        {
          id: '3',
          name: 'Emma Rodriguez',
          email: 'emma.r@company.com',
          role: 'VFX Supervisor',
          department: 'Technical',
          joinDate: '2023-06-10',
          status: 'active',
          projects: 15,
          rating: 4.7,
          permissions: ['manage_vfx', 'approve_renders']
        },
        {
          id: '4',
          name: 'James Wilson',
          email: 'james.w@company.com',
          role: 'Script Writer',
          department: 'Creative',
          joinDate: '2024-01-05',
          status: 'pending',
          projects: 2,
          rating: 4.5,
          permissions: ['edit_scripts']
        },
        {
          id: '5',
          name: 'Lisa Park',
          email: 'lisa.p@company.com',
          phone: '+1 555-0105',
          role: 'Marketing Director',
          department: 'Marketing',
          joinDate: '2022-11-30',
          status: 'inactive',
          projects: 20,
          rating: 4.6,
          permissions: ['manage_campaigns', 'approve_marketing']
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredMembers = teamMembers.filter(member => {
    const matchesDepartment = selectedDepartment === 'all' || member.department === selectedDepartment;
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.role.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const stats = {
    total: teamMembers.length,
    active: teamMembers.filter(m => m.status === 'active').length,
    departments: new Set(teamMembers.map(m => m.department)).size,
    avgRating: (teamMembers.reduce((sum, m) => sum + m.rating, 0) / teamMembers.length).toFixed(1)
  };

  const InviteModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-gray-900">Invite Team Member</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 placeholder-gray-500"
              placeholder="colleague@company.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 placeholder-gray-500"
              placeholder="Full Name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900">
              <option value="">Select Role</option>
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900">
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
            <textarea
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:ring-offset-white text-gray-900 placeholder-gray-500"
              rows={3}
              placeholder="Add a personal message to the invitation..."
            />
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowInviteModal(false)}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Handle invite
              setShowInviteModal(false);
            }}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <DashboardHeader
        user={user}
        userType={userType as any}
        title="Team Management"
        onLogout={logout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Management</h1>
            <p className="text-gray-600">Manage your production team, roles, and permissions</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={() => navigate('/team/invite')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Invite Member
            </button>
            <button
              onClick={() => navigate('/team/members')}
              className="px-6 py-3 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              View All Members
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-indigo-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Departments</p>
                <p className="text-2xl font-bold text-blue-600">{stats.departments}</p>
              </div>
              <Briefcase className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Rating</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.avgRating}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Actions and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition"
            >
              <UserPlus className="w-5 h-5" />
              Invite Member
            </button>
            
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
              />
            </div>
            
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-gray-900"
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            <button
              onClick={() => navigate(`/${userType}/team/roles`)}
              className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition flex items-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Manage Roles
            </button>
          </div>
        </div>

        {/* Team Members Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((member) => (
              <div key={member.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-indigo-300 transition shadow-sm">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{member.name}</h3>
                        <p className="text-sm text-gray-600">{member.role}</p>
                      </div>
                    </div>
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      {member.email}
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        {member.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      Joined {new Date(member.joinDate).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      member.status === 'active' ? 'bg-green-100 text-green-800' :
                      member.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {member.status}
                    </span>
                    <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                      {member.department}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {member.projects} projects
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      {member.rating}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 text-indigo-600 hover:bg-gray-50 rounded-lg transition text-sm">
                      View Profile
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-red-500 hover:bg-gray-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredMembers.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No team members found</p>
          </div>
        )}
      </div>

      {showInviteModal && <InviteModal />}
    </div>
  );
}