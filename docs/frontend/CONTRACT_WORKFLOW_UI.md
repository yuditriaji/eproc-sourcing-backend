# Contract Workflow UI Implementation Guide

## Overview
This document provides frontend implementation guidance for the Contract management workflow with approval-driven status transitions.

---

## Workflow States & Progress Tracking

### Contract Lifecycle
```
DRAFT → [Approval Request] → [Manager/Approver Review] → IN_PROGRESS → COMPLETED → CLOSED
                                            ↓
                                        REJECTED (back to DRAFT)
```

### Status Definitions
- **DRAFT**: Newly created, awaiting approval
- **IN_PROGRESS**: Approved and active, can create PRs
- **COMPLETED**: All work finished, ready to close
- **CLOSED**: Contract ended, archived
- **TERMINATED**: Contract cancelled

---

## API Endpoints

### 1. Create Contract
**Endpoint:** `POST /api/v1/{tenant}/contracts`  
**Roles:** ADMIN, BUYER, MANAGER

**Request Body:**
```typescript
interface CreateContractRequest {
  contractNumber?: string;  // Auto-generated if not provided
  title: string;
  description?: string;
  totalAmount?: number;
  currencyId?: string;
  startDate?: string;      // ISO 8601
  endDate?: string;        // ISO 8601
  terms?: Record<string, any>;
  deliverables?: Record<string, any>;
  vendorIds?: string[];    // Vendors to assign
}
```

**Response:**
```typescript
interface ContractResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: {
    id: string;
    contractNumber: string;
    title: string;
    status: 'DRAFT';
    totalAmount?: number;
    ownerId: string;
    approvedAt?: null;
    approvedById?: null;
    rejectionReason?: null;
    createdAt: string;
    updatedAt: string;
  };
}
```

---

### 2. Approve/Reject Contract ✨ NEW
**Endpoint:** `POST /api/v1/{tenant}/contracts/{contractId}/approve`  
**Roles:** ADMIN, MANAGER, APPROVER

**Request Body:**
```typescript
interface ApproveContractRequest {
  approved: boolean;
  comments?: string;
}
```

**Response (Approved):**
```typescript
interface ApprovalResponse {
  success: boolean;
  statusCode: 200;
  message: "Contract approved successfully and activated";
  data: {
    id: string;
    contractNumber: string;
    title: string;
    status: 'IN_PROGRESS';  // Auto-transitioned
    totalAmount: number;
    approvedAt: string;
    approvedById: string;
    approver: {
      id: string;
      firstName: string;
      lastName: string;
      role: string;
    };
    owner: {
      id: string;
      firstName: string;
      lastName: string;
    };
    createdAt: string;
    updatedAt: string;
  };
  meta: {
    nextSteps: [
      "Contract is now IN_PROGRESS",
      "You can now create Purchase Requisitions",
      "Initiate procurement workflows"
    ];
  };
}
```

**Response (Rejected):**
```typescript
{
  success: boolean;
  message: "Contract rejected";
  data: {
    id: string;
    status: 'DRAFT';  // Remains in DRAFT
    approvedAt: string;
    approvedById: string;
    rejectionReason: string;
  };
  meta: {
    nextSteps: [
      "Contract remains in DRAFT status",
      "Requester can revise and resubmit",
      "Address rejection comments"
    ];
  };
}
```

---

### 3. List Contracts
**Endpoint:** `GET /api/v1/{tenant}/contracts?page=1&limit=10&status=DRAFT`  
**Roles:** ADMIN, BUYER, MANAGER, FINANCE, APPROVER

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status
- `ownerId`: Filter by owner (ADMIN/MANAGER only)

---

### 4. Get Contract Details
**Endpoint:** `GET /api/v1/{tenant}/contracts/{contractId}`  
**Roles:** ADMIN, BUYER, MANAGER, FINANCE, APPROVER

---

### 5. Update Contract
**Endpoint:** `PATCH /api/v1/{tenant}/contracts/{contractId}`  
**Roles:** ADMIN, BUYER, MANAGER

**Note:** Only DRAFT contracts can be updated. Use approval endpoint for status changes.

---

## UI Components

### Contract List Page

**Key Features:**
1. **Status Badges:**
   ```typescript
   const statusColors = {
     DRAFT: 'warning',      // Yellow
     IN_PROGRESS: 'success', // Green
     COMPLETED: 'info',     // Blue
     CLOSED: 'default',     // Gray
     TERMINATED: 'error'    // Red
   };
   ```

2. **Action Buttons by Role:**
   ```typescript
   // For DRAFT contracts
   if (contract.status === 'DRAFT') {
     if (isOwner || hasRole(['ADMIN'])) {
       // Show Edit button
     }
     if (hasRole(['ADMIN', 'MANAGER', 'APPROVER'])) {
       // Show Approve/Reject buttons
     }
   }
   
   // For IN_PROGRESS contracts
   if (contract.status === 'IN_PROGRESS') {
     if (hasRole(['ADMIN', 'BUYER', 'MANAGER'])) {
       // Show "Create PR" button
     }
   }
   ```

