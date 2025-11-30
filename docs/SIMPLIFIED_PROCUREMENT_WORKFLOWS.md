# Simplified Procurement Workflows (Final Implementation)

## Overview
This document describes the **actual implemented workflows** without RFQ. The system uses existing Quotation entities which can work standalone.

---

## Two Procurement Workflows

### Workflow 1: Quotation → Contract → PR → PO (Direct Sourcing)
**Use case:** Quick procurement, known vendors, standard items, <$50K

```
┌──────────────┐
│ Vendor       │
│ Submits      │ ← Vendor creates quotation (standalone or from tender)
│ Quotation    │
└──────┬───────┘
       │
┌──────▼───────┐
│ Buyer        │
│ Compares     │ ← Buyer reviews multiple quotations
│ Quotations   │
└──────┬───────┘
       │
┌──────▼───────┐
│ Accept       │ ← POST /workflows/quotation/:id/accept
│ Quotation    │
└──────┬───────┘
       │
┌──────▼───────┐
│ Contract     │ ← Auto-created, status = DRAFT
│ Created      │
└──────┬───────┘
       │
┌──────▼───────┐
│ Approve      │ ← POST /contracts/:id/approve
│ Contract     │    (MANAGER/APPROVER)
└──────┬───────┘
       │ status = IN_PROGRESS
       │
┌──────▼───────┐
│   PR → PO    │ ← Standard procurement flow
│   → GR →     │
│   Invoice →  │
│   Payment    │
└──────────────┘
```

### Workflow 2: Contract → Tender → Bid → PR → PO (Competitive Bidding)
**Use case:** Large contracts, formal requirements, >$50K

```
┌──────────────┐
│ Create       │
│ Contract     │ ← POST /contracts (BUYER/MANAGER)
└──────┬───────┘
       │
┌──────▼───────┐
│ Approve      │ ← POST /contracts/:id/approve
│ Contract     │    (MANAGER/APPROVER)
└──────┬───────┘
       │ status = IN_PROGRESS (REQUIRED!)
       │
┌──────▼───────┐
│ Create       │ ← POST /workflows/tender/create/:contractId
│ Tender       │    ⚠️ NOW VALIDATES contract status = IN_PROGRESS
└──────┬───────┘
       │
┌──────▼───────┐
│ Publish      │ ← POST /workflows/tender/publish/:tenderId
│ Tender       │
└──────┬───────┘
       │
┌──────▼───────┐
│ Vendors      │ ← POST /workflows/tender/submit-bid/:tenderId
│ Submit Bids  │    + MongoDB encrypted documents
└──────┬───────┘
       │
┌──────▼───────┐
│ Close &      │ ← POST /workflows/tender/close/:tenderId
│ Evaluate     │    POST /workflows/tender/evaluate-bid/:bidId
│ Bids         │
└──────┬───────┘
       │
┌──────▼───────┐
│ Award        │ ← POST /workflows/tender/award/:tenderId
│ Tender       │
└──────┬───────┘
       │
┌──────▼───────┐
│   PR → PO    │ ← Standard procurement flow
│   → GR →     │
│   Invoice →  │
│   Payment    │
└──────────────┘
```

---

## Key Implementation Changes

### ✅ **What Was Fixed**

#### 1. Tender Creation Validation (CRITICAL FIX)
**File:** `src/modules/workflow/workflow.service.ts`

**Before:**
```typescript
async createTenderFromContract(contractId, tenderData, userId) {
  // No validation - allowed tender creation from ANY contract
  const tender = await this.prisma.tender.create({ ... });
}
```

**After:**
```typescript
async createTenderFromContract(contractId, tenderData, userId) {
  // CRITICAL: Verify contract is approved
  const contract = await this.prisma.contract.findUnique({ 
    where: { id: contractId } 
  });
  
  if (contract.status !== ContractStatus.IN_PROGRESS) {
    return {
      success: false,
      message: "Contract must be approved (IN_PROGRESS) before creating tenders",
      nextSteps: ["Approve the contract first", "Then retry tender creation"]
    };
  }
  
  // Now create tender...
}
```

#### 2. Quotation Acceptance Workflow (NEW FEATURE)
**File:** `src/modules/workflow/workflow.service.ts`

**New Method:**
```typescript
async acceptQuotation(quotationId, userId, contractDetails?) {
  // 1. Get quotation with vendor details
  const quotation = await this.prisma.quotation.findUnique({ ... });
  
  // 2. Validate quotation status
  if (quotation.status === "ACCEPTED" || quotation.status === "REJECTED") {
    return { success: false, message: "Invalid quotation status" };
  }
  
  // 3. Create contract from quotation
  const contract = await this.prisma.contract.create({
    data: {
      contractNumber: await this.generateContractNumber(),
      title: contractDetails?.title || `Contract for ${quotation.quotationNumber}`,
      totalAmount: quotation.amount,
      currencyId: quotation.currencyId,
      status: ContractStatus.DRAFT, // Requires approval!
      ownerId: userId,
      terms: contractDetails?.terms || quotation.terms,
      deliverables: contractDetails?.deliverables || quotation.items,
    }
  });
  
  // 4. Link vendor to contract
  await this.prisma.contractVendor.create({ ... });
  
  // 5. Update quotation status to ACCEPTED
  await this.prisma.quotation.update({ 
    where: { id: quotationId },
    data: { status: "ACCEPTED" }
  });
  
  // 6. Reject other quotations (if from same tender)
  if (quotation.tenderId) {
    await this.prisma.quotation.updateMany({
      where: { tenderId: quotation.tenderId, id: { not: quotationId } },
      data: { status: "REJECTED" }
    });
  }
  
  return {
    success: true,
    message: "Quotation accepted and contract created",
    nextSteps: [
      "Contract created in DRAFT status",
      "Review and approve the contract",
      "Once approved, you can create Purchase Requisitions"
    ],
    data: { quotation, contract }
  };
}
```

