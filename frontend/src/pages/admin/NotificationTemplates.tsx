import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Eye, 
  Save,
  X,
  Code,
  Mail,
  Bell,
  Smartphone,
  Globe
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../services/api';

interface NotificationTemplate {
  id: number;
  type: string;
  channel: 'in_app' | 'email' | 'push' | 'sms' | 'webhook';
  locale: string;
  titleTemplate: string;
  bodyTemplate: string;
  variables: string[];
  metadata: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const NotificationTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [previewData, setPreviewData] = useState<Record<string, string>>({});

  // Notification types
  const notificationTypes = [
    'pitch_viewed', 'pitch_liked', 'pitch_saved', 'pitch_commented',
    'nda_requested', 'nda_approved', 'nda_rejected', 'nda_signed',
    'investment_received', 'message_received', 'new_follower',
    'system_announcement', 'weekly_report'
  ];

  // Channel configurations
  const channels = [
    { value: 'in_app', label: 'In-App', icon: Bell, color: 'blue' },
    { value: 'email', label: 'Email', icon: Mail, color: 'green' },
    { value: 'push', label: 'Push', icon: Smartphone, color: 'purple' },
    { value: 'sms', label: 'SMS', icon: Smartphone, color: 'orange' },
    { value: 'webhook', label: 'Webhook', icon: Globe, color: 'gray' }
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/admin/notification-templates');
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        toast.error('Failed to fetch templates');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Error loading templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (template: Partial<NotificationTemplate>) => {
    try {
      const endpoint = template.id 
        ? `/api/admin/notification-templates/${template.id}`
        : '/api/admin/notification-templates';
      
      const method = template.id ? 'PUT' : 'POST';
      
      const response = await apiClient[method.toLowerCase()](endpoint, template);
      
      if (response.ok) {
        toast.success(template.id ? 'Template updated' : 'Template created');
        fetchTemplates();
        setIsEditing(false);
        setIsCreating(false);
        setSelectedTemplate(null);
      } else {
        toast.error('Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Error saving template');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    
    try {
      const response = await apiClient.delete(`/api/admin/notification-templates/${id}`);
      
      if (response.ok) {
        toast.success('Template deleted');
        fetchTemplates();
      } else {
        toast.error('Failed to delete template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Error deleting template');
    }
  };

  const handleDuplicateTemplate = async (template: NotificationTemplate) => {
    const duplicate = {
      ...template,
      id: undefined,
      titleTemplate: `${template.titleTemplate} (Copy)`,
      isActive: false
    };
    
    handleSaveTemplate(duplicate);
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  };

  const previewTemplate = (template: NotificationTemplate) => {
    let title = template.titleTemplate;
    let body = template.bodyTemplate;
    
    Object.entries(previewData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      title = title.replace(regex, value);
      body = body.replace(regex, value);
    });
    
    return { title, body };
  };

  const filteredTemplates = templates.filter(template => {
    if (filterChannel !== 'all' && template.channel !== filterChannel) return false;
    if (filterType !== 'all' && template.type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.titleTemplate.toLowerCase().includes(query) ||
        template.bodyTemplate.toLowerCase().includes(query) ||
        template.type.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getChannelIcon = (channel: string) => {
    const config = channels.find(c => c.value === channel);
    const Icon = config?.icon || Bell;
    return <Icon className="w-4 h-4" />;
  };

  const getChannelColor = (channel: string) => {
    const config = channels.find(c => c.value === channel);
    return config?.color || 'gray';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notification Templates</h1>
            <p className="text-gray-600 mt-1">Manage notification templates across all channels</p>
          </div>
          <button
            onClick={() => {
              setIsCreating(true);
              setSelectedTemplate({
                id: 0,
                type: notificationTypes[0],
                channel: 'in_app',
                locale: 'en',
                titleTemplate: '',
                bodyTemplate: '',
                variables: [],
                metadata: {},
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg"
          />
          
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Channels</option>
            {channels.map(channel => (
              <option key={channel.value} value={channel.value}>
                {channel.label}
              </option>
            ))}
          </select>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Types</option>
            {notificationTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No templates found</h3>
          <p className="text-gray-600">Create your first template to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              {/* Template Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`p-2 bg-${getChannelColor(template.channel)}-100 rounded-lg`}>
                    {getChannelIcon(template.channel)}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {template.type.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-sm text-gray-500">{template.locale}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  template.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {template.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Template Content Preview */}
              <div className="mb-4">
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-700">Title:</p>
                  <p className="text-sm text-gray-600 truncate">{template.titleTemplate}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Body:</p>
                  <p className="text-sm text-gray-600 line-clamp-2">{template.bodyTemplate}</p>
                </div>
              </div>

              {/* Variables */}
              {template.variables.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Variables:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.variables.map(variable => (
                      <span
                        key={variable}
                        className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setIsEditing(false);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setIsEditing(true);
                  }}
                  className="p-2 text-gray-600 hover:text-blue-600"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDuplicateTemplate(template)}
                  className="p-2 text-gray-600 hover:text-green-600"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="p-2 text-gray-600 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {(isEditing || isCreating) && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {isCreating ? 'Create Template' : 'Edit Template'}
                </h2>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setIsCreating(false);
                    setSelectedTemplate(null);
                  }}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notification Type
                  </label>
                  <select
                    value={selectedTemplate.type}
                    onChange={(e) => setSelectedTemplate({
                      ...selectedTemplate,
                      type: e.target.value
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {notificationTypes.map(type => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Channel */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Channel
                  </label>
                  <select
                    value={selectedTemplate.channel}
                    onChange={(e) => setSelectedTemplate({
                      ...selectedTemplate,
                      channel: e.target.value as any
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {channels.map(channel => (
                      <option key={channel.value} value={channel.value}>
                        {channel.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Locale */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Locale
                  </label>
                  <input
                    type="text"
                    value={selectedTemplate.locale}
                    onChange={(e) => setSelectedTemplate({
                      ...selectedTemplate,
                      locale: e.target.value
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="en, es, fr, etc."
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={selectedTemplate.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setSelectedTemplate({
                      ...selectedTemplate,
                      isActive: e.target.value === 'active'
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Title Template */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title Template
                </label>
                <input
                  type="text"
                  value={selectedTemplate.titleTemplate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedTemplate({
                      ...selectedTemplate,
                      titleTemplate: value,
                      variables: extractVariables(value + ' ' + selectedTemplate.bodyTemplate)
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  placeholder="New message from {{senderName}}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use {'{{variableName}}'} for dynamic content
                </p>
              </div>

              {/* Body Template */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body Template
                </label>
                <textarea
                  value={selectedTemplate.bodyTemplate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedTemplate({
                      ...selectedTemplate,
                      bodyTemplate: value,
                      variables: extractVariables(selectedTemplate.titleTemplate + ' ' + value)
                    });
                  }}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  placeholder="{{senderName}} sent you a message: {{messagePreview}}"
                />
              </div>

              {/* Variables Preview */}
              {selectedTemplate.variables.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Detected Variables
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map(variable => (
                      <div key={variable} className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {variable}
                        </span>
                        <input
                          type="text"
                          placeholder={`Test value for ${variable}`}
                          value={previewData[variable] || ''}
                          onChange={(e) => setPreviewData({
                            ...previewData,
                            [variable]: e.target.value
                          })}
                          className="px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Preview */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Live Preview</h3>
                <div className="bg-white p-4 rounded border">
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">Title:</p>
                    <p className="font-semibold">
                      {previewTemplate(selectedTemplate).title || 'Enter title template...'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Body:</p>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {previewTemplate(selectedTemplate).body || 'Enter body template...'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setIsCreating(false);
                    setSelectedTemplate(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveTemplate(selectedTemplate)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isCreating ? 'Create' : 'Save'} Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedTemplate && !isEditing && !isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Template Preview</h2>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`p-2 bg-${getChannelColor(selectedTemplate.channel)}-100 rounded-lg`}>
                    {getChannelIcon(selectedTemplate.channel)}
                  </span>
                  <div>
                    <p className="font-semibold">{selectedTemplate.type.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-gray-500">
                      {selectedTemplate.channel} • {selectedTemplate.locale}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Title Template:</p>
                    <code className="block p-3 bg-gray-100 rounded text-sm">
                      {selectedTemplate.titleTemplate}
                    </code>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Body Template:</p>
                    <code className="block p-3 bg-gray-100 rounded text-sm whitespace-pre-wrap">
                      {selectedTemplate.bodyTemplate}
                    </code>
                  </div>

                  {selectedTemplate.variables.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Variables:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.variables.map(variable => (
                          <span
                            key={variable}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                          >
                            {'{{'}{variable}{'}}'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsEditing(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};