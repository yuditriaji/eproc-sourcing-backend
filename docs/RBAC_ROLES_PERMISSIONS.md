# Role-Based Access Control (RBAC) & Permissions

This document provides a comprehensive overview of the roles, permissions, and access control mechanisms in the e-Procurement Sourcing Backend system.

## Table of Contents
- [Overview](#overview)
- [Role Definitions](#role-definitions)
- [Permission Actions](#permission-actions)
- [Access Control Mechanisms](#access-control-mechanisms)
- [Feature-Based Permissions](#feature-based-permissions)
- [Frontend View Alignment](#frontend-view-alignment)

---

## Overview

The system implements a dual-layer security model:
1. **Role-Based Access Control (RBAC)** - Using enum-based roles for coarse-grained access
2. **Attribute-Based Access Control (ABAC)** - Using CASL abilities for fine-grained permissions

### Security Guards
- `RolesGuard` - Validates user roles using `@Roles()` decorator
- `CaslAbilityGuard` - Validates granular permissions using `@CheckAbilities()` decorator
- `ThrottlerGuard` - Rate limiting based on role-specific limits

---

## Role Definitions

### System Roles (UserRoleEnum)

| Role | Code | Description | Typical Use Case |
|------|------|-------------|------------------|
| **ADMIN** | `ADMIN` | System administrator with full access to all features | IT administrators, system managers |
| **USER** | `USER` | Internal procurement staff | Procurement officers creating tenders and managing internal processes |
| **BUYER** | `BUYER` | Purchasing department staff | Purchase order creation, vendor management |
| **VENDOR** | `VENDOR` | External supplier/vendor | Submit bids, view published tenders |
| **APPROVER** | `APPROVER` | Approval authority | Approve PRs, contracts, invoices |
| **FINANCE** | `FINANCE` | Finance department staff | Payment processing, invoice management |
| **MANAGER** | `MANAGER` | Department manager | Workflow oversight, approvals |

---

## Permission Actions

### CASL Actions

The system defines the following granular actions:

| Action | Code | Description |
|--------|------|-------------|
| **Manage** | `manage` | Full control over a resource (all CRUD operations) |
| **Create** | `create` | Create new resources |
| **Read** | `read` | View/read resources |
| **Update** | `update` | Modify existing resources |
| **Delete** | `delete` | Remove resources |
| **Submit** | `submit` | Submit for review/approval |
| **Approve** | `approve` | Approve submissions |
| **Score** | `score` | Evaluate/score bids |
| **Award** | `award` | Award tenders to vendors |

### CASL Subjects

- **User** - User accounts and profiles
- **Tender** - Tender/RFQ documents
- **Bid** - Vendor bid submissions
- **AuditLog** - System audit logs
- **All** - All resources (admin only)

---

## Access Control Mechanisms

### 1. Role-Based Permissions Matrix

#### ADMIN
- ✅ Full access to all system features
- ✅ User management (verify, deactivate users)
- ✅ Role configuration management
- ✅ View all tenders, bids, contracts, orders
- ✅ System configuration and settings
- ✅ Complete audit trail access

**CASL Abilities:**
```typescript
can(Action.Manage, "all")
```

#### USER (Internal Procurement Staff)
- ✅ Create and manage tenders (department-scoped)
- ✅ View all tenders (department + global)
- ✅ Score and evaluate bids
- ✅ Read bid submissions
- ✅ Approve tenders they created
- ✅ Read and update own profile
- ✅ Read audit logs
- ❌ Cannot manage vendors
- ❌ Cannot submit bids

**CASL Abilities:**
```typescript
can(Action.Read, Tender)
can(Action.Create, Tender)
can(Action.Update, Tender)
can(Action.Delete, Tender)
can(Action.Score, Bid)
can(Action.Read, Bid)
can(Action.Approve, Tender)
can(Action.Read, User)
can(Action.Update, User)
can(Action.Read, AuditLog)
```

#### BUYER
- ✅ Create Purchase Orders (PO)
- ✅ Create Purchase Requisitions (PR)
- ✅ Manage vendor relationships
- ✅ View contracts and tenders
- ✅ Initiate procurement workflows
- ❌ Cannot approve PRs (requires APPROVER role)
- ❌ Cannot process payments (requires FINANCE role)

#### VENDOR
- ✅ View published tenders only
- ✅ Create and manage own bids
- ✅ Submit bids
- ✅ Read and update own profile
- ✅ View own bid history
- ✅ Read audit logs (own activities)
- ❌ Cannot create tenders
- ❌ Cannot score bids
- ❌ Cannot approve anything
- ❌ Cannot view draft tenders

**CASL Abilities:**
```typescript
can(Action.Read, Tender)        // Published only
can(Action.Create, Bid)
can(Action.Read, Bid)           // Own bids only
can(Action.Update, Bid)         // Own bids only
can(Action.Submit, Bid)
can(Action.Read, User)          // Own profile
can(Action.Update, User)        // Own profile
can(Action.Read, AuditLog)
cannot(Action.Create, Tender)
cannot(Action.Score, Bid)
cannot(Action.Approve, Tender)
```

#### APPROVER
- ✅ Approve Purchase Requisitions (PR)
- ✅ Approve contracts
- ✅ Approve invoices
- ✅ View workflow status
- ❌ Cannot create orders
- ❌ Cannot process payments

#### FINANCE
- ✅ Process payments
- ✅ Approve invoices
- ✅ View financial transactions
- ✅ Manage payment schedules
- ✅ View all financial reports
- ❌ Cannot create tenders or bids

#### MANAGER
- ✅ Initiate procurement workflows
- ✅ Approve PRs and contracts
- ✅ View department activities
- ✅ Oversee tender processes
- ✅ Approve workflow steps
- ✅ Create Purchase Orders

---

## Feature-Based Permissions

### Authentication & User Management

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Register account | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Login/Logout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verify users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View all users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage role configs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Tender Management

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Create tender | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View all tenders | ✅ | ✅ (dept+global) | ✅ | ❌ | ✅ | ✅ | ✅ |
| View published tenders | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update tender | ✅ | ✅ (own) | ✅ (own) | ❌ | ❌ | ❌ | ✅ |
| Delete tender | ✅ | ✅ (own) | ✅ (own) | ❌ | ❌ | ❌ | ✅ |
| Publish tender | ✅ | ✅ (own) | ✅ | ❌ | ❌ | ❌ | ✅ |
| Award tender | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### Bid Management

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Create bid | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| View all bids | ✅ | ✅ (for own tenders) | ✅ | ❌ | ✅ | ❌ | ✅ |
| View own bids | N/A | N/A | N/A | ✅ | N/A | N/A | N/A |
| Update bid | ❌ | ❌ | ❌ | ✅ (own, draft) | ❌ | ❌ | ❌ |
| Submit bid | ❌ | ❌ | ❌ | ✅ (own) | ❌ | ❌ | ❌ |
| Score bid | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |

### Contract Management

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Create contract | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View contracts | ✅ | ✅ | ✅ | ✅ (assigned) | ✅ | ✅ | ✅ |
| Update contract | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Close/Terminate contract | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### Purchase Requisition (PR)

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Create PR | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View PR | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Update PR | ✅ | ✅ (own) | ✅ (own) | ❌ | ❌ | ❌ | ✅ |
| Approve/Reject PR | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

### Purchase Order (PO)

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Create PO | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View PO | ✅ | ✅ | ✅ | ✅ (assigned) | ✅ | ✅ | ✅ |
| Update PO | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Approve PO | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

### Invoice & Payment

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Create invoice | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| View invoices | ✅ | ✅ | ✅ | ✅ (own) | ✅ | ✅ | ✅ |
| Approve invoice | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Process payment | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View payments | ✅ | ✅ | ✅ | ✅ (own) | ✅ | ✅ | ✅ |

### Workflow Management

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Initiate procurement workflow | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Create PR from contract | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Approve PR workflow | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Create PO from PR | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Record goods receipt | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Create invoice from GR | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Approve/Process payment | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

### Vendor Management

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| View vendor list | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| View vendor details | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Update vendor status | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Blacklist vendor | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |

### Budget Management

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Create budget | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View budgets | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Update budget | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Transfer budget | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View transactions | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

### Statistics & Reports

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| Dashboard overview | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tender statistics | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Vendor statistics | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Financial statistics | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

### Audit & Compliance

| Feature | ADMIN | USER | BUYER | VENDOR | APPROVER | FINANCE | MANAGER |
|---------|-------|------|-------|--------|----------|---------|---------|
| View audit logs | ✅ | ✅ (limited) | ✅ (limited) | ✅ (own) | ✅ | ✅ | ✅ |
| Export audit logs | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Frontend View Alignment

### Recommended Navigation Structure by Role

#### ADMIN Dashboard
```
├── Dashboard (Overview)
├── Users Management
│   ├── All Users
│   ├── Role Configuration
│   └── User Verification
├── Tenders
│   ├── All Tenders
│   ├── Create Tender
│   └── Tender Analytics
├── Bids
│   ├── All Bids
│   └── Bid Evaluation
├── Procurement
│   ├── Contracts
│   ├── Purchase Requisitions
│   ├── Purchase Orders
│   ├── Goods Receipts
│   └── Workflow Management
├── Finance
│   ├── Invoices
│   ├── Payments
│   └── Budget Management
├── Vendors
│   ├── Vendor Directory
│   └── Vendor Performance
├── Reports & Analytics
│   ├── Statistics Dashboard
│   ├── Financial Reports
│   └── Audit Logs
└── System Settings
```

#### USER (Procurement Staff) Dashboard
```
├── Dashboard (My Overview)
├── Tenders
│   ├── My Tenders
│   ├── Department Tenders
│   ├── Create Tender
│   └── Published Tenders
├── Bids
│   ├── Bids for My Tenders
│   └── Score Bids
├── Reports
│   ├── Tender Statistics
│   └── Activity Log
└── Profile
```

#### BUYER Dashboard
```
├── Dashboard (Overview)
├── Tenders
│   ├── Active Tenders
│   └── Create Tender
├── Procurement
│   ├── Purchase Requisitions
│   │   ├── Create PR
│   │   └── My PRs
│   ├── Purchase Orders
│   │   ├── Create PO
│   │   └── Active POs
│   └── Goods Receipts
├── Vendors
│   ├── Vendor Directory
│   └── Vendor Management
├── Contracts
│   ├── Active Contracts
│   └── Create Contract
└── Reports
```

#### VENDOR Dashboard
```
├── Dashboard (My Overview)
├── Tenders
│   ├── Published Tenders
│   └── Search Tenders
├── My Bids
│   ├── Draft Bids
│   ├── Submitted Bids
│   └── Create New Bid
├── Contracts
│   └── My Contracts (Assigned)
├── Invoices
│   └── My Invoices
└── Profile
    ├── Company Profile
    └── Documents
```

#### APPROVER Dashboard
```
├── Dashboard (Approval Queue)
├── Pending Approvals
│   ├── Purchase Requisitions
│   ├── Contracts
│   └── Invoices
├── Approval History
├── Tenders
│   └── View All Tenders
├── Bids
│   └── View/Score Bids
└── Reports
```

#### FINANCE Dashboard
```
├── Dashboard (Financial Overview)
├── Invoices
│   ├── Pending Approval
│   ├── Approved Invoices
│   └── All Invoices
├── Payments
│   ├── Payment Queue
│   ├── Process Payment
│   └── Payment History
├── Budget Management
│   ├── Budget Overview
│   ├── Budget Allocation
│   └── Budget Transfers
├── Transactions
│   └── Transaction History
├── Financial Reports
│   ├── Spending Analysis
│   └── Payment Reports
└── Audit Logs
```

#### MANAGER Dashboard
```
├── Dashboard (Department Overview)
├── Tenders
│   ├── Department Tenders
│   ├── Create Tender
│   └── All Tenders
├── Procurement Workflow
│   ├── Initiate Workflow
│   ├── Approve PRs
│   └── Workflow Status
├── Contracts
│   ├── Active Contracts
│   └── Create Contract
├── Budget
│   ├── Budget Overview
│   └── Budget Allocation
├── Team Activity
│   └── Department Reports
└── Approvals
    ├── Pending Approvals
    └── Approval History
```

---

## Implementation Notes

### Rate Limiting by Role

Default throttle limits (requests per minute):
- **ADMIN**: 100
- **USER**: 60
- **BUYER**: 60
- **VENDOR**: 30
- **APPROVER**: 60
- **FINANCE**: 60
- **MANAGER**: 60

Configure via environment variables:
```env
THROTTLE_LIMIT_ADMIN=100
THROTTLE_LIMIT_USER=60
THROTTLE_LIMIT_VENDOR=30
```

### Authentication Flow

1. User logs in with email/password
2. JWT access token generated with claims:
   - `sub` - User ID
   - `email` - User email
   - `role` - User role (enum)
   - `abilities` - Custom CASL abilities (optional)
3. Refresh token stored as httpOnly cookie
4. Access token expires in 1 hour (configurable)
5. Refresh token expires in 7 days (configurable)

### Vendor Account Verification

Vendor accounts require manual verification:
1. Vendor registers with role `VENDOR`
2. Account created with `isVerified: false`
3. Admin reviews and verifies using `/auth/users/:userId/verify`
4. Vendor gains full access after verification

### Department-Scoped Access

USER role has department-scoped access:
- Can create tenders for their department
- Can view tenders from their department + global tenders
- Cannot view other departments' draft tenders

---

## API Examples

### Check User Role
```typescript
// In controller
@UseGuards(RolesGuard)
@Roles('ADMIN', 'USER')
async createTender() {
  // Only ADMIN and USER can access
}
```

### Check CASL Abilities
```typescript
// In controller
@UseGuards(CaslAbilityGuard)
@CheckAbilities(
  AbilityRequirement(Action.Create, Tender)
)
async createTender() {
  // Check fine-grained abilities
}
```

### Accessing User Context
```typescript
async getTenders(@Req() req: Request) {
  const user = req.user as any;
  // user.id, user.role, user.email, user.abilities
}
```

---

## Security Best Practices

### Backend Security
1. **Always validate role at controller level** using `@Roles()` decorator
2. **Use CASL abilities for fine-grained control** when role-based isn't sufficient
3. **Validate ownership** before allowing updates/deletes
4. **Filter data based on role** (e.g., vendors see published tenders only)
5. **Log all sensitive operations** via AuditService
6. **Implement rate limiting** per role to prevent abuse
7. **Verify user status** (isActive, isVerified) before granting access

### Frontend Security
1. **Validate user role at login** - Check that the user's role matches the portal they're logging into
   - Admin login should only accept ADMIN role users
   - Vendor login should only accept VENDOR role users
   - Example:
   ```typescript
   if (user.role !== 'VENDOR' && !user.rbacRoles?.includes('Vendor')) {
     toast.error('Access denied. Vendor credentials required.');
     return;
   }
   ```

2. **Implement defense-in-depth** - Add role checks at layout/route level to prevent access even if login is bypassed
   - Check role in layout components
   - Redirect unauthorized users to `/unauthorized` page

3. **Never rely solely on frontend validation** - Frontend checks are for UX, backend must enforce all security

4. **Support both enum and RBAC roles** - Check both `user.role` and `user.rbacRoles` for flexibility

---

## References

- **Prisma Schema**: `prisma/schema.prisma` (UserRoleEnum definition)
- **Ability Factory**: `src/modules/auth/abilities/ability.factory.ts`
- **Roles Guard**: `src/common/guards/roles.guard.ts`
- **CASL Ability Guard**: `src/common/guards/casl-ability.guard.ts`
- **Auth Controller**: `src/modules/auth/auth.controller.ts`
- **Tender Controller**: `src/modules/tender/tender.controller.ts`
- **Workflow Controller**: `src/modules/workflow/workflow.controller.ts`

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Backend Development Team
