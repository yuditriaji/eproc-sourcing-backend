# Vendor Registration with Integrated User Creation

## Overview

**✨ NEW: One-Step Vendor Registration**

Admins can now create vendor company AND user account in a single API call! No more two-step process.

---

## How It Works

### Option 1: Vendor Company Only (Old Way)

```typescript
POST /api/v1/:tenant/vendors
{
  "name": "ABC Supply Co.",
  "contactEmail": "contact@abc.com",
  "registrationNumber": "REG-12345"
  // ... other vendor fields
}

Response:
{
  "vendor": {
    "id": "vendor_123",
    "name": "ABC Supply Co.",
    "status": "ACTIVE"
  }
}
```

### Option 2: Vendor Company + User Account (NEW! 🚀)

```typescript
POST /api/v1/:tenant/vendors
{
  // Vendor company details
  "name": "ABC Supply Co.",
  "contactEmail": "contact@abc.com",
  "registrationNumber": "REG-12345",
  
  // User account creation (NEW!)
  "createUserAccount": true,
  "userEmail": "john@abc.com",        // Required if createUserAccount=true
  "userUsername": "john_abc",         // Optional
  "userFirstName": "John",            // Optional
  "userLastName": "Doe"               // Optional
}

Response:
{
  "vendor": {
    "id": "vendor_123",
    "name": "ABC Supply Co.",
    "status": "ACTIVE"
  },
  "user": {
    "id": "user_456",
    "email": "john@abc.com",
    "username": "john_abc",
    "role": "VENDOR",
    "isVerified": true
  },
  "temporaryPassword": "Td8#kL2@pR9!",
  "message": "Vendor and user account created successfully. Send these credentials to the vendor."
}
```

---

## Frontend Implementation

### Admin Portal - Create Vendor Form

Add checkbox and conditional fields to vendor creation form:

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

