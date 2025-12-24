import React, { useState, useEffect } from 'react';
import { Plus, Users, UserPlus, UserMinus, Mail, Shield, Eye, Edit, Trash2 } from 'lucide-react';
import apiClient from '../../services/api';
import { toast } from 'react-hot-toast';

interface TeamMember {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  lastActive?: string;
  avatar?: string;
}

interface Team {
  id: number;
  name: string;
  description?: string;
  ownerId: number;
  members: TeamMember[];
  createdAt: string;
  visibility: 'private' | 'team' | 'public';
}

interface TeamInvite {
  id: number;
  teamId: number;
  teamName: string;
  invitedBy: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface TeamManagementProps {
  userId: number;
  pitchId?: number;
}

export default function TeamManagement({ userId, pitchId }: TeamManagementProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create team form
  const [newTeam, setNewTeam] = useState({
    name: '',
    description: '',
    visibility: 'private' as const
  });

  // Invite form
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'viewer' as 'editor' | 'viewer',
    message: ''
  });

  useEffect(() => {
    loadTeams();
    loadInvites();
  }, [userId]);

  const loadTeams = async () => {
    try {
      const response = await apiClient.get('/api/teams');
      setTeams(response.data.data.teams || []);
    } catch (error) {
      console.error('Failed to load teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const loadInvites = async () => {
    try {
      const response = await apiClient.get('/api/teams/invites');
      setInvites(response.data.data.invites || []);
    } catch (error) {
      console.error('Failed to load invites:', error);
    }
  };

  const createTeam = async () => {
    try {
      const response = await apiClient.post('/api/teams', newTeam);
      const createdTeam = response.data.data.team;
      setTeams([...teams, createdTeam]);
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '', visibility: 'private' });
      toast.success('Team created successfully');
      
      // If we have a pitch, associate it with the team
      if (pitchId) {
        await apiClient.post(`/api/pitches/${pitchId}/team`, { 
          teamId: createdTeam.id 
        });
      }
    } catch (error) {
      console.error('Failed to create team:', error);
      toast.error('Failed to create team');
    }
  };

  const inviteMember = async () => {
    if (!selectedTeam) return;
    
    try {
      await apiClient.post(`/api/teams/${selectedTeam.id}/invite`, inviteForm);
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'viewer', message: '' });
      toast.success('Invitation sent successfully');
      loadTeams(); // Reload to get updated member list
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  const removeMember = async (teamId: number, memberId: number) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    try {
      await apiClient.delete(`/api/teams/${teamId}/members/${memberId}`);
      toast.success('Member removed');
      loadTeams();
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    }
  };

  const updateMemberRole = async (teamId: number, memberId: number, newRole: string) => {
    try {
      await apiClient.put(`/api/teams/${teamId}/members/${memberId}`, { 
        role: newRole 
      });
      toast.success('Role updated');
      loadTeams();
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleInvite = async (inviteId: number, action: 'accept' | 'reject') => {
    try {
      await apiClient.post(`/api/teams/invites/${inviteId}/${action}`);
      toast.success(`Invitation ${action}ed`);
      loadInvites();
      if (action === 'accept') {
        loadTeams();
      }
    } catch (error) {
      console.error(`Failed to ${action} invitation:`, error);
      toast.error(`Failed to ${action} invitation`);
    }
  };

  const deleteTeam = async (teamId: number) => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return;
    }
    
    try {
      await apiClient.delete(`/api/teams/${teamId}`);
      setTeams(teams.filter(t => t.id !== teamId));
      if (selectedTeam?.id === teamId) {
        setSelectedTeam(null);
      }
      toast.success('Team deleted');
    } catch (error) {
      console.error('Failed to delete team:', error);
      toast.error('Failed to delete team');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Shield className="w-4 h-4 text-yellow-500" />;
      case 'editor': return <Edit className="w-4 h-4 text-blue-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Invites */}
      {invites.filter(i => i.status === 'pending').length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Pending Team Invitations
          </h3>
          <div className="space-y-2">
            {invites.filter(i => i.status === 'pending').map(invite => (
              <div key={invite.id} className="flex items-center justify-between bg-white p-3 rounded">
                <div>
                  <p className="font-medium">{invite.teamName}</p>
                  <p className="text-sm text-gray-600">
                    Invited by {invite.invitedBy} as {invite.role}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInvite(invite.id, 'accept')}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleInvite(invite.id, 'reject')}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          Team Management
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      {/* Teams Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(team => (
          <div
            key={team.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedTeam?.id === team.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedTeam(team)}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold">{team.name}</h3>
              {team.ownerId === userId && (
                <Shield className="w-4 h-4 text-yellow-500" title="Team Owner" />
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2">{team.description || 'No description'}</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {team.members.length} members
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                team.visibility === 'public' ? 'bg-green-100 text-green-700' :
                team.visibility === 'team' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {team.visibility}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Team Details */}
      {selectedTeam && (
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-semibold">{selectedTeam.name}</h3>
              <p className="text-gray-600">{selectedTeam.description}</p>
            </div>
            <div className="flex gap-2">
              {selectedTeam.ownerId === userId && (
                <>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite
                  </button>
                  <button
                    onClick={() => deleteTeam(selectedTeam.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Team Members */}
          <div className="space-y-3">
            <h4 className="font-semibold">Team Members</h4>
            {selectedTeam.members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-gray-600">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {getRoleIcon(member.role)}
                    <span className="text-sm">{member.role}</span>
                  </div>
                  {selectedTeam.ownerId === userId && member.userId !== userId && (
                    <div className="flex gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(selectedTeam.id, member.id, e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button
                        onClick={() => removeMember(selectedTeam.id, member.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Create New Team</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Team Name</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter team name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({...newTeam, description: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Optional team description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Visibility</label>
                <select
                  value={newTeam.visibility}
                  onChange={(e) => setNewTeam({...newTeam, visibility: e.target.value as any})}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="private">Private - Only team members</option>
                  <option value="team">Team - Members and invited users</option>
                  <option value="public">Public - Anyone can view</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createTeam}
                  disabled={!newTeam.name}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  Create Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="member@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({...inviteForm, role: e.target.value as any})}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="viewer">Viewer - Can view content</option>
                  <option value="editor">Editor - Can edit content</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message (Optional)</label>
                <textarea
                  value={inviteForm.message}
                  onChange={(e) => setInviteForm({...inviteForm, message: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Add a personal message to the invitation"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={inviteMember}
                  disabled={!inviteForm.email}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                >
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}