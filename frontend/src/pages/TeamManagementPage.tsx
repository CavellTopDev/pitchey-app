import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserPlus, Shield, Mail, Phone, Calendar, 
  MoreVertical, Edit2, Trash2, CheckCircle, XCircle,
  Award, Briefcase, Clock, Star, Handshake, GitBranch
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { useAuthStore } from '../store/authStore';
import CreatorCollaborations from './creator/CreatorCollaborations';
import ProductionCollaborations from './production/ProductionCollaborations';

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

export default function TeamManagementPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const userType = user?.userType || 'production';
  const [activeTab, setActiveTab] = useState<'members' | 'collaborations' | 'roles'>('members');
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
          permissions: ['edit', 'delete', 'approve']
        },
        {
          id: '2',
          name: 'Michael Chen',
          email: 'michael.c@company.com',
          phone: '+1 555-0102',
          role: 'Director',
          department: 'Creative',
          joinDate: '2023-03-22',
          status: 'active',
          projects: 8,
          rating: 4.6,
          permissions: ['edit', 'approve']
        },
        {
          id: '3',
          name: 'Emily Rodriguez',
          email: 'emily.r@company.com',
          role: 'Writer',
          department: 'Development',
          joinDate: '2023-06-10',
          status: 'pending',
          projects: 3,
          rating: 4.2,
          permissions: ['edit']
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabs = [
    { id: 'members', label: 'Team Members', icon: Users },
    { id: 'collaborations', label: 'Collaborations', icon: Handshake },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield }
  ];

  const filteredMembers = teamMembers.filter(member => {
    const matchesDepartment = selectedDepartment === 'all' || member.department === selectedDepartment;
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.role.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType={userType as 'creator' | 'investor' | 'production'}
        title="Team & Collaborations"
        onLogout={handleLogout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                      ${activeTab === tab.id
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-200 ease-in-out">
          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* Header Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1 w-full sm:max-w-md">
                  <input
                    type="text"
                    placeholder="Search team members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                
                <div className="flex gap-3">
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite Member
                  </button>
                </div>
              </div>

              {/* Team Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Members</p>
                      <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-purple-500 opacity-20" />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Active Now</p>
                      <p className="text-2xl font-bold text-green-600">
                        {teamMembers.filter(m => m.status === 'active').length}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500 opacity-20" />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Departments</p>
                      <p className="text-2xl font-bold text-blue-600">{departments.length}</p>
                    </div>
                    <Briefcase className="w-8 h-8 text-blue-500 opacity-20" />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Rating</p>
                      <p className="text-2xl font-bold text-yellow-600">4.5</p>
                    </div>
                    <Star className="w-8 h-8 text-yellow-500 opacity-20" />
                  </div>
                </div>
              </div>

              {/* Team Members Table */}
              <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role & Department
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Projects
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rating
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            Loading team members...
                          </td>
                        </tr>
                      ) : filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            No team members found
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                  <span className="text-purple-600 font-medium">
                                    {member.name.split(' ').map(n => n[0]).join('')}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{member.name}</div>
                                  <div className="text-sm text-gray-500">{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm text-gray-900">{member.role}</div>
                                <div className="text-sm text-gray-500">{member.department}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{member.projects}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                ${member.status === 'active' ? 'bg-green-100 text-green-800' : 
                                  member.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                  'bg-gray-100 text-gray-800'}`}>
                                {member.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Star className="w-4 h-4 text-yellow-400 mr-1" />
                                <span className="text-sm text-gray-900">{member.rating}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button className="text-gray-400 hover:text-gray-500">
                                <MoreVertical className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collaborations' && (
            <div>
              {userType === 'creator' ? (
                <CreatorCollaborations />
              ) : (
                <ProductionCollaborations />
              )}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold mb-4">Roles & Permissions</h3>
              <div className="space-y-4">
                {roles.map(role => (
                  <div key={role} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{role}</p>
                      <p className="text-sm text-gray-500">
                        {teamMembers.filter(m => m.role.includes(role)).length} members
                      </p>
                    </div>
                    <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                      Configure Permissions
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
}