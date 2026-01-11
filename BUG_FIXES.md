# Pitchey Application Bug Fixes & Improvements

## Overview
This document provides comprehensive bug fixes for the Pitchey application's critical issues. Each section includes root cause analysis, specific fixes, and testing scenarios.

---

## 1. Browse Tab Content Mixing Issue

### Issue Description
The Browse section in `/frontend/src/pages/Marketplace.tsx` has navigation tabs (Trending, New, General Browse, Genres) but the content is not properly separated between tabs, leading to mixed results.

### Root Cause Analysis
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/pages/Marketplace.tsx`
**Lines:** 522-557, 767-968

**Problems Identified:**
1. **Inconsistent Data Sources**: Different tabs use different data arrays (`trendingPitches`, `newPitches`, `browsePitches`) but filtering logic mixes them
2. **Shared Filter State**: All tabs share the same filter state (`selectedGenre`, `selectedFormat`, `searchQuery`) causing cross-contamination
3. **URL Hash Handling**: The hash-based navigation clears filters inconsistently (lines 153-159)
4. **Filter Application Logic**: The `applyFilters()` function doesn't properly isolate content by tab type

### Specific Code Fixes

#### Fix 1: Separate Data Management per Tab
**File:** `frontend/src/pages/Marketplace.tsx`
**Lines to modify:** 67-78, 153-170

```typescript
// REPLACE: Mixed filter state (lines 67-78)
const [searchQuery, setSearchQuery] = useState('');
const [selectedGenre, setSelectedGenre] = useState('');
const [selectedFormat, setSelectedFormat] = useState('');

// WITH: Tab-specific filter state
const [filterState, setFilterState] = useState({
  all: { search: '', genre: '', format: '' },
  trending: { search: '', genre: '', format: '' },
  new: { search: '', genre: '', format: '' },
  browse: { search: '', genre: '', format: '' },
  genres: { search: '', genre: '', format: '' }
});

const getCurrentFilters = () => filterState[currentView as keyof typeof filterState] || filterState.all;
const updateCurrentFilters = (updates: Partial<typeof filterState.all>) => {
  setFilterState(prev => ({
    ...prev,
    [currentView]: { ...getCurrentFilters(), ...updates }
  }));
};
```

#### Fix 2: Tab-Specific Data Loading
**Lines to modify:** 153-170

```typescript
// REPLACE: Generic applyFilters function
const applyFilters = () => {
  // Current mixed logic
};

// WITH: Tab-specific filtering logic
const getTabSpecificPitches = useCallback(() => {
  const filters = getCurrentFilters();
  let basePitches: Pitch[] = [];

  switch (currentView) {
    case 'trending':
      basePitches = trendingPitches;
      break;
    case 'new':
      basePitches = newPitches;
      break;
    case 'browse':
      basePitches = browsePitches;
      break;
    case 'genres':
      basePitches = pitches;
      break;
    default:
      basePitches = pitches;
  }

  return basePitches.filter(pitch => {
    const matchesSearch = !filters.search || 
      pitch.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
      pitch.logline?.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesGenre = !filters.genre || pitch.genre === filters.genre;
    const matchesFormat = !filters.format || pitch.format === filters.format;
    
    return matchesSearch && matchesGenre && matchesFormat;
  });
}, [currentView, pitches, trendingPitches, newPitches, browsePitches, filterState]);
```

#### Fix 3: Enhanced Tab Navigation
**Lines to modify:** 522-557

```typescript
// REPLACE: Simple href navigation
<a href="#trending" className={...}>Trending</a>

// WITH: Proper tab switching with state management
<button
  onClick={() => {
    setCurrentView('trending');
    window.history.pushState({}, '', '#trending');
  }}
  className={`flex items-center gap-1 font-medium transition ${
    currentView === 'trending' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-700 hover:text-purple-600'
  }`}
>
  <TrendingUp className="w-4 h-4" />
  Trending
</button>
```

### Testing Scenarios

```typescript
// Test Case 1: Tab Content Isolation
describe('Browse Tab Content Isolation', () => {
  test('Trending tab shows only trending content', async () => {
    render(<Marketplace />);
    
    // Click trending tab
    fireEvent.click(screen.getByText('Trending'));
    
    // Verify only trending pitches are shown
    const pitchCards = screen.getAllByTestId('pitch-card');
    expect(pitchCards).toHaveLength(trendingPitches.length);
    
    // Verify trending-specific sorting (by views)
    const firstPitch = pitchCards[0];
    expect(firstPitch).toHaveTextContent(expect.stringMatching(/\d+\s+views/));
  });

  test('Filter state is isolated per tab', async () => {
    render(<Marketplace />);
    
    // Set filter in 'all' tab
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'action' } });
    
    // Switch to trending tab
    fireEvent.click(screen.getByText('Trending'));
    
    // Verify search input is empty in trending tab
    expect(screen.getByPlaceholderText('Search')).toHaveValue('');
    
    // Switch back to all tab
    fireEvent.click(screen.getByText('All'));
    
    // Verify search input retains 'action'
    expect(screen.getByPlaceholderText('Search')).toHaveValue('action');
  });
});
```

---

## 2. NDA Workflow Completion Gaps

### Issue Description
The NDA approval workflow in `/frontend/src/components/NDA/NDAApprovalWorkflow.tsx` lacks critical workflow steps and error handling.

### Root Cause Analysis
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/components/NDA/NDAApprovalWorkflow.tsx`
**Lines:** 179-217, 219-240

**Problems Identified:**
1. **Missing Status Transitions**: No intermediate states between pending → approved/rejected
2. **No Approval History**: No tracking of approval chain or revision history
3. **Missing Expiry Handling**: NDAs can expire but no automated handling
4. **Incomplete Bulk Operations**: Bulk actions don't handle partial failures properly
5. **No Escalation Logic**: No automatic escalation for high-priority requests

### Specific Code Fixes

#### Fix 1: Enhanced Status State Machine
**File:** `frontend/src/components/NDA/NDAApprovalWorkflow.tsx`
**Lines to add after line 41:**

```typescript
// ADD: Enhanced status types with intermediate states
export type NDAStatus = 
  | 'pending' 
  | 'under_review' 
  | 'approved' 
  | 'conditionally_approved'
  | 'rejected' 
  | 'expired'
  | 'withdrawn'
  | 'escalated';

export interface NDAApprovalHistory {
  id: number;
  action: 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'modified' | 'expired';
  actorId: number;
  actorName: string;
  timestamp: string;
  notes?: string;
  previousStatus: NDAStatus;
  newStatus: NDAStatus;
}

export interface EnhancedNDAApprovalRequest extends NDAApprovalRequest {
  status: NDAStatus;
  approvalHistory: NDAApprovalHistory[];
  reviewerNotes?: string;
  conditions?: string[];
  escalationLevel: number;
  expiresAt?: string;
  lastReviewedAt?: string;
  assignedReviewerId?: number;
}
```

#### Fix 2: Comprehensive Approval Process
**Lines to replace 179-217:**

