# Frontend Fix - RBAC Admin Data Visibility

## Problem
RBAC admin users can login but cannot see any data (users, roles, etc.) in admin portal.
Enum ADMIN users can see everything, but RBAC admin users see empty lists.

## Root Cause
Frontend components filter displayed data using only `user.role === 'ADMIN'`, which excludes RBAC admin users.

---

## Solution: Fix Data Filtering in Components

### The Issue
Components that display lists (users, roles, tenders, etc.) often filter data based on user role:

**Broken Pattern:**
```javascript
// ❌ Only checks enum role - RBAC admin sees nothing
if (user.role === 'ADMIN') {
  displayData(allUsers);
} else {
  displayData([]);
}
```

### The Fix

**Option 1: Check Both Roles (Recommended)**
```javascript
// ✅ Checks both enum AND RBAC roles
const isAdmin = user.role === 'ADMIN' || user.rbacRoles?.includes('Admin');

if (isAdmin) {
  displayData(allUsers);
} else {
  displayData([]);
}
```

**Option 2: Remove Frontend Filtering (Best)**
```javascript
// ✅ Let backend handle authorization
// Just display whatever data the API returns
// Backend already checks permissions
displayData(allUsers);
```

---

## Common Places to Fix

### 1. User Management Page

**Before:**
```javascript
// ❌ RBAC admin can't see users
const visibleUsers = user.role === 'ADMIN' 
  ? allUsers 
  : allUsers.filter(u => u.id === user.id);
```

**After:**
```javascript
// ✅ RBAC admin can see users
const isAdmin = user.role === 'ADMIN' || user.rbacRoles?.includes('Admin');
const visibleUsers = isAdmin
  ? allUsers 
  : allUsers.filter(u => u.id === user.id);
```

### 2. Roles & Permissions Page

**Before:**
```javascript
// ❌ RBAC admin can't see roles
if (user.role !== 'ADMIN') {
  return <div>Unauthorized</div>;
}
```

**After:**
```javascript
// ✅ RBAC admin can see roles
const isAdmin = user.role === 'ADMIN' || user.rbacRoles?.includes('Admin');
if (!isAdmin) {
  return <div>Unauthorized</div>;
}
```

### 3. Tender Management

**Before:**
```javascript
// ❌ RBAC admin can't see all tenders
const tenders = user.role === 'ADMIN'
  ? allTenders
  : allTenders.filter(t => t.createdBy === user.id);
```

**After:**
```javascript
// ✅ RBAC admin can see all tenders
const isAdmin = user.role === 'ADMIN' || user.rbacRoles?.includes('Admin');
const tenders = isAdmin
  ? allTenders
  : allTenders.filter(t => t.createdBy === user.id);
```

### 4. Conditional UI Elements

**Before:**
```javascript
// ❌ RBAC admin can't see admin buttons
{user.role === 'ADMIN' && (
  <button onClick={deleteUser}>Delete</button>
)}
```

**After:**
```javascript
// ✅ RBAC admin can see admin buttons
{(user.role === 'ADMIN' || user.rbacRoles?.includes('Admin')) && (
  <button onClick={deleteUser}>Delete</button>
)}
```

---

## Search & Replace Pattern

Find all instances of these patterns in your frontend codebase:

**Pattern 1: Direct role check**
```javascript
user.role === 'ADMIN'
```
Replace with:
```javascript
(user.role === 'ADMIN' || user.rbacRoles?.includes('Admin'))
```

**Pattern 2: Negative check**
```javascript
user.role !== 'ADMIN'
```
Replace with:
```javascript
(user.role !== 'ADMIN' && !user.rbacRoles?.includes('Admin'))
```

**Pattern 3: Ternary**
```javascript
user.role === 'ADMIN' ? adminView : userView
```
Replace with:
```javascript
(user.role === 'ADMIN' || user.rbacRoles?.includes('Admin')) ? adminView : userView
```

---

## Utility Function (Recommended)

Create a reusable helper to avoid repeating logic:

```javascript
// utils/permissions.js
export function hasAnyRole(user, requiredRoles) {
  if (!user) return false;
  
  // Check enum role
  if (requiredRoles.includes(user.role)) return true;
  
  // Check RBAC roles
  if (user.rbacRoles?.some(r => requiredRoles.includes(r))) return true;
  
  return false;
}

export function isAdmin(user) {
  return hasAnyRole(user, ['ADMIN', 'Admin']);
}

export function isBuyer(user) {
  return hasAnyRole(user, ['BUYER', 'Buyer']);
}

// Usage in components:
import { isAdmin } from '@/utils/permissions';

// Clean and readable
if (isAdmin(user)) {
  displayData(allUsers);
}

// Works with filter
const adminUsers = allUsers.filter(u => isAdmin(u));

// Works with conditional rendering
{isAdmin(user) && <AdminPanel />}
```

---

## TypeScript Type Update

```typescript
// types/user.ts
export interface User {
  id: string;
  email: string;
  role: string;            // Enum: ADMIN, BUYER, VENDOR, etc.
  rbacRoles?: string[];    // RBAC: ["Admin", "Buyer", etc.]
  abilities?: any;
  tenantId: string;
}
```

---

## Real-World Example: User List Component

```javascript
import { isAdmin } from '@/utils/permissions';

function UserListPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Backend already filters based on permissions
    // Just fetch and display
    fetch('/api/users')
      .then(res => res.json())
      .then(setUsers);
  }, []);

  return (
    <div>
      <h1>Users</h1>
      
      {/* Show create button only for admins */}
      {isAdmin(user) && (
        <button onClick={createUser}>Create User</button>
      )}

      {/* Display all users returned by API */}
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            {isAdmin(user) && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              {isAdmin(user) && (
                <td>
                  <button onClick={() => editUser(u)}>Edit</button>
                  <button onClick={() => deleteUser(u)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Test Checklist

- [ ] RBAC admin user can see user list
- [ ] RBAC admin user can see roles list
- [ ] RBAC admin user can see admin buttons (Create, Edit, Delete)
- [ ] RBAC admin user can see all tenders (not just their own)
- [ ] Enum ADMIN user still works as before
- [ ] Non-admin users don't see admin-only data
- [ ] Token contains `rbacRoles` array after login
- [ ] Console shows no errors about undefined `rbacRoles`

---

## Quick Debug

If data still not showing, add debug logging:

```javascript
console.log('Current user:', user);
console.log('Enum role:', user.role);
console.log('RBAC roles:', user.rbacRoles);
console.log('Is admin?', user.role === 'ADMIN' || user.rbacRoles?.includes('Admin'));
console.log('Data from API:', users);
```

Check:
1. Does `user.rbacRoles` exist and include `"Admin"`?
2. Does the API return data?
3. Is the data being filtered somewhere in the component?

---

## Summary

**Problem:** RBAC admin users can't see data because frontend filters only check `user.role`

**Solution:** Update all data visibility checks to include RBAC roles:

```javascript
// Old: user.role === 'ADMIN'
// New: user.role === 'ADMIN' || user.rbacRoles?.includes('Admin')

// Better: Use utility function
import { isAdmin } from '@/utils/permissions';
if (isAdmin(user)) { /* show data */ }
```

**Key insight:** Backend already authorizes correctly. Just fix frontend visibility logic.
