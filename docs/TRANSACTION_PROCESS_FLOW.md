# Transaction Process Flow

Complete end-to-end transaction process flows for the e-procurement sourcing backend, including all request bodies and responses for UI/UX alignment.

---

## Table of Contents
1. [Procurement Workflow](#1-procurement-workflow)
2. [Tender Workflow](#2-tender-workflow)
3. [Invoice & Payment Processing](#3-invoice--payment-processing)
4. [Workflow Status Tracking](#4-workflow-status-tracking)
5. [Transaction Statistics](#5-transaction-statistics)

---

## Base URL Pattern
```
{API_PREFIX}/{tenant}
```
Where:
- `API_PREFIX`: Default is `api/v1`
- `tenant`: Tenant identifier (subdomain or ID)

All transaction endpoints require JWT authentication with appropriate role permissions.

---

## 1. Procurement Workflow

The procurement workflow follows this sequence:  
**Contract → Purchase Requisition (PR) → Purchase Order (PO) → Goods Receipt → Invoice → Payment**

### 1.1 Initiate Procurement from Contract
**Endpoint:** `POST /{tenant}/workflows/procurement/initiate/{contractId}`  
**Auth:** Bearer (ADMIN, BUYER, MANAGER)  
**Description:** Initialize procurement workflow from an existing contract

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Procurement workflow initiated successfully",
  "data": {
    "workflowId": "wf_proc001",
    "status": "INITIATED",
    "contractId": "con_tech001",
    "contractTitle": "IT Infrastructure Services Contract"
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

---

### 1.2 Create Purchase Requisition (PR)
**Endpoint:** `POST /{tenant}/workflows/procurement/create-pr/{contractId}`  
**Auth:** Bearer (ADMIN, BUYER, MANAGER)  
**Description:** Create a purchase requisition from an active contract

#### Request Body
```json
{
  "title": "Q1 2025 IT Equipment Purchase",
  "description": "Procurement of laptops and peripherals for development team expansion",
  "items": [
    {
      "itemCode": "LAPTOP-MBP-16",
      "description": "MacBook Pro 16-inch M3 Max, 32GB RAM, 1TB SSD",
      "quantity": 10,
      "unitPrice": 3500.00,
      "totalPrice": 35000.00,
      "specifications": {
        "processor": "Apple M3 Max",
        "ram": "32GB",
        "storage": "1TB SSD",
        "warranty": "3 years"
      }
    },
    {
      "itemCode": "MONITOR-LG-27",
      "description": "LG 27-inch 4K Monitor",
      "quantity": 10,
      "unitPrice": 450.00,
      "totalPrice": 4500.00,
      "specifications": {
        "size": "27 inches",
        "resolution": "3840x2160",
        "refreshRate": "60Hz"
      }
    },
    {
      "itemCode": "KB-MOUSE-SET",
      "description": "Wireless Keyboard and Mouse Set",
      "quantity": 10,
      "unitPrice": 120.00,
      "totalPrice": 1200.00
    }
  ],
  "estimatedAmount": 40700.00,
  "requiredBy": "2025-03-31T00:00:00Z",
  "justification": "Team expansion from 15 to 25 developers requires additional workstations. Budget approved in Q1 planning meeting.",
  "department": "Engineering",
  "costCenter": "CC-ENG-001"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Purchase Requisition created successfully",
  "data": {
    "id": "pr_2025q1001",
    "prNumber": "PR-202501-0001",
    "title": "Q1 2025 IT Equipment Purchase",
    "description": "Procurement of laptops and peripherals for development team expansion",
    "status": "PENDING",
    "estimatedAmount": 40700.00,
    "requiredBy": "2025-03-31T00:00:00Z",
    "contractId": "con_tech001",
    "requesterId": "usr_buyer001",
    "department": "Engineering",
    "costCenter": "CC-ENG-001",
    "items": [
      {
        "itemCode": "LAPTOP-MBP-16",
        "description": "MacBook Pro 16-inch M3 Max, 32GB RAM, 1TB SSD",
        "quantity": 10,
        "unitPrice": 3500.00,
        "totalPrice": 35000.00
      },
      {
        "itemCode": "MONITOR-LG-27",
        "description": "LG 27-inch 4K Monitor",
        "quantity": 10,
        "unitPrice": 450.00,
        "totalPrice": 4500.00
      },
      {
        "itemCode": "KB-MOUSE-SET",
        "description": "Wireless Keyboard and Mouse Set",
        "quantity": 10,
        "unitPrice": 120.00,
        "totalPrice": 1200.00
      }
    ],
    "createdAt": "2025-01-20T09:15:00.000Z",
    "updatedAt": "2025-01-20T09:15:00.000Z"
  },
  "meta": {
    "nextSteps": [
      "Wait for manager approval",
      "Finance team review (if amount > threshold)",
      "Final approval before PO creation"
    ]
  }
}
```

---

### 1.3 Approve/Reject Purchase Requisition
**Endpoint:** `POST /{tenant}/workflows/procurement/approve-pr/{prId}`  
**Auth:** Bearer (ADMIN, MANAGER, APPROVER)  
**Description:** Approve or reject a pending purchase requisition

#### Request Body (Approval)
```json
{
  "approved": true,
  "comments": "Approved for Q1 budget allocation. Confirmed with finance team that budget is available."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Purchase Requisition approved successfully",
  "data": {
    "id": "pr_2025q1001",
    "prNumber": "PR-202501-0001",
    "status": "APPROVED",
    "approvedAt": "2025-01-20T14:30:00.000Z",
    "approvedById": "usr_manager001",
    "approvedBy": {
      "id": "usr_manager001",
      "name": "Sarah Johnson",
      "role": "MANAGER"
    },
    "comments": "Approved for Q1 budget allocation. Confirmed with finance team that budget is available."
  },
  "meta": {
    "nextSteps": [
      "Create Purchase Order",
      "Select vendors",
      "Define delivery terms",
      "Submit PO for approval"
    ]
  }
}
```

#### Request Body (Rejection)
```json
{
  "approved": false,
  "comments": "Budget allocation needs to be revised. Please reduce quantity by 3 units and resubmit."
}
```

#### Response (200 OK - Rejection)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Purchase Requisition rejected",
  "data": {
    "id": "pr_2025q1001",
    "status": "REJECTED",
    "rejectedAt": "2025-01-20T14:30:00.000Z",
    "rejectedById": "usr_manager001",
    "rejectionReason": "Budget allocation needs to be revised. Please reduce quantity by 3 units and resubmit."
  },
  "meta": {
    "nextSteps": [
      "Requester can revise and resubmit",
      "Address rejection comments",
      "Update specifications if needed"
    ]
  }
}
```

---

### 1.4 Create Purchase Order (PO) from Approved PR
**Endpoint:** `POST /{tenant}/workflows/procurement/create-po/{prId}`  
**Auth:** Bearer (ADMIN, BUYER, MANAGER)  
**Description:** Generate purchase order from an approved purchase requisition

#### Request Body
```json
{
  "vendorIds": ["ven_tech001", "ven_monitors002"]
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Purchase Order created successfully",
  "data": {
    "id": "po_2025001",
    "poNumber": "PO-202501-0001",
    "title": "PO for Q1 2025 IT Equipment Purchase",
    "amount": 40700.00,
    "status": "DRAFT",
    "prId": "pr_2025q1001",
    "contractId": "con_tech001",
    "createdById": "usr_buyer001",
    "expectedDelivery": "2025-03-15T00:00:00Z",
    "paymentTerms": "Net 30 days",
    "deliveryAddress": {
      "attention": "Receiving Department",
      "street": "456 Industrial Ave",
      "city": "New York",
      "state": "NY",
      "zipCode": "10002",
      "country": "USA"
    },
    "vendors": [
      {
        "vendorId": "ven_tech001",
        "role": "PRIMARY",
        "vendor": {
          "id": "ven_tech001",
          "name": "TechCorp Suppliers Ltd",
          "contactEmail": "procurement@techcorp.com",
          "contactPhone": "+1-555-0123"
        },
        "itemsAssigned": [
          "LAPTOP-MBP-16",
          "KB-MOUSE-SET"
        ]
      },
      {
        "vendorId": "ven_monitors002",
        "role": "SECONDARY",
        "vendor": {
          "id": "ven_monitors002",
          "name": "Display Solutions Inc",
          "contactEmail": "orders@displaysolutions.com",
          "contactPhone": "+1-555-9876"
        },
        "itemsAssigned": [
          "MONITOR-LG-27"
        ]
      }
    ],
    "items": [
      {
        "itemCode": "LAPTOP-MBP-16",
        "quantity": 10,
        "unitPrice": 3500.00,
        "totalPrice": 35000.00,
        "vendorId": "ven_tech001"
      },
      {
        "itemCode": "MONITOR-LG-27",
        "quantity": 10,
        "unitPrice": 450.00,
        "totalPrice": 4500.00,
        "vendorId": "ven_monitors002"
      },
      {
        "itemCode": "KB-MOUSE-SET",
        "quantity": 10,
        "unitPrice": 120.00,
        "totalPrice": 1200.00,
        "vendorId": "ven_tech001"
      }
    ],
    "createdAt": "2025-01-21T10:00:00.000Z"
  },
  "meta": {
    "nextSteps": [
      "PO approval workflow",
      "Vendor confirmation",
      "Track delivery progress",
      "Goods receipt upon delivery"
    ]
  }
}
```

---

### 1.5 Approve/Reject Purchase Order
**Endpoint:** `POST /{tenant}/workflows/procurement/approve-po/{poId}`  
**Auth:** Bearer (ADMIN, MANAGER, FINANCE, APPROVER)  
**Description:** Approve or reject a draft purchase order

#### Request Body
```json
{
  "approved": true,
  "comments": "Budget verified, vendor credentials confirmed. Approved for processing."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Purchase Order approved successfully",
  "data": {
    "id": "po_2025001",
    "poNumber": "PO-202501-0001",
    "status": "APPROVED",
    "approvedAt": "2025-01-21T16:20:00.000Z",
    "approvedById": "usr_manager001",
    "totalAmount": 40700.00
  },
  "meta": {
    "nextSteps": [
      "PO sent to vendors",
      "Track delivery status",
      "Create goods receipt upon delivery",
      "Process vendor invoice"
    ]
  }
}
```

---

### 1.6 Create Goods Receipt
**Endpoint:** `POST /{tenant}/workflows/procurement/goods-receipt/{poId}`  
**Auth:** Bearer (ADMIN, BUYER, MANAGER)  
**Description:** Record receipt of goods delivered against a purchase order

#### Request Body
```json
{
  "receivedDate": "2025-03-10T14:00:00Z",
  "receivedItems": [
    {
      "itemCode": "LAPTOP-MBP-16",
      "description": "MacBook Pro 16-inch M3 Max",
      "orderedQuantity": 10,
      "receivedQuantity": 10,
      "condition": "GOOD",
      "serialNumbers": [
        "SN-MBP-2025-001",
        "SN-MBP-2025-002",
        "SN-MBP-2025-003",
        "SN-MBP-2025-004",
        "SN-MBP-2025-005",
        "SN-MBP-2025-006",
        "SN-MBP-2025-007",
        "SN-MBP-2025-008",
        "SN-MBP-2025-009",
        "SN-MBP-2025-010"
      ],
      "remarks": "All units tested and functioning properly"
    },
    {
      "itemCode": "MONITOR-LG-27",
      "description": "LG 27-inch 4K Monitor",
      "orderedQuantity": 10,
      "receivedQuantity": 9,
      "condition": "GOOD",
      "remarks": "1 unit damaged in transit - vendor notified for replacement"
    },
    {
      "itemCode": "KB-MOUSE-SET",
      "description": "Wireless Keyboard and Mouse Set",
      "orderedQuantity": 10,
      "receivedQuantity": 10,
      "condition": "GOOD"
    }
  ],
  "notes": "Partial delivery - 1 monitor damaged and requires replacement. All other items received in excellent condition.",
  "inspectionNotes": "Quality inspection completed. All laptops tested for hardware specifications. Monitors checked for dead pixels. All peripherals functional.",
  "inspectedBy": "Michael Chen - Receiving Manager",
  "storageLocationId": "sl_wh001"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Goods Receipt created successfully",
  "data": {
    "id": "gr_202503001",
    "receiptNumber": "GR-202503-0001",
    "poId": "po_2025001",
    "poNumber": "PO-202501-0001",
    "receivedDate": "2025-03-10T14:00:00Z",
    "status": "PARTIAL",
    "inspectedBy": "Michael Chen - Receiving Manager",
    "inspectedAt": "2025-03-10T15:30:00Z",
    "storageLocationId": "sl_wh001",
    "storageLocation": {
      "code": "SL001",
      "name": "Main Warehouse"
    },
    "receivedItems": {
      "totalItems": 3,
      "fullyReceived": 2,
      "partiallyReceived": 1,
      "damaged": 1
    },
    "summary": {
      "orderedValue": 40700.00,
      "receivedValue": 40250.00,
      "variance": -450.00,
      "completionPercentage": 98.9
    },
    "createdAt": "2025-03-10T15:30:00.000Z"
  },
  "meta": {
    "nextSteps": [
      "Process vendor invoice",
      "Schedule replacement delivery for damaged item",
      "Payment processing upon invoice approval"
    ]
  }
}
```

---

## 2. Tender Workflow

The tender workflow follows this sequence:  
**Create Tender → Publish → Vendor Submissions → Close → Evaluate → Award**

### 2.1 Create Tender from Contract
**Endpoint:** `POST /{tenant}/workflows/tender/create/{contractId}`  
**Auth:** Bearer (ADMIN, BUYER, MANAGER)  
**Description:** Create a new tender based on an existing contract

#### Request Body
```json
{
  "title": "Cloud Infrastructure Services RFP 2025",
  "description": "Comprehensive request for proposal for enterprise cloud infrastructure services including compute, storage, networking, and managed services for a 3-year term",
  "requirements": {
    "technical": [
      "99.99% uptime SLA",
      "24/7 technical support with <1hr response time for P1 issues",
      "ISO 27001 and SOC 2 Type II certified data centers",
      "Multi-region deployment capability",
      "Automated backup and disaster recovery",
      "Real-time monitoring and alerting dashboard"
    ],
    "commercial": [
      "Fixed monthly pricing for baseline services",
      "Transparent usage-based pricing for additional resources",
      "Payment terms: Net 30 days from invoice date",
      "Minimum 3-year contract commitment",
      "Annual price adjustment not to exceed CPI + 2%"
    ],
    "compliance": [
      "GDPR and CCPA compliant",
      "Data residency in US/EU regions",
      "Right to audit data security controls",
      "Incident notification within 24 hours"
    ]
  },
  "criteria": {
    "technical": {
      "weight": 50,
      "maxScore": 100,
      "subCriteria": {
        "infrastructure": 30,
        "security": 25,
        "support": 20,
        "scalability": 15,
        "innovation": 10
      }
    },
    "commercial": {
      "weight": 30,
      "maxScore": 100,
      "subCriteria": {
        "pricing": 50,
        "paymentTerms": 20,
        "contractFlexibility": 30
      }
    },
    "experience": {
      "weight": 20,
      "maxScore": 100,
      "subCriteria": {
        "trackRecord": 40,
        "references": 30,
        "teamExpertise": 30
      }
    }
  },
  "estimatedValue": 2500000.00,
  "closingDate": "2025-03-15T17:00:00Z",
  "category": "IT_SERVICES",
  "department": "IT Infrastructure",
  "minimumBids": 3,
  "allowLateSubmissions": false,
  "requireBidBond": true,
  "bidBondPercentage": 5
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Tender created successfully",
  "data": {
    "id": "tnd_cloud2025",
    "tenderNumber": "TND-202501-0005",
    "title": "Cloud Infrastructure Services RFP 2025",
    "description": "Comprehensive request for proposal for enterprise cloud infrastructure services...",
    "status": "DRAFT",
    "estimatedValue": 2500000.00,
    "closingDate": "2025-03-15T17:00:00Z",
    "contractId": "con_cloud001",
    "creatorId": "usr_buyer001",
    "category": "IT_SERVICES",
    "department": "IT Infrastructure",
    "requirements": {
      "technical": [
        "99.99% uptime SLA",
        "24/7 technical support with <1hr response time for P1 issues",
        "..."
      ],
      "commercial": ["..."],
      "compliance": ["..."]
    },
    "criteria": {
      "technical": {
        "weight": 50,
        "maxScore": 100
      },
      "commercial": {
        "weight": 30,
        "maxScore": 100
      },
      "experience": {
        "weight": 20,
        "maxScore": 100
      }
    },
    "submissionWindow": {
      "opensAt": "2025-01-25T09:00:00.000Z",
      "closesAt": "2025-03-15T17:00:00Z",
      "durationDays": 49
    },
    "createdAt": "2025-01-25T09:00:00.000Z"
  },
  "meta": {
    "nextSteps": [
      "Review tender details",
      "Publish tender to vendors",
      "Monitor vendor submissions",
      "Evaluate bids after closing date"
    ]
  }
}
```

---

### 2.2 Publish Tender
**Endpoint:** `POST /{tenant}/workflows/tender/publish/{tenderId}`  
**Auth:** Bearer (ADMIN, BUYER, MANAGER)  
**Description:** Make tender publicly available for vendor submissions

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tender published successfully",
  "data": {
    "id": "tnd_cloud2025",
    "tenderNumber": "TND-202501-0005",
    "status": "PUBLISHED",
    "publishedAt": "2025-01-26T10:00:00.000Z",
    "publicUrl": "https://vendor-portal.acme.com/tenders/TND-202501-0005",
    "notifiedVendors": 25,
    "submissionDeadline": "2025-03-15T17:00:00Z"
  },
  "meta": {
    "nextSteps": [
      "Vendors can now submit bids",
      "Monitor bid submissions",
      "Answer vendor queries",
      "Close tender on specified date"
    ]
  }
}
```

---

### 2.3 Submit Bid (Vendor)
**Endpoint:** `POST /{tenant}/workflows/tender/submit-bid/{tenderId}`  
**Auth:** Bearer (VENDOR)  
**Description:** Vendor submits a bid in response to a published tender

#### Request Body
```json
{
  "bidAmount": 2350000.00,
  "technicalProposal": {
    "executiveSummary": "CloudTech Solutions proposes a comprehensive cloud infrastructure solution leveraging AWS and Azure multi-cloud architecture...",
    "approach": {
      "architecture": "Hybrid multi-cloud deployment with primary infrastructure on AWS and failover on Azure",
      "implementation": "Phased rollout over 12 weeks with zero-downtime migration",
      "timeline": "Phase 1 (Weeks 1-4): Planning & Setup, Phase 2 (Weeks 5-8): Migration, Phase 3 (Weeks 9-12): Optimization & Handover"
    },
    "infrastructure": {
      "compute": "Auto-scaling EC2 instances with reserved capacity for baseline workload",
      "storage": "S3 with intelligent tiering and cross-region replication",
      "networking": "VPC with private subnets, Transit Gateway for multi-region connectivity",
      "security": "AWS WAF, GuardDuty, Security Hub, and third-party SIEM integration"
    },
    "sla": {
      "uptime": "99.99% guaranteed with financial penalties for non-compliance",
      "support": "24/7/365 support with 15min response for P1, 1hr for P2",
      "monitoring": "Real-time dashboard with custom alerting and weekly SLA reports"
    },
    "team": {
      "projectManager": "Jane Smith, PMP, 15 years experience",
      "technicalLead": "Robert Johnson, AWS Solutions Architect Professional",
      "securityLead": "Emily Davis, CISSP, CCSP",
      "teamSize": 12,
      "location": "US-based with follow-the-sun support"
    }
  },
  "financialProposal": {
    "breakdown": {
      "baselineInfrastructure": {
        "monthlyFee": 45000.00,
        "annualCost": 540000.00,
        "description": "Compute, storage, networking baseline"
      },
      "managedServices": {
        "monthlyFee": 25000.00,
        "annualCost": 300000.00,
        "description": "24/7 monitoring, patching, optimization"
      },
      "support": {
        "monthlyFee": 15000.00,
        "annualCost": 180000.00,
        "description": "Premium support with dedicated TAM"
      },
      "additionalServices": {
        "monthlyFee": 5000.00,
        "annualCost": 60000.00,
        "description": "Security audits, compliance reporting"
      }
    },
    "totalMonthly": 90000.00,
    "totalAnnual": 1080000.00,
    "threeYearTotal": 2350000.00,
    "paymentSchedule": [
      {
        "milestone": "Contract signing",
        "percentage": 10,
        "amount": 235000.00,
        "dueDate": "Upon signature"
      },
      {
        "milestone": "Phase 1 completion",
        "percentage": 15,
        "amount": 352500.00,
        "dueDate": "Week 4"
      },
      {
        "milestone": "Monthly recurring",
        "percentage": 75,
        "amount": 1762500.00,
        "dueDate": "Net 30 from monthly invoice"
      }
    ],
    "discounts": {
      "earlyPayment": "2% discount for payment within 10 days",
      "threeYearCommitment": "15% discount applied to monthly rates"
    }
  },
  "compliance": {
    "iso27001": true,
    "soc2Type2": true,
    "gdprCompliant": true,
    "ccpaCompliant": true,
    "dataResidency": "US-East, US-West, EU-West regions available",
    "auditRights": "Full audit rights with 30-day notice",
    "incidentNotification": "Within 4 hours for security incidents",
    "insurance": {
      "cyberLiability": 10000000.00,
      "professionalIndemnity": 5000000.00,
      "provider": "Lloyd's of London"
    }
  },
  "references": [
    {
      "company": "Fortune 500 Financial Services Company",
      "project": "Multi-cloud infrastructure migration",
      "contactPerson": "John Doe, CTO",
      "contactEmail": "john.doe@example.com",
      "projectValue": 5000000.00,
      "duration": "3 years (ongoing)"
    },
    {
      "company": "Global E-commerce Platform",
      "project": "High-availability cloud infrastructure",
      "contactPerson": "Sarah Williams, VP Engineering",
      "contactEmail": "sarah.w@example.com",
      "projectValue": 3500000.00,
      "duration": "2 years (completed)"
    }
  ],
  "attachments": [
    {
      "type": "TECHNICAL_ARCHITECTURE",
      "fileName": "cloud-architecture-diagram.pdf",
      "fileSize": 2500000,
      "uploadDate": "2025-03-10T10:00:00Z"
    },
    {
      "type": "CERTIFICATIONS",
      "fileName": "iso27001-soc2-certificates.pdf",
      "fileSize": 1200000,
      "uploadDate": "2025-03-10T10:05:00Z"
    },
    {
      "type": "COMPANY_PROFILE",
      "fileName": "cloudtech-company-profile.pdf",
      "fileSize": 3000000,
      "uploadDate": "2025-03-10T10:10:00Z"
    }
  ]
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Bid submitted successfully",
  "data": {
    "id": "bid_cloudtech001",
    "tenderId": "tnd_cloud2025",
    "tenderNumber": "TND-202501-0005",
    "vendorId": "ven_cloudtech",
    "vendorName": "CloudTech Solutions Inc",
    "bidAmount": 2350000.00,
    "status": "SUBMITTED",
    "submittedAt": "2025-03-10T16:30:00.000Z",
    "bidNumber": "BID-202503-0012",
    "validUntil": "2025-06-15T17:00:00Z"
  },
  "meta": {
    "nextSteps": [
      "Wait for tender closing",
      "Evaluation by procurement team",
      "Notification of results",
      "Contract award if successful"
    ]
  }
}
```

---

### 2.4 Close Tender
**Endpoint:** `POST /{tenant}/workflows/tender/close/{tenderId}`  
**Auth:** Bearer (ADMIN, BUYER, MANAGER)  
**Description:** Close tender to new submissions and begin evaluation

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tender closed successfully",
  "data": {
    "id": "tnd_cloud2025",
    "tenderNumber": "TND-202501-0005",
    "status": "CLOSED",
    "closingDate": "2025-03-15T17:00:00Z",
    "submittedBids": 7,
    "qualifiedBids": 6,
    "disqualifiedBids": 1,
    "averageBidAmount": 2450000.00,
    "lowestBid": 2100000.00,
    "highestBid": 2900000.00
  },
  "meta": {
    "nextSteps": [
      "Evaluate all submitted bids",
      "Score technical and commercial proposals",
      "Conduct vendor presentations if required",
      "Select winning vendor",
      "Award contract and create purchase order"
    ]
  }
}
```

---

### 2.5 Evaluate Bid
**Endpoint:** `POST /{tenant}/workflows/tender/evaluate-bid/{bidId}`  
**Auth:** Bearer (ADMIN, BUYER, MANAGER)  
**Description:** Score and evaluate a submitted bid

#### Request Body
```json
{
  "technicalScore": 88.5,
  "commercialScore": 92.0,
  "evaluationNotes": "Strong technical proposal with comprehensive architecture and proven track record. Competitive pricing with attractive payment terms. Excellent references from similar-scale projects. Minor concerns about team availability during peak periods, but overall very strong submission. Recommended for shortlist."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Bid evaluated successfully",
  "data": {
    "id": "bid_cloudtech001",
    "bidNumber": "BID-202503-0012",
    "vendorName": "CloudTech Solutions Inc",
    "technicalScore": 88.5,
    "commercialScore": 92.0,
    "experienceScore": 85.0,
    "weightedScores": {
      "technical": 44.25,
      "commercial": 27.6,
      "experience": 17.0
    },
    "totalScore": 88.85,
    "ranking": 1,
    "status": "UNDER_REVIEW",
    "evaluatedAt": "2025-03-16T10:00:00.000Z",
    "evaluatedBy": "usr_buyer001",
    "evaluator": {
      "name": "John Buyer",
      "role": "BUYER"
    },
    "recommendation": "SHORTLIST"
  },
  "meta": {
    "nextSteps": [
      "Complete evaluation of all bids",
      "Compare scores and rankings",
      "Conduct vendor presentations for top 3",
      "Make final selection",
      "Award tender to selected vendor"
    ]
  }
}
```

---

### 2.6 Award Tender
**Endpoint:** `POST /{tenant}/workflows/tender/award/{tenderId}/{winningBidId}`  
**Auth:** Bearer (ADMIN, MANAGER)  
**Description:** Award the tender to the winning bidder

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tender awarded successfully",
  "data": {
    "tenderId": "tnd_cloud2025",
    "tenderNumber": "TND-202501-0005",
    "winningBidId": "bid_cloudtech001",
    "winningBidNumber": "BID-202503-0012",
    "awardedVendor": {
      "id": "ven_cloudtech",
      "name": "CloudTech Solutions Inc",
      "contactEmail": "contracts@cloudtech.com",
      "bidAmount": 2350000.00,
      "finalScore": 88.85
    },
    "awardDate": "2025-03-20T14:00:00.000Z",
    "contractValue": 2350000.00,
    "contractDuration": "36 months",
    "status": "AWARDED",
    "purchaseOrder": {
      "id": "po_cloud2025",
      "poNumber": "PO-202503-0025",
      "status": "DRAFT",
      "message": "Purchase Order created automatically from awarded tender"
    }
  },
  "meta": {
    "nextSteps": [
      "Generate contract amendment",
      "Notify winning vendor",
      "Notify unsuccessful vendors",
      "Begin contract execution",
      "Track delivery and performance"
    ]
  }
}
```

---

## 3. Invoice & Payment Processing

### 3.1 Create Invoice (Vendor)
**Endpoint:** `POST /{tenant}/invoices`  
**Auth:** Bearer (VENDOR, FINANCE)  
**Description:** Create an invoice for delivered goods or services

#### Request Body
```json
{
  "poId": "po_2025001",
  "invoiceNumber": "INV-TECH-2025-0042",
  "invoiceDate": "2025-03-12T00:00:00Z",
  "dueDate": "2025-04-11T00:00:00Z",
  "items": [
    {
      "itemCode": "LAPTOP-MBP-16",
      "description": "MacBook Pro 16-inch M3 Max",
      "quantity": 10,
      "unitPrice": 3500.00,
      "totalPrice": 35000.00,
      "taxRate": 8.875,
      "taxAmount": 3106.25
    },
    {
      "itemCode": "KB-MOUSE-SET",
      "description": "Wireless Keyboard and Mouse Set",
      "quantity": 10,
      "unitPrice": 120.00,
      "totalPrice": 1200.00,
      "taxRate": 8.875,
      "taxAmount": 106.50
    }
  ],
  "subtotal": 36200.00,
  "taxTotal": 3212.75,
  "total": 39412.75,
  "currencyCode": "USD",
  "notes": "Payment terms: Net 30 days. Wire transfer details provided separately.",
  "attachments": [
    {
      "type": "INVOICE_DOCUMENT",
      "fileName": "invoice-INV-TECH-2025-0042.pdf",
      "fileUrl": "https://storage.techcorp.com/invoices/INV-TECH-2025-0042.pdf"
    }
  ]
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Invoice created successfully",
  "data": {
    "id": "inv_202503001",
    "invoiceNumber": "INV-TECH-2025-0042",
    "vendorInvoiceNumber": "INV-TECH-2025-0042",
    "poId": "po_2025001",
    "poNumber": "PO-202501-0001",
    "vendorId": "ven_tech001",
    "vendorName": "TechCorp Suppliers Ltd",
    "status": "PENDING_APPROVAL",
    "invoiceDate": "2025-03-12T00:00:00Z",
    "dueDate": "2025-04-11T00:00:00Z",
    "subtotal": 36200.00,
    "taxTotal": 3212.75,
    "total": 39412.75,
    "currencyCode": "USD",
    "paymentStatus": "UNPAID",
    "createdAt": "2025-03-12T09:00:00.000Z"
  },
  "meta": {
    "nextSteps": [
      "Finance team review",
      "Verify against goods receipt",
      "Approve for payment",
      "Schedule payment before due date"
    ]
  }
}
```

---

### 3.2 Approve Invoice
**Endpoint:** `PUT /{tenant}/invoices/{invoiceId}/approve`  
**Auth:** Bearer (FINANCE, ADMIN)  
**Description:** Approve invoice for payment

#### Request Body
```json
{
  "approved": true,
  "comments": "Invoice verified against GR-202503-0001. Amounts and items match. Approved for payment."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Invoice approved successfully",
  "data": {
    "id": "inv_202503001",
    "invoiceNumber": "INV-TECH-2025-0042",
    "status": "APPROVED",
    "approvedAt": "2025-03-13T10:30:00.000Z",
    "approvedBy": "usr_finance001",
    "approver": {
      "name": "Lisa Finance",
      "role": "FINANCE"
    },
    "paymentStatus": "SCHEDULED",
    "scheduledPaymentDate": "2025-04-10T00:00:00Z"
  },
  "meta": {
    "nextSteps": [
      "Payment scheduled for 2025-04-10",
      "Payment will be processed automatically",
      "Vendor will receive payment confirmation"
    ]
  }
}
```

---

### 3.3 Process Payment
**Endpoint:** `POST /{tenant}/payments`  
**Auth:** Bearer (FINANCE, ADMIN)  
**Description:** Create and process payment for approved invoice

#### Request Body
```json
{
  "invoiceId": "inv_202503001",
  "paymentMethod": "WIRE_TRANSFER",
  "paymentDate": "2025-04-10T00:00:00Z",
  "amount": 39412.75,
  "currencyCode": "USD",
  "reference": "PAYMENT-PO-202501-0001-INV-TECH-2025-0042",
  "bankDetails": {
    "bankName": "First National Bank",
    "accountName": "TechCorp Suppliers Ltd",
    "accountNumber": "XXXX-XXXX-1234",
    "routingNumber": "123456789",
    "swift": "FNBAUS33"
  },
  "notes": "Payment for IT equipment as per PO-202501-0001"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Payment processed successfully",
  "data": {
    "id": "pay_202504001",
    "paymentNumber": "PAY-202504-0001",
    "invoiceId": "inv_202503001",
    "invoiceNumber": "INV-TECH-2025-0042",
    "vendorId": "ven_tech001",
    "vendorName": "TechCorp Suppliers Ltd",
    "amount": 39412.75,
    "currencyCode": "USD",
    "paymentMethod": "WIRE_TRANSFER",
    "paymentDate": "2025-04-10T00:00:00Z",
    "status": "COMPLETED",
    "transactionId": "TXN-20250410-ABC123XYZ",
    "reference": "PAYMENT-PO-202501-0001-INV-TECH-2025-0042",
    "processedAt": "2025-04-10T09:15:00.000Z",
    "processedBy": "usr_finance001"
  },
  "meta": {
    "nextSteps": [
      "Payment confirmation sent to vendor",
      "Update accounting system",
      "Archive transaction records",
      "Close purchase order if fully paid"
    ]
  }
}
```

---

## 4. Workflow Status Tracking

### 4.1 Get Workflow Status
**Endpoint:** `GET /{tenant}/workflows/status/{entityType}/{entityId}`  
**Auth:** Bearer  
**Description:** Track progress of any workflow entity

**Entity Types:** `contract`, `pr`, `po`, `tender`, `bid`, `invoice`, `payment`

#### Example: Purchase Order Status
**Request:** `GET /{tenant}/workflows/status/po/po_2025001`

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Workflow status retrieved successfully",
  "data": {
    "entityType": "po",
    "entityId": "po_2025001",
    "poNumber": "PO-202501-0001",
    "currentStatus": "DELIVERED",
    "workflow": {
      "steps": [
        {
          "step": "CREATE_PR",
          "status": "COMPLETED",
          "completedAt": "2025-01-20T09:15:00.000Z",
          "completedBy": "usr_buyer001",
          "completedByName": "John Buyer"
        },
        {
          "step": "APPROVE_PR",
          "status": "COMPLETED",
          "completedAt": "2025-01-20T14:30:00.000Z",
          "completedBy": "usr_manager001",
          "completedByName": "Sarah Johnson"
        },
        {
          "step": "CREATE_PO",
          "status": "COMPLETED",
          "completedAt": "2025-01-21T10:00:00.000Z",
          "completedBy": "usr_buyer001",
          "completedByName": "John Buyer"
        },
        {
          "step": "APPROVE_PO",
          "status": "COMPLETED",
          "completedAt": "2025-01-21T16:20:00.000Z",
          "completedBy": "usr_manager001",
          "completedByName": "Sarah Johnson"
        },
        {
          "step": "GOODS_RECEIPT",
          "status": "COMPLETED",
          "completedAt": "2025-03-10T15:30:00.000Z",
          "completedBy": "usr_warehouse001",
          "completedByName": "Michael Chen"
        },
        {
          "step": "INVOICE_PROCESSING",
          "status": "COMPLETED",
          "completedAt": "2025-03-13T10:30:00.000Z",
          "completedBy": "usr_finance001",
          "completedByName": "Lisa Finance"
        },
        {
          "step": "PAYMENT",
          "status": "SCHEDULED",
          "scheduledFor": "2025-04-10T00:00:00.000Z",
          "assignedTo": "usr_finance001"
        }
      ],
      "progress": {
        "completed": 6,
        "total": 7,
        "percentage": 85.7
      }
    },
    "nextActions": [
      "Process scheduled payment on 2025-04-10"
    ],
    "relatedDocuments": {
      "pr": {
        "id": "pr_2025q1001",
        "number": "PR-202501-0001",
        "status": "APPROVED"
      },
      "contract": {
        "id": "con_tech001",
        "number": "CON-2024-0123",
        "status": "IN_PROGRESS"
      },
      "goodsReceipts": [
        {
          "id": "gr_202503001",
          "number": "GR-202503-0001",
          "status": "PARTIAL"
        }
      ],
      "invoices": [
        {
          "id": "inv_202503001",
          "number": "INV-TECH-2025-0042",
          "status": "APPROVED"
        }
      ],
      "payments": [
        {
          "id": "pay_202504001",
          "number": "PAY-202504-0001",
          "status": "SCHEDULED"
        }
      ]
    },
    "timeline": {
      "created": "2025-01-21T10:00:00.000Z",
      "approved": "2025-01-21T16:20:00.000Z",
      "delivered": "2025-03-10T15:30:00.000Z",
      "invoiced": "2025-03-12T09:00:00.000Z",
      "paymentDue": "2025-04-11T00:00:00.000Z",
      "estimatedCompletion": "2025-04-10T00:00:00.000Z"
    }
  }
}
```

---

## 5. Transaction Statistics

### 5.1 Purchase Order Statistics
**Endpoint:** `GET /{tenant}/transactions/statistics/purchase-orders`  
**Auth:** Bearer  
**Description:** Get PO statistics and trends

#### Query Parameters
- `period`: `daily`, `weekly`, `monthly`, `yearly`
- `year`: Filter by year (default: current year)
- `month`: Filter by month
- `status`: Filter by PO status
- `createdBy`: Filter by creator

#### Example Request
`GET /{tenant}/transactions/statistics/purchase-orders?period=monthly&year=2025`

#### Response (200 OK)
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
      "deliveredPOs": 25,
      "completedPOs": 5,
      "cancelledPOs": 3,
      "totalValue": 2750000.00,
      "averageValue": 22000.00,
      "medianValue": 18500.00
    },
    "trends": [
      {
        "period": "2025-01",
        "count": 15,
        "value": 325000.00,
        "avgValue": 21666.67
      },
      {
        "period": "2025-02",
        "count": 18,
        "value": 415000.00,
        "avgValue": 23055.56
      },
      {
        "period": "2025-03",
        "count": 22,
        "value": 512000.00,
        "avgValue": 23272.73
      }
    ],
    "topVendors": [
      {
        "vendorId": "ven_tech001",
        "vendorName": "TechCorp Suppliers Ltd",
        "totalPOs": 8,
        "totalValue": 185000.00,
        "avgValue": 23125.00,
        "onTimeDelivery": 95.5
      },
      {
        "vendorId": "ven_monitors002",
        "vendorName": "Display Solutions Inc",
        "totalPOs": 6,
        "totalValue": 142000.00,
        "avgValue": 23666.67,
        "onTimeDelivery": 92.3
      }
    ],
    "byStatus": {
      "DRAFT": { "count": 12, "value": 245000.00 },
      "APPROVED": { "count": 45, "value": 985000.00 },
      "IN_PROGRESS": { "count": 35, "value": 825000.00 },
      "DELIVERED": { "count": 25, "value": 580000.00 },
      "COMPLETED": { "count": 5, "value": 95000.00 },
      "CANCELLED": { "count": 3, "value": 20000.00 }
    },
    "byCategory": {
      "IT_EQUIPMENT": { "count": 45, "value": 1250000.00 },
      "OFFICE_SUPPLIES": { "count": 35, "value": 215000.00 },
      "SERVICES": { "count": 25, "value": 985000.00 },
      "OTHER": { "count": 20, "value": 300000.00 }
    }
  }
}
```

---

### 5.2 Tender Statistics
**Endpoint:** `GET /{tenant}/transactions/statistics/tenders`  
**Auth:** Bearer  
**Description:** Get tender and bidding statistics

#### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tender statistics retrieved successfully",
  "data": {
    "summary": {
      "totalTenders": 42,
      "activeTenders": 8,
      "closedTenders": 22,
      "awardedTenders": 12,
      "totalBids": 287,
      "averageBidsPerTender": 6.8,
      "totalValue": 15750000.00,
      "averageTenderValue": 375000.00
    },
    "successMetrics": {
      "awardRate": 28.6,
      "averageTimeToAward": 45,
      "competitionIndex": 6.8,
      "costSavings": {
        "totalEstimated": 16500000.00,
        "totalAwarded": 15750000.00,
        "savingsAmount": 750000.00,
        "savingsPercentage": 4.5
      }
    },
    "vendorParticipation": {
      "uniqueVendors": 85,
      "activeVendors": 62,
      "averageVendorBids": 3.4,
      "topVendors": [
        {
          "vendorId": "ven_cloudtech",
          "vendorName": "CloudTech Solutions Inc",
          "totalBids": 15,
          "wonTenders": 4,
          "winRate": 26.7,
          "totalValue": 8500000.00
        }
      ]
    }
  }
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Transaction validation failed",
  "errors": [
    "Purchase Requisition must be approved before creating PO",
    "Vendor not found or inactive",
    "Insufficient budget allocation for this purchase"
  ],
  "details": {
    "field": "vendorIds",
    "constraint": "must contain at least one valid vendor"
  }
}
```

### Common Error Codes
- **400** - Bad Request (validation errors, invalid workflow state)
- **401** - Unauthorized (missing or invalid JWT)
- **403** - Forbidden (insufficient role permissions)
- **404** - Not Found (entity doesn't exist)
- **409** - Conflict (duplicate numbers, invalid state transition)
- **422** - Unprocessable Entity (business logic error)

### Workflow-Specific Errors
```json
{
  "success": false,
  "statusCode": 422,
  "message": "Workflow transition not allowed",
  "errorCode": "INVALID_STATUS_TRANSITION",
  "currentStatus": "DRAFT",
  "attemptedTransition": "DELIVERED",
  "allowedTransitions": ["APPROVED", "CANCELLED"],
  "reason": "PO must be approved before goods can be received"
}
```

---

## Business Rules

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

## Rate Limiting
Transaction endpoints are subject to role-based rate limiting:
- **ADMIN**: 5000 requests/hour
- **BUYER**, **MANAGER**: 2000 requests/hour
- **USER**, **FINANCE**: 1000 requests/hour
- **VENDOR**: 500 requests/hour

Rate limit headers:
```
X-RateLimit-Limit: 2000
X-RateLimit-Remaining: 1847
X-RateLimit-Reset: 1640998800
```

---

## Swagger Documentation
Complete API documentation with interactive testing is available at:
```
/{API_PREFIX}/docs
```
