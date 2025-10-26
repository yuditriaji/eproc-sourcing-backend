# Transaction Endpoints

This document describes the transaction endpoints for the e-procurement sourcing backend API. All endpoints are tenant-scoped and require JWT authentication.

## Base URL Structure
```
{API_PREFIX}/{tenant}
```
Where:
- `API_PREFIX`: Default is `api/v1`
- `tenant`: Tenant identifier

## Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header.

**Note:** Transaction endpoints are primarily managed through the workflow system, which orchestrates the complete procurement lifecycle from contract to payment.

---

## 1. Procurement Workflow Endpoints

The procurement workflow follows this sequence: **Contract → Purchase Requisition (PR) → Purchase Order (PO) → Goods Receipt → Invoice → Payment**

### Initiate Procurement Workflow
```http
POST /{tenant}/workflows/procurement/initiate/{contractId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`

**Description:** Initiates the complete procurement workflow from an existing contract.

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Procurement workflow initiated successfully",
  "data": {
    "workflowId": "workflow_123",
    "status": "INITIATED",
    "contractId": "contract_123"
  },
  "meta": {
    "nextSteps": ["Create Purchase Requisition"]
  }
}
```

---

## 2. Purchase Requisition (PR) Management

### Create Purchase Requisition from Contract
```http
POST /{tenant}/workflows/procurement/create-pr/{contractId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`

**Request Body:**
```json
{
  "title": "IT Equipment Purchase Request",
  "description": "Purchase of laptops and accessories for development team",
  "items": [
    {
      "itemCode": "LAPTOP-001",
      "description": "MacBook Pro 16-inch",
      "quantity": 5,
      "unitPrice": 2500.00,
      "totalPrice": 12500.00
    },
    {
      "itemCode": "MOUSE-001", 
      "description": "Wireless Mouse",
      "quantity": 5,
      "unitPrice": 50.00,
      "totalPrice": 250.00
    }
  ],
  "estimatedAmount": 12750.00,
  "requiredBy": "2025-12-31T00:00:00Z",
  "justification": "Required for new development team expansion"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Purchase Requisition created successfully",
  "data": {
    "id": "pr_123",
    "prNumber": "PR-202501-0001",
    "title": "IT Equipment Purchase Request",
    "status": "PENDING",
    "estimatedAmount": 12750.00,
    "requiredBy": "2025-12-31T00:00:00Z",
    "contractId": "contract_123",
    "requesterId": "user_123",
    "createdAt": "2025-01-01T10:00:00Z"
  },
  "meta": {
    "nextSteps": ["Approve Purchase Requisition"]
  }
}
```

### Approve/Reject Purchase Requisition
```http
POST /{tenant}/workflows/procurement/approve-pr/{prId}
```

**Roles:** `ADMIN`, `MANAGER`, `APPROVER`

**Request Body:**
```json
{
  "approved": true,
  "comments": "Approved for Q1 budget allocation"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Purchase Requisition approved successfully",
  "data": {
    "id": "pr_123",
    "status": "APPROVED",
    "approvedAt": "2025-01-02T09:30:00Z",
    "approvedById": "approver_123"
  },
  "meta": {
    "nextSteps": ["Create Purchase Order"]
  }
}
```

---

## 3. Purchase Order (PO) Management

### Create Purchase Order from Approved PR
```http
POST /{tenant}/workflows/procurement/create-po/{prId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`

**Request Body:**
```json
{
  "vendorIds": ["vendor_123", "vendor_456"]
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Purchase Order created successfully",
  "data": {
    "id": "po_123",
    "poNumber": "PO-202501-0001",
    "title": "PO for IT Equipment Purchase Request",
    "amount": 12750.00,
    "status": "DRAFT",
    "prId": "pr_123",
    "contractId": "contract_123",
    "createdById": "user_123",
    "vendors": [
      {
        "vendorId": "vendor_123",
        "role": "PRIMARY",
        "vendor": {
          "name": "TechCorp Ltd",
          "contactEmail": "sales@techcorp.com"
        }
      }
    ],
    "createdAt": "2025-01-02T10:00:00Z"
  },
  "meta": {
    "nextSteps": ["Approve Purchase Order"]
  }
}
```

### Approve/Reject Purchase Order
```http
POST /{tenant}/workflows/procurement/approve-po/{poId}
```

**Roles:** `ADMIN`, `MANAGER`, `FINANCE`, `APPROVER`

**Request Body:**
```json
{
  "approved": true,
  "comments": "Budget approved, vendor verified"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Purchase Order approved successfully",
  "data": {
    "id": "po_123",
    "status": "APPROVED",
    "approvedAt": "2025-01-03T14:20:00Z",
    "approvedById": "manager_123",
    "totalAmount": 12750.00
  },
  "meta": {
    "nextSteps": ["Create Goods Receipt", "Create Invoice"]
  }
}
```

---

## 4. Goods Receipt Management

### Create Goods Receipt for Purchase Order
```http
POST /{tenant}/workflows/procurement/goods-receipt/{poId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`

**Request Body:**
```json
{
  "receivedDate": "2025-01-15T08:00:00Z",
  "receivedItems": [
    {
      "itemCode": "LAPTOP-001",
      "description": "MacBook Pro 16-inch",
      "orderedQuantity": 5,
      "receivedQuantity": 5,
      "condition": "GOOD",
      "serialNumbers": ["LP001", "LP002", "LP003", "LP004", "LP005"]
    },
    {
      "itemCode": "MOUSE-001",
      "description": "Wireless Mouse", 
      "orderedQuantity": 5,
      "receivedQuantity": 4,
      "condition": "GOOD",
      "remarks": "1 item damaged in transit"
    }
  ],
  "notes": "Partial delivery - 1 mouse damaged",
  "inspectionNotes": "All laptops in excellent condition, 1 mouse requires replacement",
  "inspectedBy": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Goods Receipt created successfully",
  "data": {
    "id": "gr_123",
    "receiptNumber": "GR-202501-0001",
    "poId": "po_123",
    "receivedDate": "2025-01-15T08:00:00Z",
    "status": "PARTIAL",
    "inspectedBy": "John Doe",
    "inspectedAt": "2025-01-15T08:30:00Z",
    "receivedItems": {
      "totalItems": 2,
      "fullyReceived": 1,
      "partiallyReceived": 1
    },
    "createdAt": "2025-01-15T08:30:00Z"
  },
  "meta": {
    "nextSteps": ["Process Invoice", "Schedule Replacement Delivery"]
  }
}
```

---

## 5. Tender Workflow Endpoints

The tender workflow follows this sequence: **Create Tender → Publish → Vendor Submissions → Close → Evaluate → Award**

### Create Tender from Contract
```http
POST /{tenant}/workflows/tender/create/{contractId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`

**Request Body:**
```json
{
  "title": "IT Infrastructure Services Tender",
  "description": "Procurement of comprehensive IT infrastructure services including hardware, software, and support",
  "requirements": {
    "technical": [
      "24/7 technical support",
      "99.9% uptime guarantee",
      "ISO 27001 certification"
    ],
    "commercial": [
      "Fixed price contract",
      "Payment terms: 30 days",
      "Warranty: 3 years minimum"
    ]
  },
  "criteria": {
    "technical": { "weight": 60, "maxScore": 100 },
    "commercial": { "weight": 40, "maxScore": 100 }
  },
  "estimatedValue": 500000.00,
  "closingDate": "2025-02-28T17:00:00Z",
  "category": "IT_SERVICES",
  "department": "IT"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Tender created successfully",
  "data": {
    "id": "tender_123",
    "tenderNumber": "TND-202501-0001",
    "title": "IT Infrastructure Services Tender",
    "status": "DRAFT",
    "estimatedValue": 500000.00,
    "closingDate": "2025-02-28T17:00:00Z",
    "contractId": "contract_123",
    "creatorId": "user_123",
    "createdAt": "2025-01-10T09:00:00Z"
  },
  "meta": {
    "nextSteps": ["Publish Tender"]
  }
}
```

### Publish Tender
```http
POST /{tenant}/workflows/tender/publish/{tenderId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tender published successfully",
  "data": {
    "id": "tender_123",
    "status": "PUBLISHED",
    "publishedAt": "2025-01-12T10:00:00Z"
  },
  "meta": {
    "nextSteps": ["Await Vendor Submissions"]
  }
}
```

### Submit Bid (Vendor)
```http
POST /{tenant}/workflows/tender/submit-bid/{tenderId}
```

**Roles:** `VENDOR`

**Request Body:**
```json
{
  "bidAmount": 475000.00,
  "technicalProposal": {
    "approach": "Cloud-first infrastructure with hybrid capabilities",
    "timeline": "3 months implementation",
    "team": {
      "projectManager": "Jane Smith",
      "technicalLead": "Bob Johnson",
      "teamSize": 8
    }
  },
  "financialProposal": {
    "breakdown": {
      "hardware": 200000.00,
      "software": 150000.00,
      "services": 100000.00,
      "support": 25000.00
    },
    "paymentSchedule": [
      { "milestone": "Contract signing", "percentage": 20 },
      { "milestone": "Hardware delivery", "percentage": 40 },
      { "milestone": "System implementation", "percentage": 30 },
      { "milestone": "Go-live", "percentage": 10 }
    ]
  },
  "compliance": {
    "iso27001": true,
    "dataProtection": true,
    "references": [
      {
        "company": "BigCorp Ltd",
        "contactPerson": "Alice Williams", 
        "project": "Enterprise Cloud Migration"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Bid submitted successfully",
  "data": {
    "id": "bid_123",
    "tenderId": "tender_123",
    "vendorId": "vendor_123",
    "bidAmount": 475000.00,
    "status": "SUBMITTED",
    "submittedAt": "2025-01-25T16:30:00Z"
  },
  "meta": {
    "nextSteps": ["Await Tender Closure and Evaluation"]
  }
}
```

### Close Tender
```http
POST /{tenant}/workflows/tender/close/{tenderId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tender closed successfully",
  "data": {
    "id": "tender_123",
    "status": "CLOSED",
    "closingDate": "2025-02-28T17:00:00Z",
    "submittedBids": 5
  },
  "meta": {
    "nextSteps": ["Evaluate Bids"]
  }
}
```

### Evaluate Bid
```http
POST /{tenant}/workflows/tender/evaluate-bid/{bidId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`

**Request Body:**
```json
{
  "technicalScore": 85.5,
  "commercialScore": 92.0,
  "evaluationNotes": "Strong technical proposal with competitive pricing. Good track record and references."
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Bid evaluated successfully",
  "data": {
    "id": "bid_123",
    "technicalScore": 85.5,
    "commercialScore": 92.0,
    "totalScore": 88.2,
    "status": "UNDER_REVIEW",
    "evaluatedAt": "2025-03-01T10:00:00Z",
    "evaluatedBy": "evaluator_123"
  },
  "meta": {
    "nextSteps": ["Complete All Evaluations", "Award Tender"]
  }
}
```

### Award Tender
```http
POST /{tenant}/workflows/tender/award/{tenderId}/{winningBidId}
```

**Roles:** `ADMIN`, `MANAGER`

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tender awarded successfully",
  "data": {
    "tenderId": "tender_123",
    "winningBidId": "bid_123",
    "awardedVendor": {
      "id": "vendor_123",
      "name": "TechCorp Ltd",
      "bidAmount": 475000.00
    },
    "awardDate": "2025-03-05T14:00:00Z",
    "status": "AWARDED"
  },
  "meta": {
    "nextSteps": ["Generate Contract Amendment", "Begin Procurement Process"]
  }
}
```

---

## 6. Workflow Status Tracking

### Get Workflow Status
```http
GET /{tenant}/workflows/status/{entityType}/{entityId}
```

**Roles:** `ADMIN`, `BUYER`, `MANAGER`, `FINANCE`, `VENDOR`

**Parameters:**
- `entityType`: `contract`, `pr`, `po`, `tender`, `bid`, `invoice`, `payment`
- `entityId`: The ID of the entity

**Example:**
```http
GET /{tenant}/workflows/status/po/po_123
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Workflow status retrieved successfully",
  "data": {
    "entityType": "po",
    "entityId": "po_123",
    "currentStatus": "APPROVED",
    "workflow": {
      "steps": [
        {
          "step": "CREATE_PR",
          "status": "COMPLETED",
          "completedAt": "2025-01-02T10:00:00Z",
          "completedBy": "user_123"
        },
        {
          "step": "APPROVE_PR", 
          "status": "COMPLETED",
          "completedAt": "2025-01-02T14:30:00Z",
          "completedBy": "approver_123"
        },
        {
          "step": "CREATE_PO",
          "status": "COMPLETED",
          "completedAt": "2025-01-03T09:15:00Z",
          "completedBy": "buyer_123"
        },
        {
          "step": "APPROVE_PO",
          "status": "COMPLETED",
          "completedAt": "2025-01-03T16:20:00Z",
          "completedBy": "manager_123"
        },
        {
          "step": "GOODS_RECEIPT",
          "status": "PENDING",
          "assignedTo": "warehouse_team"
        },
        {
          "step": "INVOICE_PROCESSING",
          "status": "NOT_STARTED"
        },
        {
          "step": "PAYMENT",
          "status": "NOT_STARTED"
        }
      ]
    },
    "nextActions": [
      "Create Goods Receipt",
      "Process Vendor Invoice"
    ],
    "relatedDocuments": {
      "pr": "pr_123",
      "contract": "contract_123",
      "invoices": [],
      "goodsReceipts": []
    }
  }
}
```

---

## 7. Transaction Statistics and Reports

### Purchase Order Statistics
```http
GET /{tenant}/transactions/statistics/purchase-orders?period=monthly&year=2025
```

**Query Parameters:**
- `period`: `daily`, `weekly`, `monthly`, `yearly`
- `year`: Year for filtering (default: current year)
- `month`: Month for filtering (when period is daily/weekly)
- `status`: Filter by PO status
- `createdBy`: Filter by creator ID

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "PO statistics retrieved successfully",
  "data": {
    "summary": {
      "totalPOs": 125,
      "draftPOs": 12,
      "approvedPOs": 45,
      "inProgressPOs": 35,
      "completedPOs": 28,
      "cancelledPOs": 5,
      "totalValue": 2750000.00,
      "averageValue": 22000.00
    },
    "trends": [
      {
        "period": "2025-01",
        "count": 15,
        "value": 325000.00
      },
      {
        "period": "2025-02",
        "count": 18,
        "value": 415000.00
      }
    ],
    "topVendors": [
      {
        "vendorId": "vendor_123",
        "vendorName": "TechCorp Ltd",
        "totalPOs": 8,
        "totalValue": 185000.00
      }
    ]
  }
}
```

### Purchase Requisition Statistics
```http
GET /{tenant}/transactions/statistics/purchase-requisitions?status=pending
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "PR statistics retrieved successfully",
  "data": {
    "summary": {
      "totalPRs": 95,
      "pendingPRs": 8,
      "approvedPRs": 67,
      "rejectedPRs": 15,
      "cancelledPRs": 5,
      "totalValue": 1850000.00,
      "averageApprovalTime": "2.5 days"
    },
    "pendingApprovals": [
      {
        "id": "pr_456",
        "prNumber": "PR-202501-0045",
        "title": "Office Supplies Q1",
        "requestedBy": "John Doe",
        "estimatedAmount": 5500.00,
        "requiredBy": "2025-03-31T00:00:00Z",
        "daysWaiting": 3
      }
    ]
  }
}
```

---

## 8. Error Responses

### Standard Error Format
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "Purchase Requisition must be approved before creating PO",
    "Vendor not found or inactive"
  ]
}
```

### Common Error Codes
- `400` - Bad Request (validation errors, invalid workflow state)
- `401` - Unauthorized (missing or invalid JWT)
- `403` - Forbidden (insufficient role permissions)
- `404` - Not Found (entity doesn't exist)
- `409` - Conflict (duplicate numbers, invalid state transition)
- `422` - Unprocessable Entity (business logic error)

### Workflow-Specific Errors
- `INVALID_STATUS_TRANSITION` - Attempting invalid status change
- `INSUFFICIENT_APPROVAL_RIGHTS` - User cannot approve this transaction
- `WORKFLOW_NOT_READY` - Prerequisites not met for next step
- `TENDER_CLOSED` - Cannot submit bid to closed tender
- `EVALUATION_INCOMPLETE` - Cannot award tender before all bids evaluated

---

## 9. Rate Limiting

Transaction endpoints are subject to role-based rate limiting:
- `ADMIN`: 5000 requests/hour
- `BUYER`, `MANAGER`: 2000 requests/hour  
- `USER`, `FINANCE`: 1000 requests/hour
- `VENDOR`: 500 requests/hour

Rate limit headers:
```
X-RateLimit-Limit: 2000
X-RateLimit-Remaining: 1847
X-RateLimit-Reset: 1640998800
```

---

## 10. Data Validation Rules

### Purchase Requisition
- `title`: Required, max 200 characters
- `items`: Required array, min 1 item
- `estimatedAmount`: Must be positive decimal
- `requiredBy`: Must be future date

### Purchase Order
- `amount`: Must match PR estimated amount ±10%
- `vendorIds`: Required array, min 1 vendor
- `expectedDelivery`: Must be after creation date

### Bid Submission
- `bidAmount`: Must be positive, within tender budget ±50%
- `technicalProposal`: Required for technical evaluation
- `compliance`: All mandatory requirements must be true

### Goods Receipt
- `receivedQuantity`: Cannot exceed ordered quantity
- `condition`: Must be valid enum value
- `inspectedBy`: Required if inspection notes provided

---

## 11. Business Rules

### Workflow Progression
1. **Contract must be IN_PROGRESS** to create PR/Tender
2. **PR must be APPROVED** before creating PO
3. **PO must be APPROVED** before goods receipt
4. **Goods receipt required** before final invoice processing
5. **Invoice must be approved** before payment

### Approval Authority
- PRs under $10,000: Department Manager
- PRs $10,000-$50,000: Finance Manager + Department Manager
- PRs over $50,000: Admin approval required
- POs follow same approval hierarchy as PRs

### Tender Rules
- Minimum 14-day submission period for tenders over $100,000
- Technical evaluation must be completed before commercial evaluation
- Minimum 3 qualified bids required for tender award
- Tender cannot be awarded to highest scoring bid if score < 70%

---

## 12. Integration Points

### External Systems
- **ERP Integration**: Purchase orders sync with external ERP
- **Payment Gateway**: Payment processing through integrated gateway
- **Document Storage**: All transaction documents stored in secure cloud storage
- **Email Notifications**: Automatic notifications for status changes
- **Audit Trail**: Complete audit log for compliance reporting

### Event-Driven Architecture
All transaction state changes emit events for:
- Real-time notifications
- Workflow automation
- External system synchronization
- Audit logging
- Analytics and reporting

---

## Swagger Documentation

Complete API documentation with request/response schemas is available at:
```
/{API_PREFIX}/docs
```

The Swagger UI provides interactive testing capabilities and detailed schema definitions for all transaction endpoints.