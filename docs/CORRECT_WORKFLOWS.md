# CORRECT Procurement Workflows

## Critical Correction

**TENDER COMES BEFORE CONTRACT, NOT AFTER!**

---

## Two Procurement Workflows

### Workflow 1: Quotation → Contract (Informal, Direct Sourcing)
**Use case:** Quick procurement, known vendors, <$50K

```
Vendor Submits Quotation
         ↓
Buyer Reviews & Compares
         ↓
Accept Quotation
         ↓
CREATE CONTRACT (DRAFT)
         ↓
Approve Contract
         ↓
Contract (IN_PROGRESS)
         ↓
PR → PO → GR → Invoice → Payment
```

**Key Points:**
- Quotations submitted standalone (no tender required)
- Buyer accepts ONE quotation
- **Contract created FROM accepted quotation**
- Contract requires approval before PR

---

### Workflow 2: Tender → Bid → Contract (Formal, Competitive Bidding)
**Use case:** Large value, complex requirements, formal process, >$50K

```
CREATE TENDER (standalone, no contract needed)
         ↓
Publish Tender
         ↓
Vendors Submit Bids (+ MongoDB encrypted docs)
         ↓
Close Tender
         ↓
Evaluate Bids (score against criteria)
         ↓
Award Tender to Winning Bid
         ↓
CREATE CONTRACT FROM WINNING BID (DRAFT)
         ↓
Approve Contract
         ↓
Contract (IN_PROGRESS)
         ↓
PR → PO → GR → Invoice → Payment
```

**Key Points:**
- Tender created FIRST (standalone, contractId is optional/null initially)
- Vendors submit bids with MongoDB encrypted documents
- Formal evaluation with scoring matrix
- **Contract created FROM awarded bid**
- Tender.contractId gets populated AFTER contract creation
- Contract requires approval before PR

---

## Schema Relationships (CORRECT Understanding)

### Tender Model
```prisma
model Tender {
  id          String
  contractId  String?  // OPTIONAL - gets populated AFTER award
  // ... other fields
  contract    Contract? @relation(...)
  bids        Bid[]
}
```

**Tender.contractId is OPTIONAL:**
- `null` when tender is created
- Gets populated when tender is awarded (contract created)
- Tender can exist WITHOUT a contract

### Contract Model
```prisma
model Contract {
  id       String
  status   ContractStatus  // DRAFT → IN_PROGRESS → COMPLETED
  // ... other fields
  tenders  Tender[]  // Contracts can have multiple tenders
}
```

**Contract can be created from:**
1. Accepted Quotation (Workflow 1)
2. Awarded Tender/Bid (Workflow 2)

---

## Correct API Flow

### Workflow 1: Quotation → Contract
```bash
# 1. Vendor creates quotation
POST /{tenant}/quotations
{
  "vendorId": "vendor_123",
  "amount": 5500,
  "items": [...]
}

# 2. Buyer accepts quotation → Creates contract
POST /{tenant}/workflows/quotation/accept/{quotationId}
Response: { contract: { id, status: "DRAFT" } }

# 3. Manager approves contract
POST /{tenant}/contracts/{contractId}/approve
Response: { status: "IN_PROGRESS" }

# 4. Create PR from approved contract
POST /{tenant}/workflows/procurement/create-pr/{contractId}
```

### Workflow 2: Tender → Bid → Contract
```bash
# 1. Create tender (NO contract required!)
POST /{tenant}/tenders
{
  "title": "Cloud Services Tender",
  "requirements": {...},
  "criteria": {...},
  "estimatedValue": 250000,
  "closingDate": "2025-03-15"
}
# Note: contractId is null/optional

# 2. Publish tender
POST /{tenant}/workflows/tender/publish/{tenderId}

# 3. Vendors submit bids
POST /{tenant}/workflows/tender/submit-bid/{tenderId}
# MongoDB: Encrypted technical/financial/legal documents uploaded

# 4. Close tender
POST /{tenant}/workflows/tender/close/{tenderId}

# 5. Evaluate bids
POST /{tenant}/workflows/tender/evaluate-bid/{bidId}
{
  "technicalScore": 85,
  "commercialScore": 90
}

# 6. Award tender → Creates contract
POST /{tenant}/workflows/tender/award/{tenderId}
Body: { "winningBidId": "bid_123" }

Response:
{
  "success": true,
  "message": "Tender awarded successfully and contract created",
  "data": {
    "bid": {...},
    "contract": {
      "id": "con_456",
      "contractNumber": "CON-202502-001",
      "status": "DRAFT"  // Requires approval!
    }
  },
  "meta": {
    "nextSteps": [
      "Contract created in DRAFT status",
      "Review and approve the contract",
      "Once approved, create Purchase Requisitions"
    ]
  }
}

# 7. Manager approves contract
POST /{tenant}/contracts/{contractId}/approve

# 8. Create PR from approved contract
POST /{tenant}/workflows/procurement/create-pr/{contractId}
```

