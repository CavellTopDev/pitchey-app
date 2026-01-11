import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { followService } from '../../services/follow.service';
import { useBetterAuthStore } from '../../store/betterAuthStore';

interface FollowButtonProps {
  userId: string;
  username?: string;
  initialFollowing?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'outline' | 'ghost';
  onFollowChange?: (isFollowing: boolean) => void;
  className?: string;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  username,
  initialFollowing = false,
  size = 'md',
  variant = 'primary',
  onFollowChange,
  className = ''
}) => {
  const { user } = useBetterAuthStore();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    setIsFollowing(initialFollowing);
  }, [initialFollowing]);

  useEffect(() => {
    // Check follow status on mount if not provided
    if (!initialFollowing && user?.id && userId && user.id !== userId) {
      checkFollowStatus();
    }
  }, [userId, user?.id, initialFollowing, checkFollowStatus]);

  const checkFollowStatus = useCallback(async () => {
    try {
      const following = await followService.isFollowing(userId);
      setIsFollowing(following);
    } catch (error) {
      console.error('Failed to check follow status:', error);
    }
  }, [userId]);

  const handleFollow = async () => {
    if (!user) {
      // Don't redirect - Better Auth handles authentication
      toast.error('Please log in to follow users');
      return;
    }

    if (user.id === userId) {
      return; // Can't follow yourself
    }

    setLoading(true);
    try {
      const action = isFollowing ? 'unfollow' : 'follow';
      const result = await followService.toggleFollow(userId, action);
      
      setIsFollowing(result.isFollowing);
      onFollowChange?.(result.isFollowing);

      // Show success feedback
      if (result.isFollowing) {
        // Could trigger a toast notification here
      } else {
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
      // Could show error toast here
    } finally {
      setLoading(false);
    }
  };

  // Don't show for own profile
  if (user?.id === userId) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const baseClasses = `
    inline-flex items-center justify-center gap-2 font-medium rounded-lg 
    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variantClasses = {
    primary: isFollowing
      ? hover
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-green-600 text-white hover:bg-green-700'
      : 'bg-purple-600 text-white hover:bg-purple-700',
    outline: isFollowing
      ? hover
        ? 'border-2 border-red-600 text-red-600 hover:bg-red-50'
        : 'border-2 border-green-600 text-green-600 hover:bg-green-50'
      : 'border-2 border-purple-600 text-purple-600 hover:bg-purple-50',
    ghost: isFollowing
      ? hover
        ? 'text-red-600 hover:bg-red-50'
        : 'text-green-600 hover:bg-green-50'
      : 'text-purple-600 hover:bg-purple-50'
  };

  const Icon = isFollowing 
    ? hover 
      ? UserMinus 
      : UserCheck 
    : UserPlus;

  const buttonText = isFollowing
    ? hover
      ? 'Unfollow'
      : 'Following'
    : 'Follow';

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} />
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
};