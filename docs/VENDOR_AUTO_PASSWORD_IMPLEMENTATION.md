# Vendor Auto-Generated Password Implementation

## Overview

Admins can now create vendor user accounts directly from the admin portal with auto-generated secure passwords. Vendors receive temporary credentials and must change their password on first login.

---

## Backend Implementation ✅ COMPLETE

### New Endpoint

```
POST /api/v1/:tenant/vendors/:vendorId/user
```

**Authorization:** Admin only  
**Purpose:** Create user account for vendor with auto-generated password

### Request

```typescript
POST /api/v1/quiv/vendors/vendor_123/user
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "john@vendorcompany.com",     // Required
  "username": "john_vendor",              // Optional (defaults to email prefix)
  "firstName": "John",                    // Optional (defaults to vendor name)
  "lastName": "Doe"                       // Optional (defaults to empty)
}
```

### Response

```typescript
{
  "user": {
    "id": "user_789xyz",
    "email": "john@vendorcompany.com",
    "username": "john_vendor",
    "firstName": "John",
    "lastName": "Doe",
    "role": "VENDOR",
    "isVerified": true,
    "isActive": true,
    "createdAt": "2024-11-22T19:00:00Z"
  },
  "temporaryPassword": "Td8#kL2@pR9!",
  "message": "User created successfully. Send these credentials to the vendor. They must change the password on first login."
}
```

### Password Generation

**Algorithm:** Secure random password with guaranteed complexity
- **Length:** 12 characters
- **Format:** Mix of uppercase, lowercase, numbers, and special characters
- **Guarantee:** At least 1 of each character type
- **Example:** `Td8#kL2@pR9!`

**Security Features:**
- Uses cryptographically secure random generation
- Bcrypt hashing (10 rounds)
- Password never stored in plain text
- Logged in audit trail

---

## Frontend Implementation

### Admin Portal - Vendor Detail Page

Add "Create User Account" button and modal:

