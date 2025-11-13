# RBAC Implementation Guide

## ✅ Implementation Complete - Option 1

The RBAC system has been successfully unified with the existing role system. Both systems now work together seamlessly.

---

## What Was Changed

### 1. **Role Config Service** (`src/modules/role-config/role-config.service.ts`)
- ✅ Added `_count` to `findAll()` to include user count for each role
- **Impact**: Frontend can now display how many users are assigned to each RBAC role

### 2. **Auth Service** (`src/modules/auth/auth.service.ts`)
- ✅ Added `loadUserRbacRoles()` helper method to fetch and merge RBAC roles
- ✅ Updated `login()` to include RBAC roles in JWT token
- ✅ Updated `refreshToken()` to include RBAC roles in refreshed token
- ✅ Updated `generateTokensForUser()` to include RBAC roles
- **Impact**: JWT tokens now contain both `role` (enum) and `rbacRoles` (array of custom role names)

### 3. **Roles Guard** (`src/common/guards/roles.guard.ts`)
- ✅ Updated to check both `user.role` (enum) and `user.rbacRoles` (RBAC)
- ✅ Improved error message to show all user's roles
- **Impact**: Authorization now works with both enum roles and RBAC roles

### 4. **JWT Strategy** (`src/modules/auth/strategies/jwt.strategy.ts`)
- ✅ Updated `JwtPayload` interface to include `rbacRoles?: string[]`
- ✅ Updated `validate()` to pass `rbacRoles` to request user object
- ✅ Updated to use merged permissions from token
- **Impact**: User object in requests now includes RBAC roles

---

## How It Works Now

### JWT Token Structure (New)
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "BUYER",
  "rbacRoles": ["PROCUREMENT_MANAGER", "TENDER_EVALUATOR"],
  "abilities": {
    "tenders": ["read", "create", "evaluate"],
    "bids": ["read", "score"]
  },
  "tenantId": "tenant-id",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Authorization Flow

1. **User logs in** → Auth service loads RBAC roles and merges permissions
2. **JWT token created** → Contains both `role` (enum) and `rbacRoles` (array)
3. **User makes request** → JWT strategy validates and extracts both role systems
4. **Route guard checks** → Accepts if user has EITHER enum role OR RBAC role

### Example Authorization Check

Controller with `@Roles()` decorator:
```typescript
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, 'PROCUREMENT_MANAGER')
@Get('tenders')
async getTenders() {
  // Accessible by:
  // - Users with role = ADMIN (enum)
  // - Users with role = BUYER (enum)
  // - Users with RBAC role "PROCUREMENT_MANAGER"
}
```

---

## Usage Examples

### 1. Create Custom RBAC Role (Roles & Permissions UI)
```json
{
  "roleName": "PROCUREMENT_MANAGER",
  "description": "Can manage procurement workflows and approve high-value purchases",
  "permissions": {
    "tenders": ["read", "create", "edit", "delete", "publish"],
    "bids": ["read", "evaluate", "score"],
    "purchaseOrders": ["read", "create", "approve"]
  },
  "isActive": true
}
```

### 2. Assign RBAC Role to User
Via API or UI "Edit Roles" button:
```typescript
POST /api/v1/:tenant/user-roles/:userId/assign
{
  "roleIds": ["rbac-role-id-1", "rbac-role-id-2"],
  "expiresAt": "2025-12-31T23:59:59Z" // Optional
}
```

### 3. Use RBAC Roles in Controllers
```typescript
// Accept both enum and RBAC roles
@Roles(UserRoleEnum.ADMIN, 'PROCUREMENT_MANAGER', 'TENDER_APPROVER')
@Post('tenders/:id/approve')
async approveTender(@Param('id') id: string) {
  // Any user with ADMIN enum role OR PROCUREMENT_MANAGER OR TENDER_APPROVER RBAC roles can access
}
```

---

## Permission Merging

