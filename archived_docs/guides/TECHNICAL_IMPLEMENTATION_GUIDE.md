# Technical Implementation Guide - Client Feedback Fixes

**Purpose**: Step-by-step technical guide for implementing client-requested changes  
**Related**: CLIENT_FEEDBACK_REQUIREMENTS.md

---

## 🔴 CRITICAL FIX #1: Investor Sign-Out Issue

### Problem Location
- Frontend: `frontend/src/components/InvestorDashboard.tsx`
- Backend: `src/routes/auth.routes.ts`

### Investigation Steps
```bash
# 1. Check if logout button exists and has proper handler
grep -r "handleLogout" frontend/src/components/InvestorDashboard.tsx

# 2. Verify logout endpoint is registered
grep -r "logout" src/routes/auth.routes.ts

# 3. Check role-specific logout logic
grep -r "investor.*logout" src/
```

### Fix Implementation
```typescript
// frontend/src/components/InvestorDashboard.tsx
const handleLogout = async () => {
  try {
    await authService.logout('investor'); // Ensure role-specific logout
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    navigate('/investor/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};

// Ensure button is properly wired
<button onClick={handleLogout} className="logout-btn">
  Sign Out
</button>
```

---

## 🔴 CRITICAL FIX #2: Investor Dashboard Not Working

### Files to Check
- `frontend/src/pages/InvestorDashboard.tsx`
- `src/routes/investor.routes.ts`
- `src/services/investor.service.ts`

### Debugging Checklist
```bash
# 1. Check for API endpoint issues
curl -X GET http://localhost:8001/api/investor/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Check database queries
grep -r "getInvestorDashboard" src/services/

# 3. Check WebSocket connections
grep -r "investor.*websocket" src/
```

### Required Dashboard Data Structure
```typescript
interface InvestorDashboard {
  portfolio: {
    totalInvested: number;
    activeInvestments: number;
    roi: number;
    pitchesViewed: number;
  };
  savedPitches: Pitch[];
  activeNDAs: NDARecord[];
  recentActivity: Activity[];
  notifications: Notification[];
}
```

---

## 🟡 MEDIUM PRIORITY: Browse Section Fixes

### 1. Fix Tab Content Separation

**Files to Modify**:
- `frontend/src/pages/BrowsePitches.tsx`
- `src/routes/pitch.routes.ts`
- `src/services/pitch.service.ts`

```typescript
// src/services/pitch.service.ts
export const getTrendingPitches = async () => {
  // ONLY return trending based on algorithm
  return await db.select()
    .from(pitches)
    .where(
      and(
        eq(pitches.status, 'published'),
        gte(pitches.viewCount, 100), // Example threshold
        gte(pitches.engagementScore, 0.7)
      )
    )
    .orderBy(desc(pitches.trendingScore))
    .limit(20);
};

export const getNewPitches = async () => {
  // ONLY return newest pitches
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return await db.select()
    .from(pitches)
    .where(
      and(
        eq(pitches.status, 'published'),
        gte(pitches.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(pitches.createdAt))
    .limit(50);
};

// REMOVE this function entirely
// export const getTopRatedPitches = async () => { ... }
```

### 2. Remove Top Rated Tab

```tsx
// frontend/src/pages/BrowsePitches.tsx
// REMOVE this tab from the tab array
const tabs = [
  { id: 'trending', label: 'Trending' },
  { id: 'new', label: 'New' },
  // DELETE: { id: 'top-rated', label: 'Top Rated' },
];
```

### 3. Implement General Browse with Sorting

```typescript
// New API endpoint: src/routes/pitch.routes.ts
router.get('/browse/general', async (req, res) => {
  const { sort, order, genre, format, budget_min, budget_max } = req.query;
  
  let query = db.select().from(pitches).where(eq(pitches.status, 'published'));
  
  // Apply filters
  if (genre) query = query.where(eq(pitches.genre, genre));
  if (format) query = query.where(eq(pitches.format, format));
  if (budget_min) query = query.where(gte(pitches.budget, budget_min));
  if (budget_max) query = query.where(lte(pitches.budget, budget_max));
  
  // Apply sorting
  const sortMap = {
    'alphabetical': order === 'desc' ? desc(pitches.title) : asc(pitches.title),
    'date': order === 'desc' ? desc(pitches.createdAt) : asc(pitches.createdAt),
    'budget': order === 'desc' ? desc(pitches.budget) : asc(pitches.budget),
    'views': order === 'desc' ? desc(pitches.viewCount) : asc(pitches.viewCount),
  };
  
  if (sortMap[sort]) {
    query = query.orderBy(sortMap[sort]);
  }
  
  const results = await query.limit(50);
  res.json(results);
});
```

---

## 🟡 Access Control Fix: Remove Investor Pitch Creation

