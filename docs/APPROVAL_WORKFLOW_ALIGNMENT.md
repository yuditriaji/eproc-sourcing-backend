# Approval Workflow Alignment Analysis

## Current State Analysis

### Existing Approval Infrastructure

The system has the following approval-related infrastructure:

1. **ProcessConfig Model** - Configurable workflow definitions
   - Process types: TENDER, PROCUREMENT, INVOICE, PAYMENT
   - Stores workflow steps with required roles and conditions
   - Links to RBAC configurations

2. **RBAC Configuration**
   - Role-based permissions with org hierarchy support
   - Links to process configurations
   - Flexible permission structures

3. **Existing Approval Methods**
   - PR Approval: `PurchaseRequisitionService.approve()`
   - PO Approval: `PurchaseOrderService.approve()`
   - Invoice Approval: Available in invoice module
   - Payment Approval: Exists in payment processing

### Gap Analysis

#### Contract Status Management
**Current Issue:**
- Contracts transition from DRAFT → IN_PROGRESS via manual update
- No approval workflow for contract activation
- Status changes via direct PATCH endpoint

**Expected Behavior:**
- Contract should go through approval workflow before activation
- Status transitions should be automatic upon approval
- Should support multi-level approval hierarchy

#### Missing Approval Models
The system lacks dedicated approval tracking tables:
- No `Approval` model for tracking approval requests
- No `ApprovalStep` model for multi-level approvals
- No `ApprovalHistory` for audit trail

## Required Workflow Alignment

### 1. Contract Approval Workflow

**Desired Flow:**
```
DRAFT → [Approval Request] → [Manager Approval] → [Finance Approval (if >threshold)] → IN_PROGRESS
```

**Implementation Needs:**
1. Add `approvedAt` and `approvedById` fields to Contract model
2. Create `approveContract()` method in ContractService
3. Add approval workflow endpoint: `POST /:tenant/contracts/:id/approve`
4. Auto-transition to IN_PROGRESS upon approval
5. Support rejection and return to DRAFT

### 2. Complete Procurement Flow with Approvals

**Current State:**
```
Quotation → Contract (manual) → PR → PO → GR → Invoice → Payment
```

**Aligned Flow:**
```
1. Quotation [SUBMITTED] → [Approval] → [ACCEPTED] → Contract Creation
2. Contract [DRAFT] → [Approval] → [IN_PROGRESS] → PR Creation
3. PR [PENDING] → [Approval] → [APPROVED] → PO Creation ✅ (Already working)
4. PO [DRAFT] → [Approval] → [APPROVED] → Goods Receipt ✅ (Already working)
5. Invoice [PENDING] → [Approval] → [APPROVED] → Payment
6. Payment [REQUESTED] → [Approval] → [PROCESSED]
```

### 3. Approval Hierarchy Configuration

**Example Approval Rules:**
```json
{
  "CONTRACT": {
    "thresholds": [
      {
        "maxAmount": 10000,
        "approvers": ["MANAGER"]
      },
      {
        "maxAmount": 50000,
        "approvers": ["MANAGER", "FINANCE"]
      },
      {
        "maxAmount": null,
        "approvers": ["MANAGER", "FINANCE", "ADMIN"]
      }
    ]
  },
  "PR": {
    "thresholds": [
      {
        "maxAmount": 5000,
        "approvers": ["MANAGER"]
      },
      {
        "maxAmount": 25000,
        "approvers": ["MANAGER", "FINANCE"]
      }
    ]
  }
}
```

## Implementation Plan

### Phase 1: Add Contract Approval Infrastructure (Immediate)

**1.1 Update Contract Schema**
```prisma
model Contract {
  // ... existing fields
  approvalStatus  ApprovalStatus?   @default(PENDING)
  approvedAt      DateTime?
  approvedById    String?
  approver        User?             @relation("ContractApprover", fields: [approvedById], references: [id])
  rejectionReason String?
  // ... rest of fields
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}
```

