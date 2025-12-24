import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Globe, Users, FileText, Shield, Info } from 'lucide-react';
import { Visibility } from '../../middleware/rbac';
import apiClient from '../../services/api';
import { toast } from 'react-hot-toast';

interface VisibilitySettingsProps {
  resourceId: number;
  resourceType: 'pitch' | 'document' | 'project';
  currentVisibility: Visibility;
  currentSettings?: VisibilityConfig;
  onUpdate: (visibility: Visibility, config: VisibilityConfig) => void;
  userRole: string;
  teams?: { id: number; name: string }[];
}

interface VisibilityConfig {
  visibility: Visibility;
  ndaRequired?: boolean;
  teamIds?: number[];
  allowedUserIds?: number[];
  blockedUserIds?: number[];
  expiresAt?: string;
  customMessage?: string;
}

interface AccessUser {
  id: number;
  name: string;
  email: string;
  accessType: 'allowed' | 'blocked';
}

export default function VisibilitySettings({
  resourceId,
  resourceType,
  currentVisibility,
  currentSettings = { visibility: currentVisibility },
  onUpdate,
  userRole,
  teams = []
}: VisibilitySettingsProps) {
  const [config, setConfig] = useState<VisibilityConfig>(currentSettings);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentSettings.allowedUserIds?.length || currentSettings.blockedUserIds?.length) {
      loadAccessUsers();
    }
  }, [currentSettings]);

  const loadAccessUsers = async () => {
    try {
      const userIds = [
        ...(currentSettings.allowedUserIds || []),
        ...(currentSettings.blockedUserIds || [])
      ];
      
      if (userIds.length === 0) return;
      
      const response = await apiClient.post('/api/users/bulk', { ids: userIds });
      const users = response.data.data.users || [];
      
      setAccessUsers(users.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        accessType: currentSettings.allowedUserIds?.includes(user.id) ? 'allowed' : 'blocked'
      })));
    } catch (error) {
      console.error('Failed to load access users:', error);
    }
  };

  const handleVisibilityChange = (visibility: Visibility) => {
    const newConfig = { ...config, visibility };
    
    // Reset incompatible settings
    if (visibility === Visibility.PUBLIC) {
      newConfig.ndaRequired = false;
      newConfig.teamIds = [];
      newConfig.blockedUserIds = config.blockedUserIds || [];
    } else if (visibility === Visibility.PRIVATE) {
      newConfig.teamIds = [];
      newConfig.allowedUserIds = config.allowedUserIds || [];
    } else if (visibility === Visibility.TEAM) {
      newConfig.ndaRequired = false;
    }
    
    setConfig(newConfig);
  };

  const handleTeamToggle = (teamId: number) => {
    const teamIds = config.teamIds || [];
    const newTeamIds = teamIds.includes(teamId)
      ? teamIds.filter(id => id !== teamId)
      : [...teamIds, teamId];
    
    setConfig({ ...config, teamIds: newTeamIds });
  };

  const addUserAccess = async (accessType: 'allowed' | 'blocked') => {
    if (!emailInput) return;
    
    try {
      const response = await apiClient.get(`/api/users/by-email?email=${emailInput}`);
      const user = response.data.data.user;
      
      if (!user) {
        toast.error('User not found');
        return;
      }
      
      // Check if already added
      if (accessUsers.some(u => u.id === user.id)) {
        toast.error('User already in access list');
        return;
      }
      
      const newUser: AccessUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        accessType
      };
      
      setAccessUsers([...accessUsers, newUser]);
      
      // Update config
      if (accessType === 'allowed') {
        setConfig({
          ...config,
          allowedUserIds: [...(config.allowedUserIds || []), user.id]
        });
      } else {
        setConfig({
          ...config,
          blockedUserIds: [...(config.blockedUserIds || []), user.id]
        });
      }
      
      setEmailInput('');
      toast.success(`User ${accessType === 'allowed' ? 'allowed' : 'blocked'}`);
    } catch (error) {
      console.error('Failed to add user:', error);
      toast.error('Failed to add user');
    }
  };

  const removeUserAccess = (userId: number) => {
    setAccessUsers(accessUsers.filter(u => u.id !== userId));
    setConfig({
      ...config,
      allowedUserIds: config.allowedUserIds?.filter(id => id !== userId),
      blockedUserIds: config.blockedUserIds?.filter(id => id !== userId)
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onUpdate(config.visibility, config);
      toast.success('Visibility settings updated');
    } catch (error) {
      console.error('Failed to update visibility:', error);
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const getVisibilityIcon = (visibility: Visibility) => {
    switch (visibility) {
      case Visibility.PUBLIC:
        return <Globe className="w-5 h-5" />;
      case Visibility.PRIVATE:
        return <Lock className="w-5 h-5" />;
      case Visibility.TEAM:
        return <Users className="w-5 h-5" />;
      case Visibility.NDA:
        return <FileText className="w-5 h-5" />;
      case Visibility.INVESTORS:
        return <Shield className="w-5 h-5" />;
      default:
        return <Eye className="w-5 h-5" />;
    }
  };

  const getVisibilityDescription = (visibility: Visibility) => {
    switch (visibility) {
      case Visibility.PUBLIC:
        return 'Anyone can view this content';
      case Visibility.PRIVATE:
        return 'Only you can view this content';
      case Visibility.TEAM:
        return 'Only team members can view';
      case Visibility.NDA:
        return 'Requires signed NDA to view';
      case Visibility.INVESTORS:
        return 'Only verified investors can view';
      default:
        return '';
    }
  };

  const canChangeVisibility = userRole === 'creator' || userRole === 'admin';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Visibility Settings
        </h3>

        {/* Visibility Options */}
        <div className="space-y-3">
          {Object.values(Visibility).map((vis) => (
            <label
              key={vis}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                config.visibility === vis
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${!canChangeVisibility ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="visibility"
                value={vis}
                checked={config.visibility === vis}
                onChange={() => handleVisibilityChange(vis)}
                disabled={!canChangeVisibility}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {getVisibilityIcon(vis)}
                  <span className="capitalize">{vis}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {getVisibilityDescription(vis)}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* Team Selection (for TEAM visibility) */}
        {config.visibility === Visibility.TEAM && teams.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Select Teams</h4>
            <div className="space-y-2">
              {teams.map(team => (
                <label key={team.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.teamIds?.includes(team.id)}
                    onChange={() => handleTeamToggle(team.id)}
                    disabled={!canChangeVisibility}
                  />
                  <span>{team.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* NDA Requirement (for NDA visibility) */}
        {config.visibility === Visibility.NDA && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">
                  NDA Required
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Users must sign a Non-Disclosure Agreement before accessing this content.
                </p>
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={config.ndaRequired !== false}
                    onChange={(e) => setConfig({ ...config, ndaRequired: e.target.checked })}
                    disabled={!canChangeVisibility}
                  />
                  <span className="text-sm">Enforce NDA requirement</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="mt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            disabled={!canChangeVisibility}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Specific User Access */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">User Access Control</h4>
                
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter user email"
                    className="flex-1 px-3 py-2 border rounded"
                    disabled={!canChangeVisibility}
                  />
                  <button
                    onClick={() => addUserAccess('allowed')}
                    className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                    disabled={!canChangeVisibility || !emailInput}
                  >
                    Allow
                  </button>
                  <button
                    onClick={() => addUserAccess('blocked')}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                    disabled={!canChangeVisibility || !emailInput}
                  >
                    Block
                  </button>
                </div>

                {/* User List */}
                {accessUsers.length > 0 && (
                  <div className="space-y-2">
                    {accessUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-white rounded">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            user.accessType === 'allowed' 
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {user.accessType === 'allowed' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-gray-600">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeUserAccess(user.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          disabled={!canChangeVisibility}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Expiration Date */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Access Expiration</h4>
                <input
                  type="datetime-local"
                  value={config.expiresAt || ''}
                  onChange={(e) => setConfig({ ...config, expiresAt: e.target.value })}
                  className="px-3 py-2 border rounded"
                  disabled={!canChangeVisibility}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Optional: Set when access should expire
                </p>
              </div>

              {/* Custom Message */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Custom Access Message</h4>
                <textarea
                  value={config.customMessage || ''}
                  onChange={(e) => setConfig({ ...config, customMessage: e.target.value })}
                  placeholder="Message shown to users without access"
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  disabled={!canChangeVisibility}
                />
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        {canChangeVisibility && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {!canChangeVisibility && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              Only content owners can change visibility settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}