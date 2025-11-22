# Vendor Credential Management Guide

## Overview

The system separates **Vendor** (company) from **User** (login account). When an admin creates a vendor in the admin portal, they're creating a vendor **company record**, not a user account. Vendors need separate user credentials to log in.

---

## Current Architecture

### Vendor Model (Company)
```prisma
model Vendor {
  id                 String
  tenantId           String
  name               String           // Company name
  contactEmail       String?          // Company contact email (NOT login email)
  registrationNumber String?
  status             VendorStatus     // PENDING_APPROVAL, ACTIVE, etc.
  // ... other company details
}
```

### User Model (Login Account)
```prisma
model User {
  id         String
  tenantId   String
  email      String       // Login email
  username   String       // Login username
  password   String       // Hashed password
  role       UserRoleEnum // VENDOR, USER, ADMIN, etc.
  isVerified Boolean
  // ... other user details
}
```

**Key Point:** There is **NO direct relationship** between Vendor and User tables. A vendor company can have multiple user accounts, or none.

---

## Problem: Missing Vendor User Creation Flow

### ❌ Current Situation (Incomplete)

1. Admin creates Vendor in admin portal → Only creates vendor company record
2. Vendor cannot log in → No user account exists
3. **Missing:** Flow to create user credentials for the vendor

### ✅ What We Need

Two approaches to solve this:

---

## Solution 1: Self-Registration Flow (Recommended)

### Flow

1. **Admin creates Vendor company** (status: `PENDING_APPROVAL`)
   - POST `/api/v1/:tenant/vendors`
   - Creates vendor company record
   - Stores `contactEmail`

2. **Admin invites vendor** (manual or automated)
   - Send email to vendor's `contactEmail`
   - Email contains registration link: `https://portal.com/vendor/register?token=xyz&vendorId=abc`

3. **Vendor registers themselves**
   - POST `/api/v1/:tenant/auth/register`
   - Provides: email, username, password
   - System creates User with role `VENDOR`

4. **Admin verifies vendor user**
   - PATCH `/api/v1/:tenant/auth/users/:userId/verify`
   - Sets `isVerified: true`
   - Vendor can now log in

### API Flow

```typescript
// Step 1: Admin creates vendor company
POST /api/v1/quiv/vendors
{
  "name": "ABC Supply Co.",
  "contactEmail": "contact@abcsupply.com",
  "registrationNumber": "REG-12345",
  // ... other details
}

// Response:
{
  "id": "vendor_123abc",
  "name": "ABC Supply Co.",
  "status": "PENDING_APPROVAL"
}

// Step 2: Vendor self-registers
POST /api/v1/quiv/auth/register
{
  "email": "john@abcsupply.com",      // Login email
  "username": "john_abc",              // Login username
  "password": "SecurePass123!",
  "role": "VENDOR",                    // Important!
  "firstName": "John",
  "lastName": "Doe"
}

// Response:
{
  "user": {
    "id": "user_789xyz",
    "email": "john@abcsupply.com",
    "role": "VENDOR",
    "isVerified": false              // Requires admin verification
  },
  "accessToken": "...",
  "refreshToken": "..."
}

// Step 3: Admin verifies the vendor user
PATCH /api/v1/quiv/auth/users/user_789xyz/verify

// Step 4: Vendor can now log in
POST /api/v1/quiv/auth/login
{
  "email": "john@abcsupply.com",
  "password": "SecurePass123!"
}
```

---

## Solution 2: Admin-Created Credentials Flow

This requires backend modifications to allow admins to create vendor user accounts directly.

### Required Changes

#### 1. Add Vendor User Creation Endpoint

**File:** `src/modules/vendor/vendor.controller.ts`

```typescript
@Post(':id/user')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
@ApiOperation({ 
  summary: 'Create user account for vendor (Admin only)',
  description: 'Creates a login account for a vendor company'
})
async createVendorUser(
  @Param('id') vendorId: string,
  @Body() dto: CreateVendorUserDto,
  @Req() req: any,
) {
  return this.vendorService.createVendorUser(vendorId, dto, req.user.tenantId);
}
```

#### 2. Add DTO

```typescript
class CreateVendorUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
```

#### 3. Add Service Method

**File:** `src/modules/vendor/vendor.service.ts`

```typescript
async createVendorUser(
  vendorId: string,
  dto: CreateVendorUserDto,
  tenantId: string,
) {
  // Verify vendor exists
  const vendor = await this.prisma.vendor.findFirst({
    where: { id: vendorId, tenantId, deletedAt: null },
  });

  if (!vendor) {
    throw new NotFoundException('Vendor not found');
  }

  // Check if user with email already exists
  const existingUser = await this.prisma.user.findFirst({
    where: { tenantId, email: dto.email },
  });

  if (existingUser) {
    throw new ConflictException('User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(dto.password, 10);

  // Create user with VENDOR role
  const user = await this.prisma.user.create({
    data: {
      tenantId,
      email: dto.email,
      username: dto.username,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: 'VENDOR',
      isVerified: true,  // Auto-verified since created by admin
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isVerified: true,
      createdAt: true,
    },
  });

  // Log audit
  await this.auditService.log({
    tenantId,
    userId: req.user.id,
    action: 'CREATE',
    entity: 'User',
    entityId: user.id,
    details: { vendorId, createdForVendor: vendor.name },
  });

  return user;
}
```