3. **Filters:**
   - Status dropdown
   - Date range picker
   - Owner filter (ADMIN/MANAGER only)
   - Amount range
   - Search by contract number/title

---

### Contract Detail Page

**Layout Sections:**

1. **Header Section:**
   - Contract number (large, prominent)
   - Title
   - Status badge
   - Action buttons (Approve/Reject/Edit)

2. **Progress Timeline Component:**
   ```typescript
   interface TimelineStep {
     label: string;
     status: 'completed' | 'current' | 'pending' | 'rejected';
     timestamp?: string;
     actor?: {
       name: string;
       role: string;
       avatar?: string;
     };
     description?: string;
   }
   
   const contractTimeline: TimelineStep[] = [
     {
       label: 'Created',
       status: 'completed',
       timestamp: contract.createdAt,
       actor: contract.owner,
       description: 'Contract draft created'
     },
     {
       label: 'Awaiting Approval',
       status: contract.approvedAt ? 'completed' : 'current',
       timestamp: contract.approvedAt,
       actor: contract.approver,
       description: contract.rejectionReason || 'Pending manager review'
     },
     {
       label: 'Active',
       status: contract.status === 'IN_PROGRESS' ? 'completed' : 'pending',
       description: 'Contract activated for procurement'
     },
     {
       label: 'Completed',
       status: contract.status === 'COMPLETED' ? 'completed' : 'pending',
       description: 'All deliverables completed'
     },
     {
       label: 'Closed',
       status: contract.status === 'CLOSED' ? 'completed' : 'pending',
       description: 'Contract archived'
     }
   ];
   ```

3. **Approval Section (for DRAFT contracts):**
   ```tsx
   {contract.status === 'DRAFT' && !contract.approvedAt && (
     <Card>
       <CardHeader>
         <CardTitle>Approval Required</CardTitle>
       </CardHeader>
       <CardContent>
         {hasRole(['ADMIN', 'MANAGER', 'APPROVER']) ? (
           <ApprovalForm 
             contractId={contract.id}
             onApprove={handleApprove}
             onReject={handleReject}
           />
         ) : (
           <Alert>
             <AlertDescription>
               This contract is pending approval from a Manager or Approver.
             </AlertDescription>
           </Alert>
         )}
       </CardContent>
     </Card>
   )}
   
   {contract.status === 'DRAFT' && contract.rejectionReason && (
     <Alert variant="destructive">
       <AlertTitle>Contract Rejected</AlertTitle>
       <AlertDescription>
         <strong>Reason:</strong> {contract.rejectionReason}
         <br />
         <strong>Rejected by:</strong> {contract.approver?.firstName} {contract.approver?.lastName}
         <br />
         <strong>Date:</strong> {formatDate(contract.approvedAt)}
       </AlertDescription>
     </Alert>
   )}
   ```

4. **Contract Details Tabs:**
   - **Overview**: Amount, dates, status, vendors
   - **Terms & Conditions**: Display terms JSON
   - **Deliverables**: Show deliverables with milestones
   - **Related Documents**: PRs, POs, Invoices
   - **Audit Log**: Changes history

5. **Approval History Display:**
   ```tsx
   <Card>
     <CardHeader>
       <CardTitle>Approval History</CardTitle>
     </CardHeader>
     <CardContent>
       {contract.approvedAt && (
         <div className="space-y-2">
           <div className="flex items-center gap-2">
             <Avatar>
               <AvatarFallback>
                 {contract.approver?.firstName?.[0]}
                 {contract.approver?.lastName?.[0]}
               </AvatarFallback>
             </Avatar>
             <div>
               <p className="font-medium">
                 {contract.approver?.firstName} {contract.approver?.lastName}
               </p>
               <p className="text-sm text-muted-foreground">
                 {contract.approver?.role} • {formatDate(contract.approvedAt)}
               </p>
             </div>
           </div>
           <Badge variant={contract.status === 'IN_PROGRESS' ? 'success' : 'destructive'}>
             {contract.rejectionReason ? 'Rejected' : 'Approved'}
           </Badge>
           {contract.rejectionReason && (
             <p className="text-sm">{contract.rejectionReason}</p>
           )}
         </div>
       )}
     </CardContent>
   </Card>
   ```

---

### Contract Create/Edit Form

**Form Fields:**
1. Contract Number (auto-generated or manual)
2. Title (required)
3. Description (textarea)
4. Total Amount
5. Currency (dropdown)
6. Start Date (date picker)
7. End Date (date picker)
8. Vendors (multi-select)
9. Terms & Conditions (JSON editor or form fields)
10. Deliverables (dynamic list with milestones)

