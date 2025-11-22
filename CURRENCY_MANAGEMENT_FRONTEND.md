# Currency Management - Frontend Implementation Guide

## Overview

This document provides complete specifications for implementing the Currency Management feature in the frontend. The backend API is fully implemented and ready to use.

---

## Backend API Reference

### Base URL
`/api/v1/:tenant/currencies`

### Authentication
All endpoints require JWT Bearer token authentication.

---

## API Endpoints

### 1. Create Currency

**Endpoint:**
```http
POST /currencies
```

**Required Role:** `ADMIN` or `USER` (or RBAC `Admin`/`User`)

**Request Body:**
```json
{
  "code": "USD",
  "symbol": "$",
  "name": "US Dollar",
  "exchangeRate": 1.0,
  "isActive": true
}
```

**Field Specifications:**
| Field | Type | Required | Validation | Example |
|-------|------|----------|------------|---------|
| `code` | string | ✅ | Exactly 3 uppercase letters | `"USD"`, `"EUR"`, `"IDR"` |
| `symbol` | string | ✅ | 1-10 characters | `"$"`, `"€"`, `"Rp"` |
| `name` | string | ✅ | 1-100 characters | `"US Dollar"` |
| `exchangeRate` | number | ❌ | Positive, max 6 decimals | `1.0`, `15750.50` |
| `isActive` | boolean | ❌ | true/false | `true` (default) |

**Response:** `201 Created`
```json
{
  "id": "cm123abc",
  "tenantId": "tenant123",
  "code": "USD",
  "symbol": "$",
  "name": "US Dollar",
  "exchangeRate": 1.0,
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation error
- `409 Conflict` - Currency code already exists

---

### 2. List Currencies

**Endpoint:**
```http
GET /currencies?limit=20&offset=0&active=true&search=USD
```

**Required Role:** Any authenticated user

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | ❌ | 20 | Number of records to return |
| `offset` | number | ❌ | 0 | Number of records to skip (pagination) |
| `active` | boolean | ❌ | - | Filter by active status (`true` or `false`) |
| `search` | string | ❌ | - | Search by currency code or name |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "cm123abc",
      "code": "USD",
      "symbol": "$",
      "name": "US Dollar",
      "exchangeRate": 1.0,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "cm456def",
      "code": "EUR",
      "symbol": "€",
      "name": "Euro",
      "exchangeRate": 0.92,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 2
}
```

---

### 3. Get Active Currencies (Simplified for Dropdowns)

**Endpoint:**
```http
GET /currencies/active
```

**Required Role:** Any authenticated user

**Purpose:** Returns simplified list of active currencies for dropdowns/selection fields

**Response:** `200 OK`
```json
[
  {
    "id": "cm123abc",
    "code": "USD",
    "symbol": "$",
    "name": "US Dollar"
  },
  {
    "id": "cm456def",
    "code": "EUR",
    "symbol": "€",
    "name": "Euro"
  }
]
```

---

### 4. Get Currency by ID

**Endpoint:**
```http
GET /currencies/:id
```

**Required Role:** Any authenticated user

**Response:** `200 OK`
```json
{
  "id": "cm123abc",
  "tenantId": "tenant123",
  "code": "USD",
  "symbol": "$",
  "name": "US Dollar",
  "exchangeRate": 1.0,
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

**Error:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "Currency not found"
}
```

---

### 5. Update Currency

**Endpoint:**
```http
PUT /currencies/:id
```

**Required Role:** `ADMIN` or `USER` (or RBAC `Admin`/`User`)

**Request Body:** (all fields optional)
```json
{
  "symbol": "US$",
  "name": "United States Dollar",
  "exchangeRate": 1.05,
  "isActive": false
}
```

**Note:** `code` field is **immutable** and cannot be updated

**Response:** `200 OK`
```json
{
  "id": "cm123abc",
  "code": "USD",
  "symbol": "US$",
  "name": "United States Dollar",
  "exchangeRate": 1.05,
  "isActive": false,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-16T10:00:00.000Z"
}
```

**Error:** `404 Not Found` if currency doesn't exist

---

### 6. Delete Currency

**Endpoint:**
```http
DELETE /currencies/:id
```

**Required Role:** `ADMIN` only (or RBAC `Admin`)

**Response:** `200 OK`
```json
{
  "message": "Currency deleted successfully"
}
```

**Error Responses:**

