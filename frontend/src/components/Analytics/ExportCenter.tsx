import React, { useState, useEffect } from 'react';
import {
  Download, FileText, Image, Table, Calendar, Clock, X, Check,
  Settings, Filter, Mail, Share2, Archive, RefreshCw, AlertCircle,
  CheckCircle, Info, Zap, Globe, BarChart3, PieChart, LineChart,
  Users, DollarSign, Eye, TrendingUp, Layout, Grid3X3, Layers,
  FileSpreadsheet, FilePdf, FileImage, FileJson, FileCode
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { toast } from 'react-hot-toast';
import { analyticsService } from '../../services/analytics.service';

// Export format definitions
interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  extensions: string[];
  supportsCharts: boolean;
  supportsScheduling: boolean;
  maxFileSize: string;
  features: string[];
}

// Export template definitions
interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  role: string[];
  sections: string[];
  defaultFormat: string;
  previewAvailable: boolean;
}

interface ExportCenterProps {
  data: any;
  config: any;
  onClose: () => void;
  onExport: (format: string) => Promise<void>;
}

// Available export formats
const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'pdf',
    name: 'PDF Report',
    description: 'Professional report with charts and formatting',
    icon: FilePdf,
    extensions: ['pdf'],
    supportsCharts: true,
    supportsScheduling: true,
    maxFileSize: '10MB',
    features: ['Charts', 'Branding', 'Multi-page', 'Print-ready']
  },
  {
    id: 'excel',
    name: 'Excel Workbook',
    description: 'Spreadsheet with data tables and pivot charts',
    icon: FileSpreadsheet,
    extensions: ['xlsx', 'xls'],
    supportsCharts: true,
    supportsScheduling: true,
    maxFileSize: '25MB',
    features: ['Formulas', 'Pivot tables', 'Charts', 'Multiple sheets']
  },
  {
    id: 'csv',
    name: 'CSV Data',
    description: 'Raw data export for external analysis',
    icon: Table,
    extensions: ['csv'],
    supportsCharts: false,
    supportsScheduling: true,
    maxFileSize: '50MB',
    features: ['Raw data', 'Universal compatibility', 'Lightweight']
  },
  {
    id: 'json',
    name: 'JSON Data',
    description: 'Structured data for API integration',
    icon: FileJson,
    extensions: ['json'],
    supportsCharts: false,
    supportsScheduling: false,
    maxFileSize: '100MB',
    features: ['API ready', 'Structured', 'Developer friendly']
  },
  {
    id: 'png',
    name: 'Chart Images',
    description: 'High-resolution chart visualizations',
    icon: FileImage,
    extensions: ['png', 'jpg', 'svg'],
    supportsCharts: true,
    supportsScheduling: false,
    maxFileSize: '5MB',
    features: ['High resolution', 'Multiple formats', 'Web ready']
  }
];

// Export templates
const EXPORT_TEMPLATES: ExportTemplate[] = [
  {
    id: 'executive_summary',
    name: 'Executive Summary',
    description: 'High-level overview for leadership',
    role: ['admin', 'production', 'investor'],
    sections: ['Overview', 'Key Metrics', 'Trends', 'Recommendations'],
    defaultFormat: 'pdf',
    previewAvailable: true
  },
  {
    id: 'creator_performance',
    name: 'Creator Performance Report',
    description: 'Detailed creator analytics and insights',
    role: ['creator'],
    sections: ['Content Performance', 'Audience Analytics', 'Engagement Trends', 'Revenue'],
    defaultFormat: 'pdf',
    previewAvailable: true
  },
  {
    id: 'investor_portfolio',
    name: 'Investment Portfolio Report',
    description: 'Portfolio performance and ROI analysis',
    role: ['investor'],
    sections: ['Portfolio Overview', 'ROI Analysis', 'Risk Assessment', 'Market Trends'],
    defaultFormat: 'pdf',
    previewAvailable: true
  },
  {
    id: 'production_dashboard',
    name: 'Production Analytics',
    description: 'Project and talent management insights',
    role: ['production'],
    sections: ['Project Status', 'Budget Analysis', 'Talent Performance', 'Revenue Tracking'],
    defaultFormat: 'excel',
    previewAvailable: true
  },
  {
    id: 'financial_summary',
    name: 'Financial Summary',
    description: 'Revenue, costs, and profitability analysis',
    role: ['admin', 'production', 'investor'],
    sections: ['Revenue Breakdown', 'Cost Analysis', 'Profit Margins', 'Forecasts'],
    defaultFormat: 'excel',
    previewAvailable: true
  },
  {
    id: 'raw_data',
    name: 'Raw Data Export',
    description: 'Complete dataset for custom analysis',
    role: ['admin'],
    sections: ['All Tables', 'Relationships', 'Metadata'],
    defaultFormat: 'csv',
    previewAvailable: false
  }
];

export default function ExportCenter({ data, config, onClose, onExport }: ExportCenterProps) {
  // State management
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customSections, setCustomSections] = useState<string[]>([]);
  const [exportOptions, setExportOptions] = useState({
    includeCharts: true,
    includeRawData: false,
    includeMetadata: true,
    highResolution: true,
    compress: false,
    watermark: false
  });
  
  // Date range for export
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
    preset: config.timeRange || 'month'
  });
  
  // Scheduling options
  const [scheduleExport, setScheduleExport] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: 'weekly',
    time: '09:00',
    day: '1', // Monday
    recipients: [''],
    autoDownload: true
  });
  
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportQueue, setExportQueue] = useState<string[]>([]);
  
  // Filter templates by role
  const availableTemplates = EXPORT_TEMPLATES.filter(template => 
    template.role.includes(config.role)
  );
  
  // Get selected format details
  const selectedFormatDetails = EXPORT_FORMATS.find(f => f.id === selectedFormat);
  
  // Get selected template details
  const selectedTemplateDetails = selectedTemplate 
    ? EXPORT_TEMPLATES.find(t => t.id === selectedTemplate)
    : null;
  
  // Set default template when component mounts
  useEffect(() => {
    if (availableTemplates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(availableTemplates[0].id);
    }
  }, [availableTemplates, selectedTemplate]);
  
  // Update format when template changes
  useEffect(() => {
    if (selectedTemplateDetails) {
      setSelectedFormat(selectedTemplateDetails.defaultFormat);
      setCustomSections(selectedTemplateDetails.sections);
    }
  }, [selectedTemplateDetails]);
  
  // Handle export
  const handleExport = async () => {
    if (!selectedFormatDetails) return;
    
    setExporting(true);
    setExportProgress(0);
    
    try {
      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);
      
      // Prepare export data
      const exportData = {
        format: selectedFormat,
        template: selectedTemplate,
        sections: customSections,
        options: exportOptions,
        dateRange,
        data: data,
        metadata: {
          generatedAt: new Date().toISOString(),
          role: config.role,
          layout: config.layout,
          timeRange: config.timeRange
        }
      };
      
      // Call export function
      await onExport(selectedFormat);
      
      // Complete progress
      clearInterval(progressInterval);
      setExportProgress(100);
      
      setTimeout(() => {
        setExporting(false);
        setExportProgress(0);
        toast.success(`Export completed successfully as ${selectedFormat.toUpperCase()}`);
      }, 500);
      
    } catch (error) {
      console.error('Export failed:', error);
      setExporting(false);
      setExportProgress(0);
      toast.error('Export failed. Please try again.');
    }
  };
  
  // Handle scheduled export
  const handleScheduleExport = async () => {
    try {
      const scheduleData = {
        type: scheduleConfig.frequency,
        format: selectedFormat,
        template: selectedTemplate,
        sections: customSections,
        options: exportOptions,
        recipients: scheduleConfig.recipients.filter(email => email.trim()),
        timeOfDay: scheduleConfig.time,
        dayOfWeek: scheduleConfig.frequency === 'weekly' ? parseInt(scheduleConfig.day) : undefined,
        dayOfMonth: scheduleConfig.frequency === 'monthly' ? parseInt(scheduleConfig.day) : undefined,
        autoDownload: scheduleConfig.autoDownload
      };
      
      const result = await analyticsService.scheduleReport(scheduleData);
      
      toast.success(`Export scheduled successfully. Next run: ${format(new Date(result.nextRun), 'PPpp')}`);
      onClose();
    } catch (error) {
      console.error('Schedule failed:', error);
      toast.error('Failed to schedule export. Please try again.');
    }
  };
  
  // Toggle section in custom export
  const toggleSection = (section: string) => {
    setCustomSections(prev => 
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };
  
  // Available sections for custom export
  const allSections = [
    'Overview', 'Key Metrics', 'Trends', 'Performance', 'Audience',
    'Geography', 'Technology', 'Financial', 'Recommendations',
    'Content Performance', 'Engagement', 'Revenue', 'ROI Analysis',
    'Risk Assessment', 'Market Trends', 'Project Status', 'Budget Analysis',
    'Talent Performance', 'Raw Data', 'Metadata', 'Appendix'
  ];
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Export Center</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Export your analytics data in various formats
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-8">
            {/* Template Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Template</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedTemplate === template.id
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.sections.map((section) => (
                            <span
                              key={section}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                            >
                              {section}
                            </span>
                          ))}
                        </div>
                      </div>
                      {template.previewAvailable && (
                        <button className="text-blue-600 hover:text-blue-700 text-sm">
                          Preview
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Format Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Format</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {EXPORT_FORMATS.map((format) => {
                  const Icon = format.icon;
                  return (
                    <div
                      key={format.id}
                      onClick={() => setSelectedFormat(format.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedFormat === format.id
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="w-5 h-5 text-gray-700" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{format.name}</h4>
                          <p className="text-sm text-gray-600">{format.description}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Max size:</span>
                          <span className="font-medium">{format.maxFileSize}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          {format.features.map((feature) => (
                            <span
                              key={feature}
                              className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Custom Sections */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sections to Include</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {allSections.map((section) => (
                  <label key={section} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customSections.includes(section)}
                      onChange={() => toggleSection(section)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{section}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Export Options */}
            {selectedFormatDetails && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedFormatDetails.supportsCharts && (
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeCharts}
                        onChange={(e) => setExportOptions(prev => ({
                          ...prev,
                          includeCharts: e.target.checked
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-medium text-gray-900">Include Charts</span>
                        <p className="text-sm text-gray-600">Add visual charts and graphs</p>
                      </div>
                    </label>
                  )}
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeRawData}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        includeRawData: e.target.checked
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Include Raw Data</span>
                      <p className="text-sm text-gray-600">Add underlying data tables</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeMetadata}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        includeMetadata: e.target.checked
                      }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Include Metadata</span>
                      <p className="text-sm text-gray-600">Add generation info and filters</p>
                    </div>
                  </label>
                  
                  {selectedFormat === 'png' && (
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportOptions.highResolution}
                        onChange={(e) => setExportOptions(prev => ({
                          ...prev,
                          highResolution: e.target.checked
                        }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-medium text-gray-900">High Resolution</span>
                        <p className="text-sm text-gray-600">Export at 300 DPI for print</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            )}
            
            {/* Date Range */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quick Select
                  </label>
                  <select
                    value={dateRange.preset}
                    onChange={(e) => {
                      const preset = e.target.value;
                      setDateRange(prev => ({ ...prev, preset }));
                      
                      // Update dates based on preset
                      const now = new Date();
                      let start: Date;
                      
                      switch (preset) {
                        case 'today':
                          start = now;
                          break;
                        case 'week':
                          start = subDays(now, 7);
                          break;
                        case 'month':
                          start = subDays(now, 30);
                          break;
                        case 'quarter':
                          start = subDays(now, 90);
                          break;
                        case 'year':
                          start = subDays(now, 365);
                          break;
                        default:
                          return;
                      }
                      
                      setDateRange(prev => ({
                        ...prev,
                        start: start.toISOString().split('T')[0],
                        end: now.toISOString().split('T')[0]
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="today">Today</option>
                    <option value="week">Last 7 days</option>
                    <option value="month">Last 30 days</option>
                    <option value="quarter">Last 90 days</option>
                    <option value="year">Last year</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Schedule Export */}
            {selectedFormatDetails?.supportsScheduling && (
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    id="schedule-export"
                    checked={scheduleExport}
                    onChange={(e) => setScheduleExport(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="schedule-export" className="text-lg font-semibold text-gray-900">
                    Schedule Recurring Export
                  </label>
                </div>
                
                {scheduleExport && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-blue-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Frequency
                      </label>
                      <select
                        value={scheduleConfig.frequency}
                        onChange={(e) => setScheduleConfig(prev => ({
                          ...prev,
                          frequency: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={scheduleConfig.time}
                        onChange={(e) => setScheduleConfig(prev => ({
                          ...prev,
                          time: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    {scheduleConfig.frequency === 'weekly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day of Week
                        </label>
                        <select
                          value={scheduleConfig.day}
                          onChange={(e) => setScheduleConfig(prev => ({
                            ...prev,
                            day: e.target.value
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                          <option value="0">Sunday</option>
                        </select>
                      </div>
                    )}
                    
                    {scheduleConfig.frequency === 'monthly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day of Month
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={scheduleConfig.day}
                          onChange={(e) => setScheduleConfig(prev => ({
                            ...prev,
                            day: e.target.value
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Recipients (comma separated)
                      </label>
                      <input
                        type="email"
                        multiple
                        value={scheduleConfig.recipients.join(', ')}
                        onChange={(e) => setScheduleConfig(prev => ({
                          ...prev,
                          recipients: e.target.value.split(',').map(email => email.trim())
                        }))}
                        placeholder="user@example.com, team@example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            {exporting ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Generating export...</span>
                  <span className="font-medium">{exportProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Export will include {customSections.length} sections as {selectedFormat.toUpperCase()}
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  
                  {scheduleExport ? (
                    <button
                      onClick={handleScheduleExport}
                      disabled={scheduleConfig.recipients.filter(email => email.trim()).length === 0}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Schedule Export</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleExport}
                      disabled={customSections.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Now</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}