#### 4. Frontend: Add "Create User" Button

In admin vendor detail page:

```tsx
// After vendor is created, show button
<Button onClick={handleCreateUser}>
  Create Login Account for Vendor
</Button>

// Modal/Form
<Dialog>
  <DialogTitle>Create Vendor User Account</DialogTitle>
  <DialogContent>
    <Input label="Email" name="email" />
    <Input label="Username" name="username" />
    <Input label="Password" type="password" name="password" />
    <Input label="First Name" name="firstName" />
    <Input label="Last Name" name="lastName" />
  </DialogContent>
  <DialogActions>
    <Button onClick={handleSubmit}>Create User</Button>
  </DialogActions>
</Dialog>

// API call
const response = await fetch(
  `/api/v1/${tenant}/vendors/${vendorId}/user`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: 'vendor@example.com',
      username: 'vendor_user',
      password: 'TempPassword123!',
      firstName: 'John',
      lastName: 'Doe',
    }),
  }
);
```

---

## Solution 3: Hybrid Approach (Best Practice)

Combine both methods:

1. **Self-Registration (Default)** - For most vendors
   - Vendors register themselves
   - Admin verifies after registration
   - More secure (vendors set their own passwords)

2. **Admin-Created (Optional)** - For special cases
   - Admin can manually create user if needed
   - Generate temporary password
   - Send invitation email with password reset link

---

## Database Link Between Vendor and User (Optional Enhancement)

### Option A: Add vendorId to User Model

**Pros:** Direct link, easy to query
**Cons:** Schema migration required

```prisma
model User {
  // ... existing fields
  vendorId  String?
  vendor    Vendor?  @relation(fields: [vendorId], references: [id])
}

model Vendor {
  // ... existing fields
  users     User[]
}
```

### Option B: Use Metadata in User Table

**Pros:** No schema change needed
**Cons:** Less structured

```typescript
// Store vendorId in user.abilities or new metadata field
user.abilities = {
  vendorId: "vendor_123abc",
  // other abilities
}
```

### Option C: Separate Mapping Table

**Pros:** Many-to-many support, flexible
**Cons:** More complex queries

```prisma
model VendorUser {
  id       String
  tenantId String
  vendorId String
  userId   String
  role     String  // e.g., "PRIMARY", "SECONDARY"
  
  vendor   Vendor  @relation(fields: [vendorId], references: [id])
  user     User    @relation(fields: [userId], references: [id])
  
  @@unique([tenantId, vendorId, userId])
}
```

---

## Recommended Implementation Plan

### Phase 1: Quick Fix (Self-Registration)
**Timeline:** 1 day

1. ✅ **No backend changes needed** - Auth API already supports this
2. Add vendor invitation email template
3. Update admin portal:
   - Add "Invite Vendor" button
   - Generate invitation email with registration link
4. Update vendor portal registration page:
   - Add optional `?vendorId=xyz` query param
   - Pre-fill company name if vendorId provided

### Phase 2: Enhanced Flow (Admin Creates User)
**Timeline:** 2-3 days

1. Add vendor user creation endpoint (as shown above)
2. Update admin portal with "Create User" feature
3. Add password generation utility
4. Add email notification for credentials

### Phase 3: Full Integration (Database Link)
**Timeline:** 1 week

1. Decide on linking approach (Option A recommended)
2. Create Prisma migration
3. Update services to enforce vendor-user relationship
4. Update frontend to show linked users
5. Add user management in vendor detail page

---

## Current Workaround (Immediate Solution)

**Until we implement one of the above solutions:**

### For Admins:

1. Create Vendor in admin portal
2. Manually share this information with vendor:
   - Portal URL: `https://eproc-vendor-portal.vercel.app/vendor/register?tenant=quiv`
   - Tell them to register with VENDOR role
3. After vendor registers, verify their account:
   - Go to Admin → Users
   - Find the vendor user
   - Click "Verify"

### For Vendors:

1. Go to vendor registration page
2. Fill in registration form
3. **Important:** System should detect email from vendor company
4. Wait for admin verification
5. Log in after verification

---

## Testing Checklist

### Test Case 1: Self-Registration Flow
- [ ] Admin creates vendor company
- [ ] Vendor receives invitation email
- [ ] Vendor clicks registration link
- [ ] Vendor fills registration form with role=VENDOR
- [ ] System creates user with isVerified=false
- [ ] Admin verifies user account
- [ ] Vendor can log in successfully
- [ ] Vendor sees vendor portal (not business portal)

