# Role-Based Access Control (RBAC) Implementation

## Overview
A comprehensive permission system has been implemented to provide granular access control across the Pitchey platform. The RBAC system ensures users can only access and modify resources they have permission for.

## Architecture

### Core Components

1. **RBACService** (`src/services/rbac.service.ts`)
   - Central service for permission checking
   - Manages role-permission mappings
   - Provides helper methods for access control

2. **RBACMiddleware** (`src/middleware/rbac.middleware.ts`)
   - Worker middleware for endpoint protection
   - Handles authentication and authorization
   - Checks resource ownership

3. **RBACIntegration** (`src/utils/rbac-integration.ts`)
   - Helper utilities for integrating RBAC into existing endpoints
   - Permission check wrappers
   - Ownership verification

4. **Database Schema** (`src/db/migrations/add-rbac-tables.sql`)
   - User roles and permissions storage
   - Audit logging
   - Permission overrides

## User Roles

### 1. Admin
- Full system access
- Can moderate content
- User management capabilities
- System configuration

### 2. Creator
- Create, edit, delete own pitches
- Approve/reject NDA requests for their pitches
- Upload documents
- View analytics for own content
- Messaging capabilities

### 3. Investor
- Request NDAs
- Make investments
- Manage portfolio
- View financial data
- Access pitch details (with NDA)

### 4. Production Company
- Request NDAs
- Create production projects
- Manage crew
- Schedule and budget management
- Can also invest (hybrid role)

### 5. Viewer (Default)
- View public content only
- Limited read-only access
- No creation or modification capabilities

## Permissions

### Pitch Permissions
```typescript
PITCH_CREATE = 'pitch.create'
PITCH_EDIT_OWN = 'pitch.edit.own'
PITCH_EDIT_ANY = 'pitch.edit.any'
PITCH_DELETE_OWN = 'pitch.delete.own'
PITCH_DELETE_ANY = 'pitch.delete.any'
PITCH_VIEW_PUBLIC = 'pitch.view.public'
PITCH_VIEW_PRIVATE = 'pitch.view.private'
PITCH_PUBLISH = 'pitch.publish'
PITCH_MODERATE = 'pitch.moderate'
```

### NDA Permissions
```typescript
NDA_REQUEST = 'nda.request'
NDA_APPROVE = 'nda.approve'
NDA_REJECT = 'nda.reject'
NDA_SIGN = 'nda.sign'
NDA_REVOKE = 'nda.revoke'
NDA_VIEW_OWN = 'nda.view.own'
NDA_VIEW_ANY = 'nda.view.any'
NDA_UPLOAD_CUSTOM = 'nda.upload.custom'
```

### Investment Permissions
```typescript
INVESTMENT_CREATE = 'investment.create'
INVESTMENT_VIEW_OWN = 'investment.view.own'
INVESTMENT_VIEW_ANY = 'investment.view.any'
INVESTMENT_MANAGE = 'investment.manage'
INVESTMENT_WITHDRAW = 'investment.withdraw'
PORTFOLIO_VIEW = 'portfolio.view'
PORTFOLIO_MANAGE = 'portfolio.manage'
```

## Implementation Examples

### Protecting an Endpoint

```typescript
// In worker-integrated.ts
private async createPitch(request: Request): Promise<Response> {
  const authResult = await this.requireAuth(request);
  if (!authResult.authorized) return authResult.response!;
  
  // Check RBAC permission
  const rbacCheck = await RBACIntegration.checkPitchCreatePermission(
    authResult, 
    request
  );
  if (!rbacCheck.allowed) return rbacCheck.response!;
  
  // Continue with pitch creation...
}
```

### Checking Ownership

```typescript
private async editPitch(request: Request): Promise<Response> {
  const authResult = await this.requireAuth(request);
  const pitchId = request.params.id;
  
  // Get pitch owner
  const [pitch] = await this.db.query(
    'SELECT creator_id FROM pitches WHERE id = $1',
    [pitchId]
  );
  
  // Check ownership-based permission
  const rbacCheck = await RBACIntegration.checkPitchEditPermission(
    authResult,
    pitch.creator_id,
    request
  );
  if (!rbacCheck.allowed) return rbacCheck.response!;
  
  // Continue with editing...
}
```

### NDA-Based Access

```typescript
private async viewPrivateDocument(request: Request): Promise<Response> {
  const authResult = await this.requireAuth(request);
  const documentId = request.params.id;
  
  // Check if user has NDA
  const hasNDA = await this.checkNDAAccess(
    authResult.user.id, 
    documentPitchId
  );
  
  // Check permission with NDA requirement
  const rbacCheck = await RBACIntegration.checkDocumentViewPermission(
    authResult,
    false, // not public
    hasNDA,
    documentOwnerId,
    request
  );
  if (!rbacCheck.allowed) return rbacCheck.response!;
  
  // Return document...
}
```

## Database Schema

### User Permissions Table
```sql
CREATE TABLE user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  permission VARCHAR(100) NOT NULL,
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, permission)
);
```

### Role Overrides Table
```sql
CREATE TABLE role_overrides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  original_role VARCHAR(50) NOT NULL,
  override_role VARCHAR(50) NOT NULL,
  reason TEXT,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

### Audit Log Table
```sql
CREATE TABLE permission_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id INTEGER,
  permission VARCHAR(100),
  granted BOOLEAN,
  denial_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Helper Functions

### Check Permission
```typescript
RBACService.hasPermission(context, Permission.PITCH_CREATE)
```

### Check Ownership
```typescript
RBACService.canAccess(context, permission, {
  checkOwnership: true,
  requireNDA: false,
  requirePublished: true
})
```

### Get User Permissions
```typescript
const permissions = RBACService.getUserPermissions(context);
```

## Testing

Run the RBAC test suite:
```bash
./test-rbac-system.sh
```

This tests:
- Role identification
- Creator permissions
- Investor permissions
- Production permissions
- Document access control
- Ownership checks
- Admin restrictions
- Cross-role restrictions

## Security Considerations

1. **Default Deny**: All endpoints require explicit permission grants
2. **Ownership Checks**: Users can only modify their own resources
3. **NDA Requirements**: Private content requires approved NDAs
4. **Audit Logging**: All permission checks are logged
5. **Role Overrides**: Temporary permission changes are tracked
6. **Expiring Permissions**: Permissions can have time limits

## Migration Path

For existing users:
1. Role is derived from `user_type` field
2. Creators → creator role
3. Investors → investor role
4. Production companies → production role
5. Others → viewer role (default)

## Future Enhancements

1. **Team Permissions**: Share permissions within teams
2. **Delegation**: Allow users to delegate permissions
3. **Custom Roles**: Create organization-specific roles
4. **Permission Templates**: Predefined permission sets
5. **API Keys**: Service-specific permissions

## Troubleshooting

### Common Issues

1. **403 Forbidden**: User lacks required permission
   - Check user role
   - Verify permission mapping
   - Check ownership if applicable

2. **401 Unauthorized**: Authentication required
   - Ensure user is logged in
   - Check session validity

3. **Permission Denied**: Resource-specific denial
   - Check NDA status
   - Verify resource ownership
   - Check publication status

## API Response Codes

- `200`: Success with permission
- `401`: Authentication required
- `403`: Permission denied
- `404`: Resource not found or no access

## Conclusion

The RBAC system provides comprehensive access control while maintaining flexibility for future enhancements. All major endpoints are protected, and permissions are enforced at multiple levels (role, ownership, NDA status).