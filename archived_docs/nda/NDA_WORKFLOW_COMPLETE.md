# Complete NDA Workflow Implementation

## Overview

The NDA (Non-Disclosure Agreement) system in Pitchey provides a comprehensive workflow for protecting sensitive pitch information while enabling investors and production companies to access detailed project data under legal agreements.

## Architecture Components

### Backend Services

#### 1. NDAService (`/src/services/ndaService.ts`)
Core service handling all NDA operations:
- **Request Management**: Create, approve, reject NDA requests
- **Access Control**: Check NDA status and protected content access
- **PDF Generation**: Generate legal NDA documents
- **Expiration Handling**: Automatic expiration and revocation
- **Statistics**: NDA usage analytics

#### 2. NDA Expiration Service (`/src/services/nda-expiration.service.ts`)
Background service for automatic NDA lifecycle management:
- Runs every 24 hours
- Automatically revokes expired NDAs
- Sends expiration notifications
- Maintains data integrity

### Database Schema

#### NDA Requests Table (`nda_requests`)
```sql
- id: serial (primary key)
- pitchId: integer (references pitches.id)
- requesterId: integer (references users.id)
- ownerId: integer (references users.id)
- ndaType: enum ('basic', 'enhanced', 'custom')
- requestMessage: text
- companyInfo: jsonb
- status: varchar ('pending', 'approved', 'rejected', 'expired')
- rejectionReason: text
- requestedAt: timestamp
- respondedAt: timestamp
- expiresAt: timestamp
```

#### NDAs Table (`ndas`)
```sql
- id: serial (primary key)
- pitchId: integer (references pitches.id)
- signerId: integer (references users.id)
- ndaType: enum ('basic', 'enhanced', 'custom')
- ndaVersion: varchar
- customNdaUrl: text
- ipAddress: varchar
- userAgent: text
- signedAt: timestamp
- signatureData: jsonb
- accessGranted: boolean
- accessRevokedAt: timestamp
- expiresAt: timestamp
```

### API Endpoints

#### Core NDA Endpoints
```
GET  /api/pitches/:id/nda-status        - Check user's NDA status for a pitch
POST /api/pitches/:id/request-nda       - Request NDA access
GET  /api/creator/nda-requests          - List pending requests (creators)
POST /api/nda/:id/approve               - Approve NDA request
POST /api/nda/:id/reject                - Reject NDA request with reason
GET  /api/nda/signed                    - List user's signed NDAs
GET  /api/nda/:id/document              - Download NDA PDF
GET  /api/nda/stats                     - Get NDA statistics
```

### Frontend Components

#### 1. NDAStatus Component (`/components/NDAStatus.tsx`)
Displays current NDA status on pitch cards:
- Shows access level (Basic, Enhanced, None)
- Request access button
- Download NDA document link
- Compact and full display modes

#### 2. ProtectedContent Component (`/components/ProtectedContent.tsx`)
Wraps sensitive content with access control:
- Blurs content when access denied
- Shows unlock overlay
- Specialized components for budget, script, financials
- Customizable fallback content

#### 3. NDAModal Component (`/components/NDAModal.tsx`)
Request NDA access modal:
- Standard vs Custom NDA options
- Company information collection
- File upload for custom NDAs
- Request submission workflow

#### 4. Creator NDA Management (`/pages/CreatorNDAManagement.tsx`)
Dashboard for creators to manage incoming requests:
- Pending requests review
- Approve/reject functionality
- Signed NDAs overview
- Search and filtering

#### 5. Investor NDA History (`/pages/InvestorNDAHistory.tsx`)
Dashboard for investors to track their NDAs:
- Request status tracking
- Signed NDAs management
- Document downloads
- Expiration monitoring

## NDA Types and Access Levels

### Basic NDA
- **Purpose**: View enhanced pitch information
- **Access**: Synopsis, treatment, basic financial info
- **Duration**: 1 year
- **Protected**: Detailed budget, script, contact info

### Enhanced NDA
- **Purpose**: Full due diligence access
- **Access**: All financial data, scripts, contracts
- **Duration**: 2-3 years
- **Protected**: None (full access)

### Custom NDA
- **Purpose**: User-uploaded legal agreements
- **Access**: Defined by custom terms
- **Duration**: As specified in document
- **Protected**: As defined in agreement

## Workflow Process

### 1. NDA Request Flow
```
Investor/Production Company → Views Pitch → Sees Protected Content
→ Clicks "Request NDA Access" → Fills Request Form → Submits Request
→ Email Notification to Creator → Creator Reviews Request
→ Creator Approves/Rejects → Email Notification to Requester
→ If Approved: NDA Created → Access Granted → Protected Content Unlocked
```

