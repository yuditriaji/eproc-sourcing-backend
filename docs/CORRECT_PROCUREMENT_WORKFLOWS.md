# Correct Procurement Workflows

## Overview
This document clarifies the two distinct procurement workflows in the system and how they should be implemented.

---

## Workflow 1: RFQ/Quotation-Based Procurement (Direct Sourcing)

### Use Case
- Direct sourcing from known vendors
- Standard items/services
- Quick procurement needs
- Competitive pricing without formal tender

### Flow Diagram
```
┌─────────────┐
│Create RFQ   │ → Buyer creates Request for Quotation
└──────┬──────┘
       ↓
┌─────────────────┐
│Vendors Submit   │ → Multiple vendors submit quotations
│Quotations       │
└──────┬──────────┘
       ↓
┌─────────────────┐
│Buyer Reviews &  │ → Buyer compares quotations
│Compares         │
└──────┬──────────┘
       ↓
┌─────────────────┐
│Select Best      │ → Buyer selects winning quotation
│Quotation        │
└──────┬──────────┘
       ↓
┌─────────────────┐
│Create Contract  │ → System creates contract from quotation
│from Quotation   │
└──────┬──────────┘
       ↓
┌─────────────────┐
│Approve Contract │ → Manager approves contract
└──────┬──────────┘
       ↓
┌─────────────────┐
│Create PR        │ → Create Purchase Requisition
└──────┬──────────┘
       ↓
┌─────────────────┐
│Approve PR       │ → Manager approves PR
└──────┬──────────┘
       ↓
┌─────────────────┐
│Create PO        │ → Create Purchase Order
└──────┬──────────┘
       ↓
┌─────────────────┐
│Approve PO       │ → Manager approves PO
└──────┬──────────┘
       ↓
┌─────────────────┐
│Goods Receipt    │ → Receive goods/services
└──────┬──────────┘
       ↓
┌─────────────────┐
│Vendor Invoice   │ → Vendor submits invoice
└──────┬──────────┘
       ↓
┌─────────────────┐
│Approve Invoice  │ → Finance approves invoice
└──────┬──────────┘
       ↓
┌─────────────────┐
│Process Payment  │ → Payment to vendor
└─────────────────┘
```

### API Endpoints

#### 1. Create RFQ (Request for Quotation)
**Endpoint:** `POST /api/v1/{tenant}/rfq`  
**Roles:** ADMIN, BUYER, MANAGER

**Request Body:**
```json
{
  "title": "Office Supplies RFQ - Q1 2025",
  "description": "Request for quotation for office supplies",
  "items": [
    {
      "itemCode": "PAPER-A4",
      "description": "A4 Paper, 80gsm",
      "quantity": 1000,
      "unit": "ream",
      "specifications": {
        "size": "A4",
        "weight": "80gsm",
        "whiteness": "CIE 160+"
      }
    }
  ],
  "validUntil": "2025-02-28T23:59:59Z",
  "targetVendors": ["vendor1_id", "vendor2_id"],
  "department": "Administration"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "RFQ created and sent to vendors",
  "data": {
    "id": "rfq_12345",
    "rfqNumber": "RFQ-202501-0001",
    "status": "OPEN",
    "validUntil": "2025-02-28T23:59:59Z"
  }
}
```

#### 2. Vendor Submits Quotation
**Endpoint:** `POST /api/v1/{tenant}/quotations`  
**Roles:** VENDOR

**Request Body:**
```json
{
  "rfqId": "rfq_12345",
  "vendorId": "vendor1_id",
  "items": [
    {
      "itemCode": "PAPER-A4",
      "quantity": 1000,
      "unitPrice": 5.50,
      "totalPrice": 5500.00
    }
  ],
  "amount": 5500.00,
  "currencyId": "usd_id",
  "validUntil": "2025-02-28T23:59:59Z",
  "notes": "Bulk discount applied",
  "terms": {
    "paymentTerms": "Net 30",
    "deliveryTime": "7 days"
  }
}
```

#### 3. Accept Quotation & Create Contract
**Endpoint:** `POST /api/v1/{tenant}/workflows/quotation/{quotationId}/accept`  
**Roles:** ADMIN, BUYER, MANAGER

**Request Body:**
```json
{
  "createContract": true,
  "contractDetails": {
    "title": "Office Supplies Contract - Vendor ABC",
    "startDate": "2025-02-01T00:00:00Z",
    "endDate": "2025-12-31T23:59:59Z",
    "terms": {
      "paymentTerms": "Net 30",
      "deliveryTerms": "DDP"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quotation accepted and contract created",
  "data": {
    "quotation": {
      "id": "quo_12345",
      "status": "ACCEPTED"
    },
    "contract": {
      "id": "con_12345",
      "contractNumber": "CON-202502-0001",
      "status": "DRAFT",
      "totalAmount": 5500.00
    }
  },
  "meta": {
    "nextSteps": [
      "Contract requires approval",
      "Once approved, you can create Purchase Requisitions"
    ]
  }
}
```

---

