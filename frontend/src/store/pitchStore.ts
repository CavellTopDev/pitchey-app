import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MediaFile {
  type: string;
  count: number;
  uploaded: boolean;
}

interface Pitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  budget?: string;
  estimatedBudget?: number;
  productionTimeline?: string;
  targetReleaseDate?: string;
  targetAudience?: string;
  comparableTitles?: string;
  characters?: Array<{
    name: string;
    description: string;
    age?: string;
    gender?: string;
    actor?: string;
  }>;
  themes?: string[];
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  followersCount: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  mediaFiles?: MediaFile[];
  visibilitySettings?: {
    showShortSynopsis: boolean;
    showCharacters: boolean;
    showBudget: boolean;
    showMedia: boolean;
  };
}

interface PitchStore {
  pitches: Pitch[];
  drafts: Pitch[];
  currentDraft: Partial<Pitch> | null;
  
  // Actions
  addPitch: (pitch: Pitch) => void;
  updatePitch: (id: number, updates: Partial<Pitch>) => void;
  deletePitch: (id: number) => void;
  
  saveDraft: (draft: Partial<Pitch>) => void;
  loadDraft: (id: number) => Partial<Pitch> | undefined;
  deleteDraft: (id: number) => void;
  publishDraft: (id: number) => void;
  
  setCurrentDraft: (draft: Partial<Pitch> | null) => void;
  clearCurrentDraft: () => void;
  
  getPitchesByStatus: (status: 'draft' | 'published') => Pitch[];
  getAllPitches: () => Pitch[];
}

export const usePitchStore = create<PitchStore>()(
  persist(
    (set, get) => ({
      pitches: [],
      drafts: [],
      currentDraft: null,

      addPitch: (pitch) => {
        set((state) => ({
          pitches: [...state.pitches, { ...pitch, id: Date.now() }]
        }));
      },

      updatePitch: (id, updates) => {
        set((state) => ({
          pitches: state.pitches.map(p => 
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          )
        }));
      },

      deletePitch: (id) => {
        set((state) => ({
          pitches: state.pitches.filter(p => p.id !== id),
          drafts: state.drafts.filter(d => d.id !== id)
        }));
      },

      saveDraft: (draft) => {
        const draftWithId = {
          ...draft,
          id: draft.id || Date.now(),
          status: 'draft' as const,
          createdAt: draft.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          viewCount: draft.viewCount || 0,
          likeCount: draft.likeCount || 0,
          ndaCount: draft.ndaCount || 0,
          followersCount: draft.followersCount || 0
        };

        set((state) => {
          const existingIndex = state.drafts.findIndex(d => d.id === draftWithId.id);
          const updatedDrafts = existingIndex >= 0
            ? state.drafts.map((d, i) => i === existingIndex ? draftWithId as Pitch : d)
            : [...state.drafts, draftWithId as Pitch];
          
          return {
            drafts: updatedDrafts,
            currentDraft: draftWithId
          };
        });
      },

      loadDraft: (id) => {
        const draft = get().drafts.find(d => d.id === id);
        if (draft) {
          set({ currentDraft: draft });
        }
        return draft;
      },

      deleteDraft: (id) => {
        set((state) => ({
          drafts: state.drafts.filter(d => d.id !== id),
          currentDraft: state.currentDraft?.id === id ? null : state.currentDraft
        }));
      },

      publishDraft: (id) => {
        const draft = get().drafts.find(d => d.id === id);
        if (draft) {
          const publishedPitch = {
            ...draft,
            status: 'published' as const,
            publishedAt: new Date().toISOString()
          };
          
          set((state) => ({
            pitches: [...state.pitches, publishedPitch],
            drafts: state.drafts.filter(d => d.id !== id),
            currentDraft: null
          }));
        }
      },

      setCurrentDraft: (draft) => {
        set({ currentDraft: draft });
      },

      clearCurrentDraft: () => {
        set({ currentDraft: null });
      },

      getPitchesByStatus: (status) => {
        return get().pitches.filter(p => p.status === status);
      },

      getAllPitches: () => {
        const { pitches, drafts } = get();
        return [...pitches, ...drafts].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    }),
    {
      name: 'pitch-storage',
      partialize: (state) => ({
        pitches: state.pitches,
        drafts: state.drafts
      })
    }
  )
);