import { useState, useEffect, useCallback } from 'react';
import { Film, AlertCircle, TrendingUp, DollarSign, Plus, MoreVertical, Eye, Edit, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

interface PipelineProject {
  id: number;
  title: string;
  stage: string;
  status: string;
  priority: string;
  budget_allocated: number;
  budget_spent: number;
  budget_remaining: number;
  completion_percentage: number;
  start_date: string | null;
  target_completion_date: string | null;
  next_milestone: string | null;
  milestone_date: string | null;
  pitch_id: number | null;
  genre: string | null;
  format: string | null;
  logline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const stageColors: Record<string, string> = {
  development: 'bg-blue-100 text-blue-800',
  'pre-production': 'bg-indigo-100 text-indigo-800',
  production: 'bg-purple-100 text-purple-800',
  'post-production': 'bg-orange-100 text-orange-800',
  delivery: 'bg-teal-100 text-teal-800',
  release: 'bg-green-100 text-green-800',
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-600',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
};

function formatBudget(amount: number): string {
  if (!amount || amount === 0) return 'TBD';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'Not set' : d.toLocaleDateString();
}

export default function ProductionProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PipelineProject[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', stage: 'development', priority: 'medium', budget: '', startDate: '', notes: '' });
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ projects: PipelineProject[] }>('/api/production/projects');
      if (response.success) {
        setProjects(response.data?.projects || []);
      } else {
        setProjects([]);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load projects:', e);
      setError('Failed to load projects. Please try again.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (!createForm.title.trim()) {
      toast.error('Project title is required');
      return;
    }
    setCreating(true);
    try {
      const response = await apiClient.post<{ project: PipelineProject }>('/api/production/projects', {
        title: createForm.title,
        stage: createForm.stage,
        priority: createForm.priority,
        budget: createForm.budget ? parseFloat(createForm.budget) : 0,
        startDate: createForm.startDate || null,
        notes: createForm.notes || null,
      });
      if (response.success && response.data?.project) {
        setProjects(prev => [response.data!.project, ...prev]);
        setShowCreateModal(false);
        setCreateForm({ title: '', stage: 'development', priority: 'medium', budget: '', startDate: '', notes: '' });
        toast.success('Project created');
      } else {
        toast.error('Failed to create project');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleArchiveProject = async (projectId: number) => {
    if (!window.confirm('Archive this project?')) return;
    try {
      await apiClient.put(`/api/production/projects/${projectId}`, { status: 'cancelled' });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success('Project archived');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to archive project');
    }
  };

  const filteredProjects = filter === 'all'
    ? projects
    : projects.filter(p => p.stage === filter);

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    budget: projects.reduce((sum, p) => sum + (Number(p.budget_allocated) || 0), 0),
    avgProgress: projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / projects.length)
      : 0,
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Projects</h1>
            <p className="text-gray-600 mt-1">Manage your production pipeline</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{error}</p>
              <button onClick={() => void loadProjects()} className="ml-auto text-red-600 hover:text-red-800 font-medium">Retry</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Film className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">{formatBudget(stats.budget)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Progress</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgProgress}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px overflow-x-auto">
              {['all', 'development', 'pre-production', 'production', 'post-production', 'delivery', 'release'].map((stage) => (
                <button
                  key={stage}
                  onClick={() => setFilter(stage)}
                  className={`py-3 px-6 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${
                    filter === stage
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {stage === 'all' ? 'All' : stage.replace('-', ' ')}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <Film className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {projects.length === 0 ? 'No projects yet' : 'No projects in this stage'}
            </h3>
            <p className="text-gray-500 mb-6">
              {projects.length === 0
                ? 'Create your first production project to start tracking progress'
                : 'Move projects through stages as they progress'}
            </p>
            {projects.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Plus className="w-5 h-5" />
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{project.title}</h3>
                      {project.genre && <p className="text-sm text-gray-600">{project.genre}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${stageColors[project.stage] || 'bg-gray-100 text-gray-800'}`}>
                        {project.stage.replace('-', ' ')}
                      </span>
                      <span className={`text-xs font-medium ${priorityColors[project.priority] || 'text-gray-600'}`}>
                        {project.priority}
                      </span>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">{project.completion_percentage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.completion_percentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-600">Budget</p>
                      <p className="font-semibold">{formatBudget(Number(project.budget_allocated))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Spent</p>
                      <p className="font-semibold">{formatBudget(Number(project.budget_spent))}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Start Date</p>
                      <p className="font-semibold">{formatDate(project.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Target</p>
                      <p className="font-semibold">{formatDate(project.target_completion_date)}</p>
                    </div>
                  </div>

                  {/* Next Milestone */}
                  {project.next_milestone && (
                    <div className="border-t pt-3 mb-4">
                      <p className="text-sm text-gray-600">
                        Next: <span className="font-medium text-gray-900">{project.next_milestone}</span>
                        {project.milestone_date && (
                          <span className="text-gray-500"> — {formatDate(project.milestone_date as string)}</span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Linked Pitch */}
                  {project.pitch_id && (
                    <div className="border-t pt-3 mb-4">
                      <button
                        onClick={() => navigate(`/production/pitch/${project.pitch_id}`)}
                        className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                      >
                        <Film className="w-3.5 h-3.5" />
                        View original pitch
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(project.pitch_id ? `/production/pitch/${project.pitch_id}` : `/production/projects`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button
                      onClick={() => navigate(`/production/projects`)}
                      className="flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handleArchiveProject(project.id)}
                      className="flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">New Production Project</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="Project title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select
                    value={createForm.stage}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, stage: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="development">Development</option>
                    <option value="pre-production">Pre-Production</option>
                    <option value="production">Production</option>
                    <option value="post-production">Post-Production</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget ($)</label>
                <input
                  type="number"
                  value={createForm.budget}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, budget: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="e.g. 500000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  rows={3}
                  placeholder="Project notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateProject()}
                disabled={creating || !createForm.title.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