### 2. Access Control Flow
```
User Views Protected Content → System Checks NDA Status
→ If Owner: Full Access → If Valid NDA: Access Based on Type
→ If No NDA: Show Protected Overlay → If Expired: Revoke Access
```

### 3. Document Generation
```
NDA Approved → Generate PDF Document → Store Signature Data
→ Email Document to Both Parties → Enable Download Links
```

## Security Features

### Legal Compliance
- Digital signature tracking
- IP address and user agent logging
- Audit trail for all NDA activities
- Timestamped document generation

### Access Protection
- Field-level content protection
- Automatic expiration handling
- Manual access revocation
- Real-time status checking

### Data Security
- Encrypted sensitive data storage
- Secure document generation
- Protected API endpoints
- Authentication required for all operations

## Usage Examples

### Protecting Content in Components
```tsx
import ProtectedContent, { ProtectedBudget } from './components/ProtectedContent';

// Protect budget information
<ProtectedBudget
  pitchId={pitch.id}
  creatorId={pitch.creator.id}
  budget={pitch.budget}
/>

// Protect any field
<ProtectedContent
  pitchId={pitch.id}
  creatorId={pitch.creator.id}
  field="script"
  fallback={<div>Script requires NDA</div>}
>
  <ScriptViewer script={pitch.script} />
</ProtectedContent>
```

### Checking NDA Status
```tsx
import NDAStatus from './components/NDAStatus';

<NDAStatus 
  pitchId={pitch.id} 
  creatorId={pitch.creator.id}
  onNDARequest={() => setShowModal(true)}
/>
```

### API Usage
```typescript
// Check NDA status
const status = await apiClient.get(`/api/pitches/${pitchId}/nda-status`);

// Request NDA
const request = await apiClient.post(`/api/pitches/${pitchId}/request-nda`, {
  ndaType: 'basic',
  requestMessage: 'Investment evaluation',
  companyInfo: { ... }
});

// Approve request (creator)
const approval = await apiClient.post(`/api/nda/${requestId}/approve`);
```

## Deployment and Configuration

### Environment Variables
```
NDA_EXPIRATION_SERVICE=true    # Enable automatic expiration checking
NDA_DEFAULT_DURATION=365       # Default NDA duration in days
```

### Starting Services
```bash
# Start the main server (includes NDA endpoints)
deno run --allow-all working-server.ts

# The NDA expiration service starts automatically
# To disable: NDA_EXPIRATION_SERVICE=false
```

### Database Migration
```bash
# Run migrations to create NDA tables
deno run --allow-all src/db/migrate.ts
```

## Testing the Workflow

### Manual Testing Steps
1. **Create Test Users**: Creator and Investor accounts
2. **Create Pitch**: With protected content fields
3. **Request NDA**: As investor, request access
4. **Review Request**: As creator, check dashboard
5. **Approve NDA**: Grant access and verify email
6. **Verify Access**: Check protected content unlocks
7. **Download PDF**: Verify document generation
8. **Test Expiration**: Manually expire and verify revocation

### API Testing
```bash
# Test NDA status check
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/pitches/1/nda-status"

# Test NDA request
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ndaType":"basic","requestMessage":"Test"}' \
  "http://localhost:8000/api/pitches/1/request-nda"
```

## Monitoring and Analytics

### NDA Statistics
- Total requests per creator
- Approval/rejection rates
- Active vs expired NDAs
- Most protected content types

### Audit Logging
- All NDA activities logged
- User actions tracked
- Document access monitored
- Expiration events recorded

## Future Enhancements

### Potential Features
1. **Digital Signatures**: Integration with DocuSign/HelloSign
2. **Advanced Templates**: Industry-specific NDA templates
3. **Multi-party NDAs**: Support for complex deal structures
4. **Automated Renewals**: NDA extension workflows
5. **Compliance Reporting**: Legal audit reports
6. **Integration APIs**: Third-party legal platform integration

### Scalability Considerations
1. **Background Jobs**: Move expiration checking to job queue
2. **Document Storage**: External storage for large PDF files
3. **Caching**: Cache NDA status for performance
4. **Analytics**: Dedicated analytics database
5. **Notifications**: Real-time notification system

## Troubleshooting

### Common Issues
1. **PDF Generation Fails**: Check jsPDF dependency
2. **Access Not Updating**: Verify API endpoints
3. **Emails Not Sending**: Check email service configuration
4. **Expiration Not Working**: Verify background service

### Debug Commands
```bash
# Check NDA expiration service
curl "http://localhost:8000/api/nda/stats"

# Manual expiration check
# (Add debug endpoint in development)
```

This implementation provides a production-ready NDA workflow that balances legal compliance, user experience, and security requirements.