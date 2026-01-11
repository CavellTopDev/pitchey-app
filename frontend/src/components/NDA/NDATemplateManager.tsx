import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Download,
  Upload,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  Eye,
  Star,
  Settings,
  Search
} from 'lucide-react';
import { useToast } from '../Toast/ToastProvider';
import { ndaService } from '../../services/nda.service';

interface NDATemplate {
  id: number;
  name: string;
  description: string;
  content: string;
  variables: string[];
  isDefault: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

interface NDATemplateManagerProps {
  userId: number;
  onTemplateSelect?: (template: NDATemplate) => void;
  readonly?: boolean;
}

interface TemplateFormData {
  name: string;
  description: string;
  content: string;
  variables: string[];
  isDefault: boolean;
}

const DEFAULT_TEMPLATE_CONTENT = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on [DATE] between:

DISCLOSING PARTY: [CREATOR_NAME]
RECEIVING PARTY: [REQUESTER_NAME]

PROJECT: "[PITCH_TITLE]"

1. CONFIDENTIAL INFORMATION
All information disclosed in relation to the above project, including but not limited to creative concepts, treatments, scripts, financial projections, production timelines, business plans, distribution strategies, talent attachments, and deal structures.

2. OBLIGATIONS
The Receiving Party agrees to:
• Keep all information strictly confidential
• Use information solely for evaluation purposes
• Not disclose to any third parties without prior written consent
• Return or destroy all confidential materials upon request

3. TERM
This agreement shall remain in effect for [TERM_LENGTH] years from the date of signature.

4. EXCEPTIONS
This agreement does not apply to information that:
• Is already publicly available
• Was known prior to disclosure
• Is independently developed
• Is required to be disclosed by law

5. REMEDIES
Breach of this agreement may result in irreparable harm, and the Disclosing Party shall be entitled to seek injunctive relief and monetary damages.

By signing below, both parties acknowledge they have read, understood, and agree to be bound by the terms of this agreement.

DISCLOSING PARTY: ___________________    DATE: _________
[CREATOR_NAME]

RECEIVING PARTY: ____________________    DATE: _________
[REQUESTER_NAME]`;

export default function NDATemplateManager({
  userId,
  onTemplateSelect,
  readonly = false
}: NDATemplateManagerProps) {
  const [templates, setTemplates] = useState<NDATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NDATemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<NDATemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    content: '',
    variables: [],
    isDefault: false
  });

  const { success, error } = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await ndaService.getNDATemplates();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      error('Loading Failed', 'Unable to load NDA templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const detectVariables = (content: string): string[] => {
    const variablePattern = /\[([A-Z_][A-Z0-9_]*)\]/g;
    const matches = content.match(variablePattern);
    return matches ? [...new Set(matches.map(match => match.slice(1, -1)))] : [];
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      content: DEFAULT_TEMPLATE_CONTENT,
      variables: detectVariables(DEFAULT_TEMPLATE_CONTENT),
      isDefault: false
    });
    setShowEditor(true);
  };

  const handleEditTemplate = (template: NDATemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      content: template.content,
      variables: template.variables,
      isDefault: template.isDefault
    });
    setShowEditor(true);
  };

  const handleCloneTemplate = (template: NDATemplate) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description,
      content: template.content,
      variables: template.variables,
      isDefault: false
    });
    setShowEditor(true);
  };

  const handleDeleteTemplate = async (template: NDATemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      await ndaService.deleteNDATemplate(template.id);
      await loadTemplates();
      success('Template Deleted', 'The NDA template has been deleted successfully.');
    } catch (err) {
      error('Deletion Failed', 'Unable to delete template. Please try again.');
    }
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      error('Validation Error', 'Please provide both name and content for the template.');
      return;
    }

    try {
      const templateData = {
        ...formData,
        variables: detectVariables(formData.content)
      };

      if (editingTemplate) {
        await ndaService.updateNDATemplate(editingTemplate.id, templateData);
        success('Template Updated', 'The NDA template has been updated successfully.');
      } else {
        await ndaService.createNDATemplate(templateData);
        success('Template Created', 'The NDA template has been created successfully.');
      }

      await loadTemplates();
      setShowEditor(false);
    } catch (err) {
      error('Save Failed', 'Unable to save template. Please try again.');
    }
  };

  const handlePreview = (template: NDATemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleDownloadTemplate = (template: NDATemplate) => {
    const blob = new Blob([template.content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleContentChange = (content: string) => {
    setFormData(prev => ({
      ...prev,
      content,
      variables: detectVariables(content)
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">NDA Template Manager</h1>
            <p className="text-gray-500">
              {readonly 
                ? 'Browse and preview available NDA templates'
                : 'Create and manage your custom NDA templates'
              }
            </p>
          </div>
        </div>

        {!readonly && (
          <button
            onClick={handleCreateTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
        />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                {template.isDefault && (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePreview(template)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Preview template"
                >
                  <Eye className="w-4 h-4 text-gray-500" />
                </button>
                
                {!readonly && (
                  <>
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Edit template"
                    >
                      <Edit3 className="w-4 h-4 text-gray-500" />
                    </button>
                    
                    <button
                      onClick={() => handleCloneTemplate(template)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Clone template"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                    
                    {!template.isDefault && (
                      <button
                        onClick={() => handleDeleteTemplate(template)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Delete template"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </>
                )}
                
                <button
                  onClick={() => handleDownloadTemplate(template)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Download template"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.description}</p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Settings className="w-3 h-3" />
                <span>{template.variables.length} variables</span>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {template.variables.slice(0, 3).map((variable) => (
                  <span
                    key={variable}
                    className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {variable}
                  </span>
                ))}
                {template.variables.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                    +{template.variables.length - 3}
                  </span>
                )}
              </div>
            </div>

            {onTemplateSelect && (
              <button
                onClick={() => onTemplateSelect(template)}
                className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Select Template
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && !loading && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No matching templates' : 'No templates found'}
          </h3>
          <p className="text-gray-500">
            {searchTerm 
              ? 'Try adjusting your search terms.'
              : readonly 
                ? 'No templates are available yet.'
                : 'Create your first NDA template to get started.'
            }
          </p>
        </div>
      )}

      {/* Template Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Editor Header */}
            <div className="p-6 border-b bg-purple-50">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </h3>
                <button
                  onClick={() => setShowEditor(false)}
                  className="p-2 hover:bg-purple-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Template Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Film Industry Standard NDA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this template"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Make this the default template</span>
                </label>
              </div>

              {/* Content Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Content *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  rows={20}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                  placeholder="Enter your NDA template content here..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use square brackets for variables like [CREATOR_NAME], [REQUESTER_NAME], [PITCH_TITLE], etc.
                </p>
              </div>

              {/* Detected Variables */}
              {formData.variables.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Detected Variables ({formData.variables.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {formData.variables.map((variable) => (
                      <span
                        key={variable}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Editor Footer */}
            <div className="p-6 border-t bg-gray-50 flex justify-between">
              <button
                onClick={() => setShowEditor(false)}
                className="px-6 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Save className="w-4 h-4" />
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Preview Header */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 rounded-lg p-6 font-mono text-sm leading-relaxed whitespace-pre-line">
                {selectedTemplate.content}
              </div>
            </div>

            {/* Preview Footer */}
            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{selectedTemplate.variables.length} variables</span>
                <span>•</span>
                <span>Created {new Date(selectedTemplate.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDownloadTemplate(selectedTemplate)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                {onTemplateSelect && (
                  <button
                    onClick={() => {
                      onTemplateSelect(selectedTemplate);
                      setShowPreview(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Select Template
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}