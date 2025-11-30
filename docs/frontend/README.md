# Frontend Implementation Guides - Index

## Overview
This directory contains comprehensive frontend implementation guides for all workflows in the e-procurement system. Each guide provides API endpoints, UI components, state management patterns, and approval hierarchy displays.

---

## Document Structure

### 1. [Contract Workflow](./CONTRACT_WORKFLOW_UI.md) ✅
**Complete approval-driven contract management**
- Contract creation (DRAFT status)
- Approval/rejection workflow with ADMIN, MANAGER, APPROVER roles
- Auto status transition: DRAFT → IN_PROGRESS upon approval
- Timeline component with approval history
- Related: PR creation depends on IN_PROGRESS contracts

**Key Endpoints:**
- `POST /contracts` - Create contract
- `POST /contracts/:id/approve` - Approve/reject ✨ NEW
- `GET /contracts` - List with filters
- `GET /contracts/:id` - Details
- `PATCH /contracts/:id` - Update

---

### 2. [Purchase Requisition Workflow](./PR_WORKFLOW_UI.md) 🚧
**PR creation and approval process**
- Create PR from active contracts (IN_PROGRESS)
- Multi-level approval hierarchy display
- Status tracking: PENDING → APPROVED → PO Creation
- Rejection handling with feedback loop

**Key Endpoints:**
- `POST /workflows/procurement/create-pr/:contractId`
- `POST /workflows/procurement/approve-pr/:prId`
- `GET /purchase-requisitions`
- `GET /purchase-requisitions/:id`

---

### 3. [Purchase Order Workflow](./PO_WORKFLOW_UI.md) 🚧
**PO creation and approval from PRs**
- Create PO from approved PR
- Vendor assignment
- Multi-level approval based on amount thresholds
- Goods receipt tracking

**Key Endpoints:**
- `POST /workflows/procurement/create-po/:prId`
- `POST /workflows/procurement/approve-po/:poId`
- `POST /workflows/procurement/goods-receipt/:poId`
- `GET /purchase-orders`

---

### 4. [Tender Workflow](./TENDER_WORKFLOW_UI.md) 🚧
**Complete tender lifecycle**
- Tender creation from contracts
- Publishing workflow
- Bid submission (vendor role)
- Bid evaluation and scoring
- Tender award process

**Key Endpoints:**
- `POST /workflows/tender/create/:contractId`
- `POST /workflows/tender/publish/:tenderId`
- `POST /workflows/tender/submit-bid/:tenderId` (VENDOR)
- `POST /workflows/tender/evaluate-bid/:bidId`
- `POST /workflows/tender/award/:tenderId/:bidId`

---

### 5. [Invoice & Payment Workflow](./INVOICE_PAYMENT_UI.md) 🚧
**Financial workflow completion**
- Invoice creation from goods receipts
- Invoice approval (FINANCE, MANAGER)
- Payment processing
- Payment status tracking

**Key Endpoints:**
- `POST /invoices`
- `PUT /invoices/:id/approve`
- `POST /payments`
- `GET /invoices`, `GET /payments`

---

### 6. [Unified Approval Queue](./APPROVAL_QUEUE_UI.md) 🚧
**Cross-workflow approval management**
- Single interface for all pending approvals
- Filter by entity type (Contract, PR, PO, Invoice, Payment)
- Approval hierarchy visualization
- Bulk approval actions

**Key Features:**
- Role-based filtering (MANAGER, APPROVER, FINANCE)
- Real-time updates
- Approval history
- Delegation support

---

### 7. [Workflow Status Tracker Component](./WORKFLOW_STATUS_TRACKER.md) 🚧
**Reusable progress tracking component**
- Visual timeline with stages
- Approval actor display (name, role, avatar)
- Status indicators (completed, current, pending, rejected)
- Mobile-responsive design

