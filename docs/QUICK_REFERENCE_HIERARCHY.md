# Quick Reference: Transaction Hierarchy

## Summary

✅ **MongoDB BidDocument is CORRECTLY used for Tender/Bid workflow, NOT Quotations**

---

## Two Procurement Workflows

### Workflow 1: RFQ/Quotation (Direct Sourcing)
**When to use:** Quick procurement, known vendors, standard items, <$50K

```
RFQ → Quotation → Contract → PR → PO → GR → Invoice → Payment
     (simple)     (approval)
                  
🗄️ PostgreSQL only (simple documents via Document table)
```

### Workflow 2: Tender/Bid (Competitive Bidding)
**When to use:** Large value, complex requirements, formal process, >$50K

```
Contract → Tender → Bid → PR → PO → GR → Invoice → Payment
(approval)         (MongoDB docs)

🗄️ PostgreSQL (metadata) + 🍃 MongoDB (encrypted bid documents)
```

---

## Why MongoDB for Bids, Not Quotations?

### Bids (Tender Workflow) = Complex & Secure 🔒
- Technical proposals (100+ pages)
- Financial statements
- Compliance certificates
- Legal documents
- Company credentials
- **Requires:** Encryption, audit trail, access control

### Quotations (RFQ Workflow) = Simple 📄
- Price lists
- Basic terms
- Simple attachments
- **Sufficient:** PostgreSQL Document table

---

## Data Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL (Prisma)                    │
│                    All Transactional Data                   │
├─────────────────────────────────────────────────────────────┤
│ • Users, Vendors, Contracts                                 │
│ • RFQ (to be implemented)                                   │
│ • Quotations (with simple Document attachments)             │
│ • Tenders, Bids (metadata: scores, status)                  │
│ • PRs, POs, GRs, Invoices, Payments                         │
│ • Documents (metadata: filename, size, type)                │
└─────────────────────────────────────────────────────────────┘

                            ↕️
                    (Bid documents only)

┌─────────────────────────────────────────────────────────────┐
│                    MongoDB (Mongoose)                       │
│              Encrypted Sensitive Documents                  │
├─────────────────────────────────────────────────────────────┤
│ • BidDocument Collection                                    │
│   - Technical proposals (encrypted)                         │
│   - Commercial proposals (encrypted)                        │
│   - Financial documents (encrypted)                         │
│   - Legal certificates (encrypted)                          │
│   - AES-256-GCM encryption                                  │
│   - Per-tenant encryption keys                              │
│   - SHA-256 checksums                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Hierarchy Visual

```
WORKFLOW 1: RFQ → QUOTATION → CONTRACT
═══════════════════════════════════════════════════════════════

   [RFQ]                [Quotation]            [Contract]
   MISSING              PostgreSQL             PostgreSQL
     │                       │                      │
     ├─ rfqNumber            ├─ quotationNumber    ├─ contractNumber
     ├─ items[]             ├─ rfqId (optional)   ├─ totalAmount
     ├─ targetVendors[]     ├─ vendorId           ├─ status: DRAFT
     └─ validUntil          ├─ amount             │   ↓ (approve)
                            ├─ items[]            └─ IN_PROGRESS
                            └─ status: SUBMITTED
                                ↓ (accept)
                            Creates Contract ────────┘


WORKFLOW 2: CONTRACT → TENDER → BID
═══════════════════════════════════════════════════════════════

   [Contract]             [Tender]              [Bid]
   PostgreSQL             PostgreSQL            PostgreSQL + MongoDB
     │                       │                      │
     ├─ contractNumber       ├─ tenderNumber        ├─ PostgreSQL:
     ├─ totalAmount          ├─ contractId REQ!    │  ├─ bidId
     ├─ status: DRAFT        ├─ requirements{}     │  ├─ tenderId
     │   ↓ (approve)         ├─ criteria{}         │  ├─ vendorId
     └─ IN_PROGRESS          ├─ status: DRAFT      │  ├─ scores
           │                 │   ↓ (publish)       │  └─ status
           └─────────────→   └─ PUBLISHED          │
                Creates           │                 └─ MongoDB:
                Tender ───────────┘                    ├─ BidDocument
                                  Vendors submit          ├─ technical.pdf 🔒
                                  Bids ──────────────→    ├─ financial.xlsx 🔒
                                                          ├─ legal.pdf 🔒
                                                          └─ encrypted!


BOTH WORKFLOWS MERGE HERE:
═══════════════════════════════════════════════════════════════

[PR]          [PO]          [GR]        [Invoice]     [Payment]
PostgreSQL    PostgreSQL    PostgreSQL  PostgreSQL    PostgreSQL
   │             │             │            │             │
   ├─ prNumber   ├─ poNumber   ├─ receipt   ├─ invoice    ├─ payment
   ├─ contract   ├─ prId       ├─ poId      ├─ poId       ├─ invoiceId
   ├─ items      ├─ contract   ├─ received  ├─ amount     ├─ amount
   ├─ amount     ├─ vendors    ├─ quantity  ├─ status:    └─ status:
   └─ status:    └─ status:    └─ status:      SUBMITTED     PENDING
      PENDING       DRAFT         PARTIAL       ↓              ↓
      ↓ (approve)   ↓ (approve)   ↓          APPROVED      COMPLETED
      APPROVED      APPROVED      COMPLETED     ↓
                    ↓ (issue)                  Ready for
                    ISSUED                     Payment ────────┘
```

---

## Approval Gates

```
┌─────────────────────────────────────────────────────────────┐
│                      APPROVAL CHECKPOINTS                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Contract Approval (MANAGER/APPROVER)                       │
│     ├─ DRAFT → IN_PROGRESS                                  │
│     └─ Required before: Tender creation OR PR creation      │
│                                                              │
│  PR Approval (MANAGER/APPROVER)                             │
│     ├─ PENDING → APPROVED                                   │
│     ├─ Budget check                                         │
│     └─ Required before: PO creation                         │
│                                                              │
│  PO Approval (MANAGER/APPROVER)                             │
│     ├─ DRAFT → APPROVED → ISSUED                            │
│     ├─ Budget commitment                                    │
│     └─ Required before: Sending to vendor                   │
│                                                              │
│  Invoice Approval (FINANCE/MANAGER/APPROVER)                │
│     ├─ SUBMITTED → APPROVED                                 │
│     ├─ Three-way match (PO-GR-Invoice)                      │
│     └─ Required before: Payment                             │
│                                                              │
│  Payment Approval (FINANCE - dual approval)                 │
│     ├─ PENDING → COMPLETED                                  │
│     └─ Releases budget commitment                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Business Rules

### Tender/Bid Flow
1. ✅ Contract MUST be approved (IN_PROGRESS) before tender creation
2. ✅ Tender MUST be published before vendors can bid
3. ✅ Bid documents automatically encrypted in MongoDB
4. ✅ Bids scored against evaluation criteria
5. ✅ Tender awarded to highest-scoring bid

### RFQ/Quotation Flow
1. ✅ RFQ sent to targeted vendors only
2. ✅ Vendors submit quotations with pricing
3. ✅ Buyer accepts ONE winning quotation
4. ✅ Contract auto-created from accepted quotation
5. ✅ Contract requires approval before PR creation

### Common Rules (Both Workflows)
1. ✅ All amounts: Contract ≥ PR ≥ PO ≥ GR ≥ Invoice ≥ Payment
2. ✅ Budget checks at PR and PO stages
3. ✅ Three-way match: PO ↔ GR ↔ Invoice
4. ✅ Each step requires previous step completion
5. ✅ Full audit trail for all transactions

---

## Status State Machines

```
Contract:  DRAFT ──approve──> IN_PROGRESS ──complete──> COMPLETED

Tender:    DRAFT ──publish──> PUBLISHED ──close──> CLOSED ──award──> AWARDED

Bid:       DRAFT ──submit──> SUBMITTED ──evaluate──> EVALUATED ──┬──> AWARDED
                                                                   └──> REJECTED

PR:        PENDING ──approve──> APPROVED
                   └──reject──> REJECTED

PO:        DRAFT ──approve──> APPROVED ──issue──> ISSUED ──receive──> DELIVERED

Invoice:   DRAFT ──submit──> SUBMITTED ──approve──> APPROVED ──pay──> PAID

Payment:   PENDING ──process──> PROCESSING ──complete──> COMPLETED
                                           └──fail──> FAILED
```

---

## Implementation Status

### ✅ Working
- Contract CRUD & approval
- Tender CRUD (needs validation fix)
- Bid submission with MongoDB encryption
- PR/PO/GR/Invoice/Payment workflows
- Quotation CRUD

### 🚧 Needs Fix
- Tender creation validation (must check contract = IN_PROGRESS)
- Quotation acceptance endpoint (create contract from quotation)

### ❌ Missing
- RFQ entity and endpoints
- RFQ → Quotation workflow
- Quotation comparison tools

---

## Quick Decision Tree

```
Do you need formal competitive bidding?
│
├─ YES → Use Tender/Bid Workflow
│   ├─ Create & approve Contract
│   ├─ Create Tender from Contract
│   ├─ Publish Tender
│   ├─ Vendors submit Bids (MongoDB documents)
│   ├─ Evaluate & award
│   └─ Continue with PR → PO → ...
│
└─ NO → Use RFQ/Quotation Workflow
    ├─ Create RFQ
    ├─ Vendors submit Quotations
    ├─ Accept winning Quotation
    ├─ Contract auto-created (needs approval)
    └─ Continue with PR → PO → ...
```

---

## MongoDB BidDocument Fields Reference

```javascript
{
  // Indexing
  tenantId: "tenant_123",           // Tenant isolation
  bidId: "bid_456",                 // Link to PostgreSQL bid
  vendorId: "vendor_789",           // Vendor who uploaded
  tenderId: "tender_101",           // Related tender
  
  // Document info
  documentType: "technical",        // technical|commercial|financial|legal
  fileName: "proposal.pdf",
  originalName: "Technical Proposal v2.pdf",
  mimeType: "application/pdf",
  fileSize: 5242880,                // bytes
  
  // Security
  encryptedContent: "base64...",    // AES-256-GCM encrypted
  encryptionAlgorithm: "aes-256-gcm",
  initializationVector: "hex...",
  authTag: "hex...",
  checksum: "sha256...",            // Integrity check
  isEncrypted: true,
  
  // Status
  isSubmitted: true,
  submittedAt: "2025-01-15T10:30:00Z",
  
  // Audit
  uploadedBy: "vendor_789",
  uploadedAt: "2025-01-15T10:25:00Z",
  lastAccessedAt: "2025-01-15T14:20:00Z",
  lastAccessedBy: "user_123"
}
```

---

## For Frontend Teams

### API Endpoints by Workflow

**RFQ/Quotation:**
```
POST   /rfq                              Create RFQ [MISSING]
POST   /quotations                       Submit quotation
POST   /workflows/quotation/:id/accept   Accept & create contract [MISSING]
POST   /contracts/:id/approve            Approve contract
```

**Tender/Bid:**
```
POST   /contracts                        Create contract
POST   /contracts/:id/approve            Approve contract
POST   /workflows/tender/create/:id      Create tender from contract
POST   /workflows/tender/publish/:id     Publish tender
POST   /bids                             Submit bid (+ MongoDB upload)
POST   /workflows/tender/award/:id       Award tender
```

**Common (Both):**
```
POST   /purchase-requisitions            Create PR
POST   /purchase-requisitions/:id/approve Approve PR
POST   /purchase-orders                  Create PO
POST   /purchase-orders/:id/approve      Approve PO
POST   /goods-receipts                   Record GR
POST   /invoices                         Create invoice
POST   /invoices/:id/approve             Approve invoice
POST   /payments                         Create payment
POST   /payments/:id/process             Process payment
```

---

## Conclusion

✅ **The system architecture is CORRECT:**
- PostgreSQL handles all transactional data
- MongoDB handles encrypted bid documents ONLY (Tender/Bid workflow)
- Quotations use simple PostgreSQL Document table
- Two workflows merge at PR stage
- Clear approval hierarchy enforced throughout

📚 **Full details in:** `docs/END_TO_END_TRANSACTION_FLOW.md`
