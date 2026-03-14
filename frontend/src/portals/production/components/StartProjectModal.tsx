import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { useNavigate } from 'react-router-dom';

interface PitchData {
  id: number | string;
  title: string;
  genre?: string;
  budget?: string | number;
  estimatedBudget?: string | number;
  productionTimeline?: string;
  logline?: string;
  shortSynopsis?: string;
}

interface StartProjectModalProps {
  pitch: PitchData;
  onClose: () => void;
  onCreated?: () => void;
}

export default function StartProjectModal({ pitch, onClose, onCreated }: StartProjectModalProps) {
  const navigate = useNavigate();

  // Parse budget from pitch data
  const rawBudget = pitch.estimatedBudget || pitch.budget || '';
  const parsedBudget = typeof rawBudget === 'number'
    ? rawBudget
    : parseFloat(String(rawBudget).replace(/[^0-9.]/g, '')) || 0;

  // Build initial notes from pitch context
  const initialNotes = [
    pitch.logline && `Logline: ${pitch.logline}`,
    pitch.genre && `Genre: ${pitch.genre}`,
    pitch.productionTimeline && `Timeline: ${pitch.productionTimeline}`,
  ].filter(Boolean).join('\n');

  const [form, setForm] = useState({
    title: pitch.title || '',
    stage: 'development',
    priority: 'medium',
    budget: parsedBudget > 0 ? String(parsedBudget) : '',
    startDate: '',
    targetCompletionDate: '',
    notes: initialNotes,
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('Project title is required');
      return;
    }

    setCreating(true);
    try {
      // Check for existing project from this pitch
      const checkRes = await apiClient.get<{ projects: Array<{ id: number; pitch_id: number }> }>(
        `/api/production/projects?pitchId=${pitch.id}`
      );
      const existing = checkRes.data?.projects?.find(
        (p: any) => String(p.pitch_id) === String(pitch.id)
      );
      if (existing) {
        toast.error('A project already exists for this pitch');
        setCreating(false);
        return;
      }

      const res = await apiClient.post<{ project: any }>('/api/production/projects', {
        title: form.title,
        pitchId: Number(pitch.id),
        stage: form.stage,
        priority: form.priority,
        budget: form.budget ? parseFloat(form.budget) : 0,
        startDate: form.startDate || null,
        targetCompletionDate: form.targetCompletionDate || null,
        notes: form.notes || null,
      });

      if (res.success) {
        toast.success('Project created from pitch');
        onClose();
        onCreated?.();
        navigate('/production/projects');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Start Production Project</h2>
            <p className="text-sm text-gray-500">From pitch: {pitch.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setForm(prev => ({ ...prev, stage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="development">Development</option>
                <option value="pre-production">Pre-Production</option>
                <option value="production">Production</option>
                <option value="post-production">Post-Production</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
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
              value={form.budget}
              onChange={(e) => setForm(prev => ({ ...prev, budget: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="e.g. 500000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Completion</label>
              <input
                type="date"
                value={form.targetCompletionDate}
                onChange={(e) => setForm(prev => ({ ...prev, targetCompletionDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              rows={4}
              placeholder="Project notes, context from the pitch..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t sticky bottom-0 bg-white rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={creating || !form.title.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