export function CreateVendorForm() {
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    try {
      const response = await fetch(`/api/v1/${tenant}/vendors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          createUserAccount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create vendor');
      }

      // Check if user account was created
      if (result.user && result.temporaryPassword) {
        setCredentials(result);
        toast.success('Vendor and user account created successfully!');
      } else {
        toast.success('Vendor created successfully!');
      }

    } catch (error) {
      toast.error(error.message);
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
    toast.success('Credentials copied to clipboard!');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Vendor Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              {...register('name', { required: true })}
              placeholder="ABC Supply Co."
            />
          </div>

          <div>
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              {...register('contactEmail')}
              placeholder="contact@abc.com"
            />
          </div>

          <div>
            <Label htmlFor="registrationNumber">Registration Number</Label>
            <Input
              id="registrationNumber"
              {...register('registrationNumber')}
              placeholder="REG-12345"
            />
          </div>

          {/* Add more vendor fields as needed */}
        </CardContent>
      </Card>

      <Separator />

      {/* User Account Creation (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle>User Account (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createUserAccount"
              checked={createUserAccount}
              onCheckedChange={setCreateUserAccount}
            />
            <Label htmlFor="createUserAccount" className="cursor-pointer">
              Create login account for this vendor
            </Label>
          </div>

          {createUserAccount && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                A secure password will be auto-generated. You'll need to send these credentials to the vendor.
              </p>

              <div>
                <Label htmlFor="userEmail">Email *</Label>
                <Input
                  id="userEmail"
                  type="email"
                  {...register('userEmail', { 
                    required: createUserAccount,
                  })}
                  placeholder="john@abc.com"
                />
                {errors.userEmail && (
                  <p className="text-sm text-red-500 mt-1">Email is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="userUsername">Username (Optional)</Label>
                <Input
                  id="userUsername"
                  {...register('userUsername')}
                  placeholder="john_abc"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Defaults to email prefix if not provided
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userFirstName">First Name</Label>
                  <Input
                    id="userFirstName"
                    {...register('userFirstName')}
                    placeholder="John"
                  />
                </div>

                <div>
                  <Label htmlFor="userLastName">Last Name</Label>
                  <Input
                    id="userLastName"
                    {...register('userLastName')}
                    placeholder="Doe"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials Display (after creation) */}
      {credentials && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <CardHeader>
            <CardTitle className="text-green-900 dark:text-green-100">
              ✓ User Account Created
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Copy these credentials and send them to the vendor securely.
            </p>

            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={credentials.user.email} readOnly />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Username</Label>
                <Input value={credentials.user.username} readOnly />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                <Input 
                  value={credentials.temporaryPassword} 
                  readOnly 
                  className="font-mono font-bold"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleCopyCredentials}
              variant="outline"
              className="w-full"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy All Credentials
            </Button>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>⚠️ Important:</strong> The vendor must change this password on first login.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">
          Create Vendor {createUserAccount && '& User Account'}
        </Button>
      </div>
    </form>
  );
}
```

---

## API Request Examples

### Example 1: Simple Vendor (No User)

```bash
curl -X POST http://localhost:3000/api/v1/quiv/vendors \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Supply Co.",
    "contactEmail": "contact@abc.com",
    "registrationNumber": "REG-12345"
  }'
```

### Example 2: Vendor + User Account

```bash
curl -X POST http://localhost:3000/api/v1/quiv/vendors \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Supply Co.",
    "contactEmail": "contact@abc.com",
    "registrationNumber": "REG-12345",
    "createUserAccount": true,
    "userEmail": "john@abc.com",
    "userFirstName": "John",
    "userLastName": "Doe"
  }'
```

Response:
```json
{
  "vendor": {
    "id": "clxxx123",
    "name": "ABC Supply Co.",
    "contactEmail": "contact@abc.com",
    "status": "ACTIVE",
    "createdAt": "2024-11-22T19:00:00Z"
  },
  "user": {
    "id": "clxxx456",
    "email": "john@abc.com",
    "username": "john",
    "firstName": "John",
    "lastName": "Doe",
    "role": "VENDOR",
    "isVerified": true,
    "isActive": true,
    "createdAt": "2024-11-22T19:00:00Z"
  },
  "temporaryPassword": "Td8#kL2@pR9!",
  "message": "Vendor and user account created successfully. Send these credentials to the vendor."
}
```

---

## Comparison: Old vs New Flow

### Old Way (Two Steps) ❌

```
Step 1: Admin creates vendor
POST /vendors { name, email, ... }
→ Response: { vendor: {...} }

Step 2: Admin creates user separately
POST /vendors/:id/user { email, ... }
→ Response: { user: {...}, temporaryPassword }
```

**Problems:**
- Two API calls
- Admin might forget to create user
- Disconnected flow
- More complex UI

### New Way (One Step) ✅

```
Step 1: Admin creates vendor + user in one call
POST /vendors { 
  name, email, ...,
  createUserAccount: true,
  userEmail: "..."
}
→ Response: { vendor, user, temporaryPassword }
```

**Benefits:**
- Single API call
- Integrated flow
- Can't forget to create user (checkbox reminder)
- Simpler UI
- More intuitive

---

## User Flow

### Admin Creates Vendor

1. **Fill Vendor Form**
   - Enter company name, email, registration, etc.
   
2. **Optionally Create User**
   - Check "Create login account for this vendor"
   - Enter user email (required)
   - Optionally: username, first name, last name
   
3. **Submit**
   - Click "Create Vendor & User Account"
   - System creates vendor company
   - If checkbox checked: creates user account with auto-generated password
   
4. **Get Credentials**
   - If user created: see credentials in success message
   - Copy credentials
   - Send to vendor via email/phone

### Vendor Logs In

1. **Receive Credentials**
   - Gets email with portal URL, email, username, temp password

2. **First Login**
   - Goes to vendor portal
   - Enters credentials
   - System prompts password change

3. **Change Password**
   - Enters new secure password
   - Can now use vendor portal

---

## Error Handling

### Scenario 1: Vendor Created, User Creation Fails

```json
{
  "vendor": {
    "id": "vendor_123",
    "name": "ABC Supply Co."
  },
  "error": "Vendor created successfully, but user creation failed: Email already exists",
  "message": "Vendor created. You can create user account separately."
}
```

**Admin Action:** Use the separate endpoint to create user:
```
POST /vendors/vendor_123/user
```

### Scenario 2: Email Already in Use

```json
{
  "error": "User with this email already exists"
}
```

**Admin Action:** Use different email or check existing users

---

## Benefits of This Approach

### ✅ For Admins
1. **Faster** - One form, one click
2. **Intuitive** - Natural flow
3. **Flexible** - Can skip user creation if needed
4. **Error handling** - Vendor still created if user fails

### ✅ For Developers
1. **Single endpoint** - No need for separate POST /vendors/:id/user
2. **Transactional** - Vendor and user created together
3. **Backward compatible** - Old flow still works (no createUserAccount)
4. **Clean API** - Logical grouping

### ✅ For Users (Vendors)
1. **Quick onboarding** - Get credentials immediately
2. **Less waiting** - No multi-step approval
3. **Clear instructions** - Know they need to change password

---

## Still Need Separate Endpoint?

**Yes!** The separate `POST /vendors/:id/user` endpoint is still useful for:

1. **Retroactive creation** - Create user for existing vendor
2. **Multiple users** - One vendor, multiple user accounts (future)
3. **Error recovery** - If user creation failed during vendor creation
4. **Migration** - Bulk create users for existing vendors

---

## Migration Guide

### Existing Vendors Without Users

If you have vendors created before this feature:

```bash
# List all vendors
GET /api/v1/:tenant/vendors

# For each vendor without a user:
POST /api/v1/:tenant/vendors/{vendorId}/user
{
  "email": "user@vendor.com"
}
```

Or create a migration script:

```typescript
// scripts/create-vendor-users.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find vendors without users
  const vendors = await prisma.vendor.findMany({
    where: {
      // Add logic to find vendors without users
    },
  });

  for (const vendor of vendors) {
    if (vendor.contactEmail) {
      // Create user for this vendor
      // using the API endpoint or direct Prisma call
    }
  }
}

main();
```

---

## Configuration

### Environment Variables

No additional environment variables needed! Uses existing:
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `DATABASE_URL`

### Feature Flags (Optional)

If you want to gradually roll out:

```typescript
// config/features.ts
export const FEATURES = {
  VENDOR_USER_CREATION: process.env.ENABLE_VENDOR_USER_CREATION === 'true',
};

// In frontend
{FEATURES.VENDOR_USER_CREATION && (
  <Checkbox label="Create user account" />
)}
```

---

## Testing Checklist

### Backend Tests

- [ ] Create vendor only (createUserAccount=false)
- [ ] Create vendor + user (createUserAccount=true)
- [ ] Create vendor + user without email (should fail)
- [ ] Create vendor + user with duplicate email (should return error)
- [ ] Verify password is auto-generated
- [ ] Verify user has VENDOR role
- [ ] Verify user is pre-verified
- [ ] Verify audit logging

### Frontend Tests

- [ ] Form shows/hides user fields based on checkbox
- [ ] Form validates email when checkbox checked
- [ ] Success message shows credentials
- [ ] Copy button works
- [ ] Can create vendor without user
- [ ] Can create vendor with user
- [ ] Error handling works

### Integration Tests

- [ ] Vendor created successfully
- [ ] User created successfully
- [ ] Vendor can log in with temporary password
- [ ] Vendor must change password on first login
- [ ] Vendor can access vendor portal
- [ ] Vendor cannot access admin portal

---

## Security Considerations

### ✅ Password Security
- 12 character auto-generated password
- Bcrypt hashing (10 rounds)
- Must be changed on first login

### ✅ Access Control
- Only ADMIN and USER roles can create vendors
- Tenant isolation enforced
- Audit logging enabled

### ✅ Data Protection
- Temporary password only shown once
- Sent over HTTPS
- Admin responsible for secure delivery

---

## Future Enhancements

### Phase 1 (Current) ✅
- [x] Integrated vendor + user creation
- [x] Auto-generated passwords
- [x] Single API endpoint

### Phase 2
- [ ] Email integration (auto-send credentials)
- [ ] SMS integration (send temp password)
- [ ] Invitation links (vendor sets own password)

### Phase 3
- [ ] Multiple users per vendor
- [ ] Role-based permissions within vendor
- [ ] User management UI in vendor portal

---

## Documentation

- API: See Swagger docs at `/api/v1/docs`
- Full guide: `docs/VENDOR_CREDENTIAL_MANAGEMENT.md`
- Implementation: `docs/VENDOR_AUTO_PASSWORD_IMPLEMENTATION.md`

---

**Document Version:** 2.0  
**Last Updated:** 2024-11-22  
**Status:** ✅ Backend Complete - Ready for Frontend Implementation