**Validation:**
```typescript
const contractSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  totalAmount: z.number().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) < new Date(data.endDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate']
});
```

---

## Approval Workflow Component

### ApprovalForm Component
```tsx
interface ApprovalFormProps {
  contractId: string;
  onApprove: (data: ApprovalData) => Promise<void>;
  onReject: (data: ApprovalData) => Promise<void>;
}

interface ApprovalData {
  approved: boolean;
  comments?: string;
}

function ApprovalForm({ contractId, onApprove, onReject }: ApprovalFormProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const data = { approved: action === 'approve', comments };
      if (action === 'approve') {
        await onApprove(data);
      } else {
        await onReject(data);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={action === 'approve' ? 'default' : 'outline'}
          onClick={() => setAction('approve')}
          disabled={isLoading}
        >
          <CheckIcon className="mr-2 h-4 w-4" />
          Approve
        </Button>
        <Button
          variant={action === 'reject' ? 'destructive' : 'outline'}
          onClick={() => setAction('reject')}
          disabled={isLoading}
        >
          <XIcon className="mr-2 h-4 w-4" />
          Reject
        </Button>
      </div>
      
      {action && (
        <>
          <Textarea
            placeholder={
              action === 'approve'
                ? 'Add approval comments (optional)'
                : 'Provide rejection reason (required)'
            }
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            required={action === 'reject'}
          />
          <Button
            onClick={handleSubmit}
            disabled={isLoading || (action === 'reject' && !comments)}
            className="w-full"
          >
            {isLoading ? 'Processing...' : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
          </Button>
        </>
      )}
    </div>
  );
}
```

---

## State Management

### Redux Slice Example
```typescript
// store/contractSlice.ts
interface ContractState {
  contracts: Contract[];
  currentContract: Contract | null;
  loading: boolean;
  error: string | null;
  filters: {
    status?: ContractStatus;
    ownerId?: string;
    page: number;
    limit: number;
  };
}

// Actions
const contractSlice = createSlice({
  name: 'contracts',
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    // ... other reducers
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContracts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchContracts.fulfilled, (state, action) => {
        state.contracts = action.payload.data;
        state.loading = false;
      })
      .addCase(approveContract.fulfilled, (state, action) => {
        const index = state.contracts.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.contracts[index] = action.payload;
        }
        if (state.currentContract?.id === action.payload.id) {
          state.currentContract = action.payload;
        }
      });
  }
});
```

---

## Error Handling

### Common Error Scenarios

1. **Cannot approve non-DRAFT contract:**
   ```json
   {
     "success": false,
     "statusCode": 400,
     "message": "Only draft contracts can be approved or rejected"
   }
   ```

2. **Already approved:**
   ```json
   {
     "success": false,
     "statusCode": 400,
     "message": "Contract has already been approved or rejected"
   }
   ```

3. **Insufficient permissions:**
   ```json
   {
     "success": false,
     "statusCode": 403,
     "message": "Forbidden"
   }
   ```

**UI Error Display:**
```tsx
{error && (
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}
```

---

## Responsive Design Considerations

### Mobile View
- Stack timeline vertically
- Convert table to cards
- Bottom sheet for approval actions
- Floating action button for create

### Tablet View
- 2-column layout for details
- Compact timeline
- Drawer for filters

### Desktop View
- Full timeline with avatars
- Table view preferred
- Sidebar for filters
- Modal for approval

---

## Accessibility

1. **Screen Reader Support:**
   - Proper ARIA labels on status badges
   - Timeline with role="list"
   - Form labels and descriptions

2. **Keyboard Navigation:**
   - Tab through approval buttons
   - Enter to submit approval
   - Escape to cancel

3. **Color Contrast:**
   - Status badges meet WCAG AA
   - Error messages clearly visible

---

## Performance Optimization

1. **List Virtualization:**
   - Use react-virtual for long contract lists

2. **Caching:**
   - Cache contract details for 5 minutes
   - Invalidate on approval/update

3. **Optimistic Updates:**
   - Update UI immediately on approval
   - Rollback on error

---

## Next Steps After Contract Approval

Once contract is IN_PROGRESS, display:
```tsx
<Alert variant="success">
  <CheckCircle className="h-4 w-4" />
  <AlertTitle>Contract Active</AlertTitle>
  <AlertDescription>
    This contract is now active and ready for procurement workflows.
    <div className="mt-2 flex gap-2">
      <Button size="sm" onClick={() => navigate(`/procurement/requisitions/create?contractId=${contract.id}`)}>
        Create Purchase Requisition
      </Button>
      <Button size="sm" variant="outline" onClick={() => navigate(`/tenders/create?contractId=${contract.id}`)}>
        Create Tender
      </Button>
    </div>
  </AlertDescription>
</Alert>
```
