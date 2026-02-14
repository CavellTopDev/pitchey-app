import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Mail, Smartphone, Clock, Volume, VolumeX, 
  Save, X, MessageSquare, FileText, DollarSign, 
  Settings, User, Calendar
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { toast } from 'react-hot-toast';

interface NotificationPreference {
  id: string;
  title: string;
  description: string;
  email: boolean;
  inApp: boolean;
  push: boolean;
  sms: boolean;
}

interface NotificationSettings {
  pitchUpdates: NotificationPreference;
  messages: NotificationPreference;
  ndas: NotificationPreference;
  investments: NotificationPreference;
  marketing: NotificationPreference;
  security: NotificationPreference;
}

interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [settings, setSettings] = useState<NotificationSettings>({
    pitchUpdates: {
      id: 'pitchUpdates',
      title: 'Pitch Updates',
      description: 'When your pitches receive comments, views, or status changes',
      email: true,
      inApp: true,
      push: true,
      sms: false
    },
    messages: {
      id: 'messages',
      title: 'Messages & Chat',
      description: 'Direct messages, replies, and conversation updates',
      email: true,
      inApp: true,
      push: true,
      sms: false
    },
    ndas: {
      id: 'ndas',
      title: 'NDA Requests',
      description: 'NDA signatures, requests, and legal document updates',
      email: true,
      inApp: true,
      push: false,
      sms: false
    },
    investments: {
      id: 'investments',
      title: 'Investment Activity',
      description: 'Investment offers, funding updates, and financial activity',
      email: true,
      inApp: true,
      push: true,
      sms: true
    },
    marketing: {
      id: 'marketing',
      title: 'Marketing & Updates',
      description: 'Platform updates, feature announcements, and promotional content',
      email: false,
      inApp: false,
      push: false,
      sms: false
    },
    security: {
      id: 'security',
      title: 'Security Alerts',
      description: 'Login attempts, password changes, and security notifications',
      email: true,
      inApp: true,
      push: true,
      sms: true
    }
  });

  const [quietHours, setQuietHours] = useState<QuietHours>({
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'UTC-08:00'
  });

  const [frequency, setFrequency] = useState<'instant' | 'hourly' | 'daily' | 'weekly'>('instant');

  const updatePreference = (categoryId: string, channel: keyof Omit<NotificationPreference, 'id' | 'title' | 'description'>, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId as keyof NotificationSettings],
        [channel]: value
      }
    }));
    setHasChanges(true);
  };

  const handleQuietHoursChange = (field: keyof QuietHours, value: boolean | string) => {
    setQuietHours(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleFrequencyChange = (newFrequency: 'instant' | 'hourly' | 'daily' | 'weekly') => {
    setFrequency(newFrequency);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Notification settings updated successfully!');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    // Reset to default values
    setSettings({
      pitchUpdates: { id: 'pitchUpdates', title: 'Pitch Updates', description: 'When your pitches receive comments, views, or status changes', email: true, inApp: true, push: true, sms: false },
      messages: { id: 'messages', title: 'Messages & Chat', description: 'Direct messages, replies, and conversation updates', email: true, inApp: true, push: true, sms: false },
      ndas: { id: 'ndas', title: 'NDA Requests', description: 'NDA signatures, requests, and legal document updates', email: true, inApp: true, push: false, sms: false },
      investments: { id: 'investments', title: 'Investment Activity', description: 'Investment offers, funding updates, and financial activity', email: true, inApp: true, push: true, sms: true },
      marketing: { id: 'marketing', title: 'Marketing & Updates', description: 'Platform updates, feature announcements, and promotional content', email: false, inApp: false, push: false, sms: false },
      security: { id: 'security', title: 'Security Alerts', description: 'Login attempts, password changes, and security notifications', email: true, inApp: true, push: true, sms: true }
    });
    setQuietHours({ enabled: false, startTime: '22:00', endTime: '08:00', timezone: 'UTC-08:00' });
    setFrequency('instant');
    setHasChanges(true);
  };

  const ToggleSwitch = ({ enabled, onToggle, size = 'md' }: { enabled: boolean; onToggle: () => void; size?: 'sm' | 'md' }) => {
    const sizeClasses = size === 'sm' ? 'w-8 h-4' : 'w-11 h-6';
    const knobClasses = size === 'sm' ? 'w-3 h-3' : 'w-5 h-5';
    
    return (
      <button
        onClick={onToggle}
        className={`${sizeClasses} ${enabled ? 'bg-purple-600' : 'bg-gray-300'} rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white`}
      >
        <div
          className={`${knobClasses} bg-white rounded-full transition-transform ${
            enabled ? (size === 'sm' ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0.5'
          }`}
        />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <DashboardHeader
        user={user}
        userType={(user?.userType || 'creator') as 'creator' | 'investor' | 'production'}
        title="Notification Settings"
        onLogout={logout}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
            </div>
            <p className="mt-2 text-gray-600">Manage how and when you receive notifications</p>
          </div>

          <div className="p-6 space-y-8">
            {/* Notification Categories */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-6">Notification Types</h3>
              <div className="space-y-6">
                {Object.values(settings).map((preference) => (
                  <div key={preference.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{preference.title}</h4>
                        <p className="text-sm text-gray-600">{preference.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">Email</span>
                        </div>
                        <ToggleSwitch
                          enabled={preference.email}
                          onToggle={() => updatePreference(preference.id, 'email', !preference.email)}
                          size="sm"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">In-App</span>
                        </div>
                        <ToggleSwitch
                          enabled={preference.inApp}
                          onToggle={() => updatePreference(preference.id, 'inApp', !preference.inApp)}
                          size="sm"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">Push</span>
                        </div>
                        <ToggleSwitch
                          enabled={preference.push}
                          onToggle={() => updatePreference(preference.id, 'push', !preference.push)}
                          size="sm"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">SMS</span>
                        </div>
                        <ToggleSwitch
                          enabled={preference.sms}
                          onToggle={() => updatePreference(preference.id, 'sms', !preference.sms)}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notification Frequency */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Frequency</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'instant', label: 'Instant', icon: Bell },
                  { value: 'hourly', label: 'Hourly', icon: Clock },
                  { value: 'daily', label: 'Daily', icon: Calendar },
                  { value: 'weekly', label: 'Weekly', icon: Calendar }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleFrequencyChange(option.value as any)}
                    className={`p-3 rounded-lg border transition-colors ${
                      frequency === option.value
                        ? 'border-purple-500 bg-purple-50 text-purple-600'
                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <option.icon className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Quiet Hours</h3>
                  <p className="text-sm text-gray-600">Pause notifications during specific hours</p>
                </div>
                <ToggleSwitch
                  enabled={quietHours.enabled}
                  onToggle={() => handleQuietHoursChange('enabled', !quietHours.enabled)}
                />
              </div>
              
              {quietHours.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={quietHours.startTime}
                      onChange={(e) => handleQuietHoursChange('startTime', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                    <input
                      type="time"
                      value={quietHours.endTime}
                      onChange={(e) => handleQuietHoursChange('endTime', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                    <select
                      value={quietHours.timezone}
                      onChange={(e) => handleQuietHoursChange('timezone', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="UTC-08:00">Pacific Time (UTC-8)</option>
                      <option value="UTC-07:00">Mountain Time (UTC-7)</option>
                      <option value="UTC-06:00">Central Time (UTC-6)</option>
                      <option value="UTC-05:00">Eastern Time (UTC-5)</option>
                      <option value="UTC+00:00">GMT (UTC+0)</option>
                      <option value="UTC+01:00">Central European Time (UTC+1)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={loading || !hasChanges}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
              
              <button
                onClick={handleReset}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Reset to Defaults
              </button>
              
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}