**Usage:**
```tsx
<WorkflowStatusTracker
  entity="contract"
  entityId={contractId}
  stages={contractStages}
  approvalHistory={approvalHistory}
/>
```

---

## Common Patterns Across All Workflows

### 1. Status Badge Component
```typescript
const statusColors = {
  // Pending states
  DRAFT: 'warning',
  PENDING: 'warning',
  SUBMITTED: 'info',
  
  // Active states
  IN_PROGRESS: 'success',
  PUBLISHED: 'success',
  APPROVED: 'success',
  
  // Completed states
  COMPLETED: 'info',
  CLOSED: 'default',
  AWARDED: 'success',
  
  // Negative states
  REJECTED: 'destructive',
  CANCELLED: 'default',
  TERMINATED: 'destructive'
};
```

### 2. Approval Hierarchy Display
All approval workflows should display:
- **Current Approver**: Name, role, avatar
- **Approval Status**: Pending, approved, rejected
- **Timestamp**: When action was taken
- **Comments**: Approval/rejection notes
- **Next Approver**: If multi-level approval

Example component structure:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Approval Status</CardTitle>
  </CardHeader>
  <CardContent>
    <Timeline>
      {approvalSteps.map(step => (
        <TimelineItem key={step.id}>
          <TimelineIcon status={step.status} />
          <TimelineContent>
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarImage src={step.approver?.avatar} />
                <AvatarFallback>{step.approver?.initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{step.approver?.name}</p>
                <p className="text-sm text-muted">{step.approver?.role}</p>
              </div>
            </div>
            <p className="text-sm mt-1">{step.description}</p>
            {step.timestamp && (
              <p className="text-xs text-muted-foreground">
                {formatDate(step.timestamp)}
              </p>
            )}
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  </CardContent>
</Card>
```

### 3. Role-Based Action Buttons
```typescript
function getAvailableActions(entity: any, userRole: string, userId: string) {
  const actions: Action[] = [];
  
  // Owner actions
  if (entity.ownerId === userId || entity.requesterId === userId) {
    if (entity.status === 'DRAFT') {
      actions.push({ label: 'Edit', action: 'edit' });
      actions.push({ label: 'Delete', action: 'delete', variant: 'destructive' });
    }
  }
  
  // Approval actions
  if (hasRole(['ADMIN', 'MANAGER', 'APPROVER'])) {
    if (entity.status === 'PENDING' || entity.status === 'DRAFT') {
      if (!entity.approvedAt) {
        actions.push({ label: 'Approve', action: 'approve', variant: 'default' });
        actions.push({ label: 'Reject', action: 'reject', variant: 'outline' });
      }
    }
  }
  
  // Next workflow actions
  if (entity.status === 'APPROVED' || entity.status === 'IN_PROGRESS') {
    actions.push({ label: 'Next Step', action: 'next', variant: 'default' });
  }
  
  return actions;
}
```

### 4. API Integration Pattern
```typescript
// API slice structure
export const workflowApi = createApi({
  reducerPath: 'workflowApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Contract', 'PR', 'PO', 'Tender', 'Bid', 'Invoice', 'Payment'],
  endpoints: (builder) => ({
    // List endpoint
    getContracts: builder.query({
      query: ({ tenant, ...params }) => ({
        url: `/${tenant}/contracts`,
        params,
      }),
      providesTags: ['Contract'],
    }),
    
    // Create endpoint
    createContract: builder.mutation({
      query: ({ tenant, ...body }) => ({
        url: `/${tenant}/contracts`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Contract'],
    }),
    
    // Approve endpoint
    approveContract: builder.mutation({
      query: ({ tenant, id, ...body }) => ({
        url: `/${tenant}/contracts/${id}/approve`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Contract'],
    }),
  }),
});
```

### 5. Error Handling
```tsx
function ErrorDisplay({ error }: { error: ApiError }) {
  const getErrorMessage = (error: ApiError) => {
    if ('data' in error && error.data) {
      return error.data.message || 'An error occurred';
    }
    return 'Network error. Please try again.';
  };
  
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{getErrorMessage(error)}</AlertDescription>
    </Alert>
  );
}
```

---

## State Management Structure

### Redux Store Organization
```
store/
├── index.ts                    # Root store configuration
├── authSlice.ts               # Authentication state
├── api/
│   ├── contractApi.ts         # Contract endpoints
│   ├── procurementApi.ts      # PR & PO endpoints
│   ├── tenderApi.ts           # Tender & bid endpoints
│   ├── financeApi.ts          # Invoice & payment endpoints
│   └── workflowApi.ts         # Workflow orchestration
└── slices/
    ├── contractSlice.ts       # Contract local state
    ├── procurementSlice.ts    # PR/PO local state
    ├── approvalSlice.ts       # Approval queue state
    └── notificationSlice.ts   # Real-time notifications
```

---

## Component Library Structure

### Recommended Component Organization
```
components/
├── business/                   # Business portal components
│   ├── contracts/
│   │   ├── ContractList.tsx
│   │   ├── ContractDetail.tsx
│   │   ├── ContractForm.tsx
│   │   └── ContractApproval.tsx
│   ├── procurement/
│   │   ├── PRList.tsx
│   │   ├── PRDetail.tsx
│   │   ├── PRForm.tsx
│   │   ├── POList.tsx
│   │   └── PODetail.tsx
│   ├── approvals/
│   │   ├── ApprovalQueue.tsx
│   │   ├── ApprovalCard.tsx
│   │   └── ApprovalForm.tsx
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── WorkflowTimeline.tsx
│       ├── ApprovalHistory.tsx
│       └── ActionButtons.tsx
└── vendor/                     # Vendor portal components
    ├── tenders/
    ├── bids/
    └── shared/
```

---

## Testing Guidelines

### Unit Tests
- Component rendering with different states
- Role-based conditional rendering
- Form validation
- Error handling

### Integration Tests
- API call success/failure flows
- Optimistic updates and rollback
- Navigation after actions
- Real-time updates

### E2E Tests
- Complete workflow from creation to approval
- Multi-role approval scenarios
- Error recovery
- Mobile responsiveness

---

## Accessibility Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Proper ARIA labels on status indicators
- [ ] Screen reader announcements for state changes
- [ ] Focus management for modals and drawers
- [ ] Color contrast meets WCAG AA standards
- [ ] Alternative text for icons and images
- [ ] Form error messages associated with inputs

---

## Performance Considerations

1. **List Virtualization**: For lists > 100 items
2. **Lazy Loading**: Route-based code splitting
3. **Image Optimization**: Use Next.js Image component
4. **API Caching**: RTK Query automatic caching
5. **Debounced Search**: 300ms delay for search inputs
6. **Optimistic Updates**: Immediate UI feedback
7. **Pagination**: Server-side pagination for large datasets

---

## Mobile Responsiveness

### Breakpoints
```typescript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Ultra-wide
};
```

### Mobile Patterns
- Bottom sheets for actions
- Swipe gestures for navigation
- Floating action buttons
- Collapsible sections
- Tab navigation over sidebars

---

## Next Steps

1. ✅ **Contract Workflow** - Complete
2. 🚧 **Purchase Requisition Workflow** - In Progress
3. 🚧 **Purchase Order Workflow** - Pending
4. 🚧 **Tender Workflow** - Pending
5. 🚧 **Invoice & Payment Workflow** - Pending
6. 🚧 **Approval Queue** - Pending
7. 🚧 **Workflow Status Tracker** - Pending

---

## Support & Questions

For implementation questions or clarifications:
1. Check the specific workflow guide
2. Review TRANSACTION_PROCESS_FLOW.md for API details
3. Check RBAC_ROLES_PERMISSIONS.md for role requirements
4. Review BUSINESS_PORTAL_READINESS.md for feature overview
