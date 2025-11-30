# End-to-End Transaction Process Flow

## Document Purpose
This document provides a comprehensive view of the complete transaction hierarchy and data flow for both procurement workflows, clarifying where each entity lives (PostgreSQL vs MongoDB) and how they interact.

---

## Data Architecture Overview

### PostgreSQL (Prisma) - Transactional Data
All business entities and their relationships:
- Users, Vendors, Contracts
- Tenders, Bids (metadata only)
- Quotations
- Purchase Requisitions, Purchase Orders
- Goods Receipts, Invoices, Payments
- Documents (metadata only)

### MongoDB (Mongoose) - Document Storage
Encrypted, large document storage:
- **BidDocument** - Technical, commercial, financial, legal documents for Tender/Bid submissions
- Future: Could store contract PDFs, invoice attachments, etc.

---

## Complete Transaction Hierarchies

### Hierarchy 1: RFQ → Quotation → Contract → PR → PO → GR → Invoice → Payment

```
┌────────────────────────────────────────────────────────────────────┐
│                    RFQ/QUOTATION WORKFLOW                          │
│                   (Direct Sourcing Process)                        │
└────────────────────────────────────────────────────────────────────┘

1. RFQ (Request for Quotation) [MISSING - TO BE IMPLEMENTED]
   ├── Storage: PostgreSQL
   ├── Created by: BUYER, MANAGER
   ├── Purpose: Request price quotes from selected vendors
   ├── Fields:
   │   ├── rfqNumber
   │   ├── title, description
   │   ├── items[] (specifications)
   │   ├── targetVendors[] (invited vendors)
   │   ├── validUntil
   │   └── status: DRAFT → OPEN → CLOSED
   └── Relations:
       └── hasMany Quotations

2. Quotation [EXISTS - PostgreSQL]
   ├── Storage: PostgreSQL (prisma.quotation)
   ├── Submitted by: VENDOR
   ├── Purpose: Vendor's price proposal in response to RFQ
   ├── Fields:
   │   ├── quotationNumber
   │   ├── rfqId (optional - can be standalone)
   │   ├── vendorId
   │   ├── amount, currencyId
   │   ├── items[] (with pricing)
   │   ├── validUntil
   │   ├── terms, notes
   │   └── status: SUBMITTED → ACCEPTED | REJECTED
   ├── Relations:
   │   ├── belongsTo RFQ (optional)
   │   ├── belongsTo Vendor
   │   └── belongsTo Currency
   └── Documents: Simple attachments (Document table), NO MongoDB encryption needed

3. Contract (from Quotation) [EXISTS]
   ├── Created when: Buyer accepts winning quotation
   ├── Endpoint: POST /workflows/quotation/{id}/accept [TO BE IMPLEMENTED]
   ├── Initial Status: DRAFT
   ├── Approval Required: Yes
   ├── Approval Flow:
   │   ├── MANAGER/APPROVER reviews
   │   ├── POST /contracts/{id}/approve
   │   └── Status: DRAFT → IN_PROGRESS
   └── After approval: Can create PR

4-8. [Same as Tender workflow below: PR → PO → GR → Invoice → Payment]

┌────────────────────────────────────────────────────────────────────┐
│                     TRANSACTION AMOUNTS                            │
├────────────────────────────────────────────────────────────────────┤
│ Contract: Master amount                                            │
│ PR: Requested amount (≤ contract.totalAmount)                      │
│ PO: Committed amount (≤ PR.estimatedAmount)                        │
│ GR: Received quantity × PO unit price                              │
│ Invoice: Billed amount (≤ GR received value)                       │
│ Payment: Actual payment (≤ invoice.totalAmount)                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### Hierarchy 2: Contract → Tender → Bid → PR → PO → GR → Invoice → Payment

```
┌────────────────────────────────────────────────────────────────────┐
│                    TENDER/BID WORKFLOW                             │
│              (Competitive Bidding Process)                         │
└────────────────────────────────────────────────────────────────────┘

1. Contract (Framework) [EXISTS - PostgreSQL]
   ├── Storage: PostgreSQL (prisma.contract)
   ├── Created by: BUYER, MANAGER
   ├── Purpose: Master/framework agreement BEFORE tender
   ├── Fields:
   │   ├── contractNumber
   │   ├── title, description
   │   ├── totalAmount, currencyId
   │   ├── startDate, endDate
   │   ├── terms, deliverables
   │   ├── status: DRAFT → IN_PROGRESS → COMPLETED
   │   ├── approvedAt, approvedById [NEW]
   │   └── rejectionReason [NEW]
   ├── Relations:
   │   ├── hasMany Tenders
   │   ├── hasMany PurchaseRequisitions
   │   └── hasMany ContractVendors
   ├── Approval Flow:
   │   ├── POST /contracts/{id}/approve
   │   ├── Roles: MANAGER, APPROVER, ADMIN
   │   └── On approval: status → IN_PROGRESS
   └── Business Rule: MUST be IN_PROGRESS before creating tenders

2. Tender [EXISTS - PostgreSQL]
   ├── Storage: PostgreSQL (prisma.tender)
   ├── Created by: USER, BUYER, MANAGER (from approved contract)
   ├── Purpose: Formal RFP/ITT for competitive bidding
   ├── Fields:
   │   ├── tenderNumber
   │   ├── contractId (REQUIRED - link to framework)
   │   ├── title, description
   │   ├── requirements{} (technical, commercial, compliance)
   │   ├── criteria{} (evaluation matrix with weights)
   │   ├── estimatedValue
   │   ├── publishedAt, closingDate, evaluationDate, awardDate
   │   ├── department, category
   │   └── status: DRAFT → PUBLISHED → CLOSED → AWARDED
   ├── Relations:
   │   ├── belongsTo Contract (MUST exist)
   │   ├── hasMany Bids
   │   └── hasMany Quotations (can also have informal quotes)
   ├── Lifecycle:
   │   ├── 1. Create from contract
   │   ├── 2. Publish (vendors can now bid)
   │   ├── 3. Vendors submit bids before closingDate
   │   ├── 4. Close tender
   │   ├── 5. Evaluate bids
   │   └── 6. Award to winning bidder
   └── Validation: POST /workflows/tender/create/{contractId}
       └── MUST verify contract.status === 'IN_PROGRESS'

3. Bid [EXISTS - PostgreSQL + MongoDB]
   ├── Metadata Storage: PostgreSQL (prisma.bid)
   ├── Document Storage: MongoDB (BidDocument collection)
   ├── Submitted by: VENDOR
   ├── Purpose: Formal competitive proposal
   │
   ├── PostgreSQL Bid Table:
   │   ├── id, tenantId
   │   ├── tenderId (REQUIRED)
   │   ├── vendorId
   │   ├── technicalScore, commercialScore, totalScore
   │   ├── bidAmount
   │   ├── status: DRAFT → SUBMITTED → EVALUATED → AWARDED | REJECTED
   │   ├── submittedAt
   │   ├── encryptedData (sensitive proposal data)
   │   ├── keyVersion (for encryption)
   │   ├── technicalProposal{}, financialProposal{}, compliance{}
   │   ├── evaluationNotes, evaluatedAt, evaluatedBy
   │   └── Relations:
   │       ├── belongsTo Tender
   │       ├── belongsTo Vendor
   │       └── hasMany Documents (metadata)
   │
   └── MongoDB BidDocument Collection:
       ├── Purpose: Encrypted document storage for sensitive bid files
       ├── Schema:
       │   ├── tenantId (indexed)
       │   ├── bidId (link to PostgreSQL bid)
       │   ├── vendorId (indexed)
       │   ├── tenderId (indexed)
       │   ├── documentType: 'technical' | 'commercial' | 'financial' | 'legal'
       │   ├── fileName, originalName, mimeType, fileSize
       │   ├── encryptedContent (AES-256-GCM encrypted file)
       │   ├── encryptionAlgorithm, initializationVector, authTag
       │   ├── filePath (file system path)
       │   ├── checksum (SHA-256 for integrity)
       │   ├── isEncrypted, isSubmitted, submittedAt
       │   ├── uploadedBy, uploadedAt
       │   └── lastAccessedAt, lastAccessedBy
       ├── Security:
       │   ├── Per-tenant encryption keys (tenantId-derived)
       │   ├── AES-256-GCM authenticated encryption
       │   ├── Pre-save hook auto-encrypts content
       │   └── SHA-256 checksum for tamper detection
       ├── Indexes:
       │   ├── {tenantId, bidId, documentType}
       │   ├── {tenantId, vendorId, tenderId}
       │   └── {tenantId, isSubmitted, submittedAt}
       └── Use Cases:
           ├── Technical proposal PDFs
           ├── Financial statements
           ├── Compliance certificates
           ├── Legal agreements
           └── Company credentials

4. Purchase Requisition (PR) [EXISTS - PostgreSQL]
   ├── Storage: PostgreSQL (prisma.purchaseRequisition)
   ├── Created by: BUYER (after tender awarded OR from quotation contract)
   ├── Purpose: Internal request to purchase
   ├── Fields:
   │   ├── prNumber
   │   ├── contractId (link to contract)
   │   ├── title, description, justification
   │   ├── items[] (what to buy)
   │   ├── estimatedAmount
   │   ├── requiredBy (date)
   │   ├── requesterId
   │   └── status: PENDING → APPROVED | REJECTED
   ├── Approval Flow:
   │   ├── POST /purchase-requisitions/{id}/approve
   │   ├── Roles: MANAGER, APPROVER
   │   ├── Fields: approvedById, approvedAt, rejectionReason
   │   └── After approval: Can create PO
   └── Budget Control:
       ├── Links to Budget entity
       └── Validates available budget before approval

5. Purchase Order (PO) [EXISTS - PostgreSQL]
   ├── Storage: PostgreSQL (prisma.purchaseOrder)
   ├── Created by: BUYER (from approved PR)
   ├── Purpose: Official order to vendor
   ├── Fields:
   │   ├── poNumber
   │   ├── prId (link to PR)
   │   ├── contractId (inherited from PR)
   │   ├── title, description
   │   ├── amount, taxAmount, totalAmount, currencyId
   │   ├── orderDate, expectedDelivery
   │   ├── items[], terms
   │   ├── createdById
   │   └── status: DRAFT → APPROVED → ISSUED → DELIVERED → INVOICED
   ├── Approval Flow:
   │   ├── POST /purchase-orders/{id}/approve
   │   ├── Roles: MANAGER, APPROVER
   │   ├── Fields: approvedById, approvedAt
   │   └── After approval: Sent to vendor
   ├── Budget Commitment:
   │   ├── budgetId (allocated budget)
   │   ├── transferTraceId (budget transfer tracking)
   │   └── totalCommitted (amount committed from budget)
   └── Relations:
       ├── belongsTo PurchaseRequisition
       ├── belongsTo Contract
       ├── hasMany POVendors (vendor assignments)
       └── hasMany GoodsReceipts

6. Goods Receipt (GR) [EXISTS - PostgreSQL]
   ├── Storage: PostgreSQL (prisma.goodsReceipt)
   ├── Created by: BUYER (when goods/services received)
   ├── Purpose: Confirm receipt of goods
   ├── Fields:
   │   ├── receiptNumber
   │   ├── poId (link to PO)
   │   ├── receivedDate
   │   ├── receivedItems[] (quantity, condition)
   │   ├── notes, inspectionNotes
   │   ├── inspectedBy, inspectedAt
   │   └── status: PARTIAL → COMPLETED
   ├── Validation:
   │   ├── Received quantity ≤ PO ordered quantity
   │   └── Quality inspection may be required
   └── Triggers:
       └── Updates PO status to DELIVERED when all items received

7. Invoice [EXISTS - PostgreSQL]
   ├── Storage: PostgreSQL (prisma.invoice)
   ├── Created by: VENDOR or BUYER (on vendor's behalf)
   ├── Purpose: Bill for delivered goods/services
   ├── Fields:
   │   ├── invoiceNumber
   │   ├── poId (link to PO)
   │   ├── vendorId
   │   ├── amount, taxAmount, totalAmount, currencyId
   │   ├── dueDate
   │   ├── items[] (billed items)
   │   ├── terms
   │   └── status: DRAFT → SUBMITTED → APPROVED → PAID
   ├── Approval Flow:
   │   ├── POST /invoices/{id}/approve
   │   ├── Roles: FINANCE, MANAGER, APPROVER
   │   ├── Validation: Matches GR and PO
   │   └── After approval: Ready for payment
   └── Three-Way Match:
       ├── Invoice amount ≤ GR received value
       ├── Invoice items match PO items
       └── No discrepancies in quantities/prices

8. Payment [EXISTS - PostgreSQL]
   ├── Storage: PostgreSQL (prisma.payment)
   ├── Created by: FINANCE (from approved invoice)
   ├── Purpose: Pay vendor
   ├── Fields:
   │   ├── paymentNumber
   │   ├── invoiceId (link to invoice)
   │   ├── amount, currencyId
   │   ├── paymentDate
   │   ├── paymentMethod (bank transfer, check, etc.)
   │   ├── transactionReference
   │   ├── processedBy
   │   └── status: PENDING → PROCESSING → COMPLETED | FAILED
   ├── Approval Flow:
   │   ├── POST /payments/{id}/approve
   │   ├── Roles: FINANCE (dual approval may be required)
   │   └── After approval: Payment executed
   ├── Budget Release:
   │   └── Releases committed budget from PO
   └── Audit Trail:
       ├── Full payment history
       ├── Bank transaction reference
       └── Reconciliation status

┌────────────────────────────────────────────────────────────────────┐
│                     STATUS TRANSITIONS                             │
├────────────────────────────────────────────────────────────────────┤
│ Contract:  DRAFT → IN_PROGRESS → COMPLETED                        │
│ Tender:    DRAFT → PUBLISHED → CLOSED → AWARDED                   │
│ Bid:       DRAFT → SUBMITTED → EVALUATED → AWARDED/REJECTED       │
│ PR:        PENDING → APPROVED/REJECTED                             │
│ PO:        DRAFT → APPROVED → ISSUED → DELIVERED → INVOICED       │
│ GR:        PARTIAL → COMPLETED                                     │
│ Invoice:   DRAFT → SUBMITTED → APPROVED → PAID                    │
│ Payment:   PENDING → PROCESSING → COMPLETED/FAILED                │
└────────────────────────────────────────────────────────────────────┘
```

---

## Key Clarifications

### ✅ MongoDB BidDocument is CORRECT
**MongoDB BidDocument** belongs to **Tender/Bid workflow**, NOT Quotations.

**Why?**
1. **Tenders are formal** - Require extensive documentation (technical specs, financial statements, legal certificates)
2. **Security requirements** - Bid documents are sensitive and need encryption
3. **Document types** - Technical, commercial, financial, legal proposals
4. **Compliance** - Audit trail, access tracking, tamper detection

**Quotations are simpler:**
- Usually just price lists and basic terms
- Can use Document table for simple attachments
- Don't require encryption or complex security
- Less formal process

### Data Storage Decision Matrix

| Entity | PostgreSQL | MongoDB | Reason |
|--------|-----------|---------|--------|
| **RFQ** | ✅ | ❌ | Transactional, relational |
| **Quotation** | ✅ | ❌ | Simple structure, no encryption needed |
| **Contract** | ✅ | ❌ | Master data, relationships |
| **Tender** | ✅ | ❌ | Transactional, relational |
| **Bid (metadata)** | ✅ | ❌ | Scores, status, relationships |
| **Bid Documents** | ❌ | ✅ | Large files, encryption, security |
| **PR, PO, GR** | ✅ | ❌ | Transactional |
| **Invoice** | ✅ | ❌ | Financial records |
| **Payment** | ✅ | ❌ | Financial records |

---

## Approval Hierarchy

### Contract Approval
```
User (BUYER) creates → MANAGER/APPROVER reviews → APPROVED
└─> Contract status: DRAFT → IN_PROGRESS
```

### PR Approval
```
User (BUYER) creates → MANAGER/APPROVER reviews → Budget check → APPROVED
└─> PR status: PENDING → APPROVED
```

### PO Approval
```
User (BUYER) creates → MANAGER/APPROVER reviews → Budget commitment → APPROVED
└─> PO status: DRAFT → APPROVED → ISSUED (sent to vendor)
```

### Invoice Approval
```
Vendor/BUYER creates → FINANCE reviews → 3-way match → MANAGER approves → APPROVED
└─> Invoice status: DRAFT → SUBMITTED → APPROVED → Ready for payment
```

### Payment Approval
```
FINANCE initiates → FINANCE Manager approves (dual approval) → COMPLETED
└─> Payment status: PENDING → PROCESSING → COMPLETED
```

---

## Complete API Endpoint Map

### RFQ/Quotation Workflow APIs
```
POST   /{tenant}/rfq                                    [MISSING] Create RFQ
GET    /{tenant}/rfq                                    [MISSING] List RFQs
GET    /{tenant}/rfq/{id}                               [MISSING] Get RFQ
POST   /{tenant}/quotations                             [EXISTS]  Create quotation
GET    /{tenant}/quotations                             [EXISTS]  List quotations
GET    /{tenant}/quotations/{id}                        [EXISTS]  Get quotation
POST   /{tenant}/workflows/quotation/{id}/accept        [MISSING] Accept & create contract
```

### Tender/Bid Workflow APIs
```
POST   /{tenant}/contracts                              [EXISTS]  Create contract
POST   /{tenant}/contracts/{id}/approve                 [EXISTS]  Approve contract
POST   /{tenant}/workflows/tender/create/{contractId}   [EXISTS]  Create tender
POST   /{tenant}/workflows/tender/publish/{tenderId}    [EXISTS]  Publish tender
POST   /{tenant}/bids                                   [EXISTS]  Create bid
PUT    /{tenant}/bids/{id}                              [EXISTS]  Update bid
POST   /{tenant}/bids/{id}/submit                       [EXISTS]  Submit bid
POST   /{tenant}/workflows/tender/evaluate-bid/{bidId}  [EXISTS]  Evaluate bid
POST   /{tenant}/workflows/tender/award/{tenderId}      [EXISTS]  Award tender
```

### Common Workflow APIs (Both flows merge here)
```
POST   /{tenant}/purchase-requisitions                  [EXISTS]  Create PR
POST   /{tenant}/purchase-requisitions/{id}/approve     [EXISTS]  Approve PR
POST   /{tenant}/purchase-orders                        [EXISTS]  Create PO
POST   /{tenant}/purchase-orders/{id}/approve           [EXISTS]  Approve PO
POST   /{tenant}/goods-receipts                         [EXISTS]  Record GR
POST   /{tenant}/invoices                               [EXISTS]  Create invoice
POST   /{tenant}/invoices/{id}/approve                  [EXISTS]  Approve invoice
POST   /{tenant}/payments                               [EXISTS]  Create payment
POST   /{tenant}/payments/{id}/approve                  [EXISTS]  Approve payment
POST   /{tenant}/payments/{id}/process                  [EXISTS]  Process payment
```

---

## Role-Based Access Control (RBAC)

### Workflow 1: RFQ/Quotation
| Action | ADMIN | BUYER | MANAGER | FINANCE | VENDOR | APPROVER |
|--------|-------|-------|---------|---------|--------|----------|
| Create RFQ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View RFQs | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Submit Quotation | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Accept Quotation | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve Contract | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |

### Workflow 2: Tender/Bid
| Action | ADMIN | BUYER | MANAGER | FINANCE | VENDOR | APPROVER |
|--------|-------|-------|---------|---------|--------|----------|
| Create Contract | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve Contract | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Create Tender | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Publish Tender | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Submit Bid | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Evaluate Bid | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Award Tender | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

### Common Workflow
| Action | ADMIN | BUYER | MANAGER | FINANCE | VENDOR | APPROVER |
|--------|-------|-------|---------|---------|--------|----------|
| Create PR | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve PR | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Create PO | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve PO | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Record GR | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Invoice | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Approve Invoice | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Process Payment | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## Event Flow & Notifications

### RFQ/Quotation Workflow Events
```
1. rfq.created          → Notify: target vendors
2. quotation.submitted  → Notify: buyer/requester
3. quotation.accepted   → Notify: winning vendor, rejected vendors
4. contract.created     → Notify: approvers
5. contract.approved    → Notify: contract owner, vendors
... continues with PR events
```

### Tender/Bid Workflow Events
```
1. contract.created     → Notify: approvers
2. contract.approved    → Notify: contract owner
3. tender.created       → Audit log only
4. tender.published     → Notify: ALL eligible vendors
5. bid.submitted        → Notify: tender creator
6. tender.closed        → Notify: all bidders
7. bid.evaluated        → Audit log only
8. tender.awarded       → Notify: winning vendor, rejected vendors
... continues with PR events
```

### Common Events (Both Workflows)
```
9.  pr.created          → Notify: approvers
10. pr.approved         → Notify: PR requester
11. po.created          → Notify: approvers, assigned vendors
12. po.approved         → Notify: PO creator, vendors
13. po.issued           → Notify: vendors (email with PO PDF)
14. gr.recorded         → Notify: finance team
15. invoice.submitted   → Notify: finance approvers
16. invoice.approved    → Notify: finance payment team
17. payment.processed   → Notify: vendor, accounting team
```

---

## Implementation Priorities

### ✅ Phase 1: Completed
1. Contract approval workflow
2. End-to-end documentation
3. MongoDB BidDocument schema (correctly linked to Tender/Bid)

### 🚧 Phase 2: Immediate (This Week)
1. Add tender creation validation (require IN_PROGRESS contract)
2. Create RFQ entity and endpoints
3. Implement quotation acceptance workflow

### 📋 Phase 3: Short-term (Next 2 Weeks)
1. Quotation comparison UI
2. Enhanced bid evaluation scoring
3. Automated notifications
4. Budget integration checks

### 🔮 Phase 4: Future Enhancements
1. Approval hierarchy configuration
2. Contract templates
3. Automated vendor notifications
4. Analytics and reporting dashboards
5. Integration with external payment gateways

---

## Testing Checklist

### RFQ/Quotation Flow
- [ ] Create RFQ as BUYER
- [ ] Multiple vendors submit quotations
- [ ] Compare quotations side-by-side
- [ ] Accept winning quotation
- [ ] Verify contract auto-created with DRAFT status
- [ ] Approve contract as MANAGER
- [ ] Verify contract status = IN_PROGRESS
- [ ] Create PR from contract
- [ ] Continue through PO → GR → Invoice → Payment

### Tender/Bid Flow
- [ ] Create framework contract as BUYER
- [ ] Approve contract as MANAGER (status = IN_PROGRESS)
- [ ] Create tender from contract
- [ ] Verify tender creation blocked if contract not IN_PROGRESS
- [ ] Publish tender
- [ ] Multiple vendors submit bids with MongoDB documents
- [ ] Verify bid documents encrypted in MongoDB
- [ ] Close tender after deadline
- [ ] Evaluate and score bids
- [ ] Award tender to winning bid
- [ ] Create PR from contract
- [ ] Continue through PO → GR → Invoice → Payment

### Cross-Cutting
- [ ] Budget checks at PR/PO creation
- [ ] Budget commitment at PO approval
- [ ] Budget release at payment
- [ ] Three-way match (PO-GR-Invoice)
- [ ] Approval notifications
- [ ] Event emissions
- [ ] Audit logging for all actions
- [ ] Role-based access control enforcement

---

## Conclusion

The system correctly uses:
1. **PostgreSQL** for all transactional data and relationships
2. **MongoDB BidDocument** specifically for encrypted Tender/Bid documents (NOT quotations)
3. Two distinct procurement workflows that merge at the PR stage

The hierarchical transaction flow is:
- **Workflow 1:** RFQ → Quotation → Contract (approval) → PR → PO → GR → Invoice → Payment
- **Workflow 2:** Contract (approval) → Tender → Bid (with MongoDB docs) → PR → PO → GR → Invoice → Payment

Both workflows follow the same approval hierarchy and eventually merge into the same procurement fulfillment process (PR onwards).