---

## What Was Fixed

### ❌ WRONG Implementation (What I did initially):
```typescript
// WRONG: Requiring contract BEFORE tender
async createTenderFromContract(contractId) {
  const contract = await getContract(contractId);
  if (contract.status !== 'IN_PROGRESS') {
    throw Error("Contract must be approved first");
  }
  // Create tender...
}
```

### ✅ CORRECT Implementation (Current):
```typescript
// CORRECT: Tender created standalone
async createTender(tenderData) {
  const tender = await this.prisma.tender.create({
    data: {
      ...tenderData,
      contractId: null,  // No contract yet!
      status: 'DRAFT'
    }
  });
}

// Contract created AFTER award
async awardTender(tenderId, winningBidId) {
  // 1. Mark bid as accepted
  const winningBid = await markBidAccepted(winningBidId);
  
  // 2. CREATE CONTRACT from winning bid
  const contract = await this.prisma.contract.create({
    data: {
      title: `Contract for Tender: ${tender.title}`,
      totalAmount: winningBid.bidAmount,
      status: 'DRAFT',
      terms: tender.requirements,
      deliverables: winningBid.technicalProposal
    }
  });
  
  // 3. Link vendor to contract
  await linkVendorToContract(contract.id, winningBid.vendorId);
  
  // 4. Update tender with contractId
  await this.prisma.tender.update({
    where: { id: tenderId },
    data: { contractId: contract.id }
  });
  
  return { contract, bid: winningBid };
}
```

---

## MongoDB Usage (Correct)

**MongoDB BidDocument** is used ONLY for Tender/Bid workflow:

### When Vendor Submits Bid:
```
1. Vendor uploads documents via bid submission
2. Documents stored in MongoDB with encryption:
   - Technical proposal PDFs
   - Financial statements
   - Legal certificates
   - Compliance documents
3. AES-256-GCM encryption applied
4. Per-tenant encryption keys
5. Checksum for integrity verification
```

### NOT used for Quotations:
- Quotations use simple PostgreSQL Document table
- No encryption needed for price lists
- Informal process

---

## Business Logic Flow

### Tender/Bid Workflow States:

```
TENDER STATES:
DRAFT → PUBLISHED → CLOSED → AWARDED

BID STATES:
DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED/REJECTED

CONTRACT STATES (created AFTER award):
DRAFT → IN_PROGRESS → COMPLETED
```

### Timeline:
```
Day 1:  Create & Publish Tender (no contract)
Day 2-14: Vendors submit bids (MongoDB documents)
Day 15: Close tender
Day 16-20: Evaluate bids (scoring)
Day 21: Award tender → CREATE CONTRACT (DRAFT)
Day 22: Approve contract → IN_PROGRESS
Day 23+: Create PR → PO → ... standard procurement
```

---

## Key Differences from Initial Understanding

| Aspect | WRONG (Initial) | CORRECT (Current) |
|--------|-----------------|-------------------|
| **Tender Creation** | Required approved contract | Standalone, no contract |
| **Contract Creation** | Before tender | AFTER bid award |
| **Tender.contractId** | Required | Optional, populated later |
| **Contract Source** | Manual creation | Auto from quotation/bid |
| **Validation** | Contract status check | No contract needed |

---

## Testing Scenarios

### Test 1: Quotation Workflow
```
1. VENDOR creates quotation
2. BUYER accepts quotation
3. Verify contract created (DRAFT)
4. MANAGER approves contract
5. Verify contract (IN_PROGRESS)
6. Create PR from contract
```

### Test 2: Tender/Bid Workflow (CORRECT)
```
1. USER creates tender (NO CONTRACT)
2. Publish tender
3. VENDOR1 submits bid + MongoDB docs
4. VENDOR2 submits bid + MongoDB docs
5. USER closes tender
6. USER evaluates bids (scores)
7. USER awards tender to winning bid
8. Verify contract created (DRAFT) ✅
9. Verify tender.contractId populated ✅
10. MANAGER approves contract
11. Verify contract (IN_PROGRESS)
12. Create PR from contract
```

---

## Summary of Correct Flow

### Two Ways to Create Contracts:

**1. From Quotation (Informal)**
```
Quotation → Accept → CREATE Contract
```

**2. From Tender/Bid (Formal)**
```
Tender → Bid → Award → CREATE Contract
```

### Both converge at:
```
Contract (DRAFT) → Approve → IN_PROGRESS → PR → PO → GR → Invoice → Payment
```

---

## Apology & Correction

I apologize for the initial confusion. The CORRECT understanding is:

✅ **Tender is created FIRST (standalone)**  
✅ **Contract is created AFTER award**  
✅ **Tender.contractId is optional and populated after award**  
✅ **No contract validation needed for tender creation**

The schema design `contractId String?` (optional) was the clue that tender comes BEFORE contract, not after.