**New Endpoint:**
```typescript
// File: src/modules/workflow/workflow.controller.ts

@Post("quotation/accept/:quotationId")
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
async acceptQuotation(
  @Param("quotationId") quotationId: string,
  @Body() contractDetails?: { ... },
  @Request() req: any
): Promise<ApiResponse> {
  const result = await this.workflowService.acceptQuotation(
    quotationId,
    req.user.id,
    contractDetails
  );
  // Return result...
}
```

---

## Complete API Reference

### Quotation Workflow APIs
```
POST   /{tenant}/quotations                         Create quotation (VENDOR)
GET    /{tenant}/quotations                         List quotations
GET    /{tenant}/quotations/:id                     Get quotation details
POST   /{tenant}/workflows/quotation/accept/:id    Accept & create contract ✅ NEW
POST   /{tenant}/contracts/:id/approve             Approve contract
```

### Tender/Bid Workflow APIs
```
POST   /{tenant}/contracts                          Create contract
POST   /{tenant}/contracts/:id/approve              Approve contract
POST   /{tenant}/workflows/tender/create/:contractId Create tender ✅ FIXED
POST   /{tenant}/workflows/tender/publish/:id       Publish tender
POST   /{tenant}/workflows/tender/submit-bid/:id    Submit bid (VENDOR)
POST   /{tenant}/workflows/tender/close/:id         Close tender
POST   /{tenant}/workflows/tender/evaluate-bid/:id  Evaluate bid
POST   /{tenant}/workflows/tender/award/:id         Award tender
```

### Common Procurement APIs
```
POST   /{tenant}/workflows/procurement/create-pr/:contractId  Create PR
POST   /{tenant}/workflows/procurement/approve-pr/:id         Approve PR
POST   /{tenant}/workflows/procurement/create-po/:prId        Create PO
POST   /{tenant}/purchase-orders/:id/approve                  Approve PO
POST   /{tenant}/workflows/procurement/goods-receipt/:poId    Record GR
POST   /{tenant}/invoices                                     Create invoice
POST   /{tenant}/invoices/:id/approve                         Approve invoice
POST   /{tenant}/payments                                     Create payment
POST   /{tenant}/payments/:id/process                         Process payment
```

---

## Usage Examples

### Example 1: Quotation Workflow

```bash
# Step 1: Vendor submits quotation
POST /{tenant}/quotations
{
  "vendorId": "vendor_123",
  "amount": 5500.00,
  "currencyId": "usd_id",
  "items": [
    { "itemCode": "LAPTOP-001", "quantity": 10, "unitPrice": 550 }
  ],
  "validUntil": "2025-02-28T23:59:59Z",
  "notes": "Bulk discount applied"
}

# Step 2: Buyer accepts quotation
POST /{tenant}/workflows/quotation/accept/{quotationId}
{
  "title": "Laptop Purchase Contract - Vendor ABC",
  "startDate": "2025-02-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "terms": { "paymentTerms": "Net 30" }
}

# Response:
{
  "success": true,
  "message": "Quotation accepted and contract created successfully",
  "data": {
    "quotation": {
      "id": "quo_123",
      "status": "ACCEPTED"
    },
    "contract": {
      "id": "con_456",
      "contractNumber": "CON-202502-0001",
      "status": "DRAFT",
      "totalAmount": 5500.00
    }
  },
  "meta": {
    "nextSteps": [
      "Contract created in DRAFT status",
      "Review and approve the contract",
      "Once approved, you can create Purchase Requisitions"
    ]
  }
}

# Step 3: Manager approves contract
POST /{tenant}/contracts/{contractId}/approve
{
  "approved": true,
  "comments": "Approved for laptop purchase"
}

# Step 4: Continue with PR → PO → ...
POST /{tenant}/workflows/procurement/create-pr/{contractId}
```

### Example 2: Tender/Bid Workflow