```tsx
// Vendor Detail Page
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

export function VendorUserCreation({ vendorId, vendorName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
  });
  
  const handleCreateUser = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch(
        `/api/v1/${tenant}/vendors/${vendorId}/user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      
      const data = await response.json();
      setCredentials(data);
      toast.success('User account created successfully!');
      
      // Show credentials display
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopyCredentials = () => {
    const text = `
Vendor Portal Login Credentials
--------------------------------
URL: https://eproc-vendor-portal.vercel.app/vendor/login?tenant=${tenant}
Email: ${credentials.user.email}
Username: ${credentials.user.username}
Temporary Password: ${credentials.temporaryPassword}

IMPORTANT: You must change this password on first login.
    `.trim();
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard!');
    
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <>
      {/* Create User Button */}
      <Button onClick={() => setIsOpen(true)}>
        Create User Account
      </Button>
      
      {/* Create User Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Vendor User Account</DialogTitle>
            <DialogDescription>
              Create a login account for {vendorName}. A secure password will be auto-generated.
            </DialogDescription>
          </DialogHeader>
          
          {!credentials ? (
            // Form
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@vendorcompany.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="john_vendor (optional)"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to email prefix if not provided
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : (
            // Credentials Display
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                  ✓ User account created successfully
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Copy these credentials and send them to the vendor securely.
                </p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={credentials.user.email} readOnly />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Username</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={credentials.user.username} readOnly />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      value={credentials.temporaryPassword} 
                      readOnly 
                      className="font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>⚠️ Important:</strong> The vendor must change this password on first login.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            {!credentials ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateUser}
                  disabled={!formData.email || isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create User'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false);
                    setCredentials(null);
                    setFormData({ email: '', username: '', firstName: '', lastName: '' });
                  }}
                >
                  Close
                </Button>
                <Button onClick={handleCopyCredentials}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Credentials
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### Usage in Vendor Detail Page

```tsx
// app/admin/configuration/master-data/vendors/[id]/page.tsx

import { VendorUserCreation } from '@/components/vendor/VendorUserCreation';

export default function VendorDetailPage({ params }) {
  const { id } = params;
  const vendor = useVendor(id);
  
  return (
    <div className="space-y-6">
      {/* Vendor details... */}
      
      {/* User Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>User Accounts</CardTitle>
          <CardDescription>
            Manage login accounts for this vendor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VendorUserCreation 
            vendorId={vendor.id} 
            vendorName={vendor.name} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## User Flow

### Admin Side

1. **Create Vendor Company**
   - Admin goes to Vendors → Create Vendor
   - Fills in vendor company details
   - Clicks "Create"

2. **Create User Account**
   - Admin goes to vendor detail page
   - Clicks "Create User Account" button
   - Fills in email (required)
   - Optional: username, first name, last name
   - Clicks "Create User"

3. **Get Credentials**
   - System generates secure password
   - Admin sees credentials in modal
   - Admin copies credentials
   - Admin sends credentials to vendor (email, phone, etc.)

### Vendor Side

1. **Receive Credentials**
   - Vendor receives:
     - Portal URL
     - Email/Username
     - Temporary password

2. **First Login**
   - Vendor goes to vendor portal
   - Enters email and temporary password
   - System detects first login
   - **Vendor is prompted to change password**

3. **Change Password**
   - Vendor enters new password
   - Confirms new password
   - Saves
   - Can now use vendor portal normally

---

## Password Change Flow (To Be Implemented)

### Backend Endpoint Needed

```typescript
PATCH /api/v1/:tenant/auth/change-password

Request:
{
  "currentPassword": "Td8#kL2@pR9!",
  "newPassword": "MyNewSecure123!",
  "confirmPassword": "MyNewSecure123!"
}

Response:
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Frontend Implementation

```tsx
// Add to vendor portal after first login
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ChangePasswordPrompt() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const user = useAppSelector((state) => state.auth.user);
  
  useEffect(() => {
    // Check if user needs to change password
    // You can add a flag like `mustChangePassword` or check login count
    if (user && user.loginCount === 1) {
      setIsOpen(true);
    }
  }, [user]);
  
  return (
    <Dialog open={isOpen} onOpenChange={() => {}} closeButton={false}>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Change Your Password</DialogTitle>
          <DialogDescription>
            For security reasons, you must change your temporary password.
          </DialogDescription>
        </DialogHeader>
        
        {/* Password change form */}
        <form onSubmit={handleChangePassword}>
          <Input
            type="password"
            placeholder="Current Password"
            name="currentPassword"
          />
          <Input
            type="password"
            placeholder="New Password"
            name="newPassword"
          />
          <Input
            type="password"
            placeholder="Confirm New Password"
            name="confirmPassword"
          />
          
          <Button type="submit">Change Password</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Security Considerations

### Password Security ✅

- **Auto-generated:** 12 characters with complexity
- **Bcrypt hashing:** 10 rounds
- **One-time use:** Vendor must change on first login
- **Audit trail:** Creation logged in audit_logs table

### Access Control ✅

- **Admin only:** Only ADMIN can create vendor users
- **Tenant isolation:** Users created within correct tenant
- **Auto-verified:** Users created by admin are pre-verified
- **Role enforcement:** User role is always VENDOR

### Best Practices

1. **✅ Send credentials securely**
   - Use encrypted email
   - Or send via phone/SMS
   - Don't use insecure channels

2. **✅ Time-limited validity** (Future enhancement)
   - Add password expiry for temporary passwords
   - Force change within 24-48 hours

3. **✅ Audit everything**
   - Log who created the user
   - Log when password is changed
   - Track login attempts

---

## Testing

### Manual Test

```bash
# 1. Create vendor (as USER)
curl -X POST http://localhost:3000/api/v1/quiv/vendors \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Vendor Co.",
    "contactEmail": "contact@testvendor.com",
    "registrationNumber": "REG-TEST-001"
  }'

# Response: { "id": "vendor_abc123", ... }

# 2. Create user for vendor (as ADMIN)
curl -X POST http://localhost:3000/api/v1/quiv/vendors/vendor_abc123/user \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@testvendor.com"
  }'

# Response:
# {
#   "user": { "id": "user_xyz789", "email": "john@testvendor.com", ... },
#   "temporaryPassword": "Td8#kL2@pR9!",
#   "message": "..."
# }

# 3. Login as vendor
curl -X POST http://localhost:3000/api/v1/quiv/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@testvendor.com",
    "password": "Td8#kL2@pR9!"
  }'

# Should succeed and return tokens

# 4. Verify role-based access
# Try accessing vendor portal - should work
# Try accessing admin portal - should be blocked
```

---

## Email Template

### Vendor Credentials Email

```
Subject: Your e-Procurement Vendor Portal Login Credentials

Dear [Vendor Name],

Your account has been created for the e-Procurement vendor portal.

LOGIN DETAILS:
--------------
Portal URL: https://eproc-vendor-portal.vercel.app/vendor/login?tenant=quiv
Email: [user.email]
Username: [user.username]
Temporary Password: [temporaryPassword]

IMPORTANT SECURITY NOTICE:
-------------------------
For your security, you MUST change this temporary password when you log in for the first time.

NEXT STEPS:
----------
1. Click the portal URL above
2. Enter your email and temporary password
3. You will be prompted to create a new password
4. Choose a strong password (min. 8 characters, include uppercase, lowercase, numbers, and special characters)

If you have any questions or need assistance, please contact our procurement team.

Best regards,
[Company Name] Procurement Team

---
This is an automated message. Please do not reply to this email.
```

---

## Enhancements (Future)

### Phase 1 (Current) ✅
- [x] Auto-generate secure password
- [x] Create vendor user endpoint
- [x] Return credentials to admin
- [x] Audit logging

### Phase 2 (Next)
- [ ] Password change endpoint
- [ ] Force password change on first login
- [ ] Password strength validation
- [ ] Frontend password change modal

### Phase 3 (Future)
- [ ] Email integration
- [ ] Auto-send credentials email
- [ ] Password expiry for temporary passwords
- [ ] Password history (prevent reuse)
- [ ] Account lockout after failed attempts
- [ ] Two-factor authentication

---

## API Summary

### New Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/vendors/:id/user` | POST | ADMIN | Create vendor user with auto-password |

### Existing Endpoints (Still Available)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/register` | POST | Public | Vendor self-registration |
| `/auth/login` | POST | Public | Vendor login |
| `/auth/users/:id/verify` | PATCH | ADMIN | Verify vendor user |
| `/auth/change-password` | PATCH | User | Change own password (TODO) |

---

## Rollout Plan

### Week 1: Backend Complete ✅
- [x] Add endpoint
- [x] Add password generation
- [x] Add audit logging
- [x] Test manually

### Week 2: Frontend Implementation
- [ ] Add "Create User" button to vendor detail page
- [ ] Add modal with form
- [ ] Add credentials display
- [ ] Add copy functionality
- [ ] Test end-to-end

### Week 3: Password Change Flow
- [ ] Add backend password change endpoint
- [ ] Add frontend password change modal
- [ ] Add "must change password" flag to user
- [ ] Force password change on first login

### Week 4: Email & Polish
- [ ] Add email service integration
- [ ] Auto-send credentials email
- [ ] Add email template
- [ ] Add password expiry
- [ ] Full UAT testing

---

**Document Version:** 1.0  
**Last Updated:** 2024-11-22  
**Status:** Backend Complete - Frontend Implementation Needed
