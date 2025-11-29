import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  Moon, 
  Volume2,
  Save,
  X
} from 'lucide-react';
import { notificationService } from '../../services/notification.service';
import { toast } from 'react-hot-toast';

interface NotificationPreferencesProps {
  onClose?: () => void;
  standalone?: boolean;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ 
  onClose, 
  standalone = false 
}) => {
  const [preferences, setPreferences] = useState({
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: 'UTC',
    emailDigest: 'immediate' as 'immediate' | 'daily' | 'weekly' | 'never',
    maxDailyEmails: 20,
    soundEnabled: true,
    desktopEnabled: true,
    typePreferences: {} as Record<string, boolean>
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const notificationTypes = [
    { key: 'pitch_viewed', label: 'Pitch Views', category: 'Activity' },
    { key: 'pitch_liked', label: 'Pitch Likes', category: 'Activity' },
    { key: 'pitch_commented', label: 'Comments', category: 'Activity' },
    { key: 'nda_requested', label: 'NDA Requests', category: 'Business' },
    { key: 'nda_approved', label: 'NDA Approvals', category: 'Business' },
    { key: 'investment_received', label: 'Investments', category: 'Business' },
    { key: 'message_received', label: 'Messages', category: 'Communication' },
    { key: 'new_follower', label: 'New Followers', category: 'Social' },
    { key: 'system_announcement', label: 'System Updates', category: 'System' },
    { key: 'weekly_report', label: 'Weekly Reports', category: 'Analytics' }
  ];

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const data = await notificationService.getPreferences();
      setPreferences(prev => ({ ...prev, ...data }));
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await notificationService.updatePreferences(preferences);
      toast.success('Notification preferences saved');
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleTypeToggle = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      typePreferences: {
        ...prev.typePreferences,
        [type]: !prev.typePreferences[type]
      }
    }));
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPreferences(prev => ({ ...prev, desktopEnabled: true }));
        toast.success('Browser notifications enabled');
      } else {
        toast.error('Browser notification permission denied');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const content = (
    <div className="space-y-6">
      {/* Delivery Channels */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Delivery Channels</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <div>
                <div className="font-medium">In-App Notifications</div>
                <div className="text-sm text-gray-500">Notifications within the platform</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.inAppEnabled}
              onChange={(e) => setPreferences(prev => ({ ...prev, inAppEnabled: e.target.checked }))}
              className="h-5 w-5 text-blue-600"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-600" />
              <div>
                <div className="font-medium">Email Notifications</div>
                <div className="text-sm text-gray-500">Important updates via email</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.emailEnabled}
              onChange={(e) => setPreferences(prev => ({ ...prev, emailEnabled: e.target.checked }))}
              className="h-5 w-5 text-blue-600"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-gray-600" />
              <div>
                <div className="font-medium">Push Notifications</div>
                <div className="text-sm text-gray-500">Mobile and desktop push alerts</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.pushEnabled}
              onChange={(e) => setPreferences(prev => ({ ...prev, pushEnabled: e.target.checked }))}
              className="h-5 w-5 text-blue-600"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <div>
                <div className="font-medium">SMS Notifications</div>
                <div className="text-sm text-gray-500">Critical alerts via SMS</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.smsEnabled}
              onChange={(e) => setPreferences(prev => ({ ...prev, smsEnabled: e.target.checked }))}
              className="h-5 w-5 text-blue-600"
            />
          </label>
        </div>
      </div>

      {/* Email Frequency */}
      {preferences.emailEnabled && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Email Frequency</h3>
          <select
            value={preferences.emailDigest}
            onChange={(e) => setPreferences(prev => ({ 
              ...prev, 
              emailDigest: e.target.value as any 
            }))}
            className="w-full p-2 border rounded-lg"
          >
            <option value="immediate">Send immediately</option>
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly summary</option>
            <option value="never">Never send emails</option>
          </select>
          
          {preferences.emailDigest !== 'never' && (
            <div className="mt-3">
              <label className="text-sm text-gray-600">
                Max emails per day:
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={preferences.maxDailyEmails}
                  onChange={(e) => setPreferences(prev => ({ 
                    ...prev, 
                    maxDailyEmails: parseInt(e.target.value) 
                  }))}
                  className="ml-2 w-20 p-1 border rounded"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Quiet Hours */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quiet Hours</h3>
        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
          <div className="flex items-center gap-3">
            <Moon className="w-5 h-5 text-gray-600" />
            <div>
              <div className="font-medium">Enable Quiet Hours</div>
              <div className="text-sm text-gray-500">Pause notifications during specific hours</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={preferences.quietHoursEnabled}
            onChange={(e) => setPreferences(prev => ({ 
              ...prev, 
              quietHoursEnabled: e.target.checked 
            }))}
            className="h-5 w-5 text-blue-600"
          />
        </label>
        
        {preferences.quietHoursEnabled && (
          <div className="mt-3 flex items-center gap-3 ml-11">
            <input
              type="time"
              value={preferences.quietHoursStart}
              onChange={(e) => setPreferences(prev => ({ 
                ...prev, 
                quietHoursStart: e.target.value 
              }))}
              className="p-2 border rounded"
            />
            <span>to</span>
            <input
              type="time"
              value={preferences.quietHoursEnd}
              onChange={(e) => setPreferences(prev => ({ 
                ...prev, 
                quietHoursEnd: e.target.value 
              }))}
              className="p-2 border rounded"
            />
          </div>
        )}
      </div>

      {/* Sound Settings */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Sound & Desktop</h3>
        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-gray-600" />
            <div>
              <div className="font-medium">Notification Sounds</div>
              <div className="text-sm text-gray-500">Play sound for new notifications</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={preferences.soundEnabled}
            onChange={(e) => setPreferences(prev => ({ 
              ...prev, 
              soundEnabled: e.target.checked 
            }))}
            className="h-5 w-5 text-blue-600"
          />
        </label>

        <div className="mt-3">
          <button
            onClick={requestBrowserPermission}
            className="w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Browser Notifications</div>
                <div className="text-sm text-gray-500">
                  {Notification.permission === 'granted' 
                    ? 'Enabled - Click to test' 
                    : 'Click to enable desktop notifications'}
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                Notification.permission === 'granted' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {Notification.permission === 'granted' ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Notification Types */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Notification Types</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {notificationTypes.map(type => (
            <label
              key={type.key}
              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
            >
              <div>
                <div className="font-medium text-sm">{type.label}</div>
                <div className="text-xs text-gray-500">{type.category}</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.typePreferences[type.key] !== false}
                onChange={() => handleTypeToggle(type.key)}
                className="h-4 w-4 text-blue-600"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {!standalone && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );

  if (standalone) {
    return (
      <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Notification Preferences</h2>
          <p className="text-gray-600 mt-1">Manage how and when you receive notifications</p>
        </div>
        {content}
      </div>
    );
  }

  return content;
};