**1.2 Create Contract Approval Method**
```typescript
// ContractService
async approveContract(
  contractId: string,
  approverId: string,
  approved: boolean,
  comments?: string
): Promise<Contract> {
  const contract = await this.findOne(contractId);
  
  if (contract.status !== ContractStatus.DRAFT) {
    throw new BadRequestException('Only draft contracts can be approved');
  }
  
  const updatedContract = await this.prisma.contract.update({
    where: { id: contractId },
    data: {
      approvalStatus: approved ? 'APPROVED' : 'REJECTED',
      approvedById: approverId,
      approvedAt: new Date(),
      status: approved ? ContractStatus.IN_PROGRESS : ContractStatus.DRAFT,
      rejectionReason: !approved ? comments : null,
    },
    include: { owner: true, currency: true, vendors: true },
  });
  
  // Emit approval event
  await this.events.emit('contract.approved', {
    contractId,
    approverId,
    approved,
    contract: updatedContract,
  });
  
  return updatedContract;
}
```

**1.3 Add Controller Endpoint**
```typescript
// ContractController
@Post(':id/approve')
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.APPROVER)
async approveContract(
  @Param('id') id: string,
  @Body() approvalDto: { approved: boolean; comments?: string },
  @Request() req: any,
): Promise<ApiResponse> {
  const contract = await this.contractService.approveContract(
    id,
    req.user.id,
    approvalDto.approved,
    approvalDto.comments,
  );
  
  return {
    success: true,
    statusCode: HttpStatus.OK,
    message: approvalDto.approved 
      ? 'Contract approved and activated' 
      : 'Contract rejected',
    data: contract,
  };
}
```

### Phase 2: Quotation to Contract Flow

**2.1 Add Quotation Approval**
```typescript
async approveQuotation(
  quotationId: string,
  approverId: string,
  approved: boolean,
): Promise<{ quotation: Quotation; contract?: Contract }> {
  const quotation = await this.updateQuotationStatus(
    quotationId,
    approved ? QuotationStatus.ACCEPTED : QuotationStatus.REJECTED,
  );
  
  let contract = null;
  if (approved) {
    // Auto-create contract from accepted quotation
    contract = await this.contractService.create({
      title: `Contract for ${quotation.title}`,
      description: `Generated from quotation ${quotation.quotationNumber}`,
      totalAmount: quotation.totalAmount,
      vendorIds: [quotation.vendorId],
      // ... other fields from quotation
    }, approverId);
  }
  
  return { quotation, contract };
}
```

### Phase 3: Generic Approval System (Future)

Create reusable approval infrastructure:

**3.1 Approval Models**
```prisma
model Approval {
  id              String         @id @default(cuid())
  tenantId        String
  entityType      String         // "Contract", "PR", "PO", "Invoice", "Payment"
  entityId        String
  requesterId     String
  status          ApprovalStatus @default(PENDING)
  requiredSteps   Int            @default(1)
  completedSteps  Int            @default(0)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  requester       User           @relation(fields: [requesterId], references: [id])
  steps           ApprovalStep[]
  
  @@index([tenantId, entityType, entityId])
  @@index([tenantId, status])
}

model ApprovalStep {
  id          String         @id @default(cuid())
  tenantId    String
  approvalId  String
  stepOrder   Int
  approverRole UserRoleEnum
  approverId  String?
  status      ApprovalStatus @default(PENDING)
  approvedAt  DateTime?
  comments    String?
  
  approval    Approval       @relation(fields: [approvalId], references: [id])
  approver    User?          @relation(fields: [approverId], references: [id])
  
  @@unique([approvalId, stepOrder])
  @@index([tenantId, status])
}
```

