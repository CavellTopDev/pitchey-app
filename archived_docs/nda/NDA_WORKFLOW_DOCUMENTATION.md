# NDA & Information Request Workflow Documentation

**Purpose**: Clear visual guide for NDA and information request processes  
**For**: Development team, QA testers, and client understanding

---

## 📊 NDA Workflow Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browse    │────▶│  View Pitch  │────▶│  Request    │────▶│    Sign     │────▶│  Full      │
│   Pitches   │     │   Preview    │     │    NDA      │     │    NDA      │     │  Access    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
                           │                     │                    │                    │
                           ▼                     ▼                    ▼                    ▼
                    [Limited Info]        [Notification]       [Legal Doc]         [All Content]
                    - Title               to Creator          Generated          + Info Request
                    - Logline                                                      Option
                    - Genre
                    - Budget Range
```

---

## 🔄 Detailed Flow Diagrams

### 1️⃣ Initial Pitch Discovery

```
INVESTOR SIDE                           SYSTEM                              CREATOR SIDE
─────────────                           ──────                              ────────────

Browse Pitches
     │
     ▼
See Pitch Card ──────────────▶ Load Preview Data
     │                              │
     ▼                              ▼
[Preview Shows:]              Fetch from DB:
• Title                       - Public fields only
• Tagline                     - No sensitive data
• Genre/Format                - No full script
• Budget Range                - No contact info
• "🔒 NDA Required"
     │
     ▼
Click "View Details"
     │
     ▼
[Detailed Preview:]
• Extended logline
• Pitch video thumbnail
• Key cast (names only)
• "Request Full Access" btn
```

### 2️⃣ NDA Request Process

```
INVESTOR ACTION                 SYSTEM PROCESS                      CREATOR NOTIFICATION
───────────────                 ──────────────                      ────────────────────

Click "Request Full Access"
        │
        ▼
[NDA Request Modal]
• View NDA Terms ─────────▶ Load NDA Template ─────────▶ [Email Notification]
• Investor Info Form         (Standard or Custom)        "New NDA Request"
• Submit Request                    │                           │
        │                           ▼                           ▼
        ▼                   Store in DB:                 [Dashboard Alert]
[Waiting State]             - request_id                 • Investor Name
"Pending Approval"          - investor_id                • Company
                           - pitch_id                    • View Profile
                           - timestamp                   • Accept/Decline
```

### 3️⃣ Creator Response Options

```
CREATOR DASHBOARD
─────────────────

[NDA Requests Tab]
┌────────────────────────────────────────┐
│ New NDA Request from: Sarah Investor   │
│ Company: Stellar Productions           │
│ Requested: 2 hours ago                 │
│                                        │
│ [View Investor Profile]               │
│                                        │
│ Actions:                               │
│ ┌─────────────┐ ┌──────────────┐     │
│ │   Approve   │ │   Decline    │     │
│ └─────────────┘ └──────────────┘     │
│                                        │
│ ☐ Use Custom NDA                      │
│ [Upload Custom NDA]                    │
└────────────────────────────────────────┘
```

### 4️⃣ NDA Signing Interface

```
INVESTOR SIGNING FLOW
────────────────────

[NDA Document View]
┌─────────────────────────────────────────────┐
│ NON-DISCLOSURE AGREEMENT                    │
│                                            │
│ This agreement is between:                 │
│ • Creator: [Creator Name]                  │
│ • Investor: [Auto-filled]                  │
│                                            │
│ [Full NDA Text - Scrollable]              │
│ ...                                        │
│                                            │
│ ┌──────────────────────────────┐          │
│ │   [Signature Pad Area]       │          │
│ │                              │          │
│ └──────────────────────────────┘          │
│                                            │
│ ☐ I have read and agree to terms          │
│                                            │
│ [Sign & Submit]  [Download PDF]  [Cancel] │
└─────────────────────────────────────────────┘
```

### 5️⃣ Post-NDA Access

```
FULL PITCH ACCESS VIEW
─────────────────────

[Now Visible After NDA:]
┌──────────────────────────────────────────┐
│ 🔓 Full Access Granted                   │
├──────────────────────────────────────────┤
│ • Complete Script                        │
│ • Financial Projections                  │
│ • Detailed Budget Breakdown              │
│ • Team Bios & Experience                 │
│ • Marketing Strategy                      │
│ • Distribution Plans                      │
│ • Comparable Films Analysis              │
│ • ROI Projections                        │
│                                          │
│ [Download Pitch Deck] [Download Script]  │
│                                          │
│ [Request Additional Information]         │
└──────────────────────────────────────────┘
```

---

## 📨 Information Request Workflow

### After NDA is Signed

```
INFORMATION REQUEST FLOW
───────────────────────

Investor                    System                      Creator
────────                    ──────                      ───────

[Request More Info]
      │
      ▼
[Request Form]
• Specific Questions ────▶ Create Request ────────▶ [Notification]
• Document Needs           Store in DB               "New Info Request"
• Meeting Request               │                         │
      │                         ▼                         ▼
      ▼                  Track Status:              [Response Form]
[Confirmation]           - Pending                  • Answer Questions
"Request Sent"          - In Progress              • Attach Docs
                        - Completed                 • Schedule Meeting
                             │                           │
                             ▼                           ▼
                     [Update Status] ◀────────── [Submit Response]
                             │
                             ▼
                     [Notify Investor]
