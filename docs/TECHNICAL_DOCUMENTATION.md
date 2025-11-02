# E-Procurement Sourcing Backend - Technical Documentation

**Version**: 2.0  
**Last Updated**: October 26, 2025  
**System**: Multi-tenant SaaS E-Procurement Platform  

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Data Model & Schema](#data-model--schema)
4. [Business Processes](#business-processes)
5. [Configuration-Driven Design](#configuration-driven-design)
6. [API Structure](#api-structure)
7. [Security & Authentication](#security--authentication)
8. [Deployment & Operations](#deployment--operations)
9. [Testing Strategy](#testing-strategy)

---

## 1. System Overview

### Purpose
A comprehensive multi-tenant e-procurement platform supporting the complete procurement lifecycle from tendering to payment, with SAP-inspired configuration-driven architecture for maximum flexibility across diverse organizational structures.

### Key Capabilities
- **Multi-Tenancy**: Path-based tenant isolation (`/api/v1/:tenant`)
- **Complete Procurement Cycle**: Tender → Quotation → Bid → Contract → PR → PO → Goods Receipt → Invoice → Payment
- **Flexible Organization Structure**: SAP-style hierarchical org units (Company Code → Plant → Storage Location, Purchasing Org → Purchasing Group)
- **Configuration-Driven**: ProcessConfig, TenantConfig, and RBACConfig enable zero-code adaptations
- **Vendor Management**: Full vendor lifecycle with bid encryption and performance tracking
- **Budget Control**: Real-time budget tracking with allocation, transfer, and commitment management
- **Audit & Compliance**: Complete audit trail with event-driven architecture

### Technology Stack
- **Runtime**: Node.js 18+ with NestJS framework
- **Database**: PostgreSQL (primary), MongoDB (bid document encryption)
- **ORM**: Prisma 6+
- **Authentication**: JWT with refresh tokens, passport strategies
- **Event Bus**: Kafka-ready outbox pattern
- **Deployment**: Render.com with Docker support
- **Additional Services**: Go-based bid scoring microservice

---

## 2. Architecture

### 2.1 Multi-Tenancy Model

**Path-Based Tenant Resolution**:
```
/api/v1/:tenant/...
```

**Tenant Isolation Strategy**:
- Every table includes `tenantId` with indexed foreign key to `Tenant`
- Middleware (`TenantMiddleware`) resolves tenant slug → `tenantId`
- Interceptor (`TenantInterceptor`) validates JWT `tenantId` matches route
- Prisma middleware (ALS-based) auto-injects `tenantId` in queries
- Database session variables for RLS debugging

**Tenant Provisioning**:
```http
POST /api/v1/tenants
{
  "name": "Company Name",
  "subdomain": "company-slug",
  "config": { "region": "us" },
  "admin": {
    "email": "admin@company.com",
    "username": "admin",
    "password": "SecurePassword123!",
    "firstName": "Admin",
    "lastName": "User"
  }
}
```

### 2.2 Layer Architecture

```
┌─────────────────────────────────────────┐
│     Configuration Layer (Basis)         │
│  TenantConfig, ProcessConfig, RBAC      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        Master Data Layer                │
│  CompanyCode, Plant, PurchasingOrg,     │
│  Vendor, User, Currency, OrgUnit        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       Transaction Layer                 │
│  Tender, Bid, PR, PO, GR,              │
│  Invoice, Payment, Contract             │
└─────────────────────────────────────────┘
```

### 2.3 Core Modules

**Authentication & Authorization**:
- `auth.module.ts`: JWT strategy, login, register, refresh tokens
- `RolesGuard`: Role-based access control (RBAC)
- `CaslAbilityGuard`: Fine-grained permissions via CASL
- `ThrottlerGuard`: Rate limiting per role

**Configuration Management**:
- `config.module.ts`: Tenant-specific configurations
- `SystemConfigService`: Global system parameters
- `ProcessConfigService`: Workflow orchestration rules

**Master Data**:
- `vendor.module.ts`: Vendor CRUD with performance tracking
- `organizational-structure.module.ts`: SAP-style org hierarchy
- `currency.module.ts`: Multi-currency support

**Transactions**:
- `tender.module.ts`: Tendering and bid evaluation
- `purchase-requisition.module.ts`: PR workflow
- `purchase-order.module.ts`: PO management with multi-vendor splits
- `invoice.module.ts`: Invoice processing with 3-way matching
- `payment.module.ts`: Payment execution

**Workflows**:
- `workflow.module.ts`: Orchestrates end-to-end procurement flows
- Supports both tender-based and contract-based procurement paths

**Supporting Services**:
- `audit.module.ts`: Comprehensive audit logging
- `event.module.ts`: Event emission (outbox pattern)
- `notification.module.ts`: User notifications
- `budget.module.ts`: Budget control and tracking
- `statistics.module.ts`: Reporting and analytics

---

## 3. Data Model & Schema

### 3.1 Configuration Layer

**TenantConfig**
```prisma
model TenantConfig {
  id               String   @id @default(cuid())
  tenantId         String   @unique
  orgStructure     Json?    // Hierarchy definition
  businessVariants Json?    // Process variants
  basisConfig      Json?    // System defaults
  processConfig    Json?    // Workflow rules
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  tenant           Tenant   @relation(...)
}
```

**ProcessConfig**
```prisma
model ProcessConfig {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  processType String   // TENDER, PROCUREMENT, INVOICE, PAYMENT
  steps       Json     // Workflow definition
  isActive    Boolean  @default(true())
  tenant      Tenant   @relation(...)
}
```

**RBACConfig**
```prisma
model RbacConfig {
  id          String   @id @default(cuid())
  tenantId    String
  roleId      String
  orgLevel    Int?     // Hierarchy level
  permissions Json     // Role permissions
  processConfigId String?
  tenant      Tenant   @relation(...)
}
```

### 3.2 SAP-Style Organizational Structure

**Company Code → Plant → Storage Location**
```prisma
model CompanyCode {
  id          String            @id @default(cuid())
  tenantId    String
  code        String            // 4-char alphanumeric
  name        String
  description String?
  plants      Plant[]
  vendors     Vendor[]
  @@unique([tenantId, code])
}

model Plant {
  id              String            @id @default(cuid())
  companyCodeId   String
  code            String            // 4-char alphanumeric
  name            String
  companyCode     CompanyCode       @relation(...)
  storageLocations StorageLocation[]
  @@unique([companyCodeId, code])
}

model StorageLocation {
  id      String @id @default(cuid())
  plantId String
  code    String // 4-char alphanumeric
  name    String
  plant   Plant  @relation(...)
  @@unique([plantId, code])
}
```

**Purchasing Organization → Purchasing Group**
```prisma
model PurchasingOrg {
  id    String            @id @default(cuid())
  tenantId String
  code  String            // Max 4 chars
  name  String
  groups PurchasingGroup[]
  @@unique([tenantId, code])
}

model PurchasingGroup {
  id              String        @id @default(cuid())
  purchasingOrgId String
  code            String        // Max 3 chars
  name            String
  purchasingOrg   PurchasingOrg @relation(...)
  @@unique([purchasingOrgId, code])
}

model PurchasingOrgAssignment {
  id              String         @id @default(cuid())
  tenantId        String
  purchasingOrgId String
  companyCodeId   String?
  plantId         String?
  // Validates PORG can operate for specific CC or Plant
}
```

### 3.3 Core Transaction Entities

**Status Enums**:
- `TenderStatus`: DRAFT → PUBLISHED → CLOSED → AWARDED | CANCELLED
- `BidStatus`: DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED | REJECTED | WITHDRAWN
- `PRStatus`: PENDING → APPROVED | REJECTED | CANCELLED
- `POStatus`: DRAFT → APPROVED → IN_PROGRESS → DELIVERED → COMPLETED | CANCELLED
- `InvoiceStatus`: PENDING → APPROVED → PAID | OVERDUE | DISPUTED | CANCELLED
- `PaymentStatus`: REQUESTED → APPROVED → PROCESSED | FAILED | CANCELLED

**User Roles**:
- `ADMIN`: Full system access, governance
- `USER`: Internal procurement operations
- `BUYER`: Sourcing and PO creation
- `VENDOR`: External supplier (requires verification)
- `APPROVER`: PR/PO approval authority
- `FINANCE`: Invoice validation, payment processing
- `MANAGER`: Oversight and high-level approvals

### 3.4 Vendor Management

**Vendor Model** (Enhanced):
```prisma
model Vendor {
  id                 String           @id @default(cuid())
  tenantId           String
  // SAP org references
  companyCodeId      String?
  plantId            String?
  storageLocationId  String?
  purchasingOrgId    String?
  purchasingGroupId  String?
  // Core fields
  name               String
  registrationNumber String?
  taxId              String?
  contactEmail       String?
  contactPhone       String?
  website            String?
  address            Json?
  bankDetails        Json?
  status             VendorStatus @default(PENDING_APPROVAL)
  // Performance tracking
  rating             Decimal?     @db.Decimal(3, 2)
  totalContracts     Int          @default(0)
  onTimeDelivery     Decimal?     @db.Decimal(5, 2)
  @@unique([tenantId, registrationNumber])
}
```

---

## 4. Business Processes

### 4.1 Tendering Process

**Flow**: DRAFT → PUBLISHED → CLOSED → EVALUATED → AWARDED

```mermaid
flowchart TD
    A[Create Tender DRAFT] -->|Publish| B[PUBLISHED]
    B --> C{Closing Date}
    C -->|Before| D[Vendors Submit Bids]
    D --> C
    C -->|After| E[CLOSED]
    E --> F[Evaluate Bids]
    F --> G[Score & Rank]
    G --> H[Award Winner]
    H --> I[AWARDED]
```

**Key Steps**:
1. **Initiation**: BUYER creates tender with requirements, criteria, estimated value
2. **Publication**: Status → PUBLISHED, vendors can view and prepare bids
3. **Bid Submission**: VENDOR submits encrypted bid with technical/financial proposals
4. **Closure**: System/manual close on `closingDate`
5. **Evaluation**: Technical and commercial scoring (optional Go service integration)
6. **Award**: Select winning bid, update tender status

**Security**:
- Bid encryption using tenant-specific KMS keys
- Checksum validation for bid integrity
- Access-level controls on documents

### 4.2 Procurement Workflow

**Flow**: Contract → PR → PO → GR → Invoice → Payment

```mermaid
flowchart LR
    A[Contract IN_PROGRESS] --> B[Create PR]
    B --> C{Manager Approval}
    C -->|Approved| D[Create PO]
    C -->|Rejected| E[Revise/Cancel]
    D --> F{Finance Approval}
    F -->|Approved| G[PO IN_PROGRESS]
    G --> H[Deliver Goods]
    H --> I[Create GR]
    I --> J[Vendor Invoice]
    J --> K{Finance Validates}
    K -->|Approved| L[Process Payment]
    L --> M[PO COMPLETED]
```

**Approval Thresholds**:
- Configurable per tenant in `SystemConfig`
- Auto-approval for amounts below threshold
- Escalation paths based on `ProcessConfig` steps

**Three-Way Matching**:
- PO (ordered quantity/amount)
- GR (received quantity)
- Invoice (billed amount)
- Validation before invoice approval

### 4.3 Quotation Management

**Purpose**: RFQ process for price comparison before formal procurement

**Flow**:
1. Create quotation request (linked to tender optional)
2. Vendors submit quotations with items, amounts, terms
3. Evaluation and comparison
4. Selection → proceed to PR/PO

### 4.4 Workflow Orchestration

**Workflow Service** provides centralized process management:

**Procurement Path**:
```
POST /:tenant/workflows/procurement/initiate/{contractId}
POST /:tenant/workflows/procurement/create-pr/{contractId}
POST /:tenant/workflows/procurement/approve-pr/{prId}
POST /:tenant/workflows/procurement/create-po/{prId}
POST /:tenant/workflows/procurement/approve-po/{poId}
POST /:tenant/workflows/procurement/goods-receipt/{poId}
```

**Tender Path**:
```
POST /:tenant/workflows/tender/create/{contractId}
POST /:tenant/workflows/tender/publish/{tenderId}
POST /:tenant/workflows/tender/submit-bid/{tenderId}  (VENDOR role)
POST /:tenant/workflows/tender/close/{tenderId}
POST /:tenant/workflows/tender/evaluate-bid/{bidId}
POST /:tenant/workflows/tender/award/{tenderId}/{winningBidId}
```

---

## 5. Configuration-Driven Design

### 5.1 Configuration as Basis

**Philosophy**: All activities driven by configuration, enabling company-specific adaptations without code changes.

**Key Concepts**:
- **Key Figures**: Configuration IDs act as foreign keys throughout the system
- **Flexibility**: Same platform supports hierarchical (Djarum: 5 CCs, multi-PG) and flat (SME: single org) structures
- **Zero-Code Adaptation**: JSON-based workflow definitions and org structures

### 5.2 Tenant Configuration Example

**Hierarchical Organization (Djarum-style)**:
```json
{
  "orgStructure": {
    "levels": 3,
    "companyCodes": 5,
    "plantsPerCC": 3,
    "purchasingGroups": 10
  },
  "businessVariants": [
    {
      "processType": "PROCUREMENT",
      "approvalLevels": ["PG_BUYER", "CC_MANAGER", "FINANCE"],
      "thresholds": {
        "autoApprove": 10000,
        "financeApproval": 50000,
        "ceoApproval": 100000
      }
    }
  ],
  "numbering": {
    "poTemplate": "{companyCode}-{plantCode}-PG{groupCode}-{year}-{sequence}"
  }
}
```

**Flat Organization (SME)**:
```json
{
  "orgStructure": {
    "levels": 1,
    "companyCodes": 1
  },
  "businessVariants": [
    {
      "processType": "PROCUREMENT",
      "approvalLevels": ["BUYER", "MANAGER"],
      "thresholds": {
        "autoApprove": 5000
      }
    }
  ]
}
```

### 5.3 Process Configuration

```json
{
  "processType": "PROCUREMENT",
  "steps": [
    {
      "stepName": "PR_CREATE",
      "requiredRole": "BUYER",
      "condition": null
    },
    {
      "stepName": "PR_APPROVE",
      "requiredRole": "MANAGER",
      "condition": {
        "keyFigure": "amount",
        "operator": "gt",
        "value": 10000
      }
    },
    {
      "stepName": "PO_CREATE",
      "requiredRole": "BUYER",
      "condition": { "prStatus": "APPROVED" }
    }
  ]
}
```

---

## 6. API Structure

### 6.1 Base URL Format

```
{BASE_URL}/api/v1/:tenant/{resource}
```

**Production**: `https://eproc-sourcing-backend.onrender.com/api/v1`

### 6.2 API Documentation Files

- **Master Data**: `docs/master-data-endpoints.md`
- **Transactions**: `docs/transaction-endpoints.md`
- **Configuration**: `docs/configuration-api.md`
- **Budget Control**: `docs/budget-control.md`
- **Invoice/Payment/Quotation**: `docs/INVOICE_PAYMENT_QUOTATION_ENDPOINTS.md`

### 6.3 Authentication Endpoints

**Registration** (VENDOR requires verification):
```http
POST /:tenant/auth/register
{
  "email": "user@example.com",
  "username": "username",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "VENDOR"  // Returns 403 with userId for verification
}
```

**Verify Vendor Account** (ADMIN only):
```http
PATCH /:tenant/auth/users/:userId/verify
Authorization: Bearer {admin_token}
```

**Login**:
```http
POST /:tenant/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### 6.4 Rate Limiting

Role-based throttling:
- `ADMIN`: 5000 requests/hour
- `BUYER`, `MANAGER`: 2000 requests/hour
- `USER`, `FINANCE`: 1000 requests/hour
- `VENDOR`: 500 requests/hour

---

## 7. Security & Authentication

### 7.1 JWT Strategy

**Access Token**:
- Expires: 15 minutes (configurable via `JWT_EXPIRY`)
- Contains: `sub` (userId), `email`, `role`, `tenantId`, `abilities`

**Refresh Token**:
- Expires: 7 days (configurable via `REFRESH_TOKEN_EXPIRY`)
- Stored in database with revocation support
- HttpOnly cookie for secure transmission

### 7.2 Role-Based Access Control

**Guards Stack**:
1. `AuthGuard('jwt')`: Validates JWT
2. `RolesGuard`: Checks user role against `@Roles()` decorator
3. `CaslAbilityGuard`: Fine-grained permissions via `@CheckAbilities()`

**CASL Abilities Example**:
```typescript
// USER abilities
{
  actions: ['create', 'read', 'update'],
  subjects: ['Tender'],
  conditions: { creatorId: '{{userId}}' }
}

// VENDOR abilities
{
  actions: ['read'],
  subjects: ['Tender'],
  conditions: { status: 'PUBLISHED' }
}
```

### 7.3 Encryption

**Bid Document Encryption** (MongoDB):
- Algorithm: AES-256-GCM
- Per-tenant keys via KMS
- Automatic encryption/decryption in schema hooks
- Checksum validation for integrity

**Environment Variables Required**:
```bash
ENCRYPTION_KEY=<32-byte-hex-key>
JWT_SECRET=<secret>
REFRESH_TOKEN_SECRET=<secret>
```

### 7.4 Vendor Account Verification

VENDOR role users are created with `isVerified: false` and require ADMIN verification:

1. VENDOR registration returns 403 with `userId`
2. ADMIN calls verify endpoint
3. VENDOR can then login successfully

This ensures vendor legitimacy before platform access.

---

## 8. Deployment & Operations

### 8.1 Environment Setup

**Required Variables**:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
MONGODB_URL=mongodb://host:27017/dbname

# Authentication
JWT_SECRET=your-jwt-secret
REFRESH_TOKEN_SECRET=your-refresh-secret
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=32-byte-hex-key

# API
PORT=3000
API_PREFIX=api/v1
CORS_ORIGIN=https://yourdomain.com

# Optional
REDIS_URL=redis://host:6379
KAFKA_BROKERS=kafka:9092
GO_SCORING_SERVICE_URL=http://scoring:9090
```

### 8.2 Database Migrations

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema (development)
npm run prisma:push

# Create migration
npm run prisma:migrate

# Deploy migrations (production)
npx prisma migrate deploy

# Seed database
npm run prisma:seed
```

### 8.3 Running the Application

```bash
# Development (standard)
npm run start:dev

# Development (local-focused, no MongoDB)
npm run start:dev:local

# Production
npm run build
npm run start:prod

# With Docker Compose
docker compose up -d postgres mongodb redis
docker compose up -d backend
```

### 8.4 Health Monitoring

**Health Endpoint**:
```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" }
  }
}
```

### 8.5 Render Deployment

**render.yaml**:
```yaml
services:
  - type: web
    name: eproc-backend
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm run start:prod
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: NODE_ENV
        value: production
```

---

## 9. Testing Strategy

### 9.1 Test Structure

```
test/
├── full-procurement-flow.spec.ts   # E2E: Tender → Payment
├── force-create-data.spec.ts       # Simplified data creation
├── unit/                           # Unit tests
└── integration/                    # Integration tests
```

### 9.2 Running Tests

```bash
# All tests
npm test

# Specific test file
npx jest test/full-procurement-flow.spec.ts

# With timeout
npx jest --testTimeout=120000

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### 9.3 Test Utilities

**Seed Scripts**:
```bash
# Migrate initial data
npx ts-node scripts/migrate-initial-data.ts

# Verify user
npx ts-node scripts/verify-user.ts
```

**Local Development**:
```bash
# One-shot setup and run
npm run dev:local
```

---

## Appendix

### Key Files

- **Entry Points**: `src/main.ts`, `src/main.local.ts`
- **Schema**: `prisma/schema.prisma`
- **Seed**: `prisma/seed.ts`
- **Config**: `src/app.module.ts`, `src/app.local.module.ts`
- **Documentation**: `docs/` folder

### Swagger UI

Interactive API documentation available at:
```
{BASE_URL}/api/v1/docs
```

### Support

For technical questions or issues, refer to:
- `docs/master-data-endpoints.md` - Master data operations
- `docs/transaction-endpoints.md` - Transaction workflows  
- `docs/budget-control.md` - Budget management
- `WARP.md` - Development guidelines

---

**Document Revision**: 2.0  
**Last Updated**: October 26, 2025
