/**
 * Mobile-optimized Pitch Card for Web
 * Enhanced touch interactions, swipe gestures, and responsive design
 */

import React, { useState, useRef } from 'react';
import { useSwipeNavigation, useLongPress } from '../../hooks/useMobileGestures';
import LazyImage from '../LazyImage';

interface Pitch {
  id: number;
  title: string;
  description: string;
  genre: string;
  format: string;
  thumbnail_url?: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  creator_name: string;
  creator_avatar?: string;
  created_at: string;
}

interface MobilePitchCardProps {
  pitch: Pitch;
  onView?: (pitch: Pitch) => void;
  onLike?: (pitchId: number) => void;
  onSave?: (pitchId: number) => void;
  onShare?: (pitch: Pitch) => void;
  className?: string;
}

export default function MobilePitchCard({
  pitch,
  onView,
  onLike,
  onSave,
  onShare,
  className = ''
}: MobilePitchCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle swipe gestures
  const { bindGestures } = useSwipeNavigation(
    () => {
      // Swipe left - like
      handleLike();
    },
    () => {
      // Swipe right - save
      handleSave();
    },
    undefined, // No swipe up action
    undefined, // No swipe down action
    { swipeThreshold: 80, swipeVelocityThreshold: 0.3 }
  );

  // Handle long press for context menu
  const { bindLongPress } = useLongPress((position) => {
    setShowActions(true);
    // Add haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, 500);

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.(pitch.id);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    onSave?.(pitch.id);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const handleView = () => {
    onView?.(pitch);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: pitch.title,
        text: pitch.description,
        url: window.location.origin + `/pitches/${pitch.id}`
      }).catch(console.error);
    } else {
      onShare?.(pitch);
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)}w ago`;
    return `${Math.ceil(diffDays / 30)}mo ago`;
  };

  const getFormatColor = (format: string) => {
    const colors: Record<string, string> = {
      'Feature Film': 'bg-red-500',
      'Short Film': 'bg-teal-500',
      'Documentary': 'bg-blue-500',
      'Series': 'bg-green-500',
      'Web Series': 'bg-yellow-500',
      'Animation': 'bg-purple-500',
      'Commercial': 'bg-indigo-500'
    };
    return colors[format] || 'bg-gray-500';
  };

  React.useEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    const cleanup1 = bindGestures(element);
    const cleanup2 = bindLongPress(element);

    return () => {
      cleanup1?.();
      cleanup2?.();
    };
  }, [bindGestures, bindLongPress]);

  return (
    <>
      <div
        ref={cardRef}
        className={`
          relative bg-white rounded-2xl shadow-lg overflow-hidden
          touch-manipulation transform transition-transform duration-200
          active:scale-95 hover:shadow-xl
          ${className}
        `}
        onClick={handleView}
        role="button"
        tabIndex={0}
        aria-label={`View pitch: ${pitch.title} by ${pitch.creator_name}`}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleView();
          }
        }}
      >
        {/* Thumbnail */}
        <div className="relative h-48 bg-gray-100">
          {pitch.thumbnail_url ? (
            <LazyImage
              src={pitch.thumbnail_url}
              alt={pitch.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <span className="text-4xl text-gray-400">🎬</span>
            </div>
          )}
          
          {/* Overlay gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          
          {/* Genre tag */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 rounded-full">
            <span className="text-white text-xs font-medium">{pitch.genre}</span>
          </div>
          
          {/* Format tag */}
          <div className={`absolute top-3 right-3 px-2 py-1 rounded-full ${getFormatColor(pitch.format)}`}>
            <span className="text-white text-xs font-medium">{pitch.format}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="font-bold text-lg text-gray-900 leading-tight line-clamp-2">
            {pitch.title}
          </h3>
          
          {/* Description */}
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
            {pitch.description}
          </p>
          
          {/* Creator info */}
          <div className="flex items-center space-x-3">
            {pitch.creator_avatar ? (
              <LazyImage
                src={pitch.creator_avatar}
                alt={pitch.creator_name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">
                  {pitch.creator_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {pitch.creator_name}
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(pitch.created_at)}
              </p>
            </div>
          </div>
          
          {/* Stats and actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {/* Stats */}
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span className="flex items-center space-x-1">
                <span>👁</span>
                <span>{formatCount(pitch.view_count)}</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>❤️</span>
                <span>{formatCount(pitch.like_count)}</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>💬</span>
                <span>{formatCount(pitch.comment_count)}</span>
              </span>
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}
                className={`
                  p-2 rounded-full transition-colors touch-manipulation
                  ${isLiked ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}
                `}
                aria-label="Like pitch"
              >
                <span className="text-sm">❤️</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                className={`
                  p-2 rounded-full transition-colors touch-manipulation
                  ${isSaved ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}
                `}
                aria-label="Save pitch"
              >
                <span className="text-sm">🔖</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                className="p-2 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors touch-manipulation"
                aria-label="Share pitch"
              >
                <span className="text-sm">📤</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Swipe indicators */}
        <div className="absolute bottom-2 right-2 flex space-x-1 opacity-30">
          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
        </div>
      </div>

      {/* Action sheet modal */}
      {showActions && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={() => setShowActions(false)}
        >
          <div className="w-full bg-white rounded-t-2xl p-6 space-y-4 transform transition-transform duration-300 translate-y-0">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
            
            <h3 className="font-bold text-lg text-center">{pitch.title}</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setShowActions(false);
                  handleView();
                }}
                className="p-4 bg-blue-50 rounded-xl text-blue-600 font-medium"
              >
                👁 View Details
              </button>
              
              <button
                onClick={() => {
                  setShowActions(false);
                  handleLike();
                }}
                className="p-4 bg-red-50 rounded-xl text-red-600 font-medium"
              >
                ❤️ Like
              </button>
              
              <button
                onClick={() => {
                  setShowActions(false);
                  handleSave();
                }}
                className="p-4 bg-green-50 rounded-xl text-green-600 font-medium"
              >
                🔖 Save
              </button>
              
              <button
                onClick={() => {
                  setShowActions(false);
                  handleShare();
                }}
                className="p-4 bg-purple-50 rounded-xl text-purple-600 font-medium"
              >
                📤 Share
              </button>
            </div>
            
            <button
              onClick={() => setShowActions(false)}
              className="w-full p-4 bg-gray-100 rounded-xl text-gray-600 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}