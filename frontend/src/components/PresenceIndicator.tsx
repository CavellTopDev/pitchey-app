import React, { useState, useEffect } from 'react';
import { usePresence } from '../contexts/WebSocketContext';

interface PresenceData {
  userId: number;
  username: string;
  status: 'online' | 'away' | 'offline' | 'dnd';
  lastSeen: Date;
  activity?: string;
}

interface PresenceIndicatorProps {
  userId?: number;
  username?: string;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  showActivity?: boolean;
  className?: string;
}

export function PresenceIndicator({ 
  userId, 
  username, 
  size = 'md', 
  showStatus = true, 
  showActivity = false,
  className = '' 
}: PresenceIndicatorProps) {
  const { onlineUsers } = usePresence();
  const [userPresence, setUserPresence] = useState<PresenceData | null>(null);

  useEffect(() => {
    if (userId) {
      const presence = onlineUsers.find(user => user.userId === userId);
      setUserPresence(presence || null);
    } else if (username) {
      const presence = onlineUsers.find(user => user.username === username);
      setUserPresence(presence || null);
    }
  }, [userId, username, onlineUsers]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-400 border-green-500';
      case 'away':
        return 'bg-yellow-400 border-yellow-500';
      case 'dnd':
        return 'bg-red-400 border-red-500';
      default:
        return 'bg-gray-400 border-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'dnd':
        return 'Do not disturb';
      default:
        return 'Offline';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'lg':
        return 'w-4 h-4';
      default:
        return 'w-3 h-3';
    }
  };

  const getLastSeenText = (lastSeen: Date) => {
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return lastSeen.toLocaleDateString();
  };

  const status = userPresence?.status || 'offline';
  const isOnline = status === 'online';

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status Dot */}
      <div className="relative">
        <div
          className={`${getSizeClasses()} rounded-full border-2 ${getStatusColor(status)} ${
            isOnline ? 'animate-pulse' : ''
          }`}
        />
        {status === 'dnd' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
        )}
      </div>

      {/* Status Text and Activity */}
      {(showStatus || showActivity) && (
        <div className="flex flex-col">
          {showStatus && (
            <span className={`text-xs font-medium ${
              isOnline ? 'text-green-600' : 'text-gray-500'
            }`}>
              {getStatusText(status)}
              {!isOnline && userPresence && (
                <span className="text-gray-400 ml-1">
                  • {getLastSeenText(userPresence.lastSeen)}
                </span>
              )}
            </span>
          )}
          {showActivity && userPresence?.activity && (
            <span className="text-xs text-gray-400 truncate max-w-32">
              {userPresence.activity}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface OnlineUsersListProps {
  maxUsers?: number;
  showUsernames?: boolean;
  showActivity?: boolean;
  className?: string;
}

export function OnlineUsersList({ 
  maxUsers = 10, 
  showUsernames = true, 
  showActivity = false,
  className = '' 
}: OnlineUsersListProps) {
  const { onlineUsers } = usePresence();
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());

  const sortedUsers = [...onlineUsers]
    .sort((a, b) => {
      // Sort by status priority: online > away > dnd
      const statusPriority = { online: 3, away: 2, dnd: 1, offline: 0 };
      const aPriority = statusPriority[a.status] || 0;
      const bPriority = statusPriority[b.status] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // Then by username
      return a.username.localeCompare(b.username);
    })
    .slice(0, maxUsers);

  const toggleUserExpanded = (userId: number) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  if (onlineUsers.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <span>No users online</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-sm font-medium text-gray-700">
        Online Users ({onlineUsers.length})
      </div>
      <div className="space-y-1">
        {sortedUsers.map((user) => (
          <div
            key={user.userId}
            className={`flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors ${
              showActivity && user.activity ? 'cursor-pointer' : ''
            }`}
            onClick={() => showActivity && user.activity && toggleUserExpanded(user.userId)}
          >
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <PresenceIndicator 
                userId={user.userId} 
                size="sm" 
                showStatus={false}
              />
              {showUsernames && (
                <span className="text-sm text-gray-900 truncate">
                  {user.username}
                </span>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                user.status === 'online' 
                  ? 'bg-green-100 text-green-700'
                  : user.status === 'away'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {user.status}
              </span>
            </div>
            
            {showActivity && user.activity && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500 truncate max-w-20">
                  {expandedUsers.has(user.userId) ? user.activity : 
                   user.activity.length > 15 ? user.activity.substring(0, 15) + '...' : user.activity}
                </span>
                <svg 
                  className={`w-3 h-3 text-gray-400 transform transition-transform ${
                    expandedUsers.has(user.userId) ? 'rotate-180' : ''
                  }`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </div>
        ))}
        
        {onlineUsers.length > maxUsers && (
          <div className="text-xs text-gray-500 text-center py-1">
            +{onlineUsers.length - maxUsers} more users online
          </div>
        )}
      </div>
    </div>
  );
}

interface PresenceStatusSelectorProps {
  currentStatus?: string;
  onStatusChange: (status: 'online' | 'away' | 'dnd') => void;
  onActivityChange?: (activity: string) => void;
  className?: string;
}

export function PresenceStatusSelector({ 
  currentStatus = 'online',
  onStatusChange,
  onActivityChange,
  className = '' 
}: PresenceStatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customActivity, setCustomActivity] = useState('');
  const [showActivityInput, setShowActivityInput] = useState(false);

  const statusOptions = [
    { value: 'online', label: 'Online', color: 'bg-green-400', description: 'Available for chat' },
    { value: 'away', label: 'Away', color: 'bg-yellow-400', description: 'May not respond immediately' },
    { value: 'dnd', label: 'Do not disturb', color: 'bg-red-400', description: 'Focus mode - minimal interruptions' },
  ];

  const handleStatusChange = (status: 'online' | 'away' | 'dnd') => {
    onStatusChange(status);
    setIsOpen(false);
  };

  const handleActivitySubmit = () => {
    if (onActivityChange && customActivity.trim()) {
      onActivityChange(customActivity.trim());
      setCustomActivity('');
      setShowActivityInput(false);
    }
  };

  const currentStatusOption = statusOptions.find(option => option.value === currentStatus);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <div className={`w-3 h-3 rounded-full ${currentStatusOption?.color || 'bg-gray-400'}`}></div>
        <span className="text-sm font-medium text-gray-700">
          {currentStatusOption?.label || 'Set Status'}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="p-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value as any)}
                className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
              >
                <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
                {currentStatus === option.value && (
                  <svg className="w-4 h-4 text-blue-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
            
            {onActivityChange && (
              <>
                <div className="border-t border-gray-200 my-2"></div>
                {!showActivityInput ? (
                  <button
                    onClick={() => setShowActivityInput(true)}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors text-sm text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Set custom activity</span>
                  </button>
                ) : (
                  <div className="px-3 py-2">
                    <input
                      type="text"
                      value={customActivity}
                      onChange={(e) => setCustomActivity(e.target.value)}
                      placeholder="What are you working on?"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      maxLength={50}
                      onKeyPress={(e) => e.key === 'Enter' && handleActivitySubmit()}
                      autoFocus
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">
                        {customActivity.length}/50
                      </span>
                      <div className="space-x-2">
                        <button
                          onClick={() => {
                            setShowActivityInput(false);
                            setCustomActivity('');
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleActivitySubmit}
                          disabled={!customActivity.trim()}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Set
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PresenceIndicator;