**3.2 Generic Approval Service**
```typescript
@Injectable()
export class ApprovalService {
  async createApprovalRequest(
    entityType: string,
    entityId: string,
    requesterId: string,
    amount?: number,
  ): Promise<Approval> {
    // Get approval configuration based on entity type and amount
    const config = await this.getApprovalConfig(entityType, amount);
    
    // Create approval with required steps
    const approval = await this.prisma.approval.create({
      data: {
        entityType,
        entityId,
        requesterId,
        requiredSteps: config.steps.length,
        steps: {
          create: config.steps.map((step, index) => ({
            stepOrder: index + 1,
            approverRole: step.role,
            status: 'PENDING',
          })),
        },
      },
      include: { steps: true },
    });
    
    return approval;
  }
  
  async processApproval(
    approvalId: string,
    stepOrder: number,
    approverId: string,
    approved: boolean,
    comments?: string,
  ): Promise<Approval> {
    // Update approval step
    await this.prisma.approvalStep.update({
      where: { approvalId_stepOrder: { approvalId, stepOrder } },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approverId,
        approvedAt: new Date(),
        comments,
      },
    });
    
    // Check if all steps completed
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: { steps: true },
    });
    
    const completedSteps = approval.steps.filter(s => s.status === 'APPROVED').length;
    const rejectedSteps = approval.steps.filter(s => s.status === 'REJECTED').length;
    
    let finalStatus: ApprovalStatus = 'PENDING';
    if (rejectedSteps > 0) {
      finalStatus = 'REJECTED';
    } else if (completedSteps === approval.requiredSteps) {
      finalStatus = 'APPROVED';
    }
    
    // Update approval status
    const updatedApproval = await this.prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: finalStatus,
        completedSteps,
      },
      include: { steps: true },
    });
    
    // Trigger entity status update if fully approved
    if (finalStatus === 'APPROVED') {
      await this.updateEntityStatus(approval.entityType, approval.entityId);
    }
    
    return updatedApproval;
  }
}
```

## Migration Strategy

### Immediate Actions (Quick Wins)

1. **Add Contract Approval Endpoint** (1 day)
   - Add approval method to ContractService
   - Add approval endpoint to ContractController
   - Update TRANSACTION_PROCESS_FLOW.md documentation

2. **Update Documentation** (2 hours)
   - Document contract approval workflow
   - Update API documentation
   - Add approval examples to test files

3. **Update Frontend Guidance** (1 hour)
   - Document that contracts need approval before PR creation
   - Update business portal requirements

### Short-term (1-2 weeks)

1. **Implement Approval Fields** 
   - Add migration for contract approval fields
   - Update contract service with approval logic
   - Add approval endpoints for all entities

2. **Quotation-to-Contract Flow**
   - Implement quotation approval
   - Auto-create contracts from approved quotations

### Long-term (1 month)

1. **Generic Approval System**
   - Create Approval and ApprovalStep models
   - Implement configurable approval hierarchies
   - Support amount-based approval rules
   - Multi-step approval workflows

2. **RBAC Integration**
   - Link approvals to ProcessConfig
   - Support org-level approval routing
   - Implement approval delegation

## Testing Requirements

### Contract Approval Tests
```typescript
describe('Contract Approval Workflow', () => {
  it('should approve contract and change status to IN_PROGRESS', async () => {
    const contract = await createContract({ status: 'DRAFT' });
    const approved = await approveContract(contract.id, managerId, true);
    
    expect(approved.status).toBe('IN_PROGRESS');
    expect(approved.approvalStatus).toBe('APPROVED');
    expect(approved.approvedById).toBe(managerId);
  });
  
  it('should allow PR creation after contract approval', async () => {
    const contract = await createContract({ status: 'DRAFT' });
    await approveContract(contract.id, managerId, true);
    
    const pr = await createPR({ contractId: contract.id });
    expect(pr).toBeDefined();
  });
  
  it('should reject PR creation if contract not approved', async () => {
    const contract = await createContract({ status: 'DRAFT' });
    
    await expect(
      createPR({ contractId: contract.id })
    ).rejects.toThrow('Can only create PRs for active contracts');
  });
});
```

## Summary

**Current Gaps:**
1. ❌ Contract requires manual status update to IN_PROGRESS
2. ❌ No approval workflow for contract activation
3. ❌ Missing Quotation approval flow
4. ❌ No generic approval infrastructure

**What Works:**
1. ✅ PR approval workflow
2. ✅ PO approval workflow
3. ✅ ProcessConfig and RBAC infrastructure
4. ✅ Status transition validation

**Immediate Fix for Your Issue:**
Until approval workflow is implemented, you can:
1. Create contract (status = DRAFT)
2. Approve contract: `POST /contracts/:id/approve` with body `{ "approved": true }`
3. Contract auto-transitions to IN_PROGRESS
4. Create PR from active contract

**Long-term Solution:**
Implement full approval-driven workflow where all status transitions are automated based on hierarchical approvals configured in ProcessConfig and RBAC.
