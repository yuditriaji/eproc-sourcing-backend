# E-Procurement API Documentation

## Overview

This document provides comprehensive API documentation for the e-procurement system that implements two main business workflows:

1. **Procurement Workflow**: Contract → PR → PO → Goods Receipt → Invoice → Payment
2. **Tender/Quotation Workflow**: Create Tender → Vendor Submission → Evaluation → Award

## Base URL

```
https://your-api-domain.com/api
```

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## API Response Format

All API responses follow this consistent format:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  errors?: string[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    nextSteps?: string[];
    [key: string]: any;
  };
}
```

## User Roles

- `ADMIN`: Full system access
- `BUYER`: Can create contracts, PRs, POs, tenders
- `VENDOR`: Can submit bids and quotations
- `MANAGER`: Can approve PRs, POs, and manage teams
- `FINANCE`: Can handle financial aspects and approvals
- `APPROVER`: Can approve various requests

---

# PROCUREMENT WORKFLOW APIS

## Contract Management

### Create Contract
```http
POST /contracts
```

**Request Body:**
```json
{
  "contractNumber": "CON-202410-0001",
  "title": "Software Development Services",
  "description": "Development of e-procurement system",
  "totalAmount": 50000,
  "currencyId": "usd-currency-id",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "terms": {
    "paymentTerms": "Net 30",
    "deliveryTerms": "On-site delivery"
  },
  "deliverables": {
    "phase1": "System design and architecture",
    "phase2": "Implementation and testing"
  },
  "vendorIds": ["vendor-id-1", "vendor-id-2"]
}
```

**Roles Required:** `ADMIN`, `BUYER`, `MANAGER`

### Get All Contracts
```http
GET /contracts?page=1&limit=10&status=IN_PROGRESS
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Contract status filter
- `ownerId` (optional): Filter by owner

### Get Contract by ID
```http
GET /contracts/:id
```

### Update Contract
```http
PATCH /contracts/:id
```

**Request Body:** (Same as create, but all fields optional)

### Add Vendors to Contract
```http
POST /contracts/:id/vendors
```

**Request Body:**
```json
{
  "vendorIds": ["vendor-id-3", "vendor-id-4"]
}
```

### Remove Vendor from Contract
```http
DELETE /contracts/:id/vendors/:vendorId
```

### Delete Contract
```http
DELETE /contracts/:id
```

**Note:** Only draft contracts can be deleted

### Contract Statistics
```http
GET /contracts/statistics?ownerId=user-id
```

### Generate Contract Number
```http
GET /contracts/generate-number
```

---

## Workflow Management

### 1. Initiate Procurement from Contract

```http
POST /workflows/procurement/initiate/:contractId
```

**Description:** Validates if a contract is ready for procurement activities.

**Response Example:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Contract is ready for purchase requisition creation",
  "data": {
    "contractId": "contract-id",
    "contractTitle": "Software Development Services"
  },
  "meta": {
    "nextSteps": [
      "Create Purchase Requisition",
      "Define required items and specifications",
      "Set required delivery date",
      "Submit for approval"
    ]
  }
}
```

### 2. Create PR from Contract

```http
POST /workflows/procurement/create-pr/:contractId
```

**Request Body:**
```json
{
  "title": "Development Tools and Software",
  "description": "Required development tools for the project",
  "items": [
    {
      "itemName": "IDE Licenses",
      "quantity": 5,
      "specification": "Professional edition",
      "estimatedUnitPrice": 500
    }
  ],
  "estimatedAmount": 2500,
  "requiredBy": "2024-02-15",
  "justification": "Essential tools for project development"
}
```

### 3. Approve PR

```http
POST /workflows/procurement/approve-pr/:prId
```

**Request Body:**
```json
{
  "approved": true,
  "comments": "Approved with budget allocation from Q1 budget"
}
```

### 4. Create PO from PR

```http
POST /workflows/procurement/create-po/:prId
```

**Request Body:**
```json
{
  "vendorIds": ["vendor-id-1"]
}
```

### 5. Approve PO

```http
POST /workflows/procurement/approve-po/:poId
```

**Request Body:**
```json
{
  "approved": true,
  "comments": "Approved for immediate processing"
}
```

### 6. Create Goods Receipt

```http
POST /workflows/procurement/goods-receipt/:poId
```

**Request Body:**
```json
{
  "receivedDate": "2024-02-20",
  "receivedItems": [
    {
      "itemName": "IDE Licenses",
      "quantityReceived": 5,
      "condition": "New",
      "serialNumbers": ["SN001", "SN002", "SN003", "SN004", "SN005"]
    }
  ],
  "notes": "All items received in good condition",
  "inspectionNotes": "All licenses activated successfully",
  "inspectedBy": "Tech Lead"
}
```

---

# TENDER/QUOTATION WORKFLOW APIS

### 1. Create Tender from Contract

```http
POST /workflows/tender/create/:contractId
```

**Request Body:**
```json
{
  "title": "Web Development Services Tender",
  "description": "Seeking qualified vendors for web development services",
  "requirements": {
    "technical": [
      "Minimum 5 years experience",
      "React.js and Node.js expertise",
      "Previous e-commerce project portfolio"
    ],
    "commercial": [
      "Competitive pricing",
      "Fixed-price model preferred",
      "Payment milestones"
    ]
  },
  "criteria": {
    "technical": {
      "weight": 60,
      "maxScore": 100
    },
    "commercial": {
      "weight": 40,
      "maxScore": 100
    }
  },
  "estimatedValue": 30000,
  "closingDate": "2024-03-15T17:00:00Z",
  "category": "IT Services",
  "department": "Technology"
}
```

### 2. Publish Tender

```http
POST /workflows/tender/publish/:tenderId
```

**Description:** Makes the tender available for vendor submissions.

### 3. Submit Bid (Vendor Role)

```http
POST /workflows/tender/submit-bid/:tenderId
```

**Request Body:**
```json
{
  "bidAmount": 28000,
  "technicalProposal": {
    "methodology": "Agile development approach",
    "timeline": "12 weeks",
    "teamSize": 4,
    "technologies": ["React", "Node.js", "MongoDB"],
    "deliverables": [
      "Fully functional web application",
      "Admin dashboard",
      "Mobile responsive design",
      "Documentation and training"
    ]
  },
  "financialProposal": {
    "breakdown": {
      "development": 20000,
      "testing": 4000,
      "deployment": 2000,
      "support": 2000
    },
    "paymentSchedule": [
      { "milestone": "Project kickoff", "percentage": 20 },
      { "milestone": "UI/UX completion", "percentage": 30 },
      { "milestone": "Backend completion", "percentage": 30 },
      { "milestone": "Final delivery", "percentage": 20 }
    ]
  },
  "compliance": {
    "hasRequiredExperience": true,
    "hasPortfolio": true,
    "agreesToTerms": true,
    "certifications": ["ISO 9001", "CMMI Level 3"]
  }
}
```

### 4. Close Tender

```http
POST /workflows/tender/close/:tenderId
```

**Description:** Closes the tender for submissions and prepares for evaluation.

### 5. Evaluate Bid

```http
POST /workflows/tender/evaluate-bid/:bidId
```

**Request Body:**
```json
{
  "technicalScore": 85,
  "commercialScore": 90,
  "evaluationNotes": "Strong technical proposal with competitive pricing. Good portfolio and relevant experience."
}
```

### 6. Award Tender

```http
POST /workflows/tender/award/:tenderId/:winningBidId
```

**Description:** Awards the tender to the winning vendor and automatically creates a purchase order.

---

# WORKFLOW STATUS TRACKING

### Get Workflow Status

```http
GET /workflows/status/:entityType/:entityId
```

**Entity Types:**
- `contract`
- `tender`
- `pr` (Purchase Requisition)
- `po` (Purchase Order)

**Example Response for Contract:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Workflow status retrieved successfully",
  "data": {
    "status": "IN_PROGRESS",
    "purchaseRequisitions": 3,
    "purchaseOrders": 2,
    "tenders": 1,
    "canCreatePR": true,
    "canCreateTender": true
  }
}
```