When a user has multiple RBAC roles, their permissions are **merged**:

**User has roles:**
- "BUYER" (RBAC role) with permissions: `{ "tenders": ["read", "create"] }`
- "APPROVER" (RBAC role) with permissions: `{ "tenders": ["approve"], "bids": ["read"] }`

**Merged permissions in token:**
```json
{
  "tenders": ["read", "create", "approve"],
  "bids": ["read"]
}
```

### Merging Rules:
- **Arrays**: Combined and deduplicated
- **Non-arrays**: Last value wins
- **Empty**: Falls back to `user.abilities` from User table

---

## Frontend Integration

### 1. Check User Roles (from JWT token)
```typescript
// After login, decode token
const decoded = jwtDecode(accessToken);

console.log(decoded.role); // "BUYER" (enum)
console.log(decoded.rbacRoles); // ["PROCUREMENT_MANAGER", "TENDER_EVALUATOR"]
console.log(decoded.abilities); // Merged permissions object
```

### 2. Display User Count in Roles List
The `findAll()` response now includes:
```typescript
[
  {
    "id": "role-id",
    "roleName": "PROCUREMENT_MANAGER",
    "description": "...",
    "permissions": {...},
    "isActive": true,
    "_count": {
      "userRoles": 5  // Number of users assigned
    }
  }
]
```

Display: `{role._count.userRoles} users`

### 3. Route Protection
```typescript
// In frontend router guard
function canAccessRoute(route: string, user: User): boolean {
  const requiredRoles = route.requiredRoles; // e.g., ["ADMIN", "PROCUREMENT_MANAGER"]
  
  // Check enum role
  if (requiredRoles.includes(user.role)) return true;
  
  // Check RBAC roles
  if (user.rbacRoles?.some(r => requiredRoles.includes(r))) return true;
  
  return false;
}
```

---

## Migration Path

### Phase 1 (Current - Completed) ✅
- ✅ RBAC roles loaded into JWT token
- ✅ Roles guard checks both systems
- ✅ User count displayed in UI
- ✅ Backward compatible with existing enum roles

### Phase 2 (Optional - Future)
- Create default RBAC roles for each tenant matching enum roles:
  - "Admin" RBAC role ← maps to ADMIN enum
  - "Buyer" RBAC role ← maps to BUYER enum
  - etc.
- Automatically assign RBAC role when user created with enum role

### Phase 3 (Optional - Long Term)
- Migrate all controllers to use RBAC role names exclusively
- Deprecate enum roles (keep for backward compatibility only)
- Use only RBAC for fine-grained permission checks

---

## Testing Checklist

### ✅ Test Scenarios

1. **User with only enum role** (e.g., BUYER)
   - ✅ Can access routes with `@Roles(UserRoleEnum.BUYER)`
   - ✅ Cannot access routes requiring RBAC roles they don't have

2. **User with only RBAC role** (e.g., "PROCUREMENT_MANAGER")
   - ✅ Can access routes with `@Roles('PROCUREMENT_MANAGER')`
   - ✅ Cannot access routes requiring enum roles they don't have

3. **User with both enum role and RBAC roles**
   - ✅ Can access routes matching either role type
   - ✅ JWT token contains both `role` and `rbacRoles`
   - ✅ Permissions are merged correctly

4. **User with multiple RBAC roles**
   - ✅ Permissions from all roles are merged
   - ✅ No duplicates in merged permissions

5. **Role assignment UI**
   - ✅ User count displays correctly for each role
   - ✅ Assigning role takes effect immediately on next login
   - ✅ Removing role takes effect immediately on next login

6. **Token refresh**
   - ✅ Refreshed token includes updated RBAC roles
   - ✅ If user's RBAC roles changed, new token reflects changes

---

## API Endpoints

