# RBAC Implementation Plan: Multiple Roles Per User

## Overview
Transform the current hardcoded single-role system into a flexible, database-driven RBAC system where users can have multiple roles with both tenant-wide and process-specific permissions.

---

## Current State vs Target State

### Current State ❌
- **Single role per user**: `User.role` (enum field)
- **Hardcoded permissions**: Set in `auth.service.ts` during registration
- **No database-driven roles**: `role_configs` and `rbac_config` tables exist but unused
- **Static abilities**: Stored in `User.abilities` JSON field

### Target State ✅
- **Multiple roles per user**: Junction table `user_roles`
- **Database-driven permissions**: Read from `role_configs` and `rbac_config`
- **Dynamic permission resolution**: Merge permissions from all assigned roles
- **Context-aware access**: Different permissions based on process and org level

---

## Database Schema Changes

### 1. Create UserRole Junction Table
```prisma
model UserRole {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  roleId    String   // FK to RoleConfig
  assignedAt DateTime @default(now())
  assignedBy String?  // Admin who assigned
  expiresAt  DateTime? // Optional role expiration
  
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleConfig RoleConfig @relation(fields: [roleId], references: [id], onDelete: Cascade)
  tenant     Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, userId, roleId])
  @@index([tenantId, userId])
  @@map("user_roles")
}
```

### 2. Update User Model
```prisma
model User {
  // ... existing fields
  role     UserRole @default(BUYER) // Keep for backward compatibility
  abilities Json?                   // Keep for user-specific overrides
  
  // New relation
  userRoles UserRole[]
}
```

### 3. Keep Existing Tables (Enhanced)
- `role_configs`: Tenant-wide role definitions
- `rbac_config`: Process-specific role permissions

---

## API Endpoints to Create

### A. Role Configuration Endpoints

#### 1. RoleConfig CRUD (Tenant-wide roles)
```
POST   /:tenant/roles                    # Create role
GET    /:tenant/roles                    # List all roles
GET    /:tenant/roles/:roleId            # Get role details
PATCH  /:tenant/roles/:roleId            # Update role
DELETE /:tenant/roles/:roleId            # Delete role (soft)
```

#### 2. RbacConfig CRUD (Process-specific roles)
```
POST   /:tenant/rbac                     # Create RBAC config
GET    /:tenant/rbac                     # List all RBAC configs
GET    /:tenant/rbac/:rbacId             # Get RBAC details
PATCH  /:tenant/rbac/:rbacId             # Update RBAC
DELETE /:tenant/rbac/:rbacId             # Delete RBAC
GET    /:tenant/rbac/process/:processType # Get by process type
```

### B. User Role Assignment Endpoints

#### 3. User Role Management
```
POST   /:tenant/users/:userId/roles      # Assign role(s) to user
GET    /:tenant/users/:userId/roles      # Get user's roles
DELETE /:tenant/users/:userId/roles/:roleId # Remove role from user
GET    /:tenant/users/:userId/permissions # Get effective permissions
```

### C. Permission Resolution Endpoint

#### 4. Permission Check
```
POST   /:tenant/permissions/check        # Check if user has permission
```

---

## Use Case Scenarios

### Scenario 1: Multi-Department Manager
**Context**: Sarah manages both Procurement and Finance departments

**Setup:**
```json
// 1. Create roles
POST /:tenant/roles
{
  "roleName": "PROCUREMENT_MANAGER",
  "permissions": {
    "procurement": ["create", "read", "update", "approve"],
    "vendors": ["read", "evaluate"]
  },
  "description": "Procurement department manager"
}

POST /:tenant/roles
{
  "roleName": "FINANCE_MANAGER",
  "permissions": {
    "invoices": ["create", "read", "update", "approve"],
    "payments": ["create", "read", "approve"]
  },
  "description": "Finance department manager"
}

// 2. Assign both roles to Sarah
POST /:tenant/users/sarah_id/roles
{
  "roleIds": ["proc_mgr_role_id", "finance_mgr_role_id"]
}
```

