import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api.config';

interface FollowButtonProps {
  creatorId?: number;
  pitchId?: number;
  className?: string;
  variant?: 'default' | 'small' | 'large';
  showFollowingText?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

const FollowButton: React.FC<FollowButtonProps> = ({
  creatorId,
  pitchId,
  className = '',
  variant = 'default',
  showFollowingText = true,
  onFollowChange,
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkFollowStatus();
  }, [creatorId, pitchId]);

  const checkFollowStatus = async () => {
    if (!creatorId && !pitchId) return;

    setChecking(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setChecking(false);
        return;
      }

      // Get userId from localStorage
      const userStr = localStorage.getItem('user');
      let userId = null;
      try {
        const user = userStr ? JSON.parse(userStr) : null;
        userId = user?.id;
      } catch {
        // Ignore parse error
      }

      const params = new URLSearchParams();
      if (userId) params.append('userId', userId.toString());
      if (creatorId) params.append('creatorId', creatorId.toString());
      if (pitchId) params.append('pitchId', pitchId.toString());

      const response = await fetch(`${API_URL}/api/follows/check?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsFollowing(data.isFollowing);
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleFollow = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);

    // Get userId from localStorage
    const userStr = localStorage.getItem('user');
    let userId = null;
    try {
      const user = userStr ? JSON.parse(userStr) : null;
      userId = user?.id;
    } catch {
      // Ignore parse error
    }

    if (!userId) {
      console.error('User ID not found');
      setLoading(false);
      return;
    }

    try {
      if (isFollowing) {
        // Unfollow
        const params = new URLSearchParams();
        params.append('userId', userId.toString());
        if (creatorId) params.append('creatorId', creatorId.toString());
        if (pitchId) params.append('pitchId', pitchId.toString());

        const response = await fetch(`${API_URL}/api/follows/follow?${params}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setIsFollowing(false);
          onFollowChange?.(false);
        } else {
          throw new Error('Failed to unfollow');
        }
      } else {
        // Follow
        const body: any = {
          userId: userId
        };
        if (creatorId) body.targetId = creatorId;
        if (pitchId) body.targetId = pitchId;
        body.type = pitchId ? 'pitch' : 'creator';

        const response = await fetch(`${API_URL}/api/follows/follow`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          setIsFollowing(true);
          onFollowChange?.(true);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to follow');
        }
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      // You might want to show a toast notification here
    } finally {
      setLoading(false);
    }
  };

  const getButtonClasses = () => {
    const baseClasses = 'font-medium rounded-lg transition-colors duration-200 flex items-center justify-center';
    
    const variantClasses = {
      small: 'px-3 py-1 text-sm',
      default: 'px-4 py-2 text-sm',
      large: 'px-6 py-3 text-base',
    };

    const stateClasses = isFollowing
      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
      : 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600';

    const disabledClasses = (loading || checking) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

    return `${baseClasses} ${variantClasses[variant]} ${stateClasses} ${disabledClasses} ${className}`;
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    if (checking) return 'Loading...';
    
    if (isFollowing) {
      return showFollowingText ? 'Following' : 'Unfollow';
    }
    
    return 'Follow';
  };

  const getIcon = () => {
    if (loading || checking) {
      return (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      );
    }

    if (isFollowing) {
      return (
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    );
  };

  // Don't render if we're still checking and no token
  if (checking && !localStorage.getItem('authToken')) {
    return null;
  }

  return (
    <button
      onClick={handleFollow}
      disabled={loading || checking}
      className={getButtonClasses()}
      title={isFollowing ? `Unfollow ${pitchId ? 'pitch' : 'creator'}` : `Follow ${pitchId ? 'pitch' : 'creator'}`}
    >
      {getIcon()}
      <span>{getButtonText()}</span>
    </button>
  );
};

export default FollowButton;