### Files to Modify
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/components/Navigation.tsx`
- `src/middleware/auth.middleware.ts`

```typescript
// src/middleware/auth.middleware.ts
export const preventInvestorPitchCreation = (req, res, next) => {
  if (req.user.role === 'investor' && req.path.includes('/pitches/create')) {
    return res.status(403).json({ 
      error: 'Investors cannot create pitches' 
    });
  }
  next();
};

// frontend/src/routes/AppRoutes.tsx
// Remove or conditionally hide pitch creation route for investors
{userRole !== 'investor' && (
  <Route path="/create-pitch" element={<CreatePitch />} />
)}

// frontend/src/components/Navigation.tsx
// Hide "Create Pitch" button for investors
{userRole === 'creator' && (
  <button onClick={() => navigate('/create-pitch')}>
    Create Pitch
  </button>
)}
```

---

## 🟢 Character Management Enhancements

### 1. Add Edit Functionality

```typescript
// frontend/src/components/CharacterManager.tsx
const CharacterCard = ({ character, onEdit, onDelete, onMove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCharacter, setEditedCharacter] = useState(character);

  const handleSave = () => {
    onEdit(character.id, editedCharacter);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="character-edit-form">
        <input 
          value={editedCharacter.name}
          onChange={(e) => setEditedCharacter({...editedCharacter, name: e.target.value})}
        />
        <textarea 
          value={editedCharacter.description}
          onChange={(e) => setEditedCharacter({...editedCharacter, description: e.target.value})}
        />
        <button onClick={handleSave}>Save</button>
        <button onClick={() => setIsEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="character-card">
      <h4>{character.name}</h4>
      <p>{character.description}</p>
      <button onClick={() => setIsEditing(true)}>Edit</button>
      <button onClick={() => onMove(character.id, 'up')}>↑</button>
      <button onClick={() => onMove(character.id, 'down')}>↓</button>
      <button onClick={() => onDelete(character.id)}>Delete</button>
    </div>
  );
};
```

### 2. Implement Reordering

```typescript
// frontend/src/hooks/useCharacterManagement.ts
const useCharacterManagement = () => {
  const [characters, setCharacters] = useState([]);

  const reorderCharacters = (characterId, direction) => {
    setCharacters(prev => {
      const index = prev.findIndex(c => c.id === characterId);
      if (index === -1) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newCharacters = [...prev];
      [newCharacters[index], newCharacters[newIndex]] = 
      [newCharacters[newIndex], newCharacters[index]];
      
      // Update display_order values
      return newCharacters.map((char, idx) => ({
        ...char,
        display_order: idx
      }));
    });
  };

  return { characters, reorderCharacters };
};
```

---

## 🟢 Form Field Updates

### 1. Convert Themes to Free Text

```tsx
// frontend/src/pages/CreatePitch.tsx
// BEFORE:
<Select
  name="themes"
  options={themeOptions}
  value={formData.themes}
  onChange={handleThemeChange}
/>

// AFTER:
<textarea
  name="themes"
  placeholder="Enter themes for your pitch (e.g., redemption, family, survival)"
  value={formData.themes}
  onChange={handleChange}
  maxLength={1000}
  rows={3}
/>
```

### 2. Add World Field

```tsx
// frontend/src/pages/CreatePitch.tsx
// Add after Themes field:
<div className="form-group">
  <label htmlFor="world">World</label>
  <textarea
    id="world"
    name="world_description"
    placeholder="Describe the world where your story takes place..."
    value={formData.world_description}
    onChange={handleChange}
    maxLength={2000}
    rows={5}
  />
  <span className="char-count">
    {formData.world_description?.length || 0}/2000
  </span>
</div>
```

---

## 🟢 Document Upload System Fix

### Fix Upload Button Visibility

```tsx
// frontend/src/components/DocumentUpload.tsx
const DocumentUpload = ({ onUpload }) => {
  const [files, setFiles] = useState([]);
  const [ndaRequired, setNdaRequired] = useState(false);
  const [useCustomNda, setUseCustomNda] = useState(false);

  return (
    <div className="document-upload-section">
      <h3>Upload Documents</h3>
      
      {/* NDA Configuration */}
      <div className="nda-options">
        <label>
          <input 
            type="checkbox" 
            checked={ndaRequired}
            onChange={(e) => setNdaRequired(e.target.checked)}
          />
          Require NDA before viewing full pitch
        </label>
        
        {ndaRequired && (
          <>
            <label>
              <input 
                type="radio" 
                name="nda-type" 
                value="standard"
                checked={!useCustomNda}
                onChange={() => setUseCustomNda(false)}
              />
              Use platform standard NDA
            </label>
            <label>
              <input 
                type="radio" 
                name="nda-type" 
                value="custom"
                checked={useCustomNda}
                onChange={() => setUseCustomNda(true)}
              />
              Use custom NDA
            </label>
          </>
        )}
      </div>

      {/* Multiple File Upload */}
      <div className="file-upload-area">
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx"
          onChange={handleFileSelect}
          id="document-upload"
          style={{ display: 'none' }}
        />
        <label 
          htmlFor="document-upload" 
          className="upload-button"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '5px'
          }}
        >
          📎 Choose Files
        </label>
        
        {/* File List */}
        <div className="uploaded-files">
          {files.map(file => (
            <div key={file.name} className="file-item">
              <span>{file.name}</span>
              <button onClick={() => removeFile(file.name)}>×</button>
            </div>
          ))}
        </div>
      </div>
      
      {useCustomNda && (
        <div className="custom-nda-upload">
          <label>Upload Custom NDA:</label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleNdaUpload}
          />
        </div>
      )}
    </div>
  );
};
```

---

## 🔵 NDA Workflow Implementation

### Database Schema

```sql
-- Required tables for NDA workflow
CREATE TABLE nda_requests (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id),
  investor_id INTEGER REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, signed, declined
  requested_at TIMESTAMP DEFAULT NOW(),
  signed_at TIMESTAMP,
  expires_at TIMESTAMP,
  custom_nda_url TEXT,
  signature_data JSONB
);