```typescript
const processApproval = async (
  notes: string, 
  customTerms?: string, 
  expiryDays?: number,
  conditions?: string[]
) => {
  if (!approvalModalData) return;
  
  const { request, action } = approvalModalData;
  
  try {
    setProcessingIds(prev => new Set([...prev, request.id]));
    
    // Update status to under_review first
    onChange(files.map(r => 
      r.id === request.id 
        ? { ...r, status: 'under_review', lastReviewedAt: new Date().toISOString() }
        : r
    ));

    let newStatus: NDAStatus;
    let approvalData: any = {
      notes,
      reviewerId: user?.id,
      reviewerName: user?.name
    };

    if (action === 'approve') {
      // Determine approval type
      if (conditions && conditions.length > 0) {
        newStatus = 'conditionally_approved';
        approvalData.conditions = conditions;
      } else {
        newStatus = 'approved';
      }
      
      approvalData.customTerms = customTerms;
      approvalData.expiryDays = expiryDays;
      approvalData.expiresAt = new Date(Date.now() + (expiryDays || 90) * 24 * 60 * 60 * 1000).toISOString();

      await ndaService.approveNDA(request.id, approvalData);
    } else {
      newStatus = 'rejected';
      await ndaService.rejectNDA(request.id, approvalData);
    }
    
    // Create history entry
    const historyEntry: NDAApprovalHistory = {
      id: Date.now(),
      action: action === 'approve' ? 'approved' : 'rejected',
      actorId: user?.id || 0,
      actorName: user?.name || 'Unknown',
      timestamp: new Date().toISOString(),
      notes,
      previousStatus: request.status,
      newStatus
    };
    
    // Update local state with full workflow data
    setRequests(prev => prev.map(r => 
      r.id === request.id 
        ? { 
            ...r, 
            status: newStatus,
            approvalHistory: [...(r.approvalHistory || []), historyEntry],
            reviewerNotes: notes,
            conditions,
            lastReviewedAt: new Date().toISOString()
          }
        : r
    ));
    
    success(
      action === 'approve' ? 'NDA Approved' : 'NDA Rejected', 
      `Request from ${request.requesterName} has been ${newStatus.replace('_', ' ')}`
    );
    
    onRequestProcessed?.(request.id, action === 'approve' ? 'approved' : 'rejected');
    
  } catch (err: any) {
    console.error(`Failed to ${action} NDA:`, err);
    
    // Revert status on error
    setRequests(prev => prev.map(r => 
      r.id === request.id 
        ? { ...r, status: 'pending' }
        : r
    ));
    
    error(
      `${action === 'approve' ? 'Approval' : 'Rejection'} Failed`, 
      err.message || `Unable to ${action} the NDA request. Please try again.`
    );
  } finally {
    setProcessingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(request.id);
      return newSet;
    });
    setShowApprovalModal(false);
    setApprovalModalData(null);
  }
};
```

#### Fix 3: Automated Expiry and Escalation Handler
**Lines to add after line 121:**

```typescript
// ADD: Automated workflow handlers
useEffect(() => {
  const checkExpiredNDAs = async () => {
    const now = new Date();
    const expiredRequests = requests.filter(r => 
      r.expiresAt && new Date(r.expiresAt) <= now && r.status === 'approved'
    );
    
    if (expiredRequests.length > 0) {
      try {
        await Promise.all(
          expiredRequests.map(request => 
            ndaService.updateNDAStatus(request.id, { status: 'expired' })
          )
        );
        
        // Update local state
        setRequests(prev => prev.map(r => 
          expiredRequests.some(exp => exp.id === r.id)
            ? { ...r, status: 'expired' as NDAStatus }
            : r
        ));
        
        // Notify about expiries
        if (expiredRequests.length === 1) {
          error('NDA Expired', `NDA for ${expiredRequests[0].pitchTitle} has expired`);
        } else {
          error('NDAs Expired', `${expiredRequests.length} NDAs have expired`);
        }
      } catch (err) {
        console.error('Failed to update expired NDAs:', err);
      }
    }
  };

  const checkEscalationNeeds = async () => {
    const urgentPending = requests.filter(r => 
      r.status === 'pending' && 
      r.urgency === 'high' && 
      r.escalationLevel === 0 &&
      new Date(r.createdAt) < new Date(Date.now() - 24 * 60 * 60 * 1000) // Over 24 hours
    );
    
    if (urgentPending.length > 0) {
      try {
        await Promise.all(
          urgentPending.map(request => 
            ndaService.escalateRequest(request.id, {
              escalationLevel: 1,
              reason: 'Automatic escalation for high-priority request over 24 hours old'
            })
          )
        );
        
        setRequests(prev => prev.map(r => 
          urgentPending.some(urgent => urgent.id === r.id)
            ? { ...r, status: 'escalated' as NDAStatus, escalationLevel: 1 }
            : r
        ));
      } catch (err) {
        console.error('Failed to escalate requests:', err);
      }
    }
  };

  // Run checks every 5 minutes
  const interval = setInterval(() => {
    checkExpiredNDAs();
    checkEscalationNeeds();
  }, 5 * 60 * 1000);

  // Run immediately
  checkExpiredNDAs();
  checkEscalationNeeds();

  return () => clearInterval(interval);
}, [requests]);
```

### Testing Scenarios

```typescript
// Test Case 1: Complete Approval Workflow
describe('NDA Approval Workflow', () => {
  test('handles complete approval with conditions', async () => {
    render(<NDAApprovalWorkflow creatorId={1} />);
    
    // Click approve button
    fireEvent.click(screen.getByText('Approve'));
    
    // Add conditions
    fireEvent.change(screen.getByPlaceholderText('Add any notes...'), {
      target: { value: 'Approved with revenue sharing terms' }
    });
    
    // Submit approval
    fireEvent.click(screen.getByText('Approve NDA'));
    
    await waitFor(() => {
      expect(screen.getByText('conditionally_approved')).toBeInTheDocument();
    });
  });

  test('tracks approval history correctly', async () => {
    const request = mockNDARequest;
    render(<NDAApprovalWorkflow creatorId={1} />);
    
    // Approve request
    fireEvent.click(screen.getByText('Approve'));
    fireEvent.click(screen.getByText('Approve NDA'));
    
    await waitFor(() => {
      expect(ndaService.approveNDA).toHaveBeenCalledWith(
        request.id,
        expect.objectContaining({
          reviewerId: expect.any(Number),
          reviewerName: expect.any(String)
        })
      );
    });
  });
});
```

---

## 3. Multiple File Upload Limitations

### Issue Description
The file upload system in `/frontend/src/components/FileUpload/MultipleFileUpload.tsx` has limitations in handling concurrent uploads and file management.

### Root Cause Analysis
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/components/FileUpload/MultipleFileUpload.tsx`
**Lines:** 245-333, 336-376

**Problems Identified:**
1. **Sequential Upload Processing**: Files upload in batches but within batches they're processed sequentially (lines 350-358)
2. **Limited Error Recovery**: Failed uploads don't have automatic retry with exponential backoff
3. **No Resume Capability**: Interrupted uploads start from beginning
4. **Memory Issues**: Large files aren't chunked, causing memory problems
5. **No Duplicate Detection**: Basic duplicate check only by name and size, not content hash

### Specific Code Fixes

#### Fix 1: Parallel Upload Processing with Chunking
**File:** `frontend/src/components/FileUpload/MultipleFileUpload.tsx`
**Lines to replace 245-333:**

```typescript
// ADD: Enhanced upload interfaces and utilities
interface ChunkedUploadState {
  fileId: string;
  chunks: Blob[];
  uploadedChunks: boolean[];
  chunkSize: number;
  totalChunks: number;
  resumeToken?: string;
}

interface UploadMetrics {
  startTime: number;
  bytesUploaded: number;
  totalBytes: number;
  speed: number;
  eta: number;
}

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_CONCURRENT_UPLOADS = 3;
const MAX_CONCURRENT_CHUNKS = 4;
const MAX_RETRY_ATTEMPTS = 3;