**Result:**
- Sarah can approve procurement tenders
- Sarah can approve invoices and payments
- Sarah has merged permissions from both roles

---

### Scenario 2: Process-Specific Approver with Org Level
**Context**: John can approve tenders up to $50k at org level 3 (regional)

**Setup:**
```json
// 1. Create role config
POST /:tenant/roles
{
  "roleName": "REGIONAL_APPROVER",
  "permissions": {
    "tenders": ["read", "review"]
  }
}

// 2. Create RBAC config for TENDER process
POST /:tenant/rbac
{
  "roleName": "REGIONAL_APPROVER",
  "processConfigId": "tender_process_id",
  "orgLevel": 3,
  "permissions": {
    "actions": ["approve"],
    "conditions": {
      "maxAmount": 50000,
      "currency": "USD"
    }
  }
}

// 3. Assign role to John
POST /:tenant/users/john_id/roles
{
  "roleIds": ["regional_approver_role_id"]
}
```

**Result:**
- John can view all tenders (from role_configs)
- John can only approve tenders ≤ $50k at org level 3 (from rbac_config)
- Attempting to approve $60k tender → denied

---

### Scenario 3: Temporary Project Role
**Context**: Alice is temporarily assigned as PROJECT_LEAD for 6 months

**Setup:**
```json
POST /:tenant/users/alice_id/roles
{
  "roleIds": ["project_lead_role_id"],
  "expiresAt": "2025-07-01T00:00:00Z"
}
```

**Result:**
- Alice has PROJECT_LEAD permissions until July 1, 2025
- After expiration, system automatically revokes the role
- Audit log tracks who assigned and when it expired

---

### Scenario 4: Vendor with Multiple Company Relationships
**Context**: TechVendor Corp can submit bids and also has a consulting role

**Setup:**
```json
// Assign multiple vendor-related roles
POST /:tenant/users/techvendor_id/roles
{
  "roleIds": [
    "vendor_bidder_role_id",
    "vendor_consultant_role_id"
  ]
}
```

**Result:**
- Can submit bids (VENDOR_BIDDER role)
- Can provide consulting feedback on tenders (VENDOR_CONSULTANT role)
- Different permissions in different processes

---

### Scenario 5: Admin + User Dual Role
**Context**: Bob is both a system administrator and an active procurement user

**Setup:**
```json
// Assign both ADMIN and USER roles
POST /:tenant/users/bob_id/roles
{
  "roleIds": ["admin_role_id", "user_role_id"]
}
```

**Result:**
- Bob has full system administration access (ADMIN role)
  - Can manage users, roles, configurations
  - Can access all admin endpoints
  - Can view system-wide data
- Bob also has standard user permissions (USER role)
  - Can create and manage tenders
  - Can score bids
  - Can work on procurement tasks
- **Permission merging**: Bob gets the union of both roles
  - ADMIN permissions: `{ actions: ["manage"], subjects: ["all"] }`
  - USER permissions: `{ tenders: ["create", "read", "update"], bids: ["read", "score"] }`
  - **Effective permissions**: All admin powers + all user powers

**Use cases:**
- Small organizations where admin also does procurement work
- Testing/demo scenarios where one account needs full access
- Transition periods when promoting a user to admin but keeping their original work

---

### Scenario 6: Cross-Process Budget Approver
**Context**: Maria approves budgets across PR, PO, and Invoice processes

**Setup:**
```json
// Create process-specific RBAC for each process
POST /:tenant/rbac
{
  "roleName": "BUDGET_APPROVER",
  "processConfigId": "pr_process_id",
  "permissions": {
    "actions": ["approve_budget"]
  }
}

POST /:tenant/rbac
{
  "roleName": "BUDGET_APPROVER",
  "processConfigId": "po_process_id",
  "permissions": {
    "actions": ["approve_budget"]
  }
}

POST /:tenant/rbac
{
  "roleName": "BUDGET_APPROVER",
  "processConfigId": "invoice_process_id",
  "permissions": {
    "actions": ["approve_budget"]
  }
}
```