### Test Case 2: Admin-Created User Flow
- [ ] Admin creates vendor company
- [ ] Admin creates user account for vendor
- [ ] System generates temporary password
- [ ] Vendor receives credentials email
- [ ] Vendor logs in with temporary password
- [ ] Vendor is prompted to change password
- [ ] Vendor can access vendor portal

### Test Case 3: Security Validation
- [ ] Vendor user cannot access admin portal
- [ ] Vendor user cannot access business portal
- [ ] Vendor user can only see own bids
- [ ] Vendor user can only view published tenders
- [ ] Non-verified vendor cannot log in

---

## Email Templates

### Vendor Invitation Email

```
Subject: Invitation to Join [Company Name] e-Procurement Portal

Dear [Vendor Name],

You have been invited to join our e-Procurement vendor portal.

Company: [Company Name]
Tenant: [Tenant Name]

To complete your registration, please click the link below:
[Registration Link]

This link will expire in 7 days.

Best regards,
[Company Name] Procurement Team
```

### Credentials Email (If Admin Creates User)

```
Subject: Your e-Procurement Portal Login Credentials

Dear [Vendor Name],

Your account has been created for the e-Procurement vendor portal.

Login URL: [Portal URL]
Email: [user.email]
Username: [user.username]
Temporary Password: [generated_password]

For security reasons, you will be required to change your password upon first login.

Best regards,
[Company Name] Procurement Team
```

---

## API Reference

### Existing Endpoints (Already Available)

```
POST   /api/v1/:tenant/auth/register          - Vendor self-registration
POST   /api/v1/:tenant/auth/login             - Vendor login
PATCH  /api/v1/:tenant/auth/users/:id/verify  - Admin verifies vendor
GET    /api/v1/:tenant/auth/users             - Admin lists users
```

### New Endpoints (To Be Implemented)

```
POST   /api/v1/:tenant/vendors/:id/user       - Admin creates vendor user
POST   /api/v1/:tenant/vendors/:id/invite     - Admin sends invitation
GET    /api/v1/:tenant/vendors/:id/users      - List users for vendor
DELETE /api/v1/:tenant/vendors/:id/users/:uid - Remove user from vendor
```

---

## Frontend Implementation

### Admin Portal - Vendor Detail Page

```tsx
// Add to vendor detail page
<Card>
  <CardHeader>
    <CardTitle>User Accounts</CardTitle>
  </CardHeader>
  <CardContent>
    {/* List of users linked to this vendor */}
    {vendorUsers.map(user => (
      <div key={user.id}>
        {user.email} - {user.isVerified ? 'Verified' : 'Pending'}
      </div>
    ))}
    
    {/* Actions */}
    <Button onClick={handleInviteVendor}>
      Send Invitation Email
    </Button>
    <Button onClick={handleCreateUser}>
      Create User Account
    </Button>
  </CardContent>
</Card>
```

### Vendor Portal - Registration Page

```tsx
// Update registration to link to vendor
const searchParams = useSearchParams();
const vendorId = searchParams.get('vendorId');

<form onSubmit={handleRegister}>
  <Input name="email" label="Email" />
  <Input name="username" label="Username" />
  <Input name="password" type="password" label="Password" />
  
  {vendorId && (
    <input type="hidden" name="vendorId" value={vendorId} />
  )}
  
  <Button type="submit">Register as Vendor</Button>
</form>
```

---

## FAQ

**Q: Can one vendor company have multiple user accounts?**
A: Yes, once we implement the vendor-user linking (Phase 3). Currently, the system doesn't enforce this relationship.

**Q: Can a user have multiple roles?**
A: The enum role is single-value, but you can use RBAC roles for multiple role assignments.

**Q: What happens if a vendor user is deleted?**
A: The vendor company record remains. The user just can't log in anymore.

**Q: Can a vendor user access business portal features?**
A: No. The vendor login page validates that only VENDOR role users can access the vendor portal.

**Q: How do I reset a vendor's password?**
A: Currently not implemented. You would need to add a password reset endpoint or have admin manually update it.

---

## Next Steps

1. **Immediate (Today):**
   - Document current workaround
   - Create manual invitation process for admins
   - Test self-registration flow

2. **Short-term (This Week):**
   - Implement Solution 1 (self-registration with invitation)
   - Add invitation email functionality
   - Update admin portal UI

3. **Medium-term (Next Sprint):**
   - Implement Solution 2 (admin creates user)
   - Add vendor-user linking
   - Build user management UI in admin portal

4. **Long-term (Future):**
   - Add password reset flow
   - Add user invitation system
   - Add multi-user vendor accounts
   - Add role-based permissions within vendor

---

**Document Version:** 1.0  
**Last Updated:** 2024-11-22  
**Status:** Active Issue - Implementation Needed
