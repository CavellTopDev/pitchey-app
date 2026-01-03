# RBAC Implementation Documentation

## Overview
The Pitchey platform now implements a comprehensive Role-Based Access Control (RBAC) system to manage user permissions and content access across all portals.

## Database Schema

### Core Tables
1. **permissions** - Defines all available permissions in the system
2. **roles** - System roles (creator, investor, production, admin)
3. **role_permissions** - Maps permissions to roles
4. **user_roles** - Assigns roles to users
5. **content_access** - Manages access to protected content (pitches, documents)
6. **permission_audit** - Logs all permission checks for security

## System Roles & Permissions

### Creator Role
- **Pitch Management**: Create, edit, delete, publish own pitches
- **NDA Control**: Approve/reject NDA requests for their content
- **Investment Reception**: Receive and track investments
- **Document Management**: Upload and share pitch documents
- **Analytics**: View own content performance

### Investor Role  
- **Browse Content**: View published pitches
- **NDA Requests**: Request access to protected content
- **Investments**: Make and track investments
- **Portfolio Management**: Save and watchlist pitches
- **Analytics**: View investment performance

### Production Company Role
- **Content Discovery**: Browse and search all pitches
- **NDA Requests**: Request access to protected content  
- **Project Pipeline**: Manage production pipeline
- **Investments**: Fund projects
- **Team Management**: Manage production teams

### Admin Role
- **Full Access**: All permissions across the platform
- **User Management**: Manage all users and roles
- **Content Moderation**: Manage all content
- **System Configuration**: Platform settings
- **Audit Access**: View security audit logs

## API Integration

### Permission Checking
```typescript
// Get user's permission context
GET /api/permissions/context

Response:
{
  userId: number,
  roles: string[],
  permissions: string[],
  hasNDAAccess: Map<number, boolean>
}
```

### Protected Routes
All API endpoints now check permissions:
```typescript
// Middleware checks permission before route handler
if (!hasPermission(context, 'pitch:create')) {
  return forbidden('Insufficient permissions');
}
```

### NDA Access Flow
1. User requests NDA for protected content
2. Creator approves NDA request
3. System automatically grants content access
4. User can now view protected pitch details and documents

## Frontend Integration

### React Permission Hook
```typescript
import { usePermissions } from '@/hooks/usePermissions';

function Component() {
  const { hasPermission, hasRole, capabilities } = usePermissions();
  
  if (!hasPermission('pitch:create')) {
    return <div>You don't have permission to create pitches</div>;
  }
  
  return <CreatePitchForm />;
}
```

### Permission Guard Component
```jsx
<PermissionGuard permission="pitch:create">
  <CreatePitchButton />
</PermissionGuard>

<PermissionGuard role="investor">
  <InvestmentDashboard />
</PermissionGuard>
```

## Content Access Control

### Access Levels
- **view** - Can view content
- **edit** - Can modify content
- **admin** - Full control including delete

### Access Grant Methods
- **ownership** - Creator owns the content
- **nda** - Access granted via approved NDA
- **team** - Team member access
- **public** - Publicly accessible content

## Security Features

### Audit Logging
All permission checks are logged:
- User ID
- Action attempted
- Resource accessed
- Permission required
- Grant/deny decision
- IP address
- Timestamp

### Permission Caching
- Permission context cached for 5 minutes
- Invalidated on role changes
- Reduces database queries

### NDA Expiration
- NDAs can have expiration dates
- Access automatically revoked when expired
- Notifications sent before expiration

## Testing

### Demo Accounts
```
Creator: alex.creator@demo.com / Demo123
Investor: sarah.investor@demo.com / Demo123  
Production: stellar.production@demo.com / Demo123
Admin: admin@pitchey.com / Admin123!
```

### Test Scripts
- `scripts/test-rbac-permissions.sh` - Test permission enforcement
- `scripts/seed-rbac-demo-users.ts` - Create demo users with roles

## Migration Guide

### For Existing Users
1. Users automatically assigned roles based on `user_type`
2. Existing NDAs converted to content access records
3. Pitch creators granted ownership access

### For Developers
1. Use permission service for all authorization checks
2. Update UI components to use permission guards
3. Test with different user roles

## Best Practices

### Permission Naming
- Format: `resource:action`
- Examples: `pitch:create`, `nda:approve`, `investment:view_own`

### Role Assignment
- Users can have multiple roles
- Roles can have expiration dates
- Admin role requires additional verification

### Content Protection
- Always check NDA status for protected content
- Log access attempts for audit trail
- Implement rate limiting for sensitive operations

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check user has correct role assigned
   - Verify permission exists in role_permissions
   - Check for expired role assignments

2. **NDA Access Not Working**
   - Ensure NDA is approved
   - Check content_access record exists
   - Verify NDA hasn't expired

3. **Cache Issues**
   - Clear Redis cache if permissions not updating
   - Check cache TTL settings
   - Verify cache invalidation on updates

## Future Enhancements

### Planned Features
1. **Custom Roles** - Allow organizations to create custom roles
2. **Delegation** - Temporary permission delegation
3. **Approval Workflows** - Multi-step approval for sensitive actions
4. **API Keys** - Scoped API keys with specific permissions
5. **2FA Requirements** - Enforce 2FA for certain permissions

### Performance Optimizations
1. **Permission Prefetching** - Load common permissions on login
2. **Batch Checking** - Check multiple permissions in one query
3. **Edge Caching** - Cache permission checks at edge locations

## API Reference

### Permission Endpoints
- `GET /api/permissions/context` - Get user's permission context
- `GET /api/permissions/check` - Check specific permission
- `POST /api/permissions/grant` - Grant permission (admin only)
- `POST /api/permissions/revoke` - Revoke permission (admin only)

### Role Management
- `GET /api/roles` - List all roles
- `POST /api/roles/assign` - Assign role to user
- `DELETE /api/roles/remove` - Remove role from user
- `GET /api/roles/:roleId/permissions` - Get role permissions

### Access Control
- `GET /api/access/:contentType/:contentId` - Check access
- `POST /api/access/grant` - Grant content access
- `POST /api/access/revoke` - Revoke content access
- `GET /api/access/audit` - View access audit log

## Support
For RBAC-related issues or questions:
1. Check this documentation
2. Review test scripts for examples
3. Contact platform support
4. Report issues on GitHub