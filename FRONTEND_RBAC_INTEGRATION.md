# Frontend RBAC Integration Guide - Option 2

## Overview
This guide shows how to update your frontend to support both enum roles and RBAC roles for admin portal access and route protection.

---

## 1. Update Auth/Token Handling

### Decode JWT Token to Extract RBAC Roles

```typescript
// utils/auth.ts or similar
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub: string;
  email: string;
  role: string; // Enum role (ADMIN, BUYER, etc.)
  rbacRoles?: string[]; // RBAC roles array (NEW!)
  abilities?: any;
  tenantId: string;
  iat: number;
  exp: number;
}

export function decodeAccessToken(token: string): DecodedToken {
  return jwtDecode<DecodedToken>(token);
}

export function getCurrentUser(token: string) {
  const decoded = decodeAccessToken(token);
  
  return {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role, // Enum role
    rbacRoles: decoded.rbacRoles || [], // RBAC roles (may be empty)
    abilities: decoded.abilities,
    tenantId: decoded.tenantId,
  };
}
```

---

## 2. Update User Type/Interface

```typescript
// types/user.ts or models/user.ts
export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: string; // Enum role: ADMIN, BUYER, VENDOR, etc.
  rbacRoles: string[]; // RBAC role names: ["PROCUREMENT_MANAGER", "Admin", etc.]
  abilities?: any; // Merged permissions
  tenantId: string;
}
```

---

## 3. Create Role Check Utilities

```typescript
// utils/permissions.ts
import { User } from '@/types/user';

/**
 * Check if user has ANY of the required roles (enum OR RBAC)
 */
export function hasAnyRole(user: User | null, requiredRoles: string[]): boolean {
  if (!user) return false;
  
  // Check enum role
  if (requiredRoles.includes(user.role)) {
    return true;
  }
  
  // Check RBAC roles
  if (user.rbacRoles?.some(role => requiredRoles.includes(role))) {
    return true;
  }
  
  return false;
}

/**
 * Check if user has ALL of the required roles
 */
export function hasAllRoles(user: User | null, requiredRoles: string[]): boolean {
  if (!user) return false;
  
  const userRoles = [user.role, ...(user.rbacRoles || [])];
  
  return requiredRoles.every(role => userRoles.includes(role));
}

/**
 * Check if user is admin (enum ADMIN OR RBAC "Admin")
 */
export function isAdmin(user: User | null): boolean {
  return hasAnyRole(user, ['ADMIN', 'Admin']);
}

/**
 * Check if user has specific RBAC role
 */
export function hasRbacRole(user: User | null, roleName: string): boolean {
  return user?.rbacRoles?.includes(roleName) ?? false;
}

/**
 * Get all user's roles (enum + RBAC combined)
 */
export function getAllRoles(user: User | null): string[] {
  if (!user) return [];
  return [user.role, ...(user.rbacRoles || [])];
}
```

---

## 4. Update Admin Portal Route Guard

### Next.js App Router Example

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtDecode } from 'jwt-decode';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  try {
    const decoded = jwtDecode<any>(token);
    
    // Check if accessing admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
      // Allow if user has ADMIN enum role OR "Admin" RBAC role
      const isAdmin = decoded.role === 'ADMIN' || decoded.rbacRoles?.includes('Admin');
      
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
    }
    
    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

### React Router Example

```typescript
// components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { hasAnyRole } from '@/utils/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[]; // Can be enum or RBAC roles
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRoles = [],
  redirectTo = '/unauthorized' 
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRoles.length > 0 && !hasAnyRole(user, requiredRoles)) {
    return <Navigate to={redirectTo} replace />;
  }
  
  return <>{children}</>;
}

// Usage:
<ProtectedRoute requiredRoles={['ADMIN', 'Admin']}>
  <AdminDashboard />
</ProtectedRoute>
```

---

## 5. Update Admin Portal Navigation

```typescript
// components/AdminLayout.tsx
import { useAuth } from '@/hooks/useAuth';
import { isAdmin, hasAnyRole } from '@/utils/permissions';

export function AdminLayout() {
  const { user } = useAuth();
  
  // Only render admin layout if user is admin
  if (!isAdmin(user)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return (
    <div>
      <Sidebar user={user} />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

// components/Sidebar.tsx
export function Sidebar({ user }: { user: User }) {
  return (
    <nav>
      {/* Always show for admins */}
      {isAdmin(user) && (
        <>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/users">User Management</NavLink>
          <NavLink to="/admin/roles">Roles & Permissions</NavLink>
        </>
      )}
      
      {/* Show only if user has specific RBAC role */}
      {hasAnyRole(user, ['ADMIN', 'Admin', 'PROCUREMENT_MANAGER']) && (
        <NavLink to="/admin/tenders">Tenders</NavLink>
      )}
      
      {/* Show based on multiple roles */}
      {hasAnyRole(user, ['ADMIN', 'Admin', 'FINANCE', 'Finance']) && (
        <NavLink to="/admin/reports">Financial Reports</NavLink>
      )}
    </nav>
  );
}
```

---

## 6. Display User's Roles in UI

### User Profile/Header Component

