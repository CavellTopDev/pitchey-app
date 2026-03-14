import { useState, useEffect, useCallback } from 'react';
import { X, Search, Film, Shield } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '@/store/betterAuthStore';

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
  /** Pre-selected pitch (skips the picker) */
  pitch?: PitchData;
  /** Show pitch picker when no pitch is provided */
  showPicker?: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface AvailablePitch {
  id: number;
  title: string;
  genre: string;
  logline?: string;
  budget?: string | number;
  estimatedBudget?: string | number;
  productionTimeline?: string;
  source: 'own' | 'nda';
  creatorName?: string;
}

function parseBudget(raw: string | number | undefined): number {
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  return parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
}

function buildNotes(pitch: PitchData | AvailablePitch): string {
  return [
    (pitch as any).logline && `Logline: ${(pitch as any).logline}`,
    pitch.genre && `Genre: ${pitch.genre}`,
    (pitch as any).productionTimeline && `Timeline: ${(pitch as any).productionTimeline}`,
  ].filter(Boolean).join('\n');
}

export default function StartProjectModal({ pitch: preSelectedPitch, showPicker, onClose, onCreated }: StartProjectModalProps) {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();

  // Step: 'pick' (choose pitch) or 'form' (fill project details)
  const [step, setStep] = useState<'pick' | 'form'>(preSelectedPitch ? 'form' : 'pick');
  const [selectedPitch, setSelectedPitch] = useState<PitchData | AvailablePitch | null>(preSelectedPitch || null);

  // Pitch picker state
  const [availablePitches, setAvailablePitches] = useState<AvailablePitch[]>([]);
  const [pitchSearch, setPitchSearch] = useState('');
  const [loadingPitches, setLoadingPitches] = useState(false);

  // Form state
  const initialBudget = selectedPitch ? parseBudget((selectedPitch as any).estimatedBudget || selectedPitch.budget) : 0;
  const [form, setForm] = useState({
    title: selectedPitch?.title || '',
    stage: 'development',
    priority: 'medium',
    budget: initialBudget > 0 ? String(initialBudget) : '',
    startDate: '',
    targetCompletionDate: '',
    notes: selectedPitch ? buildNotes(selectedPitch as PitchData) : '',
  });
  const [creating, setCreating] = useState(false);

  // Load available pitches (own + NDA-signed)
  const loadPitches = useCallback(async () => {
    setLoadingPitches(true);
    try {
      const [ownRes, ndaRes] = await Promise.all([
        apiClient.get<any>(`/api/pitches?status=all&userId=${user?.id}&limit=100`),
        apiClient.get<any>('/api/ndas/outgoing-signed'),
      ]);

      const pitches: AvailablePitch[] = [];

      // Own pitches
      if (ownRes.success) {
        const ownPitches = Array.isArray(ownRes.data) ? ownRes.data : (ownRes.data?.pitches || []);
        for (const p of ownPitches) {
          pitches.push({
            id: p.id,
            title: p.title,
            genre: p.genre || 'Unknown',
            logline: p.logline,
            budget: p.budget || p.estimated_budget || p.budget_range,
            estimatedBudget: p.estimated_budget,
            productionTimeline: p.production_timeline,
            source: 'own',
          });
        }
      }

      // NDA-signed pitches (pitches from other creators that we have NDA access to)
      if (ndaRes.success) {
        const ndas = ndaRes.data?.ndas || [];
        for (const nda of ndas) {
          // Only add if not already in own pitches
          const pitchId = nda.pitch_id || nda.pitchId;
          if (pitchId && !pitches.some(p => p.id === pitchId)) {
            pitches.push({
              id: pitchId,
              title: nda.pitch_title || nda.pitchTitle || 'Untitled',
              genre: nda.genre || 'Unknown',
              logline: nda.logline,
              budget: nda.budget,
              source: 'nda',
              creatorName: nda.creator_name || nda.creatorName,
            });
          }
        }
      }

      setAvailablePitches(pitches);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load pitches:', e);
    } finally {
      setLoadingPitches(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (step === 'pick') {
      void loadPitches();
    }
  }, [step, loadPitches]);

  const filteredPitches = availablePitches.filter(p =>
    p.title.toLowerCase().includes(pitchSearch.toLowerCase()) ||
    p.genre.toLowerCase().includes(pitchSearch.toLowerCase()) ||
    (p.creatorName || '').toLowerCase().includes(pitchSearch.toLowerCase())
  );

  const handleSelectPitch = (pitch: AvailablePitch) => {
    setSelectedPitch(pitch);
    const budget = parseBudget(pitch.estimatedBudget || pitch.budget);
    setForm({
      title: pitch.title,
      stage: 'development',
      priority: 'medium',
      budget: budget > 0 ? String(budget) : '',
      startDate: '',
      targetCompletionDate: '',
      notes: buildNotes(pitch as unknown as PitchData),
    });
    setStep('form');
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('Project title is required');
      return;
    }

    setCreating(true);
    try {
      const pitchId = selectedPitch ? Number(selectedPitch.id) : null;

      // Check for duplicate if linked to a pitch
      if (pitchId) {
        const checkRes = await apiClient.get<{ projects: Array<{ id: number; pitch_id: number }> }>(
          `/api/production/projects?pitchId=${pitchId}`
        );
        const existing = checkRes.data?.projects?.find(
          (p: any) => String(p.pitch_id) === String(pitchId)
        );
        if (existing) {
          toast.error('A project already exists for this pitch');
          setCreating(false);
          return;
        }
      }

      const res = await apiClient.post<{ project: any }>('/api/production/projects', {
        title: form.title,
        pitchId,
        stage: form.stage,
        priority: form.priority,
        budget: form.budget ? parseFloat(form.budget) : 0,
        startDate: form.startDate || null,
        targetCompletionDate: form.targetCompletionDate || null,
        notes: form.notes || null,
      });

      if (res.success) {
        toast.success('Project created');
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'pick' ? 'Select a Pitch' : 'Start Production Project'}
            </h2>
            {step === 'form' && selectedPitch && (
              <p className="text-sm text-gray-500">From: {selectedPitch.title}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pitch Picker Step */}
        {step === 'pick' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={pitchSearch}
                  onChange={(e) => setPitchSearch(e.target.value)}
                  placeholder="Search pitches..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm"
                />
              </div>

              {/* Skip pitch selection */}
              <button
                onClick={() => {
                  setSelectedPitch(null);
                  setStep('form');
                }}
                className="w-full mb-4 px-4 py-2 text-sm text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition border border-dashed border-gray-300"
              >
                Create project without linking to a pitch
              </button>

              {loadingPitches ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
                </div>
              ) : filteredPitches.length === 0 ? (
                <div className="text-center py-8">
                  <Film className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">
                    {pitchSearch ? 'No pitches match your search' : 'No pitches available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPitches.map((pitch) => (
                    <button
                      key={`${pitch.source}-${pitch.id}`}
                      onClick={() => handleSelectPitch(pitch)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm truncate">{pitch.title}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {pitch.genre}
                            {pitch.creatorName && ` — by ${pitch.creatorName}`}
                          </p>
                          {pitch.logline && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{pitch.logline}</p>
                          )}
                        </div>
                        <span className={`ml-2 flex-shrink-0 px-2 py-0.5 text-xs rounded-full ${
                          pitch.source === 'own'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {pitch.source === 'own' ? 'Your pitch' : (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              NDA
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Step */}
        {step === 'form' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Back to picker (only if we started with picker) */}
              {!preSelectedPitch && (
                <button
                  onClick={() => setStep('pick')}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  &larr; Choose a different pitch
                </button>
              )}

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

            <div className="flex justify-end gap-3 p-4 border-t">
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
          </>
        )}
      </div>
    </div>
  );
}