```bash
# Step 1: Create contract
POST /{tenant}/contracts
{
  "contractNumber": "FW-CON-2025-001",
  "title": "Cloud Services Framework",
  "totalAmount": 3000000.00,
  "startDate": "2025-01-01",
  "endDate": "2027-12-31"
}

# Step 2: Approve contract
POST /{tenant}/contracts/{contractId}/approve
{
  "approved": true,
  "comments": "Framework approved"
}

# Step 3: Create tender (NOW VALIDATES contract status!)
POST /{tenant}/workflows/tender/create/{contractId}
{
  "title": "Cloud Infrastructure Q1 2025",
  "description": "Call-off for Q1 2025 cloud services",
  "requirements": { "technical": ["99.99% SLA"], "compliance": ["GDPR"] },
  "criteria": {
    "technical": { "weight": 60, "maxScore": 100 },
    "commercial": { "weight": 30, "maxScore": 100 }
  },
  "estimatedValue": 250000.00,
  "closingDate": "2025-03-15T17:00:00Z"
}

# If contract not approved, you get:
{
  "success": false,
  "message": "Cannot create tender from contract with status DRAFT. Contract must be approved (IN_PROGRESS) before creating tenders.",
  "meta": {
    "nextSteps": [
      "Approve the contract first",
      "Contract status must be IN_PROGRESS",
      "Then retry tender creation"
    ]
  }
}

# Step 4: Continue with publish → bids → evaluate → award → PR → PO
```

---

## Business Rules

### Quotation Flow
1. ✅ Vendors can create quotations (standalone or linked to tender)
2. ✅ Buyer reviews and compares quotations
3. ✅ Buyer accepts ONE quotation
4. ✅ System creates contract in DRAFT status
5. ✅ Other quotations auto-rejected (if from same tender)
6. ✅ Contract requires approval before PR creation
7. ✅ Simple document attachments via Document table (no encryption needed)

### Tender/Bid Flow
1. ✅ Contract MUST exist and be IN_PROGRESS before tender creation (NOW ENFORCED)
2. ✅ Tender published to all eligible vendors
3. ✅ Vendors submit bids with MongoDB encrypted documents
4. ✅ Tender closed on deadline
5. ✅ Bids evaluated and scored
6. ✅ Tender awarded to highest-scoring bid
7. ✅ Continue with standard procurement flow

### Common Rules
1. ✅ All amounts: Contract ≥ PR ≥ PO ≥ GR ≥ Invoice ≥ Payment
2. ✅ Budget checks at PR and PO stages
3. ✅ Three-way match: PO ↔ GR ↔ Invoice
4. ✅ Full audit trail for all transactions
5. ✅ Role-based access control enforced throughout

---

## MongoDB BidDocument Usage

**CONFIRMED:** MongoDB is ONLY used for Tender/Bid workflow, NOT quotations.

### When MongoDB is Used:
- ✅ Formal tender bids with sensitive documents
- ✅ Technical proposals (100+ pages)
- ✅ Financial statements
- ✅ Compliance certificates
- ✅ Legal documents
- ✅ AES-256-GCM encryption
- ✅ Per-tenant encryption keys

### When PostgreSQL Document Table is Used:
- ✅ Quotation attachments (simple price lists)
- ✅ Simple supporting documents
- ✅ Non-sensitive file storage

---

## Testing Scenarios

### Test 1: Quotation → Contract Flow
```
1. Login as VENDOR
2. Create quotation with items and pricing
3. Login as BUYER
4. Review quotation
5. Accept quotation via POST /workflows/quotation/accept/:id
6. Verify contract created with DRAFT status
7. Verify quotation status = ACCEPTED
8. Login as MANAGER
9. Approve contract
10. Verify contract status = IN_PROGRESS
11. Create PR from contract
12. Continue standard flow (PR → PO → GR → Invoice → Payment)
```

### Test 2: Contract → Tender → Bid Flow
```
1. Login as BUYER
2. Create framework contract
3. Try to create tender (should FAIL - contract not approved)
4. Login as MANAGER
5. Approve contract (status = IN_PROGRESS)
6. Login as BUYER
7. Create tender from contract (should SUCCESS)
8. Publish tender
9. Login as VENDOR1
10. Submit bid with MongoDB documents
11. Login as VENDOR2
12. Submit bid with MongoDB documents
13. Login as BUYER
14. Close tender
15. Evaluate and score bids
16. Award tender to winning bid
17. Create PR from contract
18. Continue standard flow (PR → PO → GR → Invoice → Payment)
```

---

## Migration Notes

### What Changed from Previous Documentation

#### ❌ Removed:
- RFQ entity (not implemented, not essential)
- RFQ endpoints
- RFQ → Quotation workflow dependency

#### ✅ Added:
- Direct quotation acceptance workflow
- Quotation → Contract auto-creation
- Tender creation validation (contract status check)

#### ✅ Clarified:
- Quotations work standalone (tenderId is optional)
- MongoDB only for Tender/Bid, not Quotations
- Two distinct workflows that merge at PR stage

---

## Conclusion

The system now has **two complete, validated procurement workflows**:

1. **Quotation → Contract** (Direct sourcing, informal)
2. **Contract → Tender → Bid** (Competitive bidding, formal)

Both workflows:
- ✅ Enforce business rules
- ✅ Validate status transitions
- ✅ Auto-create necessary entities
- ✅ Provide clear next steps
- ✅ Emit audit events
- ✅ Merge at PR stage for standard fulfillment

**No RFQ needed** - quotations work standalone!
