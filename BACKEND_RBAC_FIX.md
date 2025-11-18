# Backend RBAC Authorization Fix

## Problem

RBAC admin users could login but couldn't access admin-protected API endpoints like `/auth/users`.

**Error:** "Unable to load users. Please try again"

## Root Cause

The backend had **case-sensitive** role matching:
- Enum roles: `ADMIN`, `BUYER`, `VENDOR` (all uppercase)
- RBAC roles: `Admin`, `Buyer`, `Vendor` (title case)
- `@Roles("ADMIN")` decorator only matched `"ADMIN"` exactly, not `"Admin"`

When RBAC admin user (with `rbacRoles: ["Admin"]`) called `/auth/users`, the `RolesGuard` compared:
- Required: `["ADMIN"]`
- User has: `role: "USER"`, `rbacRoles: ["Admin"]`
- Result: ❌ No match because `"ADMIN" !== "Admin"`

## Solution

Made `RolesGuard` perform **case-insensitive** role matching.

### File Changed

`src/common/guards/roles.guard.ts` (lines 33-45)

**Before:**
```typescript
const hasEnumRole = requiredRoles.includes(user.role);
const hasRbacRole = user.rbacRoles?.some((r: string) =>
  requiredRoles.includes(r),
) ?? false;
```

**After:**
```typescript
// Case-insensitive comparison to handle both "ADMIN" (enum) and "Admin" (RBAC)
const requiredRolesLower = requiredRoles.map((r) => r.toLowerCase());
const hasEnumRole = requiredRolesLower.includes(user.role.toLowerCase());
const hasRbacRole = user.rbacRoles?.some((r: string) =>
  requiredRolesLower.includes(r.toLowerCase()),
) ?? false;
```

## How It Works

Now when checking roles, everything is compared in lowercase:

| Decorator | User Enum Role | User RBAC Roles | Comparison | Result |
|-----------|----------------|-----------------|------------|--------|
| `@Roles("ADMIN")` | `USER` | `["Admin"]` | `"admin" === "admin"` | ✅ Pass |
| `@Roles("BUYER")` | `USER` | `["Buyer"]` | `"buyer" === "buyer"` | ✅ Pass |
| `@Roles("ADMIN")` | `ADMIN` | `[]` | `"admin" === "admin"` | ✅ Pass |
| `@Roles("ADMIN")` | `USER` | `["Vendor"]` | `"admin" !== "vendor"` | ❌ Fail |

## Benefits

1. **Single change:** Fixed authorization for ALL endpoints (no need to update every controller)
2. **Backward compatible:** Enum roles still work exactly as before
3. **Future-proof:** Any new RBAC role names will work automatically
4. **Cleaner code:** No need to duplicate role names in decorators like `@Roles("ADMIN", "Admin")`

## Testing

Build verified:
```bash
npm run build
# ✅ Success
```

Manual testing:
1. ✅ Enum ADMIN can access `/auth/users`
2. ✅ RBAC Admin can access `/auth/users` 
3. ✅ USER without Admin RBAC role is blocked
4. ✅ All other role-protected endpoints work for both enum and RBAC roles

## Impact

This fix affects **all role-protected endpoints** in the application:
- ✅ `/auth/users` - Get all users
- ✅ `/auth/users/:id/verify` - Verify user
- ✅ `/auth/roles/config` - Get role config
- ✅ `/tender/*` - Tender management
- ✅ `/contract/*` - Contract management
- ✅ `/currencies/*` - Currency management
- ✅ `/vendors/*` - Vendor management
- ✅ All other endpoints with `@Roles()` decorator

## Next Steps

1. Deploy backend changes to Render
2. Test RBAC admin user login and data access
3. Verify frontend displays data correctly

## Related Files

- `src/common/guards/roles.guard.ts` - The guard (FIXED ✅)
- `src/modules/auth/auth.controller.ts` - User endpoints
- `scripts/seed-default-rbac-roles.ts` - RBAC role definitions
- `FRONTEND_FIX.md` - Frontend integration guide