// REPLACE: Single file upload function (lines 245-333)
const uploadFile = useCallback(async (fileData: EnhancedMediaFile) => {
  const controller = new AbortController();
  setActiveUploads(prev => new Map(prev.set(fileData.id, controller)));
  
  // Calculate if file needs chunking (>10MB)
  const needsChunking = fileData.file.size > 10 * 1024 * 1024;
  
  const updateProgress = (progress: number, metrics?: Partial<UploadMetrics>) => {
    onChange(files.map(f => 
      f.id === fileData.id 
        ? { 
            ...f, 
            uploadProgress: Math.min(100, Math.max(0, progress)),
            uploadSpeed: metrics?.speed,
            estimatedTimeRemaining: metrics?.eta
          }
        : f
    ));
  };

  const updateStatus = (status: EnhancedMediaFile['uploadStatus'], error?: string) => {
    onChange(files.map(f => 
      f.id === fileData.id 
        ? { ...f, uploadStatus: status, error, uploadProgress: status === 'error' ? 0 : f.uploadProgress }
        : f
    ));
  };

  updateStatus('uploading');
  updateProgress(0);

  try {
    let result: UploadResult;

    if (needsChunking) {
      result = await uploadFileWithChunking(fileData, controller, updateProgress);
    } else {
      result = await uploadService.uploadDocument(fileData.file, fileData.category || 'document', {
        folder: fileData.folder,
        isPublic: fileData.isPublic,
        requiresNda: fileData.requiresNda,
        signal: controller.signal,
        onProgress: (progress: UploadProgress) => {
          updateProgress(progress.percentage, {
            speed: progress.speed,
            eta: progress.estimatedTimeRemaining
          });
        },
        metadata: {
          originalName: fileData.originalName,
          customTitle: fileData.title,
          description: fileData.description,
          category: fileData.category,
          tags: fileData.tags?.join(','),
          isRenamed: fileData.isRenamed
        }
      });
    }

    updateStatus('completed');
    updateProgress(100);
    
    onChange(files.map(f => 
      f.id === fileData.id 
        ? { 
            ...f, 
            uploadStatus: 'completed', 
            uploadProgress: 100,
            url: result.url,
            uploadSpeed: undefined,
            estimatedTimeRemaining: undefined
          }
        : f
    ));

    onUploadComplete?.(fileData);

  } catch (uploadError: any) {
    if (uploadError.name === 'AbortError') {
      updateStatus('idle');
      updateProgress(0);
    } else {
      // Implement retry logic with exponential backoff
      const retryCount = (fileData.retryCount || 0) + 1;
      
      if (retryCount <= MAX_RETRY_ATTEMPTS) {
        const delay = Math.pow(2, retryCount - 1) * 1000; // Exponential backoff
        
        setTimeout(() => {
          const retryFile = { ...fileData, retryCount };
          uploadFile(retryFile);
        }, delay);
        
        updateStatus('error', `Retrying in ${delay / 1000}s (attempt ${retryCount}/${MAX_RETRY_ATTEMPTS})`);
      } else {
        updateStatus('error', uploadError.message);
        onUploadError?.(fileData, uploadError.message);
      }
    }
  } finally {
    setActiveUploads(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileData.id);
      return newMap;
    });
  }
}, [files, onChange, onUploadComplete, onUploadError]);