```

---

## 🗄️ Database State Tracking

### NDA Status Flow

```sql
-- NDA Request Lifecycle
'pending'    → Creator hasn't responded yet
'approved'   → Creator approved, awaiting signature
'signed'     → NDA signed, full access granted
'declined'   → Creator declined request
'expired'    → NDA validity period ended
'revoked'    → Creator revoked access
```

### Information Request Status

```sql
-- Info Request Lifecycle
'pending'      → Awaiting creator response
'in_progress'  → Creator working on response
'answered'     → Response provided
'follow_up'    → Additional questions needed
'closed'       → Request completed
```

---

## 🎯 User Interface States

### For Investors

```
PITCH CARD STATES
─────────────────

[No NDA Required]           [NDA Required - Not Signed]      [NDA Required - Signed]
┌─────────────┐             ┌─────────────┐                  ┌─────────────┐
│   [View]    │             │ 🔒 [Request │                  │ 🔓 [View]   │
│             │             │   Access]   │                  │   [Full]    │
└─────────────┘             └─────────────┘                  └─────────────┘
Full Preview                Limited Preview                   Complete Access
```

### For Creators

```
DASHBOARD INDICATORS
───────────────────

┌────────────────────────┐
│ NDA Requests      (3)  │  ← Badge shows pending count
│ ───────────────────    │
│ • Pending         (3)  │
│ • Active NDAs    (12)  │
│ • Info Requests  (5)   │
└────────────────────────┘
```

---

## 🔔 Notification System

### Email Notifications

```
NDA Request Email
─────────────────
Subject: New NDA Request for "[Pitch Title]"

Hi [Creator Name],

[Investor Name] from [Company] has requested 
access to your pitch "[Pitch Title]".

[View Request] [Respond Now]
```

### In-App Notifications

```
Real-time WebSocket Events
──────────────────────────

// Creator receives
{
  type: 'nda_request',
  pitchId: 123,
  investorId: 456,
  timestamp: '2024-01-15T10:30:00Z'
}

// Investor receives
{
  type: 'nda_approved',
  pitchId: 123,
  ndaUrl: '/nda/sign/abc123'
}
```

---

## 🧪 Testing Scenarios

### Happy Path Test

1. Investor browses pitches
2. Finds NDA-required pitch
3. Requests access
4. Creator approves
5. Investor signs NDA
6. Full access granted
7. Investor requests more info
8. Creator provides info
9. Both parties can view history

### Edge Cases to Test

1. **Expired NDA**: Access revoked after expiry date
2. **Multiple Requests**: Same investor, different pitches
3. **Custom NDA**: Creator uploads non-standard agreement
4. **Declined Request**: Proper messaging and state
5. **Concurrent Access**: Multiple investors signing simultaneously

---

## 🛠️ Implementation Checklist

### Frontend Components Needed

- [ ] NDA request modal
- [ ] NDA signing interface
- [ ] Signature pad component
- [ ] Info request form
- [ ] Creator response interface
- [ ] NDA management dashboard
- [ ] Notification badges

### Backend Endpoints Required

- [ ] POST `/api/nda/request`
- [ ] GET `/api/nda/pending`
- [ ] POST `/api/nda/approve`
- [ ] POST `/api/nda/sign`
- [ ] GET `/api/nda/signed`
- [ ] POST `/api/info-request`
- [ ] GET `/api/info-requests`
- [ ] POST `/api/info-request/respond`

### Database Tables

- [ ] `nda_requests`
- [ ] `nda_signatures`
- [ ] `info_requests`
- [ ] `info_request_responses`
- [ ] `nda_documents`

---

## 📝 Sample User Journeys

### Investor Journey

```
1. Log in as Investor
2. Browse pitches → See mix of public and NDA-protected
3. Click on NDA-protected pitch
4. See limited preview with "Request Access" button
5. Click button → Fill investor info if needed
6. Wait for creator approval (see status: "Pending")
7. Receive notification of approval
8. Review and sign NDA electronically
9. Gain full access to pitch materials
10. Download documents, request additional info if needed
```

### Creator Journey

```
1. Log in as Creator
2. Create/edit pitch
3. Enable "Require NDA" checkbox
4. Optional: Upload custom NDA
5. Publish pitch
6. Receive notification of NDA request
7. Review investor profile
8. Approve or decline request
9. If approved, wait for signature
10. Monitor signed NDAs and respond to info requests
```

---

## ❓ Frequently Asked Questions

**Q: Does the NDA workflow work in development?**
A: Yes, core functionality works locally. E-signature integration may require staging environment.

**Q: How long are NDAs valid?**
A: Default is 1 year, configurable per pitch or using custom NDAs.

**Q: Can creators revoke NDA access?**
A: Yes, though signed NDAs remain legally binding. Access to platform materials can be revoked.

**Q: Are signatures legally binding?**
A: With proper e-signature integration (DocuSign/HelloSign), yes. Development uses mock signatures.

**Q: Can investors save unsigned NDAs?**
A: Yes, they can download PDF versions for legal review before signing.

---

## 🚦 Status Codes & Error Handling

### API Response Codes

```javascript
// Success States
200 - NDA request created
201 - NDA signed successfully
200 - Info request submitted

// Error States  
400 - Invalid request data
403 - Not authorized (wrong role)
404 - Pitch/NDA not found
409 - NDA already exists
410 - NDA expired
429 - Too many requests
```

### User-Friendly Error Messages

```javascript
const errorMessages = {
  'nda_exists': 'You already have an active NDA for this pitch',
  'nda_expired': 'This NDA has expired. Please request a new one.',
  'not_authorized': 'You do not have permission to view this pitch',
  'creator_only': 'Only the pitch creator can perform this action',
  'investor_only': 'This feature is only available for investors',
  'pending_approval': 'Your request is awaiting creator approval'
};
```

---

**End of NDA Workflow Documentation**