CREATE TABLE info_requests (
  id SERIAL PRIMARY KEY,
  nda_id INTEGER REFERENCES nda_requests(id),
  pitch_id INTEGER REFERENCES pitches(id),
  investor_id INTEGER REFERENCES users(id),
  question TEXT NOT NULL,
  response TEXT,
  attachments JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP
);

-- Add to pitches table
ALTER TABLE pitches 
ADD COLUMN nda_required BOOLEAN DEFAULT false,
ADD COLUMN use_custom_nda BOOLEAN DEFAULT false,
ADD COLUMN custom_nda_url TEXT;
```

### API Implementation

```typescript
// src/routes/nda.routes.ts
router.post('/nda/request', authenticate, async (req, res) => {
  const { pitchId } = req.body;
  const investorId = req.user.id;
  
  // Check if NDA already exists
  const existing = await db.select()
    .from(ndaRequests)
    .where(
      and(
        eq(ndaRequests.pitchId, pitchId),
        eq(ndaRequests.investorId, investorId)
      )
    )
    .limit(1);
    
  if (existing.length > 0) {
    return res.json({ nda: existing[0] });
  }
  
  // Create new NDA request
  const [nda] = await db.insert(ndaRequests).values({
    pitchId,
    investorId,
    status: 'pending',
    requestedAt: new Date()
  }).returning();
  
  // Notify creator via WebSocket
  await notifyCreator(pitchId, 'nda_request', { investorId });
  
  res.json({ nda });
});

router.post('/nda/sign', authenticate, async (req, res) => {
  const { ndaId, signature } = req.body;
  
  const [signed] = await db.update(ndaRequests)
    .set({
      status: 'signed',
      signedAt: new Date(),
      signatureData: signature,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    })
    .where(eq(ndaRequests.id, ndaId))
    .returning();
    
  // Grant access to full pitch
  await grantPitchAccess(signed.pitchId, signed.investorId);
  
  res.json({ success: true, nda: signed });
});
```

---

## 🚀 Testing Scripts

### Create Test Suite

```bash
#!/bin/bash
# test-client-fixes.sh

echo "Testing Client-Requested Fixes"

# Test 1: Investor Logout
echo "1. Testing Investor Logout..."
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}' | jq -r '.token')

curl -X POST http://localhost:8001/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Test 2: Investor Dashboard
echo "2. Testing Investor Dashboard..."
curl -X GET http://localhost:8001/api/investor/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Test 3: Browse Filtering
echo "3. Testing Browse Tabs..."
curl http://localhost:8001/api/pitches/trending
curl http://localhost:8001/api/pitches/new

# Test 4: General Browse with Sorting
echo "4. Testing General Browse..."
curl "http://localhost:8001/api/pitches/browse/general?sort=alphabetical&order=asc"
curl "http://localhost:8001/api/pitches/browse/general?sort=budget&order=desc"

# Test 5: Investor Cannot Create Pitch
echo "5. Testing Investor Pitch Creation Block..."
curl -X POST http://localhost:8001/api/pitches/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Pitch"}' \
  | grep -q "403" && echo "✓ Blocked" || echo "✗ Not blocked"
```

---

## 📋 Checklist for Developers

### Immediate Actions
- [ ] Fix investor logout endpoint
- [ ] Debug investor dashboard data loading
- [ ] Remove pitch creation from investor role
- [ ] Fix browse tab filtering

### UI Updates
- [ ] Add character edit modal
- [ ] Implement character reordering
- [ ] Convert Themes to textarea
- [ ] Add World field
- [ ] Fix document upload button visibility

### Backend Updates
- [ ] Add character display_order column
- [ ] Add world_description column
- [ ] Implement NDA tables
- [ ] Create info_requests table
- [ ] Add role-based middleware

### Testing
- [ ] Test all user roles
- [ ] Verify NDA workflow
- [ ] Check browse filtering
- [ ] Validate access controls

---

**End of Technical Implementation Guide**