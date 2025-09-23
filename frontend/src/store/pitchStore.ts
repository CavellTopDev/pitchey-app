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
      pitches: [
        // Initial mock data - production pitches
        {
          id: 1,
          title: "The Last Horizon",
          logline: "A space exploration thriller about humanity's final mission to find a new home.",
          genre: "Sci-Fi",
          format: "Feature Film",
          shortSynopsis: "In 2157, Earth's resources are depleted. The starship Horizon carries humanity's last hope.",
          budget: "$45M",
          estimatedBudget: 45000000,
          productionTimeline: "15 months from greenlight to delivery",
          viewCount: 456,
          likeCount: 89,
          ndaCount: 12,
          followersCount: 234,
          status: 'published',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          publishedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
          mediaFiles: [
            { type: 'lookbook', count: 1, uploaded: true },
            { type: 'script', count: 1, uploaded: true },
            { type: 'pitch_deck', count: 1, uploaded: true },
            { type: 'budget_breakdown', count: 1, uploaded: true },
            { type: 'trailer', count: 1, uploaded: true },
            { type: 'production_timeline', count: 1, uploaded: true }
          ]
        },
        {
          id: 2,
          title: "Urban Legends",
          logline: "An anthology series exploring modern urban myths in major cities.",
          genre: "Horror",
          format: "TV Series",
          shortSynopsis: "Each episode explores a different urban legend brought to life in terrifying detail.",
          budget: "$2M per episode",
          viewCount: 321,
          likeCount: 67,
          ndaCount: 8,
          followersCount: 156,
          status: 'published',
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          publishedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
          mediaFiles: [
            { type: 'script', count: 3, uploaded: true },
            { type: 'pitch_deck', count: 1, uploaded: true },
            { type: 'budget_breakdown', count: 1, uploaded: true }
          ]
        }
      ],
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