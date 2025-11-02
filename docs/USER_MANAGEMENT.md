# User Management API Documentation

Complete API reference for managing users, roles, and permissions in the admin portal.

**Base URL**: `/:tenant` (e.g., `/api/v1/acme`)  
**Auth**: All endpoints require ADMIN role with Bearer token

---

## Table of Contents

1. [User Management](#user-management)
2. [Role Configuration](#role-configuration)
3. [User Role Assignment](#user-role-assignment)
4. [Common Response Codes](#common-response-codes)

---

## User Management

### 1. Get All Users

Retrieve all registered users in the tenant.

```
GET /:tenant/auth/users
```

**Authorization**: Bearer Token (ADMIN)

**Response 200**:
```json
{
  "users": [
    {
      "id": "usr_123",
      "email": "john.doe@acme.com",
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "department": "IT",
      "phone": "+1234567890",
      "isActive": true,
      "isVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  ],
  "total": 10
}
```

**Example**:
```bash
curl -X GET "https://api.example.com/api/v1/acme/auth/users" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 2. Create User

Create a new user account.

```
POST /:tenant/auth/register
```

**Authorization**: Bearer Token (ADMIN)

**Request Body**:
```json
{
  "email": "jane.smith@acme.com",
  "username": "janesmith",
  "password": "SecurePassword123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "USER"
}
```

**Response 201**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_456",
    "email": "jane.smith@acme.com",
    "username": "janesmith",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "USER",
    "abilities": [],
    "tenantId": "ten_123"
  }
}
```

**Example**:
```bash
curl -X POST "https://api.example.com/api/v1/acme/auth/register" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.smith@acme.com",
    "username": "janesmith",
    "password": "SecurePassword123!",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "USER"
  }'
```

---

### 3. Verify User

Manually verify a user account (typically for vendors).

```
PATCH /:tenant/auth/users/:userId/verify
```

**Authorization**: Bearer Token (ADMIN)

**Response 200**:
```json
{
  "message": "User verified successfully",
  "user": {
    "id": "usr_789",
    "email": "vendor@company.com",
    "username": "vendoruser",
    "role": "VENDOR",
    "isVerified": true
  }
}
```

**Example**:
```bash
curl -X PATCH "https://api.example.com/api/v1/acme/auth/users/usr_789/verify" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Role Configuration

### 1. Create Role

Create a new role with specific permissions.

```
POST /:tenant/roles
```

**Authorization**: Bearer Token (ADMIN)

**Request Body**:
```json
{
  "roleName": "PROCUREMENT_MANAGER",
  "permissions": {
    "tenders": ["create", "read", "update", "approve"],
    "vendors": ["read", "evaluate"],
    "bids": ["read", "score"]
  },
  "description": "Procurement department manager",
  "isActive": true
}
```

**Response 201**:
```json
{
  "id": "role_123",
  "tenantId": "ten_123",
  "roleName": "PROCUREMENT_MANAGER",
  "permissions": {
    "tenders": ["create", "read", "update", "approve"],
    "vendors": ["read", "evaluate"],
    "bids": ["read", "score"]
  },
  "description": "Procurement department manager",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Example**:
```bash
curl -X POST "https://api.example.com/api/v1/acme/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleName": "PROCUREMENT_MANAGER",
    "permissions": {
      "tenders": ["create", "read", "update", "approve"],
      "vendors": ["read", "evaluate"]
    },
    "description": "Procurement department manager"
  }'
```

---

### 2. Get All Roles

Retrieve all role configurations.

```
GET /:tenant/roles?isActive=true
```

**Authorization**: Bearer Token (ADMIN)

**Query Parameters**:
- `isActive` (optional): Filter by active status (`true` or `false`)

**Response 200**:
```json
[
  {
    "id": "role_123",
    "tenantId": "ten_123",
    "roleName": "PROCUREMENT_MANAGER",
    "permissions": {
      "tenders": ["create", "read", "update", "approve"]
    },
    "description": "Procurement department manager",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "role_456",
    "tenantId": "ten_123",
    "roleName": "FINANCE_MANAGER",
    "permissions": {
      "invoices": ["create", "read", "approve"],
      "payments": ["create", "read", "approve"]
    },
    "description": "Finance department manager",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Example**:
```bash
curl -X GET "https://api.example.com/api/v1/acme/roles?isActive=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 3. Get Role Details

Get detailed information about a specific role, including assigned users.

```
GET /:tenant/roles/:roleId
```

**Authorization**: Bearer Token (ADMIN)

**Response 200**:
```json
{
  "id": "role_123",
  "tenantId": "ten_123",
  "roleName": "PROCUREMENT_MANAGER",
  "permissions": {
    "tenders": ["create", "read", "update", "approve"]
  },
  "description": "Procurement department manager",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "userRoles": [
    {
      "id": "ur_001",
      "userId": "usr_123",
      "assignedAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": null,
      "user": {
        "id": "usr_123",
        "email": "john.doe@acme.com",
        "username": "johndoe",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ]
}
```

**Example**:
```bash
curl -X GET "https://api.example.com/api/v1/acme/roles/role_123" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 4. Update Role

Update an existing role's permissions or description.

```
PATCH /:tenant/roles/:roleId
```

**Authorization**: Bearer Token (ADMIN)

**Request Body** (all fields optional):
```json
{
  "permissions": {
    "tenders": ["create", "read", "update", "approve", "delete"],
    "vendors": ["read", "evaluate", "manage"]
  },
  "description": "Updated description",
  "isActive": false
}
```

**Response 200**:
```json
{
  "id": "role_123",
  "tenantId": "ten_123",
  "roleName": "PROCUREMENT_MANAGER",
  "permissions": {
    "tenders": ["create", "read", "update", "approve", "delete"],
    "vendors": ["read", "evaluate", "manage"]
  },
  "description": "Updated description",
  "isActive": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

**Example**:
```bash
curl -X PATCH "https://api.example.com/api/v1/acme/roles/role_123" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated procurement manager role",
    "isActive": true
  }'
```

---

### 5. Delete Role

Delete a role configuration. Cannot delete if assigned to users.

```
DELETE /:tenant/roles/:roleId
```

**Authorization**: Bearer Token (ADMIN)

**Response 200**:
```json
{
  "id": "role_123",
  "roleName": "PROCUREMENT_MANAGER",
  "message": "Role deleted successfully"
}
```

**Response 400** (if role is assigned):
```json
{
  "statusCode": 400,
  "message": "Cannot delete role. It is assigned to 5 user(s)",
  "error": "Bad Request"
}
```

**Example**:
```bash
curl -X DELETE "https://api.example.com/api/v1/acme/roles/role_123" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## User Role Assignment

### 1. Assign Roles to User

Assign one or more roles to a user. Supports multiple roles per user.

```
POST /:tenant/users/:userId/roles
```

**Authorization**: Bearer Token (ADMIN)

**Request Body**:
```json
{
  "roleIds": ["role_123", "role_456"],
  "expiresAt": "2025-07-01T00:00:00Z"
}
```

**Fields**:
- `roleIds` (required): Array of role IDs to assign
- `expiresAt` (optional): ISO date string for role expiration

**Response 201**:
```json
{
  "message": "Successfully assigned 2 role(s) to user",
  "assignments": [
    {
      "id": "ur_001",
      "tenantId": "ten_123",
      "userId": "usr_123",
      "roleId": "role_123",
      "assignedAt": "2024-01-01T00:00:00.000Z",
      "assignedBy": "usr_admin",
      "expiresAt": "2025-07-01T00:00:00.000Z",
      "roleConfig": {
        "id": "role_123",
        "roleName": "PROCUREMENT_MANAGER",
        "permissions": {...}
      }
    },
    {
      "id": "ur_002",
      "tenantId": "ten_123",
      "userId": "usr_123",
      "roleId": "role_456",
      "assignedAt": "2024-01-01T00:00:00.000Z",
      "assignedBy": "usr_admin",
      "expiresAt": "2025-07-01T00:00:00.000Z",
      "roleConfig": {
        "id": "role_456",
        "roleName": "FINANCE_MANAGER",
        "permissions": {...}
      }
    }
  ],
  "alreadyAssigned": 0
}
```

**Example - Assign Admin + User Roles**:
```bash
curl -X POST "https://api.example.com/api/v1/acme/users/usr_123/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["admin_role_id", "user_role_id"]
  }'
```

**Example - Temporary Role Assignment**:
```bash
curl -X POST "https://api.example.com/api/v1/acme/users/usr_456/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["project_lead_role_id"],
    "expiresAt": "2025-07-01T00:00:00Z"
  }'
```

---

### 2. Get User's Roles

Retrieve all roles assigned to a specific user.

```
GET /:tenant/users/:userId/roles
```

**Authorization**: Bearer Token (ADMIN)

**Response 200**:
```json
{
  "userId": "usr_123",
  "email": "john.doe@acme.com",
  "username": "johndoe",
  "roles": [
    {
      "id": "ur_001",
      "tenantId": "ten_123",
      "userId": "usr_123",
      "roleId": "role_123",
      "assignedAt": "2024-01-01T00:00:00.000Z",
      "assignedBy": "usr_admin",
      "expiresAt": null,
      "roleConfig": {
        "id": "role_123",
        "roleName": "PROCUREMENT_MANAGER",
        "permissions": {
          "tenders": ["create", "read", "update", "approve"]
        },
        "description": "Procurement department manager",
        "isActive": true
      }
    },
    {
      "id": "ur_002",
      "tenantId": "ten_123",
      "userId": "usr_123",
      "roleId": "role_456",
      "assignedAt": "2024-01-02T00:00:00.000Z",
      "assignedBy": "usr_admin",
      "expiresAt": null,
      "roleConfig": {
        "id": "role_456",
        "roleName": "FINANCE_MANAGER",
        "permissions": {
          "invoices": ["create", "read", "approve"],
          "payments": ["create", "read", "approve"]
        },
        "description": "Finance department manager",
        "isActive": true
      }
    }
  ],
  "totalRoles": 2
}
```

**Example**:
```bash
curl -X GET "https://api.example.com/api/v1/acme/users/usr_123/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 3. Get User's Effective Permissions

Get the merged permissions from all user's active roles.

```
GET /:tenant/users/:userId/roles/permissions
```

**Authorization**: Bearer Token (ADMIN)

**Response 200**:
```json
{
  "userId": "usr_123",
  "roles": ["PROCUREMENT_MANAGER", "FINANCE_MANAGER"],
  "effectivePermissions": {
    "tenders": ["create", "read", "update", "approve"],
    "vendors": ["read", "evaluate"],
    "bids": ["read", "score"],
    "invoices": ["create", "read", "approve"],
    "payments": ["create", "read", "approve"]
  }
}
```

**Example**:
```bash
curl -X GET "https://api.example.com/api/v1/acme/users/usr_123/roles/permissions" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 4. Remove Role from User

Remove a specific role assignment from a user.

```
DELETE /:tenant/users/:userId/roles/:roleId
```

**Authorization**: Bearer Token (ADMIN)

**Response 200**:
```json
{
  "message": "Role removed successfully"
}
```

**Example**:
```bash
curl -X DELETE "https://api.example.com/api/v1/acme/users/usr_123/roles/role_456" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Resource created successfully |
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions (not ADMIN) |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |

---

## Use Case Examples

### Example 1: Assign Both Admin and User Roles

For users who need system administration access while also performing regular user tasks:

```bash
# 1. Get the role IDs first
curl -X GET "https://api.example.com/api/v1/acme/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 2. Assign both ADMIN and USER roles
curl -X POST "https://api.example.com/api/v1/acme/users/bob_user_id/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["admin_role_id", "user_role_id"]
  }'

# 3. Verify the assignment
curl -X GET "https://api.example.com/api/v1/acme/users/bob_user_id/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### Example 2: Create and Assign Custom Role

Create a custom procurement manager role and assign it:

```bash
# 1. Create the role
curl -X POST "https://api.example.com/api/v1/acme/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleName": "PROCUREMENT_MANAGER",
    "permissions": {
      "tenders": ["create", "read", "update", "approve"],
      "vendors": ["read", "evaluate"],
      "bids": ["read", "score"]
    },
    "description": "Procurement department manager"
  }'

# Response: { "id": "new_role_id", ... }

# 2. Assign to user
curl -X POST "https://api.example.com/api/v1/acme/users/sarah_id/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["new_role_id"]
  }'
```

---

### Example 3: Temporary Project Lead Assignment

Assign a temporary role that expires after project completion:

```bash
curl -X POST "https://api.example.com/api/v1/acme/users/alice_id/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["project_lead_role_id"],
    "expiresAt": "2025-07-01T00:00:00Z"
  }'
```

---

### Example 4: Multi-Department Manager

Assign multiple departmental roles to a manager:

```bash
# Create Finance role
curl -X POST "https://api.example.com/api/v1/acme/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleName": "FINANCE_MANAGER",
    "permissions": {
      "invoices": ["create", "read", "update", "approve"],
      "payments": ["create", "read", "approve"]
    },
    "description": "Finance department manager"
  }'

# Create Procurement role (if not exists)
# ... (see Example 2)

# Assign both roles to manager
curl -X POST "https://api.example.com/api/v1/acme/users/manager_id/roles" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["procurement_mgr_role_id", "finance_mgr_role_id"]
  }'
```

---

## Permission Structure Examples

### Basic Permissions
```json
{
  "permissions": {
    "tenders": ["read"],
    "bids": ["read", "create"]
  }
}
```

### Advanced Permissions with Conditions
```json
{
  "permissions": {
    "tenders": ["create", "read", "update", "approve"],
    "conditions": {
      "maxApprovalAmount": 50000,
      "currency": "USD",
      "department": "IT"
    }
  }
}
```

### Admin Full Access
```json
{
  "permissions": {
    "actions": ["manage"],
    "subjects": ["all"]
  }
}
```

---

## Notes

- **Multiple Roles**: Users can have unlimited roles. Permissions are merged (union).
- **Role Expiration**: Use `expiresAt` for temporary role assignments (e.g., project-based roles).
- **Role Deletion**: Cannot delete roles that are currently assigned to users. Remove assignments first.
- **Permission Merging**: When a user has multiple roles, all permissions are combined using a union strategy.
- **Backward Compatibility**: The original `User.role` field is still maintained but not used for permission checks with the new system.

---

## Admin Portal Implementation Guide

### Recommended UI Components (with shadcn/ui)

1. **Users List Page**
   - DataTable with columns: Email, Username, Name, Status, Roles Count, Actions
   - Use `GET /auth/users` endpoint

2. **User Detail/Edit Modal**
   - Form for basic user info
   - Multi-select component for role assignment
   - Use `GET /users/:userId/roles` and `POST /users/:userId/roles`

3. **Roles Management Page**
   - DataTable with columns: Role Name, Description, Users Count, Status, Actions
   - Use `GET /roles` endpoint

4. **Role Create/Edit Form**
   - Text input for role name
   - JSON editor or dynamic form for permissions
   - Use `POST /roles` or `PATCH /roles/:roleId`

5. **Role Assignment Component**
   - Multi-select dropdown showing available roles
   - Optional date picker for expiration
   - Display currently assigned roles with remove button
   - Use `POST /users/:userId/roles` and `DELETE /users/:userId/roles/:roleId`

### State Management Tips

```typescript
// Example state structure for user management
interface UserManagementState {
  users: User[]
  roles: Role[]
  selectedUser: User | null
  userRoles: UserRole[]
  loading: boolean
}

// Example API calls
const assignRoles = async (userId: string, roleIds: string[]) => {
  const response = await fetch(`/api/v1/${tenant}/users/${userId}/roles`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ roleIds })
  })
  return response.json()
}
```

---

## Swagger/OpenAPI

All endpoints are documented in Swagger UI at:
```
/:tenant/api/v1/docs
```

Example: `https://api.example.com/api/v1/acme/docs`