## Workflow 2: Tender-Based Procurement (Competitive Bidding)

### Use Case
- Large value contracts
- Complex requirements
- Regulatory compliance requirements
- Open competitive bidding
- Formal evaluation process

### Flow Diagram
```
┌─────────────────┐
│Create Contract  │ → Create framework/master contract first
│(Master/Frame)   │
└──────┬──────────┘
       ↓
┌─────────────────┐
│Approve Contract │ → Manager approves contract
└──────┬──────────┘
       ↓
┌─────────────────┐
│Create Tender    │ → Create tender/RFP for specific work
│from Contract    │
└──────┬──────────┘
       ↓
┌─────────────────┐
│Publish Tender   │ → Publish to all eligible vendors
└──────┬──────────┘
       ↓
┌─────────────────┐
│Vendors Submit   │ → Vendors submit competitive bids
│Bids             │
└──────┬──────────┘
       ↓
┌─────────────────┐
│Close Tender     │ → Close tender after deadline
└──────┬──────────┘
       ↓
┌─────────────────┐
│Evaluate Bids    │ → Score bids against criteria
└──────┬──────────┘
       ↓
┌─────────────────┐
│Award Tender     │ → Award to winning vendor
└──────┬──────────┘
       ↓
┌─────────────────┐
│Update/Link      │ → Update existing contract or create new one
│Contract         │
└──────┬──────────┘
       ↓
┌─────────────────┐
│Create PR        │ → Create Purchase Requisition
└──────┬──────────┘
       ↓
... (same as Workflow 1 from PR onwards)
```

### API Endpoints

#### 1. Create Framework Contract First
**Endpoint:** `POST /api/v1/{tenant}/contracts`  
**Roles:** ADMIN, BUYER, MANAGER

**Request Body:**
```json
{
  "contractNumber": "FW-CON-2025-001",
  "title": "Cloud Infrastructure Services - Framework Agreement",
  "description": "3-year framework for cloud services",
  "totalAmount": 3000000.00,
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2027-12-31T23:59:59Z",
  "terms": {
    "type": "framework",
    "callOffProcedure": "mini-competition"
  }
}
```

#### 2. Approve Contract
**Endpoint:** `POST /api/v1/{tenant}/contracts/{contractId}/approve`  
**Roles:** ADMIN, MANAGER, APPROVER

**Request Body:**
```json
{
  "approved": true,
  "comments": "Framework agreement approved for cloud services"
}
```

#### 3. Create Tender from Contract
**Endpoint:** `POST /api/v1/{tenant}/workflows/tender/create/{contractId}`  
**Roles:** ADMIN, BUYER, MANAGER

**Request Body:**
```json
{
  "title": "Cloud Infrastructure Q1 2025 Call-Off",
  "description": "Specific cloud services for Q1 2025",
  "requirements": {
    "technical": ["99.99% uptime SLA", "ISO 27001 certified"],
    "commercial": ["Fixed monthly pricing"],
    "compliance": ["GDPR compliant"]
  },
  "criteria": {
    "technical": { "weight": 60, "maxScore": 100 },
    "commercial": { "weight": 30, "maxScore": 100 },
    "experience": { "weight": 10, "maxScore": 100 }
  },
  "estimatedValue": 250000.00,
  "closingDate": "2025-03-15T17:00:00Z"
}
```

**Important:** Contract MUST be IN_PROGRESS status before tender creation.

---

## Key Differences Between Workflows

| Aspect | RFQ/Quotation | Tender/Bid |
|--------|---------------|------------|
| **Contract Creation** | AFTER quotation selection | BEFORE tender creation |
| **Formality** | Informal, quick | Formal, structured |
| **Vendor Selection** | Targeted vendors | Open to all eligible |
| **Evaluation** | Simple comparison | Scored evaluation matrix |
| **Timeline** | Days/weeks | Weeks/months |
| **Documentation** | Minimal | Comprehensive |
| **Approval Levels** | 1-2 levels | Multiple levels |
| **Use Case** | <$50K, standard items | >$50K, complex projects |

---

## Database Schema Alignment

### Quotation Table
```prisma
model Quotation {
  id              String
  quotationNumber String
  tenderId        String?        // Optional - can be standalone
  vendorId        String
  amount          Decimal
  status          QuotationStatus // SUBMITTED, ACCEPTED, REJECTED
  // ... other fields
}
```

### Tender Table
```prisma
model Tender {
  id              String
  tenderNumber    String
  contractId      String?        // MUST exist before tender
  status          TenderStatus   // DRAFT, PUBLISHED, CLOSED, AWARDED
  quotations      Quotation[]    // Quotations can link to tender
  bids            Bid[]          // Formal bids for tender
  // ... other fields
}
```

### Contract Table
```prisma
model Contract {
  id                   String
  contractNumber       String
  status               ContractStatus // DRAFT, IN_PROGRESS, COMPLETED
  approvedAt           DateTime?      // NEW: approval tracking
  approvedById         String?        // NEW: who approved
  purchaseRequisitions PurchaseRequisition[] // PRs created from contract
  tenders              Tender[]       // Tenders created from contract
  // ... other fields
}
```

