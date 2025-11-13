# Role System Analysis & Recommendations

## Current State: Dual Role System

Your application currently has **TWO SEPARATE** and **DISCONNECTED** role systems:

### 1. **Simple Role System** (User.role - `UserRoleEnum`)
- **Location**: `User` model, `role` field (line 103 in schema.prisma)
- **Type**: Enum with fixed values: `ADMIN`, `USER`, `BUYER`, `VENDOR`, `APPROVER`, `FINANCE`, `MANAGER`
- **Used in**: 
  - User registration/creation (Create User form)
  - JWT token payload (auth.service.ts line 145)
  - Route guards via `@Roles()` decorator (roles.guard.ts line 33)
  - All controller authorization checks
- **Storage**: Single `role` field on User table
- **Permissions**: Optional JSON field `abilities` on User table

### 2. **Advanced RBAC System** (RbacConfig + UserRbacRole)
- **Location**: `RbacConfig` model + `UserRbacRole` junction table
- **Type**: Flexible, tenant-specific custom roles
- **Used in**:
  - Roles & Permissions management UI
  - Role assignment to users (Edit Roles button)
- **Storage**: Separate tables with many-to-many relationship
- **Permissions**: JSON field in `RbacConfig` with flexible structure
- **Features**:
  - Custom role names (e.g., "PROCUREMENT_MANAGER")
  - Tenant-specific roles
  - Fine-grained JSON permissions
  - Role assignment tracking (assignedBy, assignedAt, expiresAt)
  - Multiple roles per user

## The Problem

### Issue 1: Systems Are Not Connected
The `RolesGuard` (used by all `@Roles()` decorators) **ONLY checks `user.role`** (the enum field):

```typescript
// roles.guard.ts line 33
const hasRole = requiredRoles.includes(user.role);
```

It **DOES NOT** look at `UserRbacRole` assignments at all!

### Issue 2: User Count Not Updating
The role-config.service.ts correctly counts users:

```typescript
const assignedCount = await this.prisma.userRbacRole.count({
  where: { rbacRoleId: roleId, tenantId }
});
```

However, this might not be reflected in the UI because the frontend may not be fetching or displaying this data correctly.

### Issue 3: Token Doesn't Include RBAC Roles
When a user logs in, the JWT payload only includes `user.role` (the enum):

```typescript
// auth.service.ts line 142-148
const payload = {
  sub: user.id,
  email: user.email,
  role: user.role,  // <-- Only the enum role
  abilities: user.abilities,
  tenantId,
};
```

The RBAC roles from `UserRbacRole` are not included.

## Recommended Solutions

### **Option 1: Unify to RBAC System (Recommended)**

Make the RBAC system the primary authorization mechanism:

#### Changes Required:

1. **Update Auth Service** to load RBAC roles:
```typescript
// In auth.service.ts login()
const userRoles = await this.prismaService.userRbacRole.findMany({
  where: { 
    userId: user.id, 
    tenantId,
    OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }]
  },
  include: { rbacRole: true }
});

const mergedPermissions = // merge logic from user-role.service.ts
const roleNames = userRoles.map(ur => ur.rbacRole.roleName);

const payload = {
  sub: user.id,
  email: user.email,
  role: user.role,  // Keep for backward compatibility
  rbacRoles: roleNames,  // Add RBAC roles
  abilities: mergedPermissions,  // Use merged permissions
  tenantId,
};
```

2. **Update RolesGuard** to check RBAC roles:
```typescript
canActivate(context: ExecutionContext) {
  const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
  if (!requiredRoles) return true;

  const user = request.user;
  
  // Check both enum role and RBAC roles
  const hasEnumRole = requiredRoles.includes(user.role);
  const hasRbacRole = user.rbacRoles?.some(r => requiredRoles.includes(r));
  
  if (!hasEnumRole && !hasRbacRole) {
    throw new ForbiddenException(...);
  }
  
  return true;
}
```

3. **Update Controllers** to use RBAC role names:
```typescript
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, 'PROCUREMENT_MANAGER')
// Can now accept both enum values and custom role names
```

4. **Keep User.role for Backward Compatibility**:
   - Use as a "base role" or "default role"
   - New `@Roles()` decorator can check both systems

#### Pros:
- Flexible, tenant-specific roles work
- Granular permissions system active
- Role assignments from UI work as expected
- Can gradually migrate away from enum roles

#### Cons:
- Requires changes to auth flow and guards
- Need to update all controller decorators
- More complex authorization logic

