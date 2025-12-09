import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/WebSocketContext';
import { NotificationsService } from '../services/notifications.service';
import { useNotificationToast } from './Toast/NotificationToastContainer';

interface NotificationBellProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function NotificationBell({ 
  className = '', 
  showLabel = false,
  size = 'md' 
}: NotificationBellProps) {
  const navigate = useNavigate();
  const { notifications: wsNotifications } = useNotifications();
  const toast = useNotificationToast();
  
  const [apiNotifications, setApiNotifications] = useState<any[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousCountRef = useRef(0);

  // Load API notifications
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const notifications = await NotificationsService.getUnreadNotifications();
        // Defensive check: ensure notifications is always an array
        setApiNotifications(Array.isArray(notifications) ? notifications : []);
      } catch (error) {
        console.error('Failed to load notifications:', error);
        setApiNotifications([]); // Set empty array on error
      }
    };

    loadNotifications();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate total unread count with defensive checks
  const unreadCount = (Array.isArray(apiNotifications) ? apiNotifications.filter(n => !n.isRead) : []).length + 
                     (Array.isArray(wsNotifications) ? wsNotifications.filter(n => !n.read) : []).length;

  // Animate when new notifications arrive
  useEffect(() => {
    if (unreadCount > previousCountRef.current && previousCountRef.current > 0) {
      setHasNewNotifications(true);
      setIsAnimating(true);
      
      // Stop animation after 3 seconds
      setTimeout(() => {
        setHasNewNotifications(false);
        setIsAnimating(false);
      }, 3000);
    }
    previousCountRef.current = unreadCount;
  }, [unreadCount]);

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6', 
    lg: 'w-7 h-7'
  };

  const badgeSizeClasses = {
    sm: 'h-4 w-4 text-xs',
    md: 'h-5 w-5 text-xs',
    lg: 'h-6 w-6 text-sm'
  };

  const handleClick = () => {
    // Reset new notification indicator
    setHasNewNotifications(false);
    setIsAnimating(false);
    
    // Navigate to notification center
    navigate('/notifications');
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/notifications?tab=preferences');
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleClick}
        className={`
          relative p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
          transition-all duration-200
          ${isAnimating ? 'animate-pulse' : ''}
          ${hasNewNotifications ? 'text-blue-600' : ''}
        `}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      >
        {/* Bell icon - changes when there are notifications */}
        {unreadCount > 0 ? (
          <BellRing className={`${sizeClasses[size]} ${hasNewNotifications ? 'text-blue-600' : ''}`} />
        ) : (
          <Bell className={sizeClasses[size]} />
        )}
        
        {/* Notification count badge */}
        {unreadCount > 0 && (
          <div className={`
            absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium rounded-full 
            flex items-center justify-center font-mono z-10
            ${badgeSizeClasses[size]}
            ${isAnimating ? 'animate-bounce' : ''}
          `}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
        
        {/* Animated ping indicator for new notifications */}
        {hasNewNotifications && !unreadCount && (
          <div className={`
            absolute -top-1 -right-1 bg-blue-400 rounded-full animate-ping z-5
            ${badgeSizeClasses[size]}
          `} />
        )}
      </button>

      {/* Label for desktop */}
      {showLabel && (
        <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 mt-2 top-full">
          <div className="whitespace-nowrap text-center">
            <span className="text-xs text-gray-500 block">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-red-600 font-medium block">
                {unreadCount} new
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick settings button (appears on hover for larger sizes) */}
      {size === 'lg' && (
        <button
          onClick={handleSettingsClick}
          className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 group-hover:opacity-100"
          title="Notification settings"
        >
          <Settings className="w-2.5 h-2.5 text-gray-600" />
        </button>
      )}
    </div>
  );
}

export default NotificationBell;