---

## Implementation Status

### ✅ Currently Working
- Contract creation
- Contract approval (newly implemented)
- PR creation from approved contracts
- PO creation from approved PRs
- Tender creation from contracts (partially - needs validation)
- Bid submission for tenders

### 🚧 Needs Implementation
1. **RFQ Management**
   - Create RFQ entity/endpoint
   - Send RFQ to targeted vendors
   - Track RFQ responses

2. **Quotation Workflow**
   - Accept/Reject quotation endpoint in workflow controller
   - Auto-create contract from accepted quotation
   - Link quotation to created contract

3. **Tender Workflow Fixes**
   - Add validation: contract must be IN_PROGRESS before tender creation
   - Fix tender-to-contract relationship (currently backwards in some places)

### ❌ Missing Entirely
- RFQ entity and management
- Quotation acceptance workflow with contract creation
- Quotation comparison/evaluation tools

---

## Business Rules

### RFQ/Quotation Flow
1. RFQ created by BUYER/ADMIN/MANAGER
2. RFQ sent to selected vendors (notification)
3. Vendors submit quotations before deadline
4. Only vendors who received RFQ can submit quotations
5. Buyer can accept only ONE quotation
6. Accepting quotation:
   - Changes quotation status to ACCEPTED
   - Creates contract in DRAFT status
   - Rejected quotations marked as REJECTED
7. Contract requires approval before PR creation

### Tender/Bid Flow
1. Contract MUST exist and be IN_PROGRESS
2. Tender created from contract
3. Tender published (status: DRAFT → PUBLISHED)
4. Any vendor can submit bid for published tender
5. Tender closed on deadline
6. Bids evaluated and scored
7. Tender awarded to highest-scoring bid
8. Award updates contract or creates call-off contract
9. PR can be created from active contract

---

## Migration Path

### Phase 1: Fix Current Issues (Immediate)
1. ✅ Add contract approval workflow (DONE)
2. Add validation: tender creation requires IN_PROGRESS contract
3. Update documentation to clarify two workflows

### Phase 2: Implement RFQ/Quotation Flow (1-2 weeks)
1. Create RFQ entity and service
2. Add RFQ workflow endpoints
3. Implement quotation acceptance with contract creation
4. Add vendor notifications

### Phase 3: Enhanced Features (Future)
1. Quotation comparison tools
2. Tender evaluation scoring UI
3. Approval hierarchy configuration
4. Budget integration
5. Contract templates

---

## Testing Scenarios

### Test Scenario 1: RFQ Flow
```
1. Login as BUYER
2. Create RFQ with item details
3. Login as VENDOR1
4. Submit quotation for RFQ
5. Login as VENDOR2
6. Submit quotation for RFQ
7. Login as BUYER
8. Review quotations
9. Accept VENDOR1's quotation
10. Verify contract created with DRAFT status
11. Login as MANAGER
12. Approve contract
13. Verify contract status = IN_PROGRESS
14. Create PR from contract
15. ... continue standard flow
```

### Test Scenario 2: Tender Flow
```
1. Login as BUYER
2. Create framework contract
3. Login as MANAGER
4. Approve contract (status = IN_PROGRESS)
5. Login as BUYER
6. Create tender from contract
7. Publish tender
8. Login as VENDOR1
9. Submit bid
10. Login as VENDOR2
11. Submit bid
12. Login as BUYER
13. Close tender
14. Evaluate and score bids
15. Award tender to winning bid
16. Create PR from contract
17. ... continue standard flow
```

---

## API Summary

### RFQ/Quotation Workflow
- `POST /{tenant}/rfq` - Create RFQ
- `GET /{tenant}/rfq` - List RFQs
- `GET /{tenant}/rfq/{id}` - Get RFQ details
- `POST /{tenant}/quotations` - Submit quotation (VENDOR)
- `GET /{tenant}/quotations` - List quotations
- `POST /{tenant}/workflows/quotation/{id}/accept` - Accept & create contract

### Tender/Bid Workflow
- `POST /{tenant}/contracts` - Create contract FIRST
- `POST /{tenant}/contracts/{id}/approve` - Approve contract
- `POST /{tenant}/workflows/tender/create/{contractId}` - Create tender (requires IN_PROGRESS contract)
- `POST /{tenant}/workflows/tender/publish/{tenderId}` - Publish tender
- `POST /{tenant}/workflows/tender/submit-bid/{tenderId}` - Submit bid (VENDOR)
- `POST /{tenant}/workflows/tender/close/{tenderId}` - Close tender
- `POST /{tenant}/workflows/tender/evaluate-bid/{bidId}` - Evaluate bid
- `POST /{tenant}/workflows/tender/award/{tenderId}/{bidId}` - Award tender

---

## Next Steps

1. Review and approve this documentation
2. Implement Phase 1 fixes
3. Begin Phase 2 implementation
4. Update frontend documentation
5. Create test suites for both workflows