---

### **Option 2: Keep Simple System, Remove RBAC UI**

Remove the Roles & Permissions UI and only use `User.role` enum:

#### Changes Required:

1. **Remove RBAC-related UI** (Roles & Permissions page, Edit Roles button)
2. **Remove RBAC models** from schema (optional, or keep for future)
3. **Simplify User Management** - only show enum dropdown
4. **Use `abilities` JSON field** on User table for fine-grained permissions if needed

#### Pros:
- Simpler authorization logic
- Consistent with current implementation
- Easier to understand and maintain

#### Cons:
- Less flexible
- Can't create custom roles per tenant
- Enum changes require code deployment

---

### **Option 3: Hybrid Approach**

Use enum roles for route-level auth, RBAC for fine-grained permissions:

#### Implementation:
1. **Route guards** check `user.role` enum (as now)
2. **RBAC permissions** control specific actions within routes
3. **Create mapping** between enum roles and default RBAC roles:
   - When user assigned `ADMIN` enum → auto-assign "Admin" RBAC role
   - When user assigned `BUYER` enum → auto-assign "Buyer" RBAC role
4. **Custom RBAC roles** can be assigned in addition to base enum role

#### Pros:
- Backward compatible
- Allows both systems to coexist
- Gradual migration path

#### Cons:
- Most complex to implement
- Two sources of truth for authorization

---

## Immediate Fixes for Current Issues

### Fix 1: Show Correct User Count in Roles List

Update the frontend query to include user count:

```typescript
// In role-config.service.ts, update findAll()
async findAll(tenantId: string, isActive?: boolean) {
  return this.prisma.rbacConfig.findMany({
    where: { tenantId, ...(isActive !== undefined && { isActive }) },
    include: {
      _count: {
        select: { userRoles: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}
```

Update frontend to display `role._count.userRoles`.

### Fix 2: Make Role Assignments Work (Quick Patch)

If you want RBAC role assignments to affect authorization immediately:

Update RolesGuard to check RBAC roles:

```typescript
// roles.guard.ts
async canActivate(context: ExecutionContext): Promise<boolean> {
  const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
  if (!requiredRoles) return true;

  const request = context.switchToHttp().getRequest();
  const user = request.user;

  if (!user || !user.role) {
    throw new ForbiddenException('User role not found');
  }

  // Check enum role
  const hasEnumRole = requiredRoles.includes(user.role);
  
  // Check RBAC roles if available in token
  const hasRbacRole = user.rbacRoles?.some(r => requiredRoles.includes(r)) ?? false;

  if (!hasEnumRole && !hasRbacRole) {
    throw new ForbiddenException(
      `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${user.role}`
    );
  }

  return true;
}
```

---

## My Recommendation

**Choose Option 1** (Unify to RBAC System) because:

1. ✅ Your UI already supports it
2. ✅ It's more flexible for multi-tenant scenarios
3. ✅ You can create roles like "PROCUREMENT_MANAGER", "TENDER_EVALUATOR", etc.
4. ✅ Fine-grained permissions per tenant
5. ✅ Keep `User.role` enum for backward compatibility during migration

### Migration Path:

**Phase 1** (Immediate):
- Fix user count display in Roles & Permissions UI
- Document that RBAC roles don't affect auth yet

**Phase 2** (Next sprint):
- Update AuthService to load RBAC roles into JWT
- Update RolesGuard to check both role systems
- Test with existing enum roles

**Phase 3** (Future):
- Create default RBAC roles matching enums for all tenants
- Migrate controllers to use RBAC role names
- Add RBAC-based fine-grained permission checks (using abilities)
- Optionally deprecate enum roles

---

## Questions to Answer

1. **Do you want tenant-specific custom roles?** → Choose Option 1
2. **Do you want simplicity over flexibility?** → Choose Option 2
3. **Do you need fine-grained permissions (e.g., "can approve tenders > $10k")?** → Choose Option 1 or 3
4. **How many tenants will use this system?** → Multiple tenants → Option 1

---

## Files to Modify (Option 1)

1. `src/modules/auth/auth.service.ts` - Load RBAC roles in login
2. `src/common/guards/roles.guard.ts` - Check both role systems
3. `src/modules/role-config/role-config.service.ts` - Add user count
4. Controllers - Update `@Roles()` decorators to accept RBAC role names
5. Frontend - Display and handle RBAC roles from token

Let me know which option you'd like to implement, and I'll help you build it!
