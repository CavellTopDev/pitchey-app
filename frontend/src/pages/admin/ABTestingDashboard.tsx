// Admin Dashboard for A/B Testing Management
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  Pause, 
  CheckCircle, 
  BarChart3, 
  Settings,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

// Types
interface Experiment {
  id: number;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  startDate?: string;
  endDate?: string;
  trafficAllocation: string;
  variants: any[];
  primaryMetric: string;
  tags: string[];
  createdAt: string;
  createdBy?: number;
}

interface ExperimentResult {
  id: number;
  experimentId: number;
  status: 'calculating' | 'ready' | 'significant' | 'inconclusive';
  totalParticipants: number;
  variantSampleSizes: Record<string, number>;
  conversionRates: Record<string, number>;
  pValue?: string;
  isStatisticallySignificant: boolean;
  winningVariant?: string;
  liftPercentage?: string;
  recommendation?: string;
  confidence: string;
  calculatedAt: string;
}

const ABTestingDashboard: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch experiments
  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (selectedStatus !== 'all') {
        queryParams.append('status', selectedStatus);
      }

    const response = await fetch(`${config.API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error('Failed to fetch experiments');

      const result = await response.json();
      setExperiments(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch experiments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, [selectedStatus]);

  // Filter experiments based on search term
  const filteredExperiments = experiments.filter(exp =>
    exp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle experiment actions
  const handleExperimentAction = async (experimentId: number, action: string, reason?: string) => {
    try {
    const response = await fetch(`${config.API_URL}/api/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: reason ? JSON.stringify({ reason }) : undefined,
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) throw new Error(`Failed to ${action} experiment`);

      // Refresh experiments list
      fetchExperiments();
    } catch (err) {
      console.error(`Error ${action} experiment:`, err);
      alert(`Failed to ${action} experiment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">A/B Testing Dashboard</h1>
        <p className="text-gray-600">Manage and analyze your experiments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-md">
              <BarChart3 className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Experiments</h3>
              <p className="text-2xl font-semibold text-gray-900">{experiments.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-md">
              <Play className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Active</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {experiments.filter(e => e.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-md">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Completed</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {experiments.filter(e => e.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-md">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Significant Results</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {/* This would need to be calculated from results */}
                0
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search experiments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Experiment
            </button>
          </div>
        </div>
      </div>

      {/* Experiments Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredExperiments.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              onAction={handleExperimentAction}
            />
          ))}
        </ul>

        {filteredExperiments.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No experiments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new experiment.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Modal (placeholder) */}
      {showCreateModal && (
        <CreateExperimentModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};

// Individual experiment card component
interface ExperimentCardProps {
  experiment: Experiment;
  onAction: (experimentId: number, action: string, reason?: string) => Promise<void>;
}

const ExperimentCard: React.FC<ExperimentCardProps> = ({ experiment, onAction }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [results, setResults] = useState<ExperimentResult | null>(null);

  const fetchResults = async () => {
    try {
    const response = await fetch(`${config.API_URL}/api/admin`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        const result = await response.json();
        setResults(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch results:', err);
    }
  };

  useEffect(() => {
    if (showDetails && experiment.status === 'active' || experiment.status === 'completed') {
      fetchResults();
    }
  }, [showDetails, experiment.status, experiment.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const canStart = experiment.status === 'draft' || experiment.status === 'paused';
  const canPause = experiment.status === 'active';
  const canComplete = experiment.status === 'active' || experiment.status === 'paused';

  return (
    <li>
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(experiment.status)}`}>
                {experiment.status}
              </span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">{experiment.name}</h3>
              <p className="text-sm text-gray-500">{experiment.description}</p>
              <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                <span>Metric: {experiment.primaryMetric}</span>
                <span>Traffic: {(parseFloat(experiment.trafficAllocation) * 100).toFixed(1)}%</span>
                <span>Variants: {experiment.variants.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {results && results.isStatisticallySignificant && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Significant
              </span>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
            >
              <Eye className="h-4 w-4" />
            </button>

            {canStart && (
              <button
                onClick={() => onAction(experiment.id, 'start')}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Play className="h-3 w-3 mr-1" />
                Start
              </button>
            )}

            {canPause && (
              <button
                onClick={() => onAction(experiment.id, 'pause')}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </button>
            )}

            {canComplete && (
              <button
                onClick={() => onAction(experiment.id, 'complete')}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Complete
              </button>
            )}
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <ExperimentDetails experiment={experiment} results={results} />
          </div>
        )}
      </div>
    </li>
  );
};

// Experiment details component
interface ExperimentDetailsProps {
  experiment: Experiment;
  results: ExperimentResult | null;
}

const ExperimentDetails: React.FC<ExperimentDetailsProps> = ({ experiment, results }) => {
  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-500">Created</h4>
          <p className="text-sm text-gray-900">
            {new Date(experiment.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-500">Start Date</h4>
          <p className="text-sm text-gray-900">
            {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString() : 'Not started'}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-500">End Date</h4>
          <p className="text-sm text-gray-900">
            {experiment.endDate ? new Date(experiment.endDate).toLocaleDateString() : 'Not completed'}
          </p>
        </div>
      </div>

      {/* Tags */}
      {experiment.tags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {experiment.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Variants */}
      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-2">Variants</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {experiment.variants.map((variant: any, index: number) => (
            <div key={index} className="border border-gray-200 rounded-lg p-3">
              <h5 className="text-sm font-medium text-gray-900">{variant.name}</h5>
              <p className="text-xs text-gray-500">{variant.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                Allocation: {(variant.trafficAllocation * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {results && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Results</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Participants</p>
                <p className="text-lg font-semibold text-gray-900">{results.totalParticipants}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className={`text-sm font-medium ${
                  results.isStatisticallySignificant ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {results.isStatisticallySignificant ? 'Significant' : 'Not Significant'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Confidence</p>
                <p className="text-sm text-gray-900 capitalize">{results.confidence}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Winner</p>
                <p className="text-sm text-gray-900">
                  {results.winningVariant || 'None'}
                </p>
              </div>
            </div>

            {/* Conversion Rates */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Conversion Rates</h5>
              <div className="space-y-2">
                {Object.entries(results.conversionRates).map(([variantId, rate]) => (
                  <div key={variantId} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{variantId}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {(rate * 100).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {results.recommendation && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <h5 className="text-sm font-medium text-blue-800">Recommendation</h5>
                <p className="text-sm text-blue-700">{results.recommendation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Create experiment modal (placeholder)
interface CreateExperimentModalProps {
  onClose: () => void;
}

const CreateExperimentModal: React.FC<CreateExperimentModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <h3 className="text-lg font-medium text-gray-900">Create New Experiment</h3>
          <p className="text-sm text-gray-500 mt-2">
            This would open the experiment creation wizard.
          </p>
          <div className="mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ABTestingDashboard;