import { useRef, useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

interface DraftData {
  id: string;
  type: 'pitch' | 'message' | 'profile' | 'generic';
  content: any;
  lastModified: Date;
  version: number;
}

interface DraftSyncOptions {
  draftId: string;
  draftType: 'pitch' | 'message' | 'profile' | 'generic';
  autoSaveInterval?: number;
  conflictResolution?: 'local' | 'remote' | 'merge' | 'ask';
  enableLocalStorage?: boolean;
  validateContent?: (content: any) => boolean;
  onConflict?: (localDraft: DraftData, remoteDraft: DraftData) => DraftData;
  onSave?: (draft: DraftData) => void;
  onLoad?: (draft: DraftData) => void;
  onError?: (error: string) => void;
  onSyncStatus?: (status: 'idle' | 'saving' | 'loading' | 'conflict' | 'error') => void;
}

interface DraftSyncState {
  content: any;
  lastSaved: Date | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  hasConflict: boolean;
  lastError: string | null;
  version: number;
  remoteVersion: number;
}

const DEFAULT_OPTIONS: Required<Omit<DraftSyncOptions, 'onConflict' | 'onSave' | 'onLoad' | 'onError' | 'onSyncStatus' | 'validateContent'>> = {
  draftId: '',
  draftType: 'generic',
  autoSaveInterval: 5000,
  conflictResolution: 'ask',
  enableLocalStorage: true,
};

export function useDraftSync(options: DraftSyncOptions) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { sendMessage, isConnected } = useWebSocket();
  
  // State
  const [state, setState] = useState<DraftSyncState>({
    content: null,
    lastSaved: null,
    isDirty: false,
    isSaving: false,
    isLoading: false,
    hasConflict: false,
    lastError: null,
    version: 0,
    remoteVersion: 0,
  });
  
  // Refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingChangesRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const lastSyncedContentRef = useRef<any>(null);
  
  // Local storage key
  const localStorageKey = `draft_${opts.draftType}_${opts.draftId}`;
  
  // Update sync status
  const updateSyncStatus = useCallback((status: DraftSyncState['isSaving'] extends true ? 'saving' : DraftSyncState['isLoading'] extends true ? 'loading' : DraftSyncState['hasConflict'] extends true ? 'conflict' : DraftSyncState['lastError'] extends string ? 'error' : 'idle') => {
    opts.onSyncStatus?.(status);
  }, [opts]);
  
  // Save to local storage
  const saveToLocalStorage = useCallback((content: any, version: number) => {
    if (opts.enableLocalStorage) {
      try {
        const draftData: DraftData = {
          id: opts.draftId,
          type: opts.draftType,
          content,
          lastModified: new Date(),
          version,
        };
        localStorage.setItem(localStorageKey, JSON.stringify(draftData));
      } catch (error) {
        console.warn('Failed to save draft to localStorage:', error);
      }
    }
  }, [opts.enableLocalStorage, opts.draftId, opts.draftType, localStorageKey]);
  
  // Load from local storage
  const loadFromLocalStorage = useCallback((): DraftData | null => {
    if (opts.enableLocalStorage) {
      try {
        const saved = localStorage.getItem(localStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...parsed,
            lastModified: new Date(parsed.lastModified),
          };
        }
      } catch (error) {
        console.warn('Failed to load draft from localStorage:', error);
      }
    }
    return null;
  }, [opts.enableLocalStorage, localStorageKey]);
  
  // Clear local storage
  const clearLocalStorage = useCallback(() => {
    if (opts.enableLocalStorage) {
      localStorage.removeItem(localStorageKey);
    }
  }, [opts.enableLocalStorage, localStorageKey]);
  
  // Validate content
  const isValidContent = useCallback((content: any) => {
    if (opts.validateContent) {
      return opts.validateContent(content);
    }
    return content !== null && content !== undefined;
  }, [opts]);
  
  // Send save request
  const sendSaveRequest = useCallback((content: any, version: number) => {
    if (!isConnected) {
      setState(prev => ({ 
        ...prev, 
        lastError: 'Not connected to server',
        isSaving: false 
      }));
      updateSyncStatus('error');
      return;
    }
    
    setState(prev => ({ ...prev, isSaving: true, lastError: null }));
    updateSyncStatus('saving');
    
    sendMessage({
      type: 'draft_sync',
      data: {
        action: 'save',
        draftId: opts.draftId,
        draftType: opts.draftType,
        content,
        version,
        timestamp: new Date().toISOString(),
      },
    });
  }, [isConnected, sendMessage, opts.draftId, opts.draftType, updateSyncStatus]);
  
  // Send load request
  const sendLoadRequest = useCallback(() => {
    if (!isConnected) {
      setState(prev => ({ 
        ...prev, 
        lastError: 'Not connected to server',
        isLoading: false 
      }));
      updateSyncStatus('error');
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, lastError: null }));
    updateSyncStatus('loading');
    
    sendMessage({
      type: 'draft_sync',
      data: {
        action: 'load',
        draftId: opts.draftId,
        draftType: opts.draftType,
      },
    });
  }, [isConnected, sendMessage, opts.draftId, opts.draftType, updateSyncStatus]);
  
  // Handle auto-save
  const scheduleAutoSave = useCallback((content: any) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (isValidContent(content) && JSON.stringify(content) !== JSON.stringify(lastSyncedContentRef.current)) {
        sendSaveRequest(content, state.version + 1);
      }
    }, opts.autoSaveInterval);
  }, [opts.autoSaveInterval, isValidContent, sendSaveRequest, state.version]);
  
  // Handle conflict resolution
  const resolveConflict = useCallback((localDraft: DraftData, remoteDraft: DraftData): DraftData => {
    switch (opts.conflictResolution) {
      case 'local':
        return localDraft;
      case 'remote':
        return remoteDraft;
      case 'merge':
        // Simple merge strategy - use custom merge function if provided
        if (opts.onConflict) {
          return opts.onConflict(localDraft, remoteDraft);
        }
        // Default: use newer version
        return localDraft.lastModified > remoteDraft.lastModified ? localDraft : remoteDraft;
      case 'ask':
      default:
        // Let the UI handle the conflict
        return localDraft;
    }
  }, [opts.conflictResolution, opts.onConflict]);
  
  // Update content
  const updateContent = useCallback((newContent: any) => {
    if (!isValidContent(newContent)) {
      console.warn('Invalid content provided to updateContent');
      return;
    }
    
    setState(prev => {
      const isDirty = JSON.stringify(newContent) !== JSON.stringify(lastSyncedContentRef.current);
      return {
        ...prev,
        content: newContent,
        isDirty,
        hasConflict: false,
        lastError: null,
      };
    });
    
    pendingChangesRef.current = newContent;
    
    // Save to local storage immediately
    saveToLocalStorage(newContent, state.version);
    
    // Schedule auto-save
    scheduleAutoSave(newContent);
  }, [isValidContent, saveToLocalStorage, state.version, scheduleAutoSave]);
  
  // Manual save
  const save = useCallback(() => {
    if (state.content && isValidContent(state.content)) {
      sendSaveRequest(state.content, state.version + 1);
    }
  }, [state.content, state.version, isValidContent, sendSaveRequest]);
  
  // Manual load
  const load = useCallback(() => {
    sendLoadRequest();
  }, [sendLoadRequest]);
  
  // Discard changes
  const discardChanges = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    setState(prev => ({
      ...prev,
      content: lastSyncedContentRef.current,
      isDirty: false,
      hasConflict: false,
      lastError: null,
    }));
    
    pendingChangesRef.current = null;
    
    // Update local storage
    if (lastSyncedContentRef.current) {
      saveToLocalStorage(lastSyncedContentRef.current, state.version);
    } else {
      clearLocalStorage();
    }
  }, [saveToLocalStorage, clearLocalStorage, state.version]);
  
  // Handle WebSocket messages
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'draft_sync' && message.data?.draftId === opts.draftId) {
        const { action, content, version, error, timestamp } = message.data;
        
        switch (action) {
          case 'save_success':
            setState(prev => ({
              ...prev,
              isSaving: false,
              lastSaved: new Date(timestamp),
              version: version || prev.version + 1,
              isDirty: false,
              lastError: null,
            }));
            
            lastSyncedContentRef.current = state.content;
            updateSyncStatus('idle');
            opts.onSave?.({
              id: opts.draftId,
              type: opts.draftType,
              content: state.content,
              lastModified: new Date(timestamp),
              version: version || state.version + 1,
            });
            break;
            
          case 'save_error':
            setState(prev => ({
              ...prev,
              isSaving: false,
              lastError: error || 'Save failed',
            }));
            updateSyncStatus('error');
            opts.onError?.(error || 'Save failed');
            break;
            
          case 'load_success':
            const remoteDraft: DraftData = {
              id: opts.draftId,
              type: opts.draftType,
              content,
              lastModified: new Date(timestamp),
              version: version || 0,
            };
            
            // Check for conflicts
            const localDraft = loadFromLocalStorage();
            const hasLocalChanges = localDraft && 
              JSON.stringify(localDraft.content) !== JSON.stringify(content);
            
            if (hasLocalChanges && opts.conflictResolution === 'ask') {
              setState(prev => ({
                ...prev,
                isLoading: false,
                hasConflict: true,
                remoteVersion: version || 0,
              }));
              updateSyncStatus('conflict');
            } else {
              const resolvedDraft = hasLocalChanges ? 
                resolveConflict(localDraft, remoteDraft) : 
                remoteDraft;
              
              setState(prev => ({
                ...prev,
                content: resolvedDraft.content,
                isLoading: false,
                version: resolvedDraft.version,
                remoteVersion: version || 0,
                hasConflict: false,
                isDirty: false,
                lastSaved: resolvedDraft.lastModified,
                lastError: null,
              }));
              
              lastSyncedContentRef.current = resolvedDraft.content;
              saveToLocalStorage(resolvedDraft.content, resolvedDraft.version);
              updateSyncStatus('idle');
              opts.onLoad?.(resolvedDraft);
            }
            break;
            
          case 'load_error':
            setState(prev => ({
              ...prev,
              isLoading: false,
              lastError: error || 'Load failed',
            }));
            updateSyncStatus('error');
            opts.onError?.(error || 'Load failed');
            break;
            
          case 'conflict':
            // Another user made changes while we were editing
            setState(prev => ({
              ...prev,
              hasConflict: true,
              remoteVersion: version || prev.remoteVersion,
            }));
            updateSyncStatus('conflict');
            break;
        }
      }
    };
    
    // This would be handled by the WebSocket context
    // For now, we'll assume the context handles message routing
    
  }, [opts, state.content, state.version, loadFromLocalStorage, resolveConflict, saveToLocalStorage, updateSyncStatus]);
  
  // Initialize
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      
      // Try to load from local storage first
      const localDraft = loadFromLocalStorage();
      if (localDraft) {
        setState(prev => ({
          ...prev,
          content: localDraft.content,
          version: localDraft.version,
          lastSaved: localDraft.lastModified,
          isDirty: false,
        }));
        lastSyncedContentRef.current = localDraft.content;
        opts.onLoad?.(localDraft);
      }
      
      // Then try to load from server
      if (isConnected) {
        sendLoadRequest();
      }
    }
  }, [isConnected, loadFromLocalStorage, sendLoadRequest, opts]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);
  
  // Auto-connect and auto-save on connection changes
  useEffect(() => {
    if (isConnected && pendingChangesRef.current && !state.isSaving) {
      // Save pending changes when connection is restored
      sendSaveRequest(pendingChangesRef.current, state.version + 1);
    }
  }, [isConnected, state.isSaving, state.version, sendSaveRequest]);
  
  return {
    // State
    content: state.content,
    lastSaved: state.lastSaved,
    isDirty: state.isDirty,
    isSaving: state.isSaving,
    isLoading: state.isLoading,
    hasConflict: state.hasConflict,
    lastError: state.lastError,
    version: state.version,
    remoteVersion: state.remoteVersion,
    isConnected,
    
    // Actions
    updateContent,
    save,
    load,
    discardChanges,
    
    // Conflict resolution
    resolveWithLocal: () => {
      setState(prev => ({ ...prev, hasConflict: false }));
      save();
    },
    resolveWithRemote: () => {
      load();
    },
    
    // Status
    syncStatus: state.isSaving ? 'saving' as const : 
                state.isLoading ? 'loading' as const :
                state.hasConflict ? 'conflict' as const :
                state.lastError ? 'error' as const : 'idle' as const,
  };
}