**404 Not Found** - Currency doesn't exist
```json
{
  "statusCode": 404,
  "message": "Currency not found"
}
```

**409 Conflict** - Currency is in use
```json
{
  "statusCode": 409,
  "message": "Currency is in use and cannot be deleted",
  "details": "This currency is referenced by contracts, purchase orders, or invoices"
}
```

---

## Page Structure

### Location
**Path:** `/admin/master-data/currencies` or `/admin/configuration/currencies`

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Currencies                                                  │
│  Manage currency codes and exchange rates                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [ + Add Currency ]              [ 🔍 Search... ] [ Filter ⌄]│
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Code │ Symbol │ Name         │ Rate      │ Status │ ⋮ │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ USD  │ $      │ US Dollar    │ 1.000000  │ Active │ ⋮ │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ EUR  │ €      │ Euro         │ 0.920000  │ Active │ ⋮ │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ IDR  │ Rp     │ Rupiah       │ 15750.50  │ Active │ ⋮ │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ GBP  │ £      │ Pound        │ 0.790000  │ Inactive│⋮ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Showing 1-4 of 4 currencies                 [ 1 ] [ 2 ] ... │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Components

### 1. Currency List Table

**Columns:**
- **Code** - 3-letter currency code (e.g., `USD`)
- **Symbol** - Currency symbol (e.g., `$`)
- **Name** - Full currency name (e.g., `US Dollar`)
- **Exchange Rate** - Rate with 6 decimal places (e.g., `1.000000`)
- **Status** - Badge: `Active` (green) or `Inactive` (gray)
- **Actions** - Edit and Delete buttons

**Features:**
- ✅ Search by code or name
- ✅ Filter by active status
- ✅ Sort by any column
- ✅ Pagination (20 items per page)
- ✅ Empty state when no currencies

**Empty State:**
```
┌─────────────────────────────────────────┐
│                                         │
│           💱                            │
│                                         │
│   No currencies configured yet          │
│                                         │
│   Add your first currency to start      │
│   managing exchange rates for           │
│   multi-currency transactions.          │
│                                         │
│   [ + Add Currency ]                    │
│                                         │
└─────────────────────────────────────────┘
```

---

### 2. Create/Edit Currency Modal

**Title:** Add Currency / Edit Currency

**Form Layout:**

```
┌──────────────────────────────────────────────────────┐
│  Add Currency                                [ × ]   │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Currency Code *                                     │
│  ┌────────────────────────────────────────────┐     │
│  │ USD                                        │     │
│  └────────────────────────────────────────────┘     │
│  Must be exactly 3 uppercase letters (e.g., USD)    │
│                                                       │
│  Symbol *                                            │
│  ┌────────────────────────────────────────────┐     │
│  │ $                                          │     │
│  └────────────────────────────────────────────┘     │
│                                                       │
│  Name *                                              │
│  ┌────────────────────────────────────────────┐     │
│  │ US Dollar                                  │     │
│  └────────────────────────────────────────────┘     │
│                                                       │
│  Exchange Rate                                       │
│  ┌────────────────────────────────────────────┐     │
│  │ 1.000000                                   │     │
│  └────────────────────────────────────────────┘     │
│  Rate relative to base currency (max 6 decimals)    │
│                                                       │
│  Status                                              │
│  ┌────────────────┐                                 │
│  │ ☑ Active       │                                 │
│  └────────────────┘                                 │
│                                                       │
│  ───────────────────────────────────────────────    │
│                                                       │
│  [ Cancel ]                          [ Save ]        │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Form Fields:**

1. **Currency Code**
   - Type: Text input (uppercase, 3 chars)
   - Required: Yes
   - Validation: 
     - Exactly 3 characters
     - Only uppercase letters (A-Z)
     - Auto-convert to uppercase
   - Disabled when editing (immutable)
   - Example: `USD`, `EUR`, `IDR`

2. **Symbol**
   - Type: Text input
   - Required: Yes
   - Validation: 1-10 characters
   - Example: `$`, `€`, `Rp`, `¥`

3. **Name**
   - Type: Text input
   - Required: Yes
   - Validation: 1-100 characters
   - Example: `US Dollar`, `Euro`, `Indonesian Rupiah`

4. **Exchange Rate**
   - Type: Number input (decimal)
   - Required: No (optional)
   - Validation:
     - Must be positive (> 0)
     - Max 6 decimal places
   - Default: `1.0`
   - Example: `1.000000`, `15750.50`, `0.920000`

5. **Status (Active)**
   - Type: Checkbox/Toggle
   - Required: No
   - Default: `true` (checked)
   - Label: "Active"

**Validation Rules:**

```typescript
// Client-side validation
const schema = {
  code: {
    required: true,
    pattern: /^[A-Z]{3}$/,
    message: "Currency code must be exactly 3 uppercase letters"
  },
  symbol: {
    required: true,
    minLength: 1,
    maxLength: 10,
    message: "Symbol must be 1-10 characters"
  },
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    message: "Name must be 1-100 characters"
  },
  exchangeRate: {
    required: false,
    min: 0.000001,
    pattern: /^\d+(\.\d{1,6})?$/,
    message: "Exchange rate must be positive with max 6 decimals"
  },
  isActive: {
    required: false,
    type: "boolean"
  }
}
```

**Success Messages:**
- Create: "Currency added successfully"
- Update: "Currency updated successfully"

---

### 3. Delete Confirmation

**Dialog:**
```
┌─────────────────────────────────────────┐
│  Delete Currency                        │
├─────────────────────────────────────────┤
│                                         │
│  Are you sure you want to delete this   │
│  currency?                              │
│                                         │
│  • Code: USD                            │
│  • Name: US Dollar                      │
│                                         │
│  ⚠️  This action cannot be undone.      │
│                                         │
│  If this currency is in use by          │
│  contracts, orders, or invoices, it     │
│  cannot be deleted.                     │
│                                         │
│  [ Cancel ]            [ Delete ]       │
│                                         │
└─────────────────────────────────────────┘
```

**Success:** "Currency deleted successfully"

**Error (409 Conflict):**
```
┌─────────────────────────────────────────┐
│  ❌ Cannot Delete Currency              │
├─────────────────────────────────────────┤
│                                         │
│  This currency is currently in use and  │
│  cannot be deleted.                     │
│                                         │
│  Referenced by:                         │
│  • 5 contracts                          │
│  • 12 purchase orders                   │
│  • 8 invoices                           │
│                                         │
│  Consider marking it as inactive        │
│  instead.                               │
│                                         │
│  [ Mark as Inactive ]      [ Close ]    │
│                                         │
└─────────────────────────────────────────┘
```

---

## TypeScript API Service

```typescript
// services/currency.service.ts

export interface Currency {
  id: string;
  tenantId: string;
  code: string;
  symbol: string;
  name: string;
  exchangeRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCurrencyDto {
  code: string;
  symbol: string;
  name: string;
  exchangeRate?: number;
  isActive?: boolean;
}

export interface UpdateCurrencyDto {
  symbol?: string;
  name?: string;
  exchangeRate?: number;
  isActive?: boolean;
}

export interface ListCurrenciesParams {
  limit?: number;
  offset?: number;
  active?: boolean;
  search?: string;
}

export interface ListCurrenciesResponse {
  data: Currency[];
  total: number;
}

export const currencyService = {
  // List currencies with filters
  list: async (params?: ListCurrenciesParams): Promise<ListCurrenciesResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.active !== undefined) queryParams.append('active', params.active.toString());
    if (params?.search) queryParams.append('search', params.search);

    const { data } = await apiClient.get(`/currencies?${queryParams}`);
    return data;
  },

  // Get active currencies for dropdowns
  getActive: async (): Promise<Currency[]> => {
    const { data } = await apiClient.get('/currencies/active');
    return data;
  },

  // Get currency by ID
  getById: async (id: string): Promise<Currency> => {
    const { data } = await apiClient.get(`/currencies/${id}`);
    return data;
  },

  // Create new currency
  create: async (payload: CreateCurrencyDto): Promise<Currency> => {
    const { data } = await apiClient.post('/currencies', payload);
    return data;
  },

  // Update currency
  update: async (id: string, payload: UpdateCurrencyDto): Promise<Currency> => {
    const { data } = await apiClient.put(`/currencies/${id}`, payload);
    return data;
  },

  // Delete currency
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/currencies/${id}`);
  }
};
```

---

## React Component Example

```typescript
// components/CurrencyManagement.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currencyService } from '@/services/currency.service';

export function CurrencyManagement() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  // Fetch currencies
  const { data, isLoading } = useQuery({
    queryKey: ['currencies', { search, active: activeFilter }],
    queryFn: () => currencyService.list({ search, active: activeFilter })
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: currencyService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['currencies']);
      setIsModalOpen(false);
      toast.success('Currency added successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create currency');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCurrencyDto }) =>
      currencyService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['currencies']);
      setIsModalOpen(false);
      toast.success('Currency updated successfully');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: currencyService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['currencies']);
      toast.success('Currency deleted successfully');
    },
    onError: (error: any) => {
      if (error.response?.status === 409) {
        toast.error('Currency is in use and cannot be deleted');
      } else {
        toast.error('Failed to delete currency');
      }
    }
  });

  const handleSubmit = (formData: CreateCurrencyDto) => {
    if (selectedCurrency) {
      updateMutation.mutate({ id: selectedCurrency.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this currency?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Currencies"
        description="Manage currency codes and exchange rates"
        action={
          <Button onClick={() => {
            setSelectedCurrency(null);
            setIsModalOpen(true);
          }}>
            + Add Currency
          </Button>
        }
      />

      <FilterBar>
        <SearchInput 
          value={search} 
          onChange={setSearch}
          placeholder="Search by code or name..."
        />
        <Select value={activeFilter} onChange={setActiveFilter}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </FilterBar>

      {isLoading ? (
        <LoadingSpinner />
      ) : data?.data.length === 0 ? (
        <EmptyState 
          icon="💱"
          title="No currencies configured yet"
          description="Add your first currency to start managing exchange rates"
          action={<Button onClick={() => setIsModalOpen(true)}>+ Add Currency</Button>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Symbol</th>
              <th>Name</th>
              <th>Exchange Rate</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((currency) => (
              <tr key={currency.id}>
                <td><strong>{currency.code}</strong></td>
                <td>{currency.symbol}</td>
                <td>{currency.name}</td>
                <td>{currency.exchangeRate.toFixed(6)}</td>
                <td>
                  <Badge variant={currency.isActive ? 'success' : 'secondary'}>
                    {currency.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setSelectedCurrency(currency);
                      setIsModalOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDelete(currency.id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <CurrencyModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currency={selectedCurrency}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

---

## Form Validation Example

```typescript
// components/CurrencyForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const currencySchema = z.object({
  code: z.string()
    .length(3, 'Currency code must be exactly 3 characters')
    .regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters')
    .transform(val => val.toUpperCase()),
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol must be at most 10 characters'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  exchangeRate: z.number()
    .positive('Exchange rate must be positive')
    .refine(
      (val) => /^\d+(\.\d{1,6})?$/.test(val.toString()),
      'Exchange rate can have maximum 6 decimal places'
    )
    .optional()
    .default(1.0),
  isActive: z.boolean().optional().default(true)
});

type CurrencyFormData = z.infer<typeof currencySchema>;

export function CurrencyForm({ 
  currency, 
  onSubmit 
}: { 
  currency?: Currency; 
  onSubmit: (data: CurrencyFormData) => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CurrencyFormData>({
    resolver: zodResolver(currencySchema),
    defaultValues: currency || {
      code: '',
      symbol: '',
      name: '',
      exchangeRate: 1.0,
      isActive: true
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Currency Code *</label>
        <input
          {...register('code')}
          disabled={!!currency} // Code is immutable when editing
          placeholder="USD"
          maxLength={3}
          style={{ textTransform: 'uppercase' }}
        />
        {errors.code && <span className="error">{errors.code.message}</span>}
        <small>Must be exactly 3 uppercase letters (e.g., USD, EUR, IDR)</small>
      </div>

      <div>
        <label>Symbol *</label>
        <input {...register('symbol')} placeholder="$" maxLength={10} />
        {errors.symbol && <span className="error">{errors.symbol.message}</span>}
      </div>

      <div>
        <label>Name *</label>
        <input {...register('name')} placeholder="US Dollar" maxLength={100} />
        {errors.name && <span className="error">{errors.name.message}</span>}
      </div>

      <div>
        <label>Exchange Rate</label>
        <input
          {...register('exchangeRate', { valueAsNumber: true })}
          type="number"
          step="0.000001"
          placeholder="1.000000"
        />
        {errors.exchangeRate && <span className="error">{errors.exchangeRate.message}</span>}
        <small>Rate relative to base currency (max 6 decimals)</small>
      </div>

      <div>
        <label>
          <input {...register('isActive')} type="checkbox" />
          Active
        </label>
      </div>

      <div>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit">Save</button>
      </div>
    </form>
  );
}
```

---

## Error Handling

### Common Errors

**1. Duplicate Currency Code (409 Conflict)**
```typescript
if (error.response?.status === 409) {
  toast.error('Currency code already exists. Please use a different code.');
}
```

**2. Validation Error (400 Bad Request)**
```typescript
if (error.response?.status === 400) {
  const message = error.response?.data?.message || 'Invalid input';
  toast.error(message);
}
```

**3. Currency In Use (409 Conflict on Delete)**
```typescript
if (error.response?.status === 409) {
  showDialog({
    title: 'Cannot Delete Currency',
    message: 'This currency is currently in use and cannot be deleted.',
    action: 'Mark as Inactive',
    onAction: () => updateCurrency(id, { isActive: false })
  });
}
```

**4. Not Found (404)**
```typescript
if (error.response?.status === 404) {
  toast.error('Currency not found. It may have been deleted.');
  queryClient.invalidateQueries(['currencies']);
}
```

---

## User Permissions

**View Currencies:** Any authenticated user

**Create/Update Currencies:** `ADMIN`, `USER`, or RBAC `Admin`, `User`

**Delete Currencies:** `ADMIN` or RBAC `Admin` only

**UI Permission Logic:**
```typescript
const { user } = useAuth();
const canEdit = isAdmin(user) || user.role === 'USER';
const canDelete = isAdmin(user);

// Helper function
function isAdmin(user) {
  return user.role === 'ADMIN' || user.rbacRoles?.includes('Admin');
}
```

---

## Testing Checklist

### Functional Tests
- [ ] List displays all currencies
- [ ] Create currency with all required fields
- [ ] Create currency with exchange rate
- [ ] Cannot create duplicate currency code
- [ ] Update currency name, symbol, rate
- [ ] Cannot update currency code (immutable)
- [ ] Toggle currency active status
- [ ] Delete currency (when not in use)
- [ ] Cannot delete currency in use (shows error)
- [ ] Search filters currencies correctly
- [ ] Active filter shows only active/inactive currencies
- [ ] Pagination works correctly

### Validation Tests
- [ ] Code must be exactly 3 uppercase letters
- [ ] Symbol required (1-10 chars)
- [ ] Name required (1-100 chars)
- [ ] Exchange rate must be positive
- [ ] Exchange rate max 6 decimals
- [ ] Form shows inline errors
- [ ] Cannot submit invalid form

### UI Tests
- [ ] Empty state displays correctly
- [ ] Loading states show while fetching
- [ ] Modal opens and closes
- [ ] Success toasts appear
- [ ] Error messages are clear
- [ ] Table sorts correctly
- [ ] Delete confirmation works

### Permission Tests
- [ ] Admin can create/update/delete
- [ ] User can create/update
- [ ] User cannot delete
- [ ] Non-admin blocked from admin actions

---

## Common Currency Codes Reference

| Code | Symbol | Name |
|------|--------|------|
| USD | $ | US Dollar |
| EUR | € | Euro |
| GBP | £ | British Pound |
| JPY | ¥ | Japanese Yen |
| CNY | ¥ | Chinese Yuan |
| IDR | Rp | Indonesian Rupiah |
| SGD | S$ | Singapore Dollar |
| AUD | A$ | Australian Dollar |
| CAD | C$ | Canadian Dollar |
| CHF | Fr | Swiss Franc |
| INR | ₹ | Indian Rupee |
| MYR | RM | Malaysian Ringgit |

---

## Implementation Priority

### Phase 1 - MVP
1. ✅ List currencies table
2. ✅ Create currency modal
3. ✅ Update currency
4. ✅ Delete currency
5. ✅ Basic validation

### Phase 2 - Enhanced
6. ⭐ Search functionality
7. ⭐ Active/inactive filter
8. ⭐ Exchange rate calculator
9. ⭐ Bulk import from CSV
10. ⭐ Currency usage statistics

---

## Summary

**Feature:** Currency Management

**Purpose:** Manage multi-currency support for procurement transactions

**Backend:** ✅ Complete and tested

**Frontend:** ❌ Needs implementation

**Complexity:** Low

**Estimated Effort:** 3-4 hours for MVP

**Dependencies:**
- API client configured
- Admin authentication working (✅ Fixed)
- Table and modal components available

---

**Document Version:** 1.0  
**Last Updated:** 2024-11-19  
**Status:** Ready for Implementation