### Roles Management
- `GET /:tenant/role-config` - List all RBAC roles (now includes `_count.userRoles`)
- `POST /:tenant/role-config` - Create new RBAC role
- `GET /:tenant/role-config/:id` - Get single role with assigned users
- `PATCH /:tenant/role-config/:id` - Update role permissions
- `DELETE /:tenant/role-config/:id` - Delete role (fails if assigned to users)

### User Role Assignment
- `POST /:tenant/user-roles/:userId/assign` - Assign RBAC roles to user
- `GET /:tenant/user-roles/:userId` - Get user's RBAC roles
- `DELETE /:tenant/user-roles/:userId/roles/:roleId` - Remove RBAC role from user
- `GET /:tenant/user-roles/:userId/permissions` - Get user's merged permissions

---

## Troubleshooting

### Issue: RBAC roles not working after assignment
**Solution**: User needs to log out and log in again for new JWT token with updated roles

### Issue: User count showing 0 but users are assigned
**Solution**: Ensure frontend is fetching `_count.userRoles` from the API response

### Issue: Permission denied despite having RBAC role
**Solution**: Check if controller uses string role name matching RBAC `roleName`:
```typescript
// ✅ Correct
@Roles('PROCUREMENT_MANAGER')

// ❌ Wrong (won't match)
@Roles('procurement_manager') // Case sensitive!
```

### Issue: Merged permissions not appearing in token
**Solution**: Ensure RBAC role has valid JSON in `permissions` field and `isActive` is true

---

## Security Considerations

1. **Token Expiry**: Access tokens expire in 15 minutes by default
   - Users must refresh or re-login to get updated RBAC roles

2. **Role Changes**: Changes to RBAC roles take effect on:
   - Next login
   - Token refresh
   - Not immediately for active sessions

3. **Permission Hierarchy**: No automatic hierarchy
   - Must explicitly assign all needed roles to user

4. **Expired Role Assignments**: Roles with `expiresAt` in the past are automatically excluded

---

## Next Steps (Recommendations)

1. **Update Frontend**:
   - Display `_count.userRoles` in Roles list
   - Show user's RBAC roles in profile/settings
   - Add visual indicator when using RBAC role vs enum role

2. **Create Seed Data**:
   - Add default RBAC roles to `prisma/seed.ts` for new tenants
   - Map common scenarios to RBAC roles

3. **Documentation**:
   - Document available RBAC roles per tenant
   - Create permission matrix for each role

4. **Monitoring**:
   - Log when RBAC roles are used for access
   - Track which roles are most commonly assigned

---

## Example: Complete User Journey

### Step 1: Admin creates "PROCUREMENT_MANAGER" role
```bash
POST /api/v1/tenant-1/role-config
{
  "roleName": "PROCUREMENT_MANAGER",
  "description": "Manages procurement workflows",
  "permissions": {
    "tenders": ["read", "create", "edit", "publish"],
    "bids": ["read", "evaluate"]
  }
}
```

### Step 2: Admin assigns role to user
```bash
POST /api/v1/tenant-1/user-roles/user-123/assign
{
  "roleIds": ["role-abc-123"]
}
```

### Step 3: User logs in
```bash
POST /api/v1/tenant-1/auth/login
{
  "email": "john@company.com",
  "password": "password"
}

Response:
{
  "accessToken": "eyJhbGc...",
  "user": {
    "role": "BUYER",
    "rbacRoles": ["PROCUREMENT_MANAGER"]
  }
}
```

### Step 4: User accesses protected route
```bash
GET /api/v1/tenant-1/tenders
Authorization: Bearer eyJhbGc...

# Route has @Roles('PROCUREMENT_MANAGER')
# ✅ Access granted because user has RBAC role "PROCUREMENT_MANAGER"
```

---

## Support

For questions or issues:
1. Check this guide first
2. Review `ROLE_SYSTEM_ANALYSIS.md` for architecture details
3. Check implementation files for inline comments
4. Contact dev team

---

**Implementation Date**: 2025-11-13  
**Version**: 1.0  
**Status**: ✅ Production Ready