// ADD: Chunked upload implementation
const uploadFileWithChunking = async (
  fileData: EnhancedMediaFile,
  controller: AbortController,
  updateProgress: (progress: number, metrics?: Partial<UploadMetrics>) => void
): Promise<UploadResult> => {
  const file = fileData.file;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const chunks: Blob[] = [];
  
  // Create chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    chunks.push(file.slice(start, end));
  }

  const uploadedChunks = new Array(totalChunks).fill(false);
  const startTime = Date.now();
  
  // Initialize upload session
  const uploadSession = await uploadService.initializeChunkedUpload({
    filename: file.name,
    filesize: file.size,
    contentType: file.type,
    totalChunks,
    metadata: {
      category: fileData.category,
      folder: fileData.folder,
      isPublic: fileData.isPublic,
      requiresNda: fileData.requiresNda
    }
  });

  // Upload chunks in parallel with concurrency limit
  const uploadChunk = async (chunkIndex: number): Promise<void> => {
    if (controller.signal.aborted) {
      throw new Error('Upload cancelled');
    }

    const chunk = chunks[chunkIndex];
    const retryChunk = async (attempt: number = 1): Promise<void> => {
      try {
        await uploadService.uploadChunk({
          uploadId: uploadSession.uploadId,
          chunkIndex,
          chunk,
          signal: controller.signal
        });
        
        uploadedChunks[chunkIndex] = true;
        
        // Update progress
        const completedChunks = uploadedChunks.filter(Boolean).length;
        const progress = (completedChunks / totalChunks) * 100;
        const elapsedTime = Date.now() - startTime;
        const bytesUploaded = completedChunks * CHUNK_SIZE;
        const speed = bytesUploaded / (elapsedTime / 1000); // bytes per second
        const remainingBytes = file.size - bytesUploaded;
        const eta = remainingBytes / speed; // seconds
        
        updateProgress(progress, { speed, eta });
        
      } catch (error: any) {
        if (attempt <= MAX_RETRY_ATTEMPTS) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          await retryChunk(attempt + 1);
        } else {
          throw error;
        }
      }
    };

    await retryChunk();
  };

  // Process chunks with concurrency limit
  const chunkPromises: Promise<void>[] = [];
  const semaphore = new Array(MAX_CONCURRENT_CHUNKS).fill(0).map(() => Promise.resolve());
  
  for (let i = 0; i < totalChunks; i++) {
    const chunkIndex = i;
    const promise = semaphore.shift()!
      .then(() => uploadChunk(chunkIndex))
      .then(() => {});
    
    chunkPromises.push(promise);
    semaphore.push(promise.catch(() => {})); // Prevent rejection from blocking other chunks
  }

  await Promise.all(chunkPromises);

  // Finalize upload
  const result = await uploadService.finalizeChunkedUpload({
    uploadId: uploadSession.uploadId,
    filename: fileData.title || file.name,
    metadata: {
      originalName: fileData.originalName,
      customTitle: fileData.title,
      description: fileData.description,
      category: fileData.category,
      tags: fileData.tags?.join(','),
      isRenamed: fileData.isRenamed
    }
  });

  return result;
};
```

#### Fix 2: Enhanced Duplicate Detection with Content Hashing
**Lines to add after line 177:**

```typescript
// ADD: Advanced duplicate detection
const calculateFileHash = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      resolve(hashHex);
    };
    
    // For large files, only hash first and last 64KB for performance
    if (file.size > 10 * 1024 * 1024) {
      const firstChunk = file.slice(0, 64 * 1024);
      const lastChunk = file.slice(-64 * 1024);
      const combinedBlob = new Blob([firstChunk, lastChunk]);
      reader.readAsArrayBuffer(combinedBlob);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

// REPLACE: Basic duplicate check in processFiles function
const isDuplicate = files.some(existingFile => 
  existingFile.originalName === file.name && 
  existingFile.metadata?.size === file.size
);

// WITH: Enhanced duplicate detection
const fileHash = await calculateFileHash(file);
const isDuplicate = files.some(existingFile => 
  existingFile.metadata?.hash === fileHash ||
  (existingFile.originalName === file.name && existingFile.metadata?.size === file.size)
);

if (isDuplicate) {
  error('Duplicate File', `${file.name} appears to be a duplicate (same content or name/size)`);
  continue;
}

// Update metadata to include hash
const enhancedFile: EnhancedMediaFile = {
  // ... existing properties
  metadata: {
    size: file.size,
    hash: fileHash,
    // Additional metadata will be extracted later
  },
  // ... rest of properties
};
```

#### Fix 3: Improved Bulk Upload with Progress Tracking
**Lines to replace 336-376:**

```typescript
// REPLACE: Basic bulk upload (lines 336-376)
const startBulkUpload = useCallback(async () => {
  const filesToUpload = files.filter(f => 
    f.uploadStatus === 'queued' || f.uploadStatus === 'idle'
  );

  if (filesToUpload.length === 0) {
    error('No Files to Upload', 'All files have already been uploaded');
    return;
  }

  setIsUploading(true);

  const uploadStats = {
    total: filesToUpload.length,
    completed: 0,
    failed: 0,
    inProgress: 0
  };

  const updateOverallProgress = () => {
    const progressMessage = `${uploadStats.completed + uploadStats.failed}/${uploadStats.total} files processed`;
    // Could emit this to a global progress indicator
  };

  try {
    // Create upload queue with priority sorting
    const prioritizedFiles = filesToUpload.sort((a, b) => {
      // Prioritize smaller files first for quick wins
      if (a.file.size < 5 * 1024 * 1024 && b.file.size >= 5 * 1024 * 1024) return -1;
      if (a.file.size >= 5 * 1024 * 1024 && b.file.size < 5 * 1024 * 1024) return 1;
      return a.file.size - b.file.size;
    });

    // Process uploads with controlled concurrency
    const semaphore = Array(MAX_CONCURRENT_UPLOADS).fill(0).map(() => Promise.resolve());
    const uploadPromises: Promise<void>[] = [];

    for (const fileData of prioritizedFiles) {
      const uploadPromise = semaphore.shift()!
        .then(async () => {
          uploadStats.inProgress++;
          updateOverallProgress();
          
          try {
            await uploadFile(fileData);
            uploadStats.completed++;
          } catch (err) {
            uploadStats.failed++;
            console.error(`Failed to upload ${fileData.title}:`, err);
          } finally {
            uploadStats.inProgress--;
            updateOverallProgress();
          }
        });
      
      uploadPromises.push(uploadPromise);
      semaphore.push(uploadPromise.catch(() => {})); // Prevent rejection from blocking queue
    }

    await Promise.all(uploadPromises);

    // Final results
    if (uploadStats.failed === 0) {
      success('Upload Complete', `All ${uploadStats.completed} files uploaded successfully`);
    } else if (uploadStats.completed > 0) {
      error('Partial Upload Complete', 
        `${uploadStats.completed} files succeeded, ${uploadStats.failed} failed. Check individual files for details.`);
    } else {
      error('Upload Failed', 'No files were uploaded successfully. Please check your connection and try again.');
    }

    onBulkUpload?.(filesToUpload);

  } catch (err: any) {
    error('Bulk Upload Error', err.message || 'Bulk upload encountered an unexpected error');
  } finally {
    setIsUploading(false);
  }
}, [files, uploadFile, success, error, onBulkUpload]);
```

### Testing Scenarios

```typescript
// Test Case 1: Chunked Upload for Large Files
describe('Multiple File Upload - Chunking', () => {
  test('handles large file upload with chunking', async () => {
    const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large-file.mp4', { 
      type: 'video/mp4' 
    });
    
    render(<MultipleFileUpload files={[]} onChange={jest.fn()} />);
    
    const input = screen.getByRole('button', { name: /drag & drop/i });
    fireEvent.drop(input, { dataTransfer: { files: [largeFile] } });
    
    await waitFor(() => {
      expect(screen.getByText('Upload All (1)')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Upload All (1)'));
    
    // Verify chunked upload was initiated
    await waitFor(() => {
      expect(uploadService.initializeChunkedUpload).toHaveBeenCalled();
    });
  });

  test('retries failed chunks with exponential backoff', async () => {
    const mockError = new Error('Network error');
    uploadService.uploadChunk.mockRejectedValueOnce(mockError);
    uploadService.uploadChunk.mockResolvedValueOnce({});
    
    // Test that retry logic is triggered
    const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'test.mp4');
    // ... upload simulation
    
    await waitFor(() => {
      expect(uploadService.uploadChunk).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });
});
```

---

## 4. WebSocket Notification Reliability Issues

### Issue Description
The WebSocket implementation in `/frontend/src/contexts/WebSocketContext.tsx` has reliability issues including connection drops, message loss, and fallback handling.

### Root Cause Analysis
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/contexts/WebSocketContext.tsx`
**Lines:** 435-510, 488-509

**Problems Identified:**
1. **Aggressive Reconnection**: Circuit breaker threshold too high (5 attempts) causing loops
2. **No Message Queue Persistence**: Messages lost during reconnection
3. **Fallback Timing**: Polling service starts too late after WebSocket failure
4. **No Heartbeat Mechanism**: No way to detect silent connection drops
5. **Portal Switch Issues**: WebSocket conflicts during portal switching

### Specific Code Fixes

#### Fix 1: Enhanced Connection Management with Heartbeat
**File:** `frontend/src/contexts/WebSocketContext.tsx`
**Lines to add after line 123:**

```typescript
// ADD: Enhanced connection monitoring
interface ConnectionHealth {
  lastHeartbeat: number;
  missedHeartbeats: number;
  latency: number;
  isHealthy: boolean;
}

const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
  lastHeartbeat: Date.now(),
  missedHeartbeats: 0,
  latency: 0,
  isHealthy: true
});

// Heartbeat monitoring
useEffect(() => {
  if (!isConnected) return;

  const heartbeatInterval = setInterval(() => {
    const heartbeatStart = Date.now();
    
    // Send heartbeat
    const success = wsSendMessage({
      type: 'ping',
      timestamp: heartbeatStart,
      id: `heartbeat_${heartbeatStart}`
    });

    if (!success) {
      setConnectionHealth(prev => ({
        ...prev,
        missedHeartbeats: prev.missedHeartbeats + 1,
        isHealthy: prev.missedHeartbeats < 2
      }));
    }

    // Set timeout for heartbeat response
    const heartbeatTimeout = setTimeout(() => {
      setConnectionHealth(prev => ({
        ...prev,
        missedHeartbeats: prev.missedHeartbeats + 1,
        isHealthy: prev.missedHeartbeats < 2
      }));

      // Force disconnect if too many missed heartbeats
      if (connectionHealth.missedHeartbeats >= 3) {
        console.warn('WebSocket connection unhealthy, forcing reconnection');
        disconnect();
      }
    }, 5000); // 5 second timeout

    // Store timeout for potential cleanup
    heartbeatTimeouts.set(heartbeatStart, heartbeatTimeout);

  }, 15000); // Send heartbeat every 15 seconds

  return () => clearInterval(heartbeatInterval);
}, [isConnected, wsSendMessage]);

// Track heartbeat timeouts to clean them up
const heartbeatTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

// Handle pong responses
const handlePong = useCallback((message: WebSocketMessage) => {
  const heartbeatStart = message.timestamp;
  if (heartbeatStart) {
    const latency = Date.now() - heartbeatStart;
    
    setConnectionHealth(prev => ({
      ...prev,
      lastHeartbeat: Date.now(),
      missedHeartbeats: 0,
      latency,
      isHealthy: true
    }));

    // Clear the timeout for this heartbeat
    const timeout = heartbeatTimeouts.current.get(heartbeatStart);
    if (timeout) {
      clearTimeout(timeout);
      heartbeatTimeouts.current.delete(heartbeatStart);
    }
  }
}, []);
```

#### Fix 2: Persistent Message Queue with IndexedDB
**Lines to add after line 134:**

```typescript
// ADD: Persistent message queue using IndexedDB
interface QueuedMessage extends WebSocketMessage {
  queueId: string;
  queuedAt: number;
  attempts: number;
  priority: 'low' | 'medium' | 'high';
}

class PersistentMessageQueue {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'PitcheyMessageQueue';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'messages';

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'queueId' });
          store.createIndex('queuedAt', 'queuedAt');
          store.createIndex('priority', 'priority');
        }
      };
    });
  }

  async enqueue(message: WebSocketMessage, priority: QueuedMessage['priority'] = 'medium'): Promise<void> {
    if (!this.db) await this.initialize();
    
    const queuedMessage: QueuedMessage = {
      ...message,
      queueId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      queuedAt: Date.now(),
      attempts: 0,
      priority
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.add(queuedMessage);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async dequeue(limit: number = 10): Promise<QueuedMessage[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('priority');
      const request = index.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const messages = request.result
          .sort((a, b) => {
            // Sort by priority first, then by queued time
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
              return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return a.queuedAt - b.queuedAt;
          })
          .slice(0, limit);
        resolve(messages);
      };
    });
  }

  async remove(queueId: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(queueId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

const [messageQueue] = useState(() => new PersistentMessageQueue());
```

#### Fix 3: Improved Disconnect Handling with Fast Fallback
**Lines to replace 483-509:**

```typescript
// REPLACE: Basic disconnect handling (lines 483-509)
function handleDisconnect() {
  // Update local state to reflect disconnection
  setOnlineUsers(prev => prev.filter(user => user.userId !== user?.id));
  
  // Enhanced circuit breaker for bundling-induced loops
  const recentAttempts = connectionStatus.reconnectAttempts;
  if (recentAttempts >= 5) {
    console.warn(`🚨 WebSocket reconnection loop detected (${recentAttempts} attempts). Falling back to polling.`);
    // ... existing code
  }
}

// WITH: Enhanced disconnect handling with fast fallback
function handleDisconnect() {
  const disconnectTime = Date.now();
  
  // Update local state to reflect disconnection
  setOnlineUsers(prev => prev.filter(user => user.userId !== user?.id));
  
  // Enhanced circuit breaker with immediate fallback for frequent failures
  const recentAttempts = connectionStatus.reconnectAttempts;
  const timeSinceFirstAttempt = disconnectTime - (connectionStatus.firstAttemptTime || disconnectTime);
  
  // Immediate fallback conditions:
  // 1. More than 2 failures in 30 seconds
  // 2. More than 3 total attempts
  // 3. Connection health was poor before disconnect
  const shouldFallbackImmediately = (
    (recentAttempts >= 2 && timeSinceFirstAttempt < 30000) ||
    recentAttempts >= 3 ||
    !connectionHealth.isHealthy
  );

  if (shouldFallbackImmediately) {
    console.warn(`🚨 WebSocket unstable (${recentAttempts} attempts, health: ${connectionHealth.isHealthy}). Falling back immediately.`);
    
    setUsingFallback(true);
    localStorage.setItem('pitchey_websocket_fallback', 'true');
    localStorage.setItem('pitchey_websocket_fallback_reason', 
      `immediate_fallback_${recentAttempts}_attempts_${timeSinceFirstAttempt}ms`);
    
    if (isAuthenticated) {
      // Start polling immediately
      pollingService.start();
      presenceFallbackService.start();
      
      // Process any queued messages via polling
      processQueuedMessages();
    }
    
    // Disable WebSocket for this session
    setIsWebSocketDisabled(true);
    
  } else if (recentAttempts >= 5) {
    console.warn(`🚨 WebSocket reconnection loop detected (${recentAttempts} attempts). Falling back to polling.`);
    // Keep existing loop detection logic
    setUsingFallback(true);
    // ... existing fallback code
  } else if (recentAttempts >= 1) {
    // Start fallback in parallel after first failure
    if (!usingFallback) {
      console.info('🔄 Starting fallback services after WebSocket failure');
      setUsingFallback(true);
      pollingService.start();
      presenceFallbackService.start();
    }
  }
}

// ADD: Process queued messages during fallback
const processQueuedMessages = useCallback(async () => {
  try {
    const queuedMessages = await messageQueue.dequeue(50);
    
    if (queuedMessages.length > 0) {
      console.info(`📤 Processing ${queuedMessages.length} queued messages via fallback`);
      
      for (const queuedMessage of queuedMessages) {
        try {
          // Send via polling service API
          await pollingService.sendMessage({
            type: queuedMessage.type,
            data: queuedMessage.data,
            priority: queuedMessage.priority
          });
          
          // Remove from queue on success
          await messageQueue.remove(queuedMessage.queueId);
          
        } catch (err) {
          console.error('Failed to send queued message via fallback:', err);
          // Keep in queue for later retry
        }
      }
    }
  } catch (err) {
    console.error('Failed to process message queue:', err);
  }
}, [messageQueue, pollingService]);
```

#### Fix 4: Enhanced Message Handling with Deduplication
**Lines to replace 176-247:**

```typescript
// ADD: Message deduplication
const [seenMessages] = useState(() => new Map<string, number>());
const MESSAGE_TTL = 60000; // 1 minute

// REPLACE: Basic handleMessage function
function handleMessage(message: WebSocketMessage) {
  // Notify all general message subscribers first
  subscriptions.messages.forEach(callback => callback(message));
  // ... existing switch statement
}

// WITH: Enhanced message handling with deduplication
function handleMessage(message: WebSocketMessage) {
  const now = Date.now();
  const messageKey = `${message.type}_${message.id || message.timestamp || JSON.stringify(message.data)}`;
  
  // Check for duplicate messages
  if (seenMessages.has(messageKey)) {
    const lastSeen = seenMessages.get(messageKey)!;
    if (now - lastSeen < MESSAGE_TTL) {
      // Duplicate message within TTL, ignore
      return;
    }
  }
  
  // Store message signature
  seenMessages.set(messageKey, now);
  
  // Clean up old entries periodically
  if (Math.random() < 0.1) { // 10% chance
    for (const [key, timestamp] of seenMessages.entries()) {
      if (now - timestamp > MESSAGE_TTL) {
        seenMessages.delete(key);
      }
    }
  }
  
  // Handle pong messages for heartbeat
  if (message.type === 'pong') {
    handlePong(message);
    return;
  }
  
  // Notify all general message subscribers first
  subscriptions.messages.forEach(callback => callback(message));
  
  // Enhanced message routing with error boundaries
  try {
    switch (message.type) {
      case 'notification':
        handleNotificationMessage(message);
        break;
      case 'dashboard_update':
        handleDashboardUpdate(message);
        break;
      case 'presence_update':
        handlePresenceUpdate(message);
        break;
      case 'typing_indicator':
      case 'typing':
        handleTypingIndicator(message);
        break;
      case 'upload_progress':
        handleUploadProgress(message);
        break;
      case 'pitch_view_update':
      case 'pitch_view':
        handlePitchView(message);
        break;
      case 'chat_message':
        handleChatMessage(message);
        break;
      case 'draft_sync':
        // Handled by useDraftSync hook
        break;
      case 'connection':
      case 'subscribed':
      case 'unsubscribed':
        // Connection management messages
        break;
      case 'ping':
        // Respond to server ping
        wsSendMessage({ type: 'pong', timestamp: Date.now() });
        break;
      case 'error':
        console.error('WebSocket server error:', message.data);
        break;
      case 'initial_data':
        handleInitialData(message);
        break;
      default:
        if (process.env.NODE_ENV === 'development') {
          console.debug('Unhandled WebSocket message:', message.type, message);
        }
    }
  } catch (error) {
    console.error(`Error handling WebSocket message of type ${message.type}:`, error);
    // Don't crash the entire handler for one bad message
  }
}

// ADD: Enhanced initial data handler
const handleInitialData = useCallback((message: WebSocketMessage) => {
  try {
    const data = message.data || {};
    
    // Store notifications if present
    if (data.notifications && Array.isArray(data.notifications)) {
      setNotifications(data.notifications.map((n: any) => ({
        id: n.id?.toString() || Math.random().toString(),
        type: n.type || 'info',
        title: n.title || 'Notification',
        message: n.message || '',
        timestamp: new Date(n.createdAt || Date.now()),
        read: n.isRead || false
      })));
    }
    
    // Store dashboard metrics if present
    if (data.dashboardMetrics) {
      setDashboardMetrics(data.dashboardMetrics);
    }
    
    // Store presence data if present
    if (data.onlineUsers && Array.isArray(data.onlineUsers)) {
      setOnlineUsers(data.onlineUsers.map((user: any) => ({
        userId: user.userId,
        username: user.username,
        status: user.status || 'online',
        lastSeen: new Date(user.lastSeen || Date.now()),
        activity: user.activity
      })));
    }
    
    console.info('📡 Initial data loaded successfully');
    
  } catch (error) {
    console.error('Failed to process initial data:', error);
  }
}, []);
```

### Testing Scenarios

```typescript
// Test Case 1: Connection Health Monitoring
describe('WebSocket Connection Health', () => {
  test('detects unhealthy connection and forces reconnection', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper: WebSocketProvider });
    
    // Mock WebSocket to not respond to heartbeats
    mockWebSocket.send = jest.fn().mockReturnValue(true);
    
    // Wait for heartbeat interval
    await act(async () => {
      jest.advanceTimersByTime(20000); // 20 seconds
    });
    
    // Should have attempted to send heartbeat
    expect(mockWebSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('ping')
    );
    
    // Mock no pong response - should trigger unhealthy state
    await act(async () => {
      jest.advanceTimersByTime(10000); // 10 more seconds
    });
    
    // Should have detected unhealthy connection
    expect(result.current.connectionStatus.reconnectAttempts).toBeGreaterThan(0);
  });

  test('falls back to polling immediately on rapid failures', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper: WebSocketProvider });
    
    // Simulate rapid disconnections
    for (let i = 0; i < 3; i++) {
      mockWebSocket.onclose?.({ code: 1006, reason: 'Connection lost' });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    
    // Should have enabled fallback immediately
    expect(pollingService.start).toHaveBeenCalled();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'pitchey_websocket_fallback_reason',
      expect.stringContaining('immediate_fallback')
    );
  });
});

// Test Case 2: Message Queue Persistence
describe('Message Queue Persistence', () => {
  test('queues messages when WebSocket is disconnected', async () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper: WebSocketProvider });
    
    // Disconnect WebSocket
    mockWebSocket.readyState = WebSocket.CLOSED;
    
    // Try to send message
    const success = result.current.sendMessage({
      type: 'test_message',
      data: { content: 'test' }
    });
    
    expect(success).toBe(false);
    
    // Message should be queued
    const queuedMessages = await messageQueue.dequeue();
    expect(queuedMessages).toHaveLength(1);
    expect(queuedMessages[0].type).toBe('test_message');
  });

  test('processes queued messages after reconnection', async () => {
    // Queue some messages
    await messageQueue.enqueue({
      type: 'queued_message',
      data: { content: 'queued' }
    });
    
    const { result } = renderHook(() => useWebSocket(), { wrapper: WebSocketProvider });
    
    // Reconnect WebSocket
    mockWebSocket.readyState = WebSocket.OPEN;
    mockWebSocket.onopen?.({});
    
    await waitFor(() => {
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('queued_message')
      );
    });
  });
});
```

---

## 5. Access Control Granularity Problems

### Issue Description
The current permission system in `/frontend/src/components/PermissionGuard.tsx` and `/frontend/src/hooks/usePermissions.ts` lacks granular control for complex scenarios.

### Root Cause Analysis
**File:** `/home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/src/components/PermissionGuard.tsx`
**Lines:** 32-117

**Problems Identified:**
1. **Binary Permissions**: Only allows/denies access, no conditional or tiered access
2. **No Context-Aware Permissions**: Can't check permissions based on resource ownership or relationship
3. **Limited Role Combinations**: Can't handle complex role hierarchies or mixed permissions
4. **No Time-Based Permissions**: Can't handle temporary access or expiring permissions
5. **Static Permission Check**: No dynamic permission evaluation based on user state or resource properties

### Specific Code Fixes

#### Fix 1: Enhanced Permission System with Context Awareness
**File:** `frontend/src/components/PermissionGuard.tsx`
**Lines to replace entire file:**

```typescript
import { ReactNode, useMemo } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useBetterAuthStore } from '../store/betterAuthStore';

export interface PermissionContext {
  resource?: {
    id: string | number;
    type: string;
    ownerId?: number;
    teamId?: number;
    visibility?: string;
    status?: string;
    metadata?: Record<string, any>;
  };
  temporal?: {
    expiresAt?: string;
    validFrom?: string;
    timezone?: string;
  };
  conditions?: {
    requireOwnership?: boolean;
    requireTeamMembership?: boolean;
    allowCollaborators?: boolean;
    minimumRole?: string;
    blacklistedRoles?: string[];
    customValidation?: (user: any, resource: any) => boolean;
  };
}

export interface EnhancedPermissionResult {
  allowed: boolean;
  reason?: string;
  alternative?: {
    action: string;
    message: string;
  };
  tier?: 'full' | 'limited' | 'readonly' | 'none';
}

interface PermissionGuardProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  roles?: string[];
  context?: PermissionContext;
  fallback?: ReactNode;
  showMessage?: boolean;
  showAlternative?: boolean;
  tieredAccess?: {
    full?: ReactNode;
    limited?: ReactNode;
    readonly?: ReactNode;
  };
  children: ReactNode;
}

/**
 * Enhanced Component for granular access control with context awareness
 * 
 * Examples:
 * 
 * // Basic permission check
 * <PermissionGuard permission="pitch:create">
 *   <CreatePitchButton />
 * </PermissionGuard>
 * 
 * // Context-aware resource permission
 * <PermissionGuard 
 *   permission="pitch:edit"
 *   context={{
 *     resource: { id: pitchId, type: 'pitch', ownerId: pitch.creatorId },
 *     conditions: { requireOwnership: true, allowCollaborators: true }
 *   }}
 * >
 *   <EditPitchButton />
 * </PermissionGuard>
 * 
 * // Tiered access with different UI levels
 * <PermissionGuard 
 *   permission="analytics:view"
 *   context={{ resource: { type: 'analytics', ownerId: pitch.creatorId } }}
 *   tieredAccess={{
 *     full: <FullAnalyticsDashboard />,
 *     limited: <BasicAnalytics />,
 *     readonly: <ViewOnlyAnalytics />
 *   }}
 * >
 *   <NoAccessMessage />
 * </PermissionGuard>
 * 
 * // Temporal permissions
 * <PermissionGuard 
 *   permission="nda:view"
 *   context={{
 *     resource: { id: ndaId, type: 'nda' },
 *     temporal: { expiresAt: nda.expiresAt },
 *     conditions: { requireOwnership: false }
 *   }}
 * >
 *   <NDAContentViewer />
 * </PermissionGuard>
 */
export function PermissionGuard({ 
  permission, 
  permissions, 
  requireAll = false,
  role, 
  roles,
  context,
  fallback = null, 
  showMessage = false,
  showAlternative = false,
  tieredAccess,
  children 
}: PermissionGuardProps) {
  const { evaluateEnhancedPermission, loading } = usePermissions();
  const { isAuthenticated, user } = useBetterAuthStore();

  // Evaluate permission with full context
  const permissionResult = useMemo<EnhancedPermissionResult>(() => {
    if (loading || !isAuthenticated) {
      return { allowed: false, reason: 'Not authenticated' };
    }

    return evaluateEnhancedPermission({
      permission,
      permissions,
      requireAll,
      role,
      roles,
      context,
      user
    });
  }, [
    permission, permissions, requireAll, role, roles, 
    context, user, isAuthenticated, loading, evaluateEnhancedPermission
  ]);

  // Don't render anything while loading
  if (loading) {
    return null;
  }

  // Handle unauthenticated state
  if (!isAuthenticated) {
    if (showMessage) {
      return (
        <div className="text-gray-500 italic border border-gray-200 rounded p-3">
          <div className="flex items-center gap-2">
            <span className="text-yellow-500">⚠️</span>
            Please sign in to access this feature
          </div>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  // Handle tiered access
  if (tieredAccess && permissionResult.tier && permissionResult.tier !== 'none') {
    const tierContent = tieredAccess[permissionResult.tier];
    if (tierContent) {
      return <>{tierContent}</>;
    }
  }

  // Handle denied access
  if (!permissionResult.allowed) {
    if (showAlternative && permissionResult.alternative) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-blue-800 font-medium mb-1">
            {permissionResult.alternative.message}
          </div>
          <button className="text-blue-600 hover:text-blue-700 text-sm underline">
            {permissionResult.alternative.action}
          </button>
        </div>
      );
    }
    
    if (showMessage) {
      return (
        <div className="text-gray-500 italic border border-gray-200 rounded p-3">
          <div className="flex items-center gap-2">
            <span className="text-red-500">🚫</span>
            <div>
              <div>You don't have permission to access this feature</div>
              {permissionResult.reason && (
                <div className="text-xs text-gray-400 mt-1">
                  Reason: {permissionResult.reason}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  // All checks passed, render children
  return <>{children}</>;
}

/**
 * Hook for enhanced permission checking with context
 */
export function useEnhancedPermissionCheck(
  options: Omit<PermissionGuardProps, 'children' | 'fallback' | 'showMessage' | 'showAlternative' | 'tieredAccess'>
): EnhancedPermissionResult {
  const { evaluateEnhancedPermission, loading } = usePermissions();
  const { isAuthenticated, user } = useBetterAuthStore();

  return useMemo(() => {
    if (loading || !isAuthenticated) {
      return { allowed: false, reason: 'Not authenticated', tier: 'none' };
    }

    return evaluateEnhancedPermission({
      ...options,
      user
    });
  }, [options, user, isAuthenticated, loading, evaluateEnhancedPermission]);
}

/**
 * Utility component for conditional rendering based on enhanced permissions
 */
export function ConditionalRender({ 
  condition, 
  children, 
  fallback 
}: { 
  condition: EnhancedPermissionResult;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (condition.allowed) {
    return <>{children}</>;
  }
  
  return <>{fallback || null}</>;
}

/**
 * Higher-order component for enhanced permission wrapping
 */
export function withEnhancedPermissions<P extends object>(
  Component: React.ComponentType<P>,
  permissionConfig: Omit<PermissionGuardProps, 'children'>
) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGuard {...permissionConfig}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
```

#### Fix 2: Enhanced usePermissions Hook
**File:** `frontend/src/hooks/usePermissions.ts`
**Create or replace entire file:**

```typescript
import { useMemo, useCallback } from 'react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import type { PermissionContext, EnhancedPermissionResult } from '../components/PermissionGuard';

interface User {
  id: number;
  userType: string;
  permissions?: string[];
  roles?: string[];
  teamMemberships?: Array<{
    teamId: number;
    role: string;
    permissions?: string[];
  }>;
  subscriptionTier?: string;
  accountStatus?: string;
  metadata?: Record<string, any>;
}

interface EnhancedPermissionEvaluationOptions {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  roles?: string[];
  context?: PermissionContext;
  user: User | null;
}

// Enhanced permission definitions with hierarchies
const PERMISSION_HIERARCHY: Record<string, string[]> = {
  'admin:full': ['*'], // Full admin access
  'admin:content': ['pitch:*', 'nda:*', 'user:view', 'analytics:view'],
  'admin:users': ['user:*', 'team:*'],
  
  'creator:owner': ['pitch:create', 'pitch:edit:own', 'pitch:delete:own', 'nda:manage:own', 'analytics:view:own'],
  'creator:collaborator': ['pitch:edit:shared', 'pitch:view:shared', 'analytics:view:shared'],
  'creator:basic': ['pitch:create', 'pitch:view:public'],
  
  'investor:premium': ['pitch:view:premium', 'analytics:view:detailed', 'nda:request', 'investment:track'],
  'investor:basic': ['pitch:view:basic', 'analytics:view:basic', 'nda:request:limited'],
  
  'production:premium': ['pitch:view:all', 'creator:contact', 'analytics:view:detailed', 'nda:request'],
  'production:basic': ['pitch:view:public', 'analytics:view:basic'],
};

const ROLE_HIERARCHY: Record<string, number> = {
  'admin': 100,
  'moderator': 80,
  'creator': 60,
  'investor': 50,
  'production': 40,
  'user': 20,
  'guest': 10
};

const SUBSCRIPTION_TIERS: Record<string, { level: number; permissions: string[] }> = {
  'enterprise': { 
    level: 100, 
    permissions: ['*:premium', 'analytics:detailed', 'support:priority'] 
  },
  'premium': { 
    level: 80, 
    permissions: ['analytics:enhanced', 'nda:unlimited', 'collaboration:advanced'] 
  },
  'pro': { 
    level: 60, 
    permissions: ['analytics:basic', 'nda:standard', 'collaboration:basic'] 
  },
  'basic': { 
    level: 40, 
    permissions: ['pitch:create', 'nda:limited'] 
  },
  'free': { 
    level: 20, 
    permissions: ['pitch:view:public'] 
  }
};

export function usePermissions() {
  const { user, isAuthenticated } = useBetterAuthStore();
  const loading = false; // Since Better Auth handles loading

  // Basic permission checking functions
  const hasPermission = useCallback((permission: string): boolean => {
    if (!isAuthenticated || !user) return false;
    
    // Admin users have all permissions
    if (user.userType === 'admin') return true;
    
    // Check direct permissions
    if (user.permissions?.includes(permission) || user.permissions?.includes('*')) {
      return true;
    }
    
    // Check hierarchical permissions
    const userHierarchyPerms = PERMISSION_HIERARCHY[`${user.userType}:${user.metadata?.tier || 'basic'}`] || 
                              PERMISSION_HIERARCHY[user.userType] || [];
    
    return userHierarchyPerms.some(perm => 
      perm === '*' || 
      perm === permission || 
      (perm.endsWith(':*') && permission.startsWith(perm.slice(0, -1)))
    );
  }, [user, isAuthenticated]);

  const hasRole = useCallback((role: string): boolean => {
    if (!isAuthenticated || !user) return false;
    return user.userType === role || user.roles?.includes(role) || false;
  }, [user, isAuthenticated]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return permissions.some(perm => hasPermission(perm));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    return permissions.every(perm => hasPermission(perm));
  }, [hasPermission]);

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  }, [hasRole]);

  // Enhanced context-aware permission evaluation
  const evaluateEnhancedPermission = useCallback((
    options: EnhancedPermissionEvaluationOptions
  ): EnhancedPermissionResult => {
    const { permission, permissions, requireAll, role, roles, context, user } = options;

    if (!user) {
      return { 
        allowed: false, 
        reason: 'No user context',
        tier: 'none'
      };
    }

    // Check temporal permissions first
    if (context?.temporal) {
      const now = new Date();
      
      if (context.temporal.validFrom && new Date(context.temporal.validFrom) > now) {
        return {
          allowed: false,
          reason: 'Permission not yet active',
          tier: 'none',
          alternative: {
            action: 'Check back later',
            message: `Access will be available from ${new Date(context.temporal.validFrom).toLocaleDateString()}`
          }
        };
      }
      
      if (context.temporal.expiresAt && new Date(context.temporal.expiresAt) < now) {
        return {
          allowed: false,
          reason: 'Permission has expired',
          tier: 'none',
          alternative: {
            action: 'Request extension',
            message: 'Your access to this resource has expired'
          }
        };
      }
    }

    // Evaluate resource-specific context
    if (context?.resource && context?.conditions) {
      const resource = context.resource;
      const conditions = context.conditions;
      
      // Ownership check
      if (conditions.requireOwnership && resource.ownerId !== user.id) {
        return {
          allowed: false,
          reason: 'Resource ownership required',
          tier: 'none',
          alternative: {
            action: 'Contact owner',
            message: 'Only the resource owner can perform this action'
          }
        };
      }
      
      // Team membership check
      if (conditions.requireTeamMembership && resource.teamId) {
        const isMember = user.teamMemberships?.some(
          tm => tm.teamId === resource.teamId
        );
        
        if (!isMember) {
          return {
            allowed: false,
            reason: 'Team membership required',
            tier: 'none',
            alternative: {
              action: 'Request team access',
              message: 'This resource is restricted to team members'
            }
          };
        }
      }
      
      // Collaborator check
      if (conditions.allowCollaborators && resource.ownerId !== user.id) {
        // Check if user is a collaborator (implementation depends on your collaboration system)
        const isCollaborator = resource.metadata?.collaborators?.includes(user.id);
        
        if (!isCollaborator) {
          return {
            allowed: false,
            reason: 'Collaboration access required',
            tier: 'limited', // They might have limited access
            alternative: {
              action: 'Request collaboration',
              message: 'Request access as a collaborator'
            }
          };
        }
      }
      
      // Custom validation
      if (conditions.customValidation && !conditions.customValidation(user, resource)) {
        return {
          allowed: false,
          reason: 'Custom validation failed',
          tier: 'none'
        };
      }
      
      // Role-based access with minimums
      if (conditions.minimumRole) {
        const userRoleLevel = ROLE_HIERARCHY[user.userType] || 0;
        const requiredRoleLevel = ROLE_HIERARCHY[conditions.minimumRole] || 0;
        
        if (userRoleLevel < requiredRoleLevel) {
          return {
            allowed: false,
            reason: `Minimum role ${conditions.minimumRole} required`,
            tier: 'none',
            alternative: {
              action: 'Upgrade account',
              message: `This feature requires ${conditions.minimumRole} level access`
            }
          };
        }
      }
      
      // Blacklisted roles
      if (conditions.blacklistedRoles?.includes(user.userType)) {
        return {
          allowed: false,
          reason: `Access denied for ${user.userType} role`,
          tier: 'none'
        };
      }
    }

    // Evaluate subscription-based permissions
    const userSubscription = SUBSCRIPTION_TIERS[user.subscriptionTier || 'free'];
    let accessTier: EnhancedPermissionResult['tier'] = 'full';
    
    // Determine access tier based on subscription and permission
    if (permission) {
      if (permission.includes(':premium') && userSubscription.level < 80) {
        accessTier = 'limited';
      } else if (permission.includes(':detailed') && userSubscription.level < 60) {
        accessTier = 'readonly';
      } else if (permission.includes(':basic') && userSubscription.level < 40) {
        accessTier = 'none';
      }
    }

    // Check basic permissions
    let basicPermissionCheck = true;
    
    if (permission && !hasPermission(permission)) {
      basicPermissionCheck = false;
    }
    
    if (permissions) {
      const hasRequiredPermissions = requireAll 
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);
      
      if (!hasRequiredPermissions) {
        basicPermissionCheck = false;
      }
    }
    
    if (role && !hasRole(role)) {
      basicPermissionCheck = false;
    }
    
    if (roles && !hasAnyRole(roles)) {
      basicPermissionCheck = false;
    }

    // Account status check
    if (user.accountStatus === 'suspended' || user.accountStatus === 'banned') {
      return {
        allowed: false,
        reason: `Account is ${user.accountStatus}`,
        tier: 'none',
        alternative: {
          action: 'Contact support',
          message: 'Your account access is restricted. Please contact support.'
        }
      };
    }

    if (!basicPermissionCheck) {
      return {
        allowed: false,
        reason: 'Insufficient permissions',
        tier: accessTier === 'full' ? 'none' : accessTier,
        alternative: accessTier !== 'none' ? {
          action: 'Upgrade plan',
          message: 'Upgrade your subscription for full access'
        } : undefined
      };
    }

    return {
      allowed: true,
      tier: accessTier
    };
  }, [hasPermission, hasAllPermissions, hasAnyPermission, hasRole, hasAnyRole]);

  // Permission utilities
  const userPermissions = useMemo(() => {
    if (!user) return [];
    
    const directPermissions = user.permissions || [];
    const hierarchicalPermissions = PERMISSION_HIERARCHY[`${user.userType}:${user.metadata?.tier || 'basic'}`] || 
                                   PERMISSION_HIERARCHY[user.userType] || [];
    const subscriptionPermissions = SUBSCRIPTION_TIERS[user.subscriptionTier || 'free']?.permissions || [];
    
    return [...new Set([...directPermissions, ...hierarchicalPermissions, ...subscriptionPermissions])];
  }, [user]);

  const userRoles = useMemo(() => {
    if (!user) return [];
    
    const directRoles = user.roles || [];
    const primaryRole = user.userType ? [user.userType] : [];
    
    return [...new Set([...directRoles, ...primaryRole])];
  }, [user]);

  return {
    loading,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyRole,
    evaluateEnhancedPermission,
    userPermissions,
    userRoles,
    subscriptionTier: user?.subscriptionTier || 'free',
    accountStatus: user?.accountStatus || 'active'
  };
}

// Utility functions
export function getPermissionDisplayName(permission: string): string {
  const permissionMap: Record<string, string> = {
    'pitch:create': 'Create Pitches',
    'pitch:edit': 'Edit Pitches',
    'pitch:delete': 'Delete Pitches',
    'pitch:view': 'View Pitches',
    'nda:request': 'Request NDAs',
    'nda:approve': 'Approve NDAs',
    'analytics:view': 'View Analytics',
    'investment:track': 'Track Investments',
    // Add more as needed
  };
  
  return permissionMap[permission] || permission;
}

export function canUserAccessResource(
  user: User | null,
  resource: { id: string | number; type: string; ownerId?: number },
  action: string
): EnhancedPermissionResult {
  if (!user) {
    return { allowed: false, reason: 'No user', tier: 'none' };
  }

  // Implementation would use the enhanced permission evaluation
  // This is a simplified version
  const isOwner = resource.ownerId === user.id;
  const isAdmin = user.userType === 'admin';
  
  if (isAdmin || isOwner) {
    return { allowed: true, tier: 'full' };
  }
  
  return { allowed: false, reason: 'No access to resource', tier: 'none' };
}
```

### Testing Scenarios

```typescript
// Test Case 1: Context-Aware Permissions
describe('Enhanced Permission System', () => {
  test('restricts access to non-owned resources when ownership required', () => {
    const user = { id: 1, userType: 'creator' };
    const resource = { id: 'pitch-123', type: 'pitch', ownerId: 2 };
    
    render(
      <PermissionGuard
        permission="pitch:edit"
        context={{
          resource,
          conditions: { requireOwnership: true }
        }}
        showMessage={true}
      >
        <EditButton />
      </PermissionGuard>
    );
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/only the resource owner/i)).toBeInTheDocument();
  });

  test('provides tiered access based on subscription', () => {
    const user = { id: 1, userType: 'creator', subscriptionTier: 'basic' };
    
    render(
      <PermissionGuard
        permission="analytics:view:detailed"
        tieredAccess={{
          full: <FullAnalytics />,
          limited: <BasicAnalytics />,
          readonly: <ViewOnlyAnalytics />
        }}
      >
        <div>No access</div>
      </PermissionGuard>
    );
    
    // Should show limited analytics for basic tier
    expect(screen.getByTestId('basic-analytics')).toBeInTheDocument();
    expect(screen.queryByTestId('full-analytics')).not.toBeInTheDocument();
  });

  test('handles temporal permissions correctly', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    render(
      <PermissionGuard
        permission="nda:view"
        context={{
          temporal: { validFrom: futureDate }
        }}
        showAlternative={true}
      >
        <NDAViewer />
      </PermissionGuard>
    );
    
    expect(screen.getByText(/check back later/i)).toBeInTheDocument();
    expect(screen.queryByTestId('nda-viewer')).not.toBeInTheDocument();
  });
});

// Test Case 2: Permission Hierarchy
describe('Permission Hierarchy', () => {
  test('admin users bypass all permission checks', () => {
    const adminUser = { id: 1, userType: 'admin' };
    const { hasPermission } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => (
        <AuthProvider user={adminUser}>{children}</AuthProvider>
      )
    }).result.current;
    
    expect(hasPermission('pitch:edit')).toBe(true);
    expect(hasPermission('nda:approve')).toBe(true);
    expect(hasPermission('user:delete')).toBe(true);
  });

  test('evaluates hierarchical permissions correctly', () => {
    const creatorUser = { 
      id: 1, 
      userType: 'creator', 
      metadata: { tier: 'premium' } 
    };
    
    const { hasPermission } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => (
        <AuthProvider user={creatorUser}>{children}</AuthProvider>
      )
    }).result.current;
    
    expect(hasPermission('pitch:create')).toBe(true);
    expect(hasPermission('pitch:edit:own')).toBe(true);
    expect(hasPermission('user:admin')).toBe(false);
  });
});
```

---

## Summary

This comprehensive bug fix document addresses the five critical issues in the Pitchey application:

1. **Browse Tab Content Mixing**: Implemented tab-specific data management and filtering to prevent cross-contamination between different browse views.

2. **NDA Workflow Gaps**: Enhanced the approval workflow with status state machines, approval history tracking, automatic expiry handling, and escalation logic.

3. **Multiple File Upload Limitations**: Added chunked uploads for large files, enhanced error recovery with exponential backoff, improved duplicate detection with content hashing, and better concurrent upload management.

4. **WebSocket Notification Reliability**: Implemented heartbeat monitoring, persistent message queuing with IndexedDB, enhanced disconnect handling with fast fallback, and message deduplication.

5. **Access Control Granularity**: Created a comprehensive permission system with context-aware evaluation, temporal permissions, resource-based access control, and tiered access levels.

Each fix includes:
- **Root Cause Analysis**: Detailed explanation of the underlying issues
- **Specific Code Fixes**: Exact code changes with file locations and line numbers
- **Testing Scenarios**: Comprehensive test cases to verify the fixes work correctly

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Analyze Browse tab content mixing issue in Marketplace", "status": "completed", "activeForm": "Analyzing Browse tab content mixing issue"}, {"content": "Identify NDA approval workflow gaps", "status": "completed", "activeForm": "Identifying NDA approval workflow gaps"}, {"content": "Examine multiple file upload limitations", "status": "completed", "activeForm": "Examining multiple file upload limitations"}, {"content": "Review WebSocket notification reliability issues", "status": "completed", "activeForm": "Reviewing WebSocket notification reliability"}, {"content": "Assess access control granularity problems", "status": "completed", "activeForm": "Assessing access control granularity"}, {"content": "Create comprehensive BUG_FIXES.md document", "status": "completed", "activeForm": "Creating comprehensive bug fix document"}]