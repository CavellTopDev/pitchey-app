/**
 * Privacy Settings Component
 * User interface for managing data subject rights and privacy preferences
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, Download, Trash2, Edit, Eye, Lock, 
  UserX, Settings, AlertTriangle, CheckCircle, 
  Clock, FileText, Mail, Globe, Cookie
} from 'lucide-react';

interface ConsentStatus {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface DataSubjectRequest {
  id: string;
  requestType: string;
  status: string;
  requestDate: string;
  description: string;
}

const PrivacySettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'consents' | 'rights' | 'requests' | 'export'>('consents');
  const [consents, setConsents] = useState<ConsentStatus>({
    essential: true,
    functional: false,
    analytics: false,
    marketing: false
  });
  const [requests, setRequests] = useState<DataSubjectRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState<string | null>(null);

  useEffect(() => {
    loadConsentStatus();
    loadUserRequests();
  }, []);

  const loadConsentStatus = async () => {
    try {
      const response = await fetch('/api/gdpr/consent', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      
      if (data.consents) {
        const status: ConsentStatus = {
          essential: true, // Always true
          functional: data.consents.functional?.status === 'granted',
          analytics: data.consents.analytics?.status === 'granted',
          marketing: data.consents.marketing?.status === 'granted'
        };
        setConsents(status);
      }
    } catch (error) {
      console.error('Error loading consent status:', error);
    }
  };

  const loadUserRequests = async () => {
    try {
      const response = await fetch('/api/gdpr/requests', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading user requests:', error);
    }
  };

  const updateConsent = async (consentType: keyof ConsentStatus, granted: boolean) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/gdpr/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          consents: { [consentType]: granted },
          source: 'settings'
        })
      });

      if (response.ok) {
        setConsents(prev => ({ ...prev, [consentType]: granted }));
      }
    } catch (error) {
      console.error('Error updating consent:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitDataRequest = async (requestType: string, description: string, additionalData: any = {}) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/gdpr/requests/${requestType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          description,
          ...additionalData
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`${requestType} request submitted successfully. Request ID: ${result.requestId}`);
        setShowRequestForm(null);
        loadUserRequests(); // Refresh requests list
      } else {
        alert('Error submitting request: ' + result.error);
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Error submitting request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'pending': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'rejected': return <UserX className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const renderConsentManagement = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Your Privacy Preferences</h3>
            <p className="text-sm text-blue-700">
              Control how your data is used. You can change these preferences at any time. 
              Essential cookies are always enabled to ensure platform functionality.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Essential Cookies */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 mb-1">
                  Essential Cookies
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded ml-2">
                    Always Active
                  </span>
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Required for basic platform functionality including authentication and security.
                </p>
                <p className="text-xs text-gray-500">
                  Examples: Login sessions, security tokens, platform core features
                </p>
              </div>
            </div>
            <div className="w-11 h-6 bg-gray-400 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow"></div>
            </div>
          </div>
        </div>

        {/* Functional Cookies */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Functional Cookies</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Enable personalized features like language preferences and dashboard customization.
                </p>
                <p className="text-xs text-gray-500">
                  Examples: Theme settings, language choice, saved preferences
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consents.functional}
                onChange={(e) => updateConsent('functional', e.target.checked)}
                disabled={loading}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Analytics Cookies */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Analytics Cookies</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Help us understand platform usage to improve features and user experience.
                </p>
                <p className="text-xs text-gray-500">
                  Examples: Page views, feature usage, performance metrics (anonymized)
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consents.analytics}
                onChange={(e) => updateConsent('analytics', e.target.checked)}
                disabled={loading}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Marketing Cookies */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Marketing Cookies</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Enable personalized content and relevant communications based on your interests.
                </p>
                <p className="text-xs text-gray-500">
                  Examples: Email campaigns, personalized content, relevant feature suggestions
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consents.marketing}
                onChange={(e) => updateConsent('marketing', e.target.checked)}
                disabled={loading}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDataRights = () => (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-green-900 mb-1">Your Data Rights</h3>
            <p className="text-sm text-green-700">
              Under GDPR, you have several rights regarding your personal data. 
              Click any option below to exercise these rights.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Access Request */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
             onClick={() => setShowRequestForm('access')}>
          <div className="flex items-center gap-3 mb-2">
            <Eye className="h-5 w-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Access My Data</h4>
          </div>
          <p className="text-sm text-gray-600">
            Download a copy of all personal data we have about you in a portable format.
          </p>
        </div>

        {/* Rectification Request */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
             onClick={() => setShowRequestForm('rectification')}>
          <div className="flex items-center gap-3 mb-2">
            <Edit className="h-5 w-5 text-green-600" />
            <h4 className="font-medium text-gray-900">Correct My Data</h4>
          </div>
          <p className="text-sm text-gray-600">
            Request correction of inaccurate or incomplete personal data.
          </p>
        </div>

        {/* Erasure Request */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-red-300 transition-colors cursor-pointer"
             onClick={() => setShowRequestForm('erasure')}>
          <div className="flex items-center gap-3 mb-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h4 className="font-medium text-gray-900">Delete My Data</h4>
          </div>
          <p className="text-sm text-gray-600">
            Request deletion of your personal data (right to be forgotten).
          </p>
        </div>

        {/* Portability Request */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
             onClick={() => setShowRequestForm('portability')}>
          <div className="flex items-center gap-3 mb-2">
            <Download className="h-5 w-5 text-purple-600" />
            <h4 className="font-medium text-gray-900">Export My Data</h4>
          </div>
          <p className="text-sm text-gray-600">
            Get your data in a structured format to transfer to another service.
          </p>
        </div>

        {/* Restriction Request */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
             onClick={() => setShowRequestForm('restriction')}>
          <div className="flex items-center gap-3 mb-2">
            <Lock className="h-5 w-5 text-orange-600" />
            <h4 className="font-medium text-gray-900">Restrict Processing</h4>
          </div>
          <p className="text-sm text-gray-600">
            Limit how we process your personal data while keeping your account active.
          </p>
        </div>

        {/* Objection Request */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
             onClick={() => setShowRequestForm('objection')}>
          <div className="flex items-center gap-3 mb-2">
            <UserX className="h-5 w-5 text-red-600" />
            <h4 className="font-medium text-gray-900">Object to Processing</h4>
          </div>
          <p className="text-sm text-gray-600">
            Object to specific types of data processing based on legitimate interests.
          </p>
        </div>
      </div>
    </div>
  );

  const renderRequests = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Your Data Requests</h3>
          <p className="text-sm text-gray-500 mt-1">Track the status of your privacy requests</p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {requests.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No data requests submitted yet</p>
            </div>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 capitalize">
                      {request.requestType} Request
                    </h4>
                    <p className="text-sm text-gray-600">{request.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Submitted: {new Date(request.requestDate).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getStatusIcon(request.status)}
                    <span className="text-sm text-gray-900 capitalize">{request.status}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderRequestForm = () => {
    if (!showRequestForm) return null;

    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (description.trim()) {
        submitDataRequest(showRequestForm, description.trim());
        setDescription('');
      }
    };

    const requestInfo = {
      access: {
        title: 'Request Data Access',
        description: 'We will compile all your personal data and provide it in a downloadable format within 30 days.',
        icon: Eye
      },
      rectification: {
        title: 'Request Data Correction',
        description: 'Describe what information needs to be corrected and provide the accurate details.',
        icon: Edit
      },
      erasure: {
        title: 'Request Data Deletion',
        description: 'Request permanent deletion of your personal data. This action cannot be undone.',
        icon: Trash2
      },
      portability: {
        title: 'Request Data Export',
        description: 'Get your data in a structured format for transfer to another service provider.',
        icon: Download
      },
      restriction: {
        title: 'Request Processing Restriction',
        description: 'Temporarily limit how we process your data while keeping your account active.',
        icon: Lock
      },
      objection: {
        title: 'Object to Data Processing',
        description: 'Object to specific types of data processing based on our legitimate interests.',
        icon: UserX
      }
    };

    const info = requestInfo[showRequestForm as keyof typeof requestInfo];
    const Icon = info.icon;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <Icon className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">{info.title}</h3>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">{info.description}</p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Please describe your request:
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Provide details about your request..."
                required
              />
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowRequestForm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !description.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Settings</h1>
        <p className="text-gray-600">Manage your data privacy preferences and exercise your rights</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'consents', label: 'Cookie Preferences', icon: Cookie },
            { key: 'rights', label: 'Data Rights', icon: Shield },
            { key: 'requests', label: 'Request History', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'consents' && renderConsentManagement()}
      {activeTab === 'rights' && renderDataRights()}
      {activeTab === 'requests' && renderRequests()}

      {/* Request Form Modal */}
      {renderRequestForm()}
    </div>
  );
};

export default PrivacySettings;