```typescript
// components/UserProfile.tsx
import { Badge } from '@/components/ui/badge';
import { User } from '@/types/user';
import { getAllRoles } from '@/utils/permissions';

export function UserProfile({ user }: { user: User }) {
  const allRoles = getAllRoles(user);
  
  return (
    <div className="user-profile">
      <div className="user-info">
        <h3>{user.email}</h3>
        <p>Primary Role: {user.role}</p>
      </div>
      
      <div className="roles">
        <p className="text-sm text-gray-600">Active Roles:</p>
        <div className="flex gap-2 flex-wrap">
          {allRoles.map(role => (
            <Badge key={role} variant={role === user.role ? 'default' : 'secondary'}>
              {role}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### User Management Table

```typescript
// pages/admin/users.tsx
export function UsersTable({ users }: { users: User[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Primary Role</th>
          <th>RBAC Roles</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            <td>{user.email}</td>
            <td>
              <Badge>{user.role}</Badge>
            </td>
            <td>
              {user.rbacRoles?.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {user.rbacRoles.map(role => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400">None</span>
              )}
            </td>
            <td>
              <button onClick={() => editUserRoles(user.id)}>
                Edit Roles
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 7. Update Roles & Permissions Page

### Display User Count

```typescript
// pages/admin/roles.tsx
import { useQuery } from '@tanstack/react-query';

interface RbacRole {
  id: string;
  roleName: string;
  description: string;
  permissions: any;
  isActive: boolean;
  _count: {
    userRoles: number; // This is now included from backend!
  };
}

export function RolesPage() {
  const { data: roles } = useQuery<RbacRole[]>({
    queryKey: ['rbac-roles'],
    queryFn: () => fetch('/api/v1/tenant-1/role-config').then(r => r.json()),
  });
  
  return (
    <div>
      <h1>Roles & Permissions</h1>
      
      <div className="roles-grid">
        {roles?.map(role => (
          <div key={role.id} className="role-card">
            <div className="flex justify-between items-start">
              <div>
                <h3>{role.roleName}</h3>
                <p className="text-sm text-gray-600">{role.description}</p>
              </div>
              <Badge variant={role.isActive ? 'default' : 'secondary'}>
                {role.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            
            {/* Display user count */}
            <div className="mt-4">
              <span className="text-sm">
                👥 {role._count.userRoles} {role._count.userRoles === 1 ? 'user' : 'users'}
              </span>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button onClick={() => editRole(role.id)}>Edit</button>
              <button onClick={() => viewUsers(role.id)}>View Users</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. Conditional Rendering Based on Roles

### Using Hooks

```typescript
// hooks/useHasRole.ts
import { useAuth } from '@/hooks/useAuth';
import { hasAnyRole } from '@/utils/permissions';

export function useHasRole(requiredRoles: string[]): boolean {
  const { user } = useAuth();
  return hasAnyRole(user, requiredRoles);
}

// Usage in components:
function TenderApproveButton() {
  const canApprove = useHasRole(['ADMIN', 'Admin', 'PROCUREMENT_MANAGER']);
  
  if (!canApprove) return null;
  
  return <button>Approve Tender</button>;
}
```

### Using Component

```typescript
// components/RoleGuard.tsx
interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles: string[];
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, requiredRoles, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();
  
  if (!hasAnyRole(user, requiredRoles)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Usage:
<RoleGuard requiredRoles={['ADMIN', 'Admin', 'PROCUREMENT_MANAGER']}>
  <button>Delete Tender</button>
</RoleGuard>
```

---

## 9. Update API Client to Handle Token

```typescript
// lib/apiClient.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, try to refresh
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/v1/tenant-1/auth/refresh', {
            refreshToken,
          });
          
          localStorage.setItem('accessToken', data.accessToken);
          
          // Retry original request
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return axios(error.config);
        } catch (refreshError) {
          // Refresh failed, logout
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## 10. Testing Checklist

### Manual Testing Steps

```typescript
// Test scenarios to verify

// 1. User with enum ADMIN role
const user1 = {
  role: 'ADMIN',
  rbacRoles: []
};
// ✅ Should access admin portal
// ✅ All admin routes should work

// 2. User with RBAC "Admin" role
const user2 = {
  role: 'BUYER',
  rbacRoles: ['Admin']
};
// ✅ Should access admin portal
// ✅ All admin routes should work

// 3. User with custom RBAC role
const user3 = {
  role: 'BUYER',
  rbacRoles: ['PROCUREMENT_MANAGER']
};
// ❌ Should NOT access admin portal (unless portal allows this role)
// ✅ Should access procurement routes

// 4. User with multiple RBAC roles
const user4 = {
  role: 'USER',
  rbacRoles: ['PROCUREMENT_MANAGER', 'TENDER_EVALUATOR', 'REPORT_VIEWER']
};
// Access granted if route allows ANY of these roles

// 5. User with expired RBAC role
// ❌ Should not have role in rbacRoles array (backend filters)
```

---

## 11. Environment Setup

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

```typescript
// config/roles.ts
// Define your RBAC role names (for type safety)
export const RBAC_ROLES = {
  ADMIN: 'Admin',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  TENDER_EVALUATOR: 'TENDER_EVALUATOR',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  REPORT_VIEWER: 'REPORT_VIEWER',
} as const;

export type RbacRoleName = typeof RBAC_ROLES[keyof typeof RBAC_ROLES];
```

---

## 12. Migration Guide

### Step 1: Update Dependencies
```bash
npm install jwt-decode
```

### Step 2: Update Auth Context
Add `rbacRoles` to your auth context/store

### Step 3: Update Route Guards
Replace simple role checks with `hasAnyRole()` utility

### Step 4: Test Thoroughly
- Test with enum roles (existing users)
- Test with RBAC roles (newly assigned)
- Test with both
- Test with none

### Step 5: Update Documentation
Document which routes accept which RBAC roles

---

## Summary

**Backend**: ✅ Already supports both enum and RBAC roles  
**Frontend**: Update route guards to check `rbacRoles` array  
**Result**: Users with RBAC "Admin" role can access admin portal!

---

## Next Steps

1. Implement the utilities (`hasAnyRole`, `isAdmin`, etc.)
2. Update route guards in your frontend
3. Update navigation to show/hide based on roles
4. Display user's RBAC roles in UI
5. Test with both enum and RBAC admin users

Need help with specific framework implementation? Let me know!
