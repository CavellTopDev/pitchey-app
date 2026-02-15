import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { usePitchStore } from '../pitchStore';

const makePitch = (overrides = {}) => ({
  id: 1,
  title: 'Test Pitch',
  logline: 'A test pitch logline',
  genre: 'action',
  format: 'feature',
  viewCount: 0,
  likeCount: 0,
  ndaCount: 0,
  followersCount: 0,
  status: 'draft' as const,
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('pitchStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      usePitchStore.setState({
        pitches: [],
        drafts: [],
        currentDraft: null,
      });
    });
  });

  // ========================================================================
  // Initial state
  // ========================================================================
  describe('initial state', () => {
    it('has empty pitches array', () => {
      expect(usePitchStore.getState().pitches).toEqual([]);
    });

    it('has empty drafts array', () => {
      expect(usePitchStore.getState().drafts).toEqual([]);
    });

    it('has null currentDraft', () => {
      expect(usePitchStore.getState().currentDraft).toBeNull();
    });
  });

  // ========================================================================
  // addPitch
  // ========================================================================
  describe('addPitch', () => {
    it('adds pitch to pitches array', () => {
      const pitch = makePitch();

      act(() => {
        usePitchStore.getState().addPitch(pitch);
      });

      expect(usePitchStore.getState().pitches).toHaveLength(1);
    });

    it('generates a new ID using Date.now()', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T00:00:00Z'));

      const pitch = makePitch({ id: 999 });

      act(() => {
        usePitchStore.getState().addPitch(pitch);
      });

      const addedPitch = usePitchStore.getState().pitches[0];
      expect(addedPitch.id).toBe(Date.now());

      vi.useRealTimers();
    });

    it('adds multiple pitches', () => {
      act(() => {
        usePitchStore.getState().addPitch(makePitch({ id: 1 }));
        usePitchStore.getState().addPitch(makePitch({ id: 2 }));
      });

      expect(usePitchStore.getState().pitches).toHaveLength(2);
    });
  });

  // ========================================================================
  // updatePitch
  // ========================================================================
  describe('updatePitch', () => {
    it('updates existing pitch', () => {
      act(() => {
        usePitchStore.setState({
          pitches: [makePitch({ id: 1, title: 'Old Title' })],
        });
      });

      act(() => {
        usePitchStore.getState().updatePitch(1, { title: 'New Title' });
      });

      expect(usePitchStore.getState().pitches[0].title).toBe('New Title');
    });

    it('sets updatedAt on update', () => {
      act(() => {
        usePitchStore.setState({ pitches: [makePitch({ id: 1 })] });
      });

      act(() => {
        usePitchStore.getState().updatePitch(1, { title: 'Updated' });
      });

      expect(usePitchStore.getState().pitches[0].updatedAt).toBeDefined();
    });

    it('does not modify other pitches', () => {
      act(() => {
        usePitchStore.setState({
          pitches: [
            makePitch({ id: 1, title: 'Keep' }),
            makePitch({ id: 2, title: 'Change' }),
          ],
        });
      });

      act(() => {
        usePitchStore.getState().updatePitch(2, { title: 'Changed' });
      });

      expect(usePitchStore.getState().pitches[0].title).toBe('Keep');
      expect(usePitchStore.getState().pitches[1].title).toBe('Changed');
    });

    it('no-op when ID not found', () => {
      act(() => {
        usePitchStore.setState({ pitches: [makePitch({ id: 1 })] });
      });

      act(() => {
        usePitchStore.getState().updatePitch(999, { title: 'Nope' });
      });

      expect(usePitchStore.getState().pitches[0].title).toBe('Test Pitch');
    });
  });

  // ========================================================================
  // deletePitch
  // ========================================================================
  describe('deletePitch', () => {
    it('removes pitch from pitches array', () => {
      act(() => {
        usePitchStore.setState({
          pitches: [makePitch({ id: 1 }), makePitch({ id: 2 })],
        });
      });

      act(() => {
        usePitchStore.getState().deletePitch(1);
      });

      expect(usePitchStore.getState().pitches).toHaveLength(1);
      expect(usePitchStore.getState().pitches[0].id).toBe(2);
    });

    it('also removes from drafts', () => {
      act(() => {
        usePitchStore.setState({
          pitches: [makePitch({ id: 1 })],
          drafts: [makePitch({ id: 1 })],
        });
      });

      act(() => {
        usePitchStore.getState().deletePitch(1);
      });

      expect(usePitchStore.getState().drafts).toHaveLength(0);
    });
  });

  // ========================================================================
  // saveDraft
  // ========================================================================
  describe('saveDraft', () => {
    it('creates a new draft', () => {
      act(() => {
        usePitchStore.getState().saveDraft({ title: 'New Draft', logline: 'Test' });
      });

      const { drafts, currentDraft } = usePitchStore.getState();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].title).toBe('New Draft');
      expect(drafts[0].status).toBe('draft');
      expect(currentDraft).toBeDefined();
    });

    it('auto-fills default counters', () => {
      act(() => {
        usePitchStore.getState().saveDraft({ title: 'Draft' });
      });

      const draft = usePitchStore.getState().drafts[0];
      expect(draft.viewCount).toBe(0);
      expect(draft.likeCount).toBe(0);
      expect(draft.ndaCount).toBe(0);
      expect(draft.followersCount).toBe(0);
    });

    it('updates existing draft with same ID', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T00:00:00Z'));
      const id = Date.now();

      act(() => {
        usePitchStore.getState().saveDraft({ id, title: 'First' });
      });

      act(() => {
        usePitchStore.getState().saveDraft({ id, title: 'Updated' });
      });

      expect(usePitchStore.getState().drafts).toHaveLength(1);
      expect(usePitchStore.getState().drafts[0].title).toBe('Updated');

      vi.useRealTimers();
    });
  });

  // ========================================================================
  // loadDraft
  // ========================================================================
  describe('loadDraft', () => {
    it('sets currentDraft for existing draft', () => {
      act(() => {
        usePitchStore.setState({
          drafts: [makePitch({ id: 1, title: 'My Draft' })],
        });
      });

      const draft = usePitchStore.getState().loadDraft(1);
      expect(draft).toBeDefined();
      expect(draft?.title).toBe('My Draft');
      expect(usePitchStore.getState().currentDraft?.title).toBe('My Draft');
    });

    it('returns undefined for non-existent draft', () => {
      const draft = usePitchStore.getState().loadDraft(999);
      expect(draft).toBeUndefined();
    });
  });

  // ========================================================================
  // deleteDraft
  // ========================================================================
  describe('deleteDraft', () => {
    it('removes draft from drafts array', () => {
      act(() => {
        usePitchStore.setState({
          drafts: [makePitch({ id: 1 }), makePitch({ id: 2 })],
        });
      });

      act(() => {
        usePitchStore.getState().deleteDraft(1);
      });

      expect(usePitchStore.getState().drafts).toHaveLength(1);
    });

    it('clears currentDraft if it matches deleted draft', () => {
      act(() => {
        usePitchStore.setState({
          drafts: [makePitch({ id: 1 })],
          currentDraft: makePitch({ id: 1 }),
        });
      });

      act(() => {
        usePitchStore.getState().deleteDraft(1);
      });

      expect(usePitchStore.getState().currentDraft).toBeNull();
    });

    it('preserves currentDraft if different from deleted draft', () => {
      act(() => {
        usePitchStore.setState({
          drafts: [makePitch({ id: 1 }), makePitch({ id: 2 })],
          currentDraft: makePitch({ id: 2 }),
        });
      });

      act(() => {
        usePitchStore.getState().deleteDraft(1);
      });

      expect(usePitchStore.getState().currentDraft?.id).toBe(2);
    });
  });

  // ========================================================================
  // publishDraft
  // ========================================================================
  describe('publishDraft', () => {
    it('moves draft to published pitches', () => {
      act(() => {
        usePitchStore.setState({
          drafts: [makePitch({ id: 1, status: 'draft' })],
          pitches: [],
        });
      });

      act(() => {
        usePitchStore.getState().publishDraft(1);
      });

      const state = usePitchStore.getState();
      expect(state.drafts).toHaveLength(0);
      expect(state.pitches).toHaveLength(1);
      expect(state.pitches[0].status).toBe('published');
      expect(state.pitches[0].publishedAt).toBeDefined();
    });

    it('clears currentDraft', () => {
      act(() => {
        usePitchStore.setState({
          drafts: [makePitch({ id: 1 })],
          currentDraft: makePitch({ id: 1 }),
        });
      });

      act(() => {
        usePitchStore.getState().publishDraft(1);
      });

      expect(usePitchStore.getState().currentDraft).toBeNull();
    });

    it('no-op when draft not found', () => {
      act(() => {
        usePitchStore.setState({
          drafts: [makePitch({ id: 1 })],
          pitches: [],
        });
      });

      act(() => {
        usePitchStore.getState().publishDraft(999);
      });

      expect(usePitchStore.getState().pitches).toHaveLength(0);
      expect(usePitchStore.getState().drafts).toHaveLength(1);
    });
  });

  // ========================================================================
  // setCurrentDraft / clearCurrentDraft
  // ========================================================================
  describe('setCurrentDraft', () => {
    it('sets the current draft', () => {
      const draft = makePitch({ id: 1 });

      act(() => {
        usePitchStore.getState().setCurrentDraft(draft);
      });

      expect(usePitchStore.getState().currentDraft).toEqual(draft);
    });
  });

  describe('clearCurrentDraft', () => {
    it('sets currentDraft to null', () => {
      act(() => {
        usePitchStore.setState({ currentDraft: makePitch({ id: 1 }) });
      });

      act(() => {
        usePitchStore.getState().clearCurrentDraft();
      });

      expect(usePitchStore.getState().currentDraft).toBeNull();
    });
  });

  // ========================================================================
  // getPitchesByStatus
  // ========================================================================
  describe('getPitchesByStatus', () => {
    it('filters by draft status', () => {
      act(() => {
        usePitchStore.setState({
          pitches: [
            makePitch({ id: 1, status: 'draft' }),
            makePitch({ id: 2, status: 'published' }),
            makePitch({ id: 3, status: 'draft' }),
          ],
        });
      });

      const drafts = usePitchStore.getState().getPitchesByStatus('draft');
      expect(drafts).toHaveLength(2);
    });

    it('filters by published status', () => {
      act(() => {
        usePitchStore.setState({
          pitches: [
            makePitch({ id: 1, status: 'published' }),
            makePitch({ id: 2, status: 'draft' }),
          ],
        });
      });

      const published = usePitchStore.getState().getPitchesByStatus('published');
      expect(published).toHaveLength(1);
      expect(published[0].id).toBe(1);
    });
  });

  // ========================================================================
  // getAllPitches
  // ========================================================================
  describe('getAllPitches', () => {
    it('combines pitches and drafts', () => {
      act(() => {
        usePitchStore.setState({
          pitches: [makePitch({ id: 1 })],
          drafts: [makePitch({ id: 2 })],
        });
      });

      const all = usePitchStore.getState().getAllPitches();
      expect(all).toHaveLength(2);
    });

    it('sorts by createdAt descending', () => {
      act(() => {
        usePitchStore.setState({
          pitches: [
            makePitch({ id: 1, createdAt: '2024-01-01T00:00:00Z' }),
            makePitch({ id: 2, createdAt: '2024-06-01T00:00:00Z' }),
          ],
          drafts: [makePitch({ id: 3, createdAt: '2024-03-01T00:00:00Z' })],
        });
      });

      const all = usePitchStore.getState().getAllPitches();
      expect(all[0].id).toBe(2);
      expect(all[1].id).toBe(3);
      expect(all[2].id).toBe(1);
    });
  });
});