**Example Response for Tender:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Workflow status retrieved successfully",
  "data": {
    "status": "CLOSED",
    "totalBids": 5,
    "submittedBids": 5,
    "evaluatedBids": 3,
    "acceptedBids": 0,
    "canSubmitBid": false,
    "canEvaluate": true,
    "canAward": true
  }
}
```

---

# ERROR HANDLING

## Common Error Codes

- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Invalid or missing JWT token
- `403`: Forbidden - Insufficient permissions for the operation
- `404`: Not Found - Resource does not exist
- `409`: Conflict - Resource already exists or invalid state
- `500`: Internal Server Error - Server-side error

## Error Response Format

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "Title is required",
    "Estimated amount must be positive"
  ]
}
```

---

# FRONTEND INTEGRATION GUIDE

## Workflow State Management

The frontend should maintain state for each workflow step and use the `nextSteps` provided in API responses to guide users through the process.

## Real-time Updates

Consider implementing WebSocket connections for real-time updates on:
- Bid submissions
- Approval status changes
- Workflow progress notifications

## User Interface Recommendations

### Procurement Workflow UI
1. **Contract Dashboard**: Show active contracts with procurement options
2. **PR Creation Form**: Guided form with item specifications
3. **Approval Interface**: For managers to approve/reject PRs and POs
4. **Goods Receipt Form**: Simple form for receiving items
5. **Workflow Progress Tracker**: Visual representation of workflow stages

### Tender Workflow UI
1. **Tender Creation Wizard**: Step-by-step tender creation
2. **Vendor Portal**: For vendors to view and bid on tenders
3. **Bid Evaluation Interface**: For procurement team to score bids
4. **Award Interface**: Final step to award contracts

## State Management

```javascript
// Example state structure for frontend
const workflowState = {
  currentStep: 'PR_APPROVAL',
  canProceed: true,
  nextSteps: [
    'Wait for manager approval',
    'Finance team review (if amount > threshold)',
    'Final approval before PO creation'
  ],
  entityStatus: {
    contract: 'IN_PROGRESS',
    pr: 'PENDING',
    po: null
  }
};
```

## API Integration Examples

```javascript
// Example React hook for workflow management
const useWorkflow = (entityType, entityId) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/workflows/status/${entityType}/${entityId}`);
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch workflow status:', error);
    } finally {
      setLoading(false);
    }
  };

  const proceedToNextStep = async (stepData) => {
    // Implementation based on current step
    // Call appropriate workflow API endpoint
  };

  return { status, loading, checkStatus, proceedToNextStep };
};
```

---

# TESTING ENDPOINTS

All endpoints can be tested using the provided data examples. Make sure to:

1. Obtain a valid JWT token through the authentication endpoint
2. Use appropriate user roles for different operations
3. Follow the workflow sequence for proper state transitions
4. Check workflow status before proceeding to next steps

For any questions or additional endpoint requirements, please refer to the backend team.