**Result:**
- Maria can approve budget allocations in all three processes
- Single role, multiple process contexts

---

## Permission Resolution Logic

### Algorithm
```typescript
function resolveUserPermissions(userId, tenantId, context?) {
  // 1. Get all active roles for user
  const userRoles = getUserRoles(userId, tenantId)
  
  // 2. Merge tenant-wide permissions from role_configs
  const basePermissions = mergeRoleConfigPermissions(userRoles)
  
  // 3. If context provided, merge process-specific permissions from rbac_config
  let processPermissions = {}
  if (context?.processType && context?.orgLevel) {
    processPermissions = mergeRbacConfigPermissions(
      userRoles,
      context.processType,
      context.orgLevel
    )
  }
  
  // 4. Apply user-specific ability overrides
  const userOverrides = getUserAbilities(userId)
  
  // 5. Merge: base + process + overrides
  return mergePermissions(basePermissions, processPermissions, userOverrides)
}
```

### Permission Check Example
```typescript
// Check if user can approve a tender
POST /:tenant/permissions/check
{
  "userId": "john_id",
  "action": "approve",
  "resource": "tender",
  "context": {
    "processType": "TENDER",
    "orgLevel": 3,
    "amount": 45000,
    "currency": "USD"
  }
}

// Response
{
  "allowed": true,
  "matchedRules": [
    {
      "source": "rbac_config",
      "roleName": "REGIONAL_APPROVER",
      "rule": "Can approve tenders up to $50k at org level 3"
    }
  ]
}
```

---

## Migration Strategy

### Phase 1: Database Migration
1. Create `user_roles` table
2. Update relations in Prisma schema
3. Run migration: `npm run prisma:migrate`

### Phase 2: Seed Default Roles
```typescript
// Create default role_configs
await prisma.roleConfig.createMany({
  data: [
    {
      tenantId,
      roleName: "ADMIN",
      permissions: { actions: ["manage"], subjects: ["all"] },
      description: "System administrator"
    },
    {
      tenantId,
      roleName: "BUYER",
      permissions: { tenders: ["create", "read", "update"], bids: ["read", "score"] },
      description: "Procurement buyer"
    },
    {
      tenantId,
      roleName: "VENDOR",
      permissions: { tenders: ["read"], bids: ["create", "read", "update"] },
      description: "External vendor"
    }
  ]
})
```

### Phase 3: Migrate Existing Users
```typescript
// For each existing user, create user_role entry
const users = await prisma.user.findMany()
for (const user of users) {
  const roleConfig = await prisma.roleConfig.findFirst({
    where: { tenantId: user.tenantId, roleName: user.role }
  })
  
  if (roleConfig) {
    await prisma.userRole.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        roleId: roleConfig.id
      }
    })
  }
}
```

### Phase 4: Implement Endpoints
1. Create `RoleConfigController` and `RoleConfigService`
2. Create `RbacConfigController` and `RbacConfigService`
3. Create `UserRoleController` and `UserRoleService`
4. Update `AuthGuard` to use new permission resolution

### Phase 5: Update Guards
```typescript
// Enhanced RolesGuard
@Injectable()
export class RolesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    
    // Resolve all user permissions (multiple roles)
    const permissions = await this.permissionService.resolveUserPermissions(
      user.userId,
      user.tenantId,
      {
        processType: request.params.processType,
        orgLevel: user.orgLevel
      }
    )
    
    // Check if user has required permission
    return this.checkPermissions(permissions, requiredPermissions)
  }
}
```

---

## Testing Scenarios

### Test Case 1: Multiple Role Assignment
```typescript
test('User with multiple roles should have merged permissions', async () => {
  // Assign BUYER + APPROVER roles
  await assignRoles(userId, ['buyer_role_id', 'approver_role_id'])
  
  const permissions = await resolvePermissions(userId)
  
  expect(permissions.tenders).toContain('create')  // from BUYER
  expect(permissions.tenders).toContain('approve') // from APPROVER
})
```

### Test Case 2: Org Level Restriction
```typescript
test('User at org level 3 cannot approve level 2 tenders', async () => {
  const result = await checkPermission(userId, {
    action: 'approve',
    resource: 'tender',
    orgLevel: 2 // trying to approve level 2
  })
  
  expect(result.allowed).toBe(false)
  expect(result.reason).toBe('Org level mismatch')
})
```

### Test Case 3: Amount Limit
```typescript
test('User cannot approve tender exceeding amount limit', async () => {
  const result = await checkPermission(userId, {
    action: 'approve',
    resource: 'tender',
    amount: 60000 // exceeds $50k limit
  })
  
  expect(result.allowed).toBe(false)
  expect(result.reason).toBe('Amount exceeds approval limit')
})
```

### Test Case 4: Admin + User Dual Role
```typescript
test('User with ADMIN + USER roles should have both permissions', async () => {
  // Assign both ADMIN and USER roles
  await assignRoles(userId, ['admin_role_id', 'user_role_id'])
  
  const permissions = await resolvePermissions(userId)
  
  // Should have ADMIN permissions (manage all)
  expect(permissions.actions).toContain('manage')
  expect(permissions.subjects).toContain('all')
  
  // Should also have USER permissions
  expect(permissions.tenders).toContain('create')
  expect(permissions.bids).toContain('score')
  
  // Check actual permission usage
  const canManageUsers = await checkPermission(userId, {
    action: 'manage',
    resource: 'users'
  })
  expect(canManageUsers.allowed).toBe(true) // from ADMIN
  
  const canCreateTender = await checkPermission(userId, {
    action: 'create',
    resource: 'tender'
  })
  expect(canCreateTender.allowed).toBe(true) // from USER
})
```

### Test Case 5: Role Removal
```typescript
test('Removing one role should retain other role permissions', async () => {
  // Start with ADMIN + USER
  await assignRoles(userId, ['admin_role_id', 'user_role_id'])
  
  // Remove USER role
  await removeRole(userId, 'user_role_id')
  
  const permissions = await resolvePermissions(userId)
  
  // Should still have ADMIN permissions
  expect(permissions.actions).toContain('manage')
  
  // But since ADMIN has "manage all", they still can do everything
  // This tests the system correctly handles role removal
})
```

---

## Benefits After Implementation

### ✅ Flexibility
- Users can wear multiple hats (manager + approver + buyer)
- Roles can be added/removed without code changes
- Temporary role assignments for projects

### ✅ Granular Control
- Process-specific permissions (TENDER, PROCUREMENT, INVOICE)
- Org-level restrictions (regional vs. global)
- Amount-based limits ($50k vs. $100k approval limits)

### ✅ Auditability
- Track who assigned roles and when
- Track role expiration
- Permission check history

### ✅ Scalability
- New roles created via API, no code changes
- Easy to extend permissions structure
- Supports complex organizational hierarchies

---

## Implementation Checklist

- [ ] Update Prisma schema with `user_roles` table
- [ ] Create migration script
- [ ] Seed default roles in `role_configs`
- [ ] Migrate existing users to new role system
- [ ] Create `RoleConfigController` + Service
- [ ] Create `RbacConfigController` + Service
- [ ] Create `UserRoleController` + Service
- [ ] Create `PermissionService` for resolution logic
- [ ] Update `RolesGuard` to use new permission resolution
- [ ] Update `CaslAbilityGuard` to work with multiple roles
- [ ] Add API documentation
- [ ] Write integration tests
- [ ] Update Swagger docs
- [ ] Create migration guide for existing deployments

---

## Estimated Timeline
- **Database changes**: 1 day
- **API endpoints**: 3-4 days
- **Permission resolution logic**: 2-3 days
- **Guard updates**: 2 days
- **Testing**: 2-3 days
- **Documentation**: 1 day

**Total**: ~2 weeks

---

## Next Steps
1. Review and approve this plan
2. Create Prisma migration for schema changes
3. Implement endpoints in priority order:
   - RoleConfig CRUD (foundation)
   - User role assignment (core functionality)
   - RbacConfig CRUD (advanced features)
   - Permission resolution (runtime checks)
