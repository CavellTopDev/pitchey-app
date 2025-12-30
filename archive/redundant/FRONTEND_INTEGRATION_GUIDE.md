# Frontend Integration Guide - Complete API Reference

**Date**: December 6, 2025  
**Status**: Comprehensive guide for all new features

## 📚 Table of Contents
1. [Enhanced Browse Section](#enhanced-browse-section)
2. [Character Management](#character-management)
3. [Document Upload System](#document-upload-system)
4. [Investor Dashboard](#investor-dashboard)
5. [Access Control & Permissions](#access-control--permissions)
6. [Real-time Features](#real-time-features)

---

## 🔍 Enhanced Browse Section

### Get Enhanced Browse with Filters
```javascript
// Example: Get all pitches with advanced filtering and sorting
const fetchBrowsePitches = async () => {
  const params = new URLSearchParams({
    tab: 'all',           // all, film, television, web-series, documentary, short, animation
    sortBy: 'date',       // date, views, rating, investment
    sortOrder: 'desc',    // asc, desc
    genre: 'Action',      // Optional: specific genre
    budgetRange: 'medium', // low (<$1M), medium ($1-10M), high ($10-50M), mega (>$50M)
    seekingInvestment: 'true',
    hasNDA: 'false',
    search: 'thriller',   // Optional: search term
    limit: '20',
    offset: '0'
  });

  const response = await fetch(`${API_URL}/api/browse/enhanced?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  // Returns pitches with creator info, investment counts, and ratings
};

// Get available genres for filter dropdown
const fetchGenres = async () => {
  const response = await fetch(`${API_URL}/api/browse/genres`);
  const data = await response.json();
  // Returns: { genres: ['Action', 'Comedy', 'Drama', ...] }
};

// Get browse statistics
const fetchBrowseStats = async () => {
  const response = await fetch(`${API_URL}/api/browse/stats`);
  const data = await response.json();
  // Returns counts by category, total pitches, etc.
};
```

---

## ✏️ Character Management

### Complete Character CRUD Operations
```javascript
// Get all characters for a pitch
const getCharacters = async (pitchId) => {
  const response = await fetch(`${API_URL}/api/pitches/${pitchId}/characters`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Add new character
const addCharacter = async (pitchId, character) => {
  const response = await fetch(`${API_URL}/api/pitches/${pitchId}/characters`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'John Doe',
      role: 'Protagonist',
      description: 'A detective with a dark past...',
      age: '35',
      arc: 'Redemption arc from cynical to hopeful'
    })
  });
  return response.json();
};

// Reorder characters (for drag-and-drop)
const reorderCharacters = async (pitchId, characters) => {
  // Characters array should be in the new order
  const response = await fetch(`${API_URL}/api/pitches/${pitchId}/characters`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ characters })
  });
  return response.json();
};

// Update single character
const updateCharacter = async (pitchId, characterId, updates) => {
  const response = await fetch(
    `${API_URL}/api/pitches/${pitchId}/characters/${characterId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    }
  );
  return response.json();
};

// Delete character
const deleteCharacter = async (pitchId, characterId) => {
  const response = await fetch(
    `${API_URL}/api/pitches/${pitchId}/characters/${characterId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return response.json();
};
```

### React Component Example
```jsx
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const CharacterManager = ({ pitchId }) => {
  const [characters, setCharacters] = useState([]);
  
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const items = Array.from(characters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setCharacters(items);
    await reorderCharacters(pitchId, items);
  };
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="characters">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {characters.map((char, index) => (
              <Draggable key={char.id} draggableId={char.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <CharacterCard character={char} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
```

---

## 📎 Document Upload System

### File Upload Examples
```javascript
// Upload single file
const uploadFile = async (file, pitchId, type = 'general') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pitchId', pitchId);
  formData.append('type', type); // general, pitch_materials, financial, legal
  
  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
  // Returns: { fileId, fileName, url }
};

// Upload multiple files (up to 10)
const uploadMultipleFiles = async (files, pitchId, type = 'pitch_materials') => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  formData.append('pitchId', pitchId);
  formData.append('type', type);
  
  const response = await fetch(`${API_URL}/api/upload/multiple`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
  // Returns: { files: [{ fileId, fileName, url }, ...] }
};

// Upload custom NDA document (PDF only)
const uploadCustomNDA = async (pdfFile, pitchId) => {
  const formData = new FormData();
  formData.append('file', pdfFile);
  formData.append('pitchId', pitchId);
  
  const response = await fetch(`${API_URL}/api/pitches/nda/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
  // Returns: { ndaFileId, fileName, url }
};

// Rename file
const renameFile = async (fileId, newName) => {
  const response = await fetch(`${API_URL}/api/files/rename`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fileId, newName })
  });
  
  return response.json();
};

// Delete file
const deleteFile = async (fileId) => {
  const response = await fetch(`${API_URL}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Get all files for a pitch
const getPitchFiles = async (pitchId) => {
  const response = await fetch(`${API_URL}/api/pitches/${pitchId}/files`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
  // Returns: { files: [{ id, fileName, fileSize, uploadedAt, url }, ...] }
};
```

### React Upload Component
```jsx
const FileUploadManager = ({ pitchId }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  const handleFileSelect = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    
    if (selectedFiles.length > 10) {
      alert('Maximum 10 files at a time');
      return;
    }
    
    setUploading(true);
    try {
      const result = await uploadMultipleFiles(selectedFiles, pitchId);
      setFiles([...files, ...result.files]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };
  
  const handleNDAUpload = async (event) => {
    const file = event.target.files[0];
    
    if (!file.name.endsWith('.pdf')) {
      alert('NDA must be a PDF file');
      return;
    }
    
    const result = await uploadCustomNDA(file, pitchId);
    console.log('NDA uploaded:', result);
  };
  
  return (
    <div>
      <input
        type="file"
        multiple
        onChange={handleFileSelect}
        disabled={uploading}
      />
      
      <input
        type="file"
        accept=".pdf"
        onChange={handleNDAUpload}
        disabled={uploading}
      />
      
      {uploading && <div>Uploading...</div>}
      
      <div>
        {files.map(file => (
          <FileCard key={file.id} file={file} />
        ))}
      </div>
    </div>
  );
};
```

---

## 📊 Investor Dashboard

### Complete Dashboard Integration
```javascript
// Get full dashboard with all metrics
const getInvestorDashboard = async () => {
  const response = await fetch(`${API_URL}/api/investor/dashboard`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  /* Returns:
  {
    portfolio_summary: {
      total_invested: "750000",
      active_investments: 2,
      portfolio_value: "825000",
      roi_percentage: 10
    },
    recent_activity: [...],
    saved_pitches_count: 5,
    nda_stats: {
      total: 3,
      approved: 2,
      pending: 1
    },
    investment_opportunities: [...]
  }
  */
};

// Get detailed investments
const getInvestments = async () => {
  const response = await fetch(`${API_URL}/api/investor/investments`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
  /* Returns array of investments with pitch and creator details */
};

// Get portfolio summary
const getPortfolioSummary = async () => {
  const response = await fetch(`${API_URL}/api/investor/portfolio/summary`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

### Dashboard Component Example
```jsx
const InvestorDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDashboard();
  }, []);
  
  const loadDashboard = async () => {
    try {
      const data = await getInvestorDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <LoadingSpinner />;
  if (!dashboard) return <ErrorMessage />;
  
  return (
    <div className="dashboard">
      <PortfolioSummaryCard data={dashboard.portfolio_summary} />
      <NDAStatsCard stats={dashboard.nda_stats} />
      <SavedPitchesCard count={dashboard.saved_pitches_count} />
      <RecentActivityList activities={dashboard.recent_activity} />
      <InvestmentOpportunities opportunities={dashboard.investment_opportunities} />
    </div>
  );
};
```

---

## 🔐 Access Control & Permissions

### Team Management
```javascript
// Create team
const createTeam = async (name, description) => {
  const response = await fetch(`${API_URL}/api/teams`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, description })
  });
  
  return response.json();
};

// Get user's teams
const getMyTeams = async () => {
  const response = await fetch(`${API_URL}/api/teams`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Add team member
const addTeamMember = async (teamId, userEmail, role = 'member') => {
  const response = await fetch(`${API_URL}/api/teams/${teamId}/members`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userEmail, role }) // owner, admin, editor, viewer
  });
  
  return response.json();
};
```

### Pitch Collaboration
```javascript
// Add collaborator to pitch
const addPitchCollaborator = async (pitchId, config) => {
  const response = await fetch(`${API_URL}/api/pitches/${pitchId}/collaborators`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userEmail: 'collaborator@example.com', // OR teamId for team collaboration
      role: 'editor',        // owner, editor, commenter, viewer
      canEdit: true,
      canDelete: false,
      canShare: true,
      canManageNda: false
    })
  });
  
  return response.json();
};

// Get pitch collaborators
const getPitchCollaborators = async (pitchId) => {
  const response = await fetch(`${API_URL}/api/pitches/${pitchId}/collaborators`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Check permissions
const checkPermission = async (resourceType, resourceId, action) => {
  const response = await fetch(`${API_URL}/api/permissions/check`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      resourceType, // 'pitch', 'document', etc.
      resourceId,
      action        // 'read', 'edit', 'delete', 'share', 'manage_nda'
    })
  });
  
  const data = await response.json();
  return data.hasPermission;
};

// Get access logs (audit trail)
const getAccessLogs = async (resourceType, resourceId) => {
  const response = await fetch(
    `${API_URL}/api/access-logs/${resourceType}/${resourceId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  return response.json();
};
```

### Permission-Aware Component
```jsx
const PitchEditor = ({ pitchId }) => {
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  
  useEffect(() => {
    checkPermissions();
  }, [pitchId]);
  
  const checkPermissions = async () => {
    const [edit, del] = await Promise.all([
      checkPermission('pitch', pitchId, 'edit'),
      checkPermission('pitch', pitchId, 'delete')
    ]);
    
    setCanEdit(edit);
    setCanDelete(del);
  };
  
  return (
    <div>
      {canEdit && <EditButton />}
      {canDelete && <DeleteButton />}
      {!canEdit && <ViewOnlyNotice />}
    </div>
  );
};
```

---

## 🔄 Real-time Features

### WebSocket Integration
```javascript
// Connect to WebSocket
const connectWebSocket = () => {
  const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    
    // Subscribe to notifications
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'notifications'
    }));
    
    // Subscribe to pitch updates
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: `pitch_${pitchId}`
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
      case 'notification':
        handleNotification(data.payload);
        break;
      case 'pitch_updated':
        handlePitchUpdate(data.payload);
        break;
      case 'collaborator_joined':
        handleCollaboratorJoined(data.payload);
        break;
      case 'typing_indicator':
        handleTypingIndicator(data.payload);
        break;
    }
  };
  
  return ws;
};

// Send typing indicator
const sendTypingIndicator = (ws, pitchId, isTyping) => {
  ws.send(JSON.stringify({
    type: 'typing',
    pitchId,
    isTyping
  }));
};

// Auto-save draft
const autoSaveDraft = (ws, pitchId, content) => {
  ws.send(JSON.stringify({
    type: 'draft_sync',
    pitchId,
    content
  }));
};
```

---

## 📝 Quick Update Fields

### Update Themes and World Description
```javascript
// Update themes (now free-text) and world description
const updatePitchFields = async (pitchId, fields) => {
  const response = await fetch(`${API_URL}/api/pitches/${pitchId}/fields`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      themes: 'Love, loss, redemption, the human condition',
      world_description: 'A dystopian future where emotions are regulated by the government...'
    })
  });
  
  return response.json();
};
```

---

## 🎯 Best Practices

### Error Handling
```javascript
const apiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API call failed');
    }
    
    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    // Handle error appropriately
    throw error;
  }
};
```

### Loading States
```javascript
const useApiData = (fetchFunction) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchFunction();
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  return { data, loading, error };
};
```

### Optimistic Updates
```javascript
const updateCharacterOptimistically = async (pitchId, characterId, updates) => {
  // Update UI immediately
  setCharacters(prev => 
    prev.map(char => 
      char.id === characterId ? { ...char, ...updates } : char
    )
  );
  
  try {
    // Then sync with server
    await updateCharacter(pitchId, characterId, updates);
  } catch (error) {
    // Revert on error
    console.error('Update failed:', error);
    loadCharacters(); // Reload from server
  }
};
```

---

## 🚀 Deployment Checklist

1. **Environment Variables**
   ```javascript
   // .env.production
   VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
   VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
   ```

2. **CORS Configuration**
   - Ensure frontend domain is whitelisted
   - WebSocket origins configured

3. **Authentication**
   - Store JWT tokens securely
   - Refresh tokens before expiry
   - Handle 401 responses globally

4. **File Size Limits**
   - Single file: 50MB max
   - Multiple files: 10 files max
   - Custom NDA: PDF only

5. **Rate Limiting**
   - Implement retry logic
   - Handle 429 responses
   - Add request debouncing

---

## 📞 Support

For questions or issues with integration:
1. Check browser console for errors
2. Verify authentication token
3. Test with demo accounts
4. Review CORS settings

---

**Last Updated**: December 6, 2025