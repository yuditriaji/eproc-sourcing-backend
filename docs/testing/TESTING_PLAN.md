# E-Procurement System Testing Plan

## Overview
Comprehensive testing scenarios for the e-procurement sourcing backend, organized by testing layers: Configuration, Master Data, and Transactions.

---

## 1. Configuration Testing

### 1.1 Environment Configuration
**Goal**: Verify system can start with different configurations

#### Test Scenarios:
- **TC-CONFIG-001**: Verify all required environment variables load correctly
  - Variables: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `ENCRYPTION_KEY`, `PORT`, `API_PREFIX`
  - Expected: Application starts without errors
  
- **TC-CONFIG-002**: Test with missing critical environment variables
  - Test missing `DATABASE_URL`, `JWT_SECRET`
  - Expected: Application fails gracefully with clear error messages

- **TC-CONFIG-003**: Test different API_PREFIX configurations
  - Test: `api/v1`, `api/v2`, custom paths
  - Expected: Swagger accessible at `/{API_PREFIX}/docs`, health at `/health`

### 1.2 Multi-tenant Configuration
**Goal**: Ensure tenant isolation and configuration

#### Test Scenarios:
- **TC-CONFIG-004**: Create tenant with basic configuration
  - Create `Tenant` with `residencyTag`, `config` JSON
  - Expected: Tenant created successfully, `TenantConfig` can be attached

- **TC-CONFIG-005**: Verify tenant key encryption setup
  - Create `TenantKey` with DEK wrapping
  - Expected: Key stored with correct version, algorithm, and active status

- **TC-CONFIG-006**: Test tenant configuration with org structure
  - Setup `TenantConfig.orgStructure` with levels and company codes
  - Expected: Configuration stored and retrievable as JSON

### 1.3 System & Role Configuration
**Goal**: Validate system-wide and role-based configurations

#### Test Scenarios:
- **TC-CONFIG-007**: Create and retrieve SystemConfig entries
  - Create configs with different categories (security, workflow, limits)
  - Expected: Configs unique per tenant and key

- **TC-CONFIG-008**: Configure RoleConfig with permissions
  - Create roles: ADMIN, USER, BUYER, VENDOR with different permissions JSON
  - Expected: Roles created with correct permission sets

- **TC-CONFIG-009**: Setup ProcessConfig for different workflows
  - Types: TENDER, PROCUREMENT, INVOICE, PAYMENT
  - Expected: Process steps stored as JSON, queryable by type

- **TC-CONFIG-010**: Configure RbacConfig with org levels
  - Assign permissions per role per org level
  - Link to `ProcessConfig`
  - Expected: RBAC rules enforced correctly

### 1.4 Rate Limiting & Throttle Configuration
**Goal**: Verify throttling configuration per role

#### Test Scenarios:
- **TC-CONFIG-011**: Test throttle limits for different user roles
  - Configure: `THROTTLE_LIMIT_ADMIN`, `THROTTLE_LIMIT_USER`, `THROTTLE_LIMIT_VENDOR`
  - Expected: Different rate limits applied based on user role

---

## 2. Master Data Testing

### 2.1 User Management
**Goal**: Validate user CRUD and authentication

#### Test Scenarios:
- **TC-MASTER-001**: Register new user with different roles
  - Roles: ADMIN, USER, BUYER, VENDOR, APPROVER, FINANCE, MANAGER
  - Expected: User created with correct role and abilities

- **TC-MASTER-002**: User login with valid credentials
  - Expected: JWT access token and httpOnly refresh token returned

- **TC-MASTER-003**: User login with invalid credentials
  - Expected: 401 Unauthorized

- **TC-MASTER-004**: Refresh token flow
  - Expected: New access token issued with valid refresh token

- **TC-MASTER-005**: Verify user uniqueness per tenant
  - Test duplicate email/username within same tenant
  - Expected: Unique constraint violation

- **TC-MASTER-006**: Test user soft delete
  - Set `deletedAt` timestamp
  - Expected: User still in DB but not in active queries

### 2.2 Currency Management
**Goal**: Ensure currency master data integrity

#### Test Scenarios:
- **TC-MASTER-007**: Create currencies (USD, EUR, IDR)
  - Include: code, symbol, name, exchangeRate
  - Expected: Currency unique per tenant by code

- **TC-MASTER-008**: Activate/deactivate currency
  - Toggle `isActive` flag
  - Expected: Inactive currencies not available for new transactions

### 2.3 SAP-style Organization Structure
**Goal**: Test enterprise organizational hierarchy

#### Test Scenarios:
- **TC-MASTER-009**: Create CompanyCode
  - Code must be unique per tenant
  - Expected: CompanyCode created successfully

- **TC-MASTER-010**: Create Plant under CompanyCode
  - Link plant to company code
  - Expected: Plant.code unique within CompanyCode

- **TC-MASTER-011**: Create StorageLocation under Plant
  - Expected: StorageLocation.code unique within Plant

- **TC-MASTER-012**: Create PurchasingOrg
  - Expected: PurchasingOrg.code unique per tenant

- **TC-MASTER-013**: Create PurchasingGroup under PurchasingOrg
  - Expected: PurchasingGroup.code unique within PurchasingOrg

- **TC-MASTER-014**: Setup PurchasingOrgAssignment
  - Assign PurchasingOrg to CompanyCode and/or Plant
  - Expected: Assignment created without conflicts

### 2.4 OrgUnit Hierarchy
**Goal**: Validate simplified org unit structure

#### Test Scenarios:
- **TC-MASTER-015**: Create OrgUnit hierarchy (parent-child)
  - Types: COMPANY_CODE, PURCHASING_GROUP
  - Expected: Multi-level hierarchy with correct parent references

- **TC-MASTER-016**: Test unique constraints on OrgUnit
  - companyCode and pgCode must be unique per tenant
  - Expected: Violations caught

### 2.5 Vendor Management
**Goal**: Ensure vendor master data quality

#### Test Scenarios:
- **TC-MASTER-017**: Register new vendor with complete details
  - Include: name, registrationNumber, taxId, contact info, address
  - Status: PENDING_APPROVAL
  - Expected: Vendor created with all required fields

- **TC-MASTER-018**: Approve vendor
  - Change status from PENDING_APPROVAL to ACTIVE
  - Expected: Vendor can now participate in procurement

- **TC-MASTER-019**: Suspend/blacklist vendor
  - Status: SUSPENDED, BLACKLISTED
  - Expected: Vendor cannot submit new bids/quotations

- **TC-MASTER-020**: Link vendor to org structure
  - Assign: companyCodeId, plantId, storageLocationId, purchasingOrgId, purchasingGroupId
  - Expected: Vendor correctly associated with enterprise structure

- **TC-MASTER-021**: Test vendor unique registration number per tenant
  - Expected: Duplicate registrationNumber within tenant rejected

### 2.6 Budget Master Data
**Goal**: Validate budget setup

#### Test Scenarios:
- **TC-MASTER-022**: Create Budget for fiscal year and OrgUnit
  - Type: DIVISION, DEPARTMENT, STAFF, PROJECT
  - Expected: Budget unique per tenant, fiscalYear, and orgUnitId

- **TC-MASTER-023**: Initialize budget with totalAmount and availableAmount
  - Expected: availableAmount <= totalAmount

---

## 3. Transaction Testing

### 3.1 Authentication & Authorization Flow
**Goal**: End-to-end auth testing

#### Test Scenarios:
- **TC-TRANS-001**: Complete user registration → login → access protected resource
  - Expected: Full flow works without errors

- **TC-TRANS-002**: Test RolesGuard with @Roles decorator
  - Access endpoint requiring ADMIN role as USER
  - Expected: 403 Forbidden

- **TC-TRANS-003**: Test CaslAbilityGuard with @CheckAbilities
  - Verify fine-grained permission checks
  - Expected: Only users with specific abilities can access

- **TC-TRANS-004**: Test token expiry and refresh
  - Wait for access token expiry, use refresh token
  - Expected: New access token issued

- **TC-TRANS-005**: Test logout and token revocation
  - Logout user, attempt to use old tokens
  - Expected: Tokens invalid after logout

### 3.2 Tender Management Workflow
**Goal**: Complete tender lifecycle

#### Test Scenarios:
- **TC-TRANS-006**: Create tender as USER (draft)
  - Status: DRAFT
  - Include: requirements, criteria, estimatedValue
  - Expected: Tender created with generated tenderNumber

- **TC-TRANS-007**: Publish tender
  - Status: DRAFT → PUBLISHED
  - Set publishedAt timestamp
  - Expected: Vendors can now view and bid

- **TC-TRANS-008**: Close tender after closingDate
  - Status: PUBLISHED → CLOSED
  - Expected: No new bids accepted

- **TC-TRANS-009**: Test tender visibility by role
  - ADMIN: sees all tenders
  - USER: sees department/global tenders
  - VENDOR: sees only published tenders
  - Expected: Role-based filtering works correctly

- **TC-TRANS-010**: Link tender to contract
  - Set contractId
  - Expected: Tender associated with existing contract

### 3.3 Bid Management
**Goal**: Vendor bid submission and evaluation

#### Test Scenarios:
- **TC-TRANS-011**: Vendor submits bid to published tender
  - Status: DRAFT → SUBMITTED
  - Include: technicalProposal, financialProposal, bidAmount
  - Expected: Bid recorded with submittedAt timestamp

- **TC-TRANS-012**: Test bid uniqueness per vendor per tender
  - Vendor attempts to submit duplicate bid
  - Expected: Unique constraint violation

- **TC-TRANS-013**: Store encrypted bid data
  - Set encryptedData with keyVersion
  - Expected: Bid data encrypted using tenant key

- **TC-TRANS-014**: Evaluate bid (score calculation)
  - Calculate technicalScore, commercialScore, totalScore
  - Optional: Use Go scoring service via `/score` endpoint
  - Expected: Scores recorded, evaluatedBy and evaluatedAt set

- **TC-TRANS-015**: Accept/reject bid
  - Status: UNDER_REVIEW → ACCEPTED or REJECTED
  - Expected: Status updated, evaluationNotes recorded

- **TC-TRANS-016**: Withdraw bid before evaluation
  - Status: SUBMITTED → WITHDRAWN
  - Expected: Bid withdrawn successfully

### 3.4 Contract Management
**Goal**: Contract lifecycle

#### Test Scenarios:
- **TC-TRANS-017**: Create contract (draft)
  - Status: DRAFT
  - Include: title, description, totalAmount, currencyId, terms
  - Expected: Contract created with unique contractNumber per tenant

- **TC-TRANS-018**: Assign vendors to contract (ContractVendor)
  - Roles: PRIMARY, SECONDARY, SUBCONTRACTOR
  - Expected: Multiple vendors can be linked to one contract

- **TC-TRANS-019**: Sign contract
  - Set signedAt timestamp for each vendor
  - Status: DRAFT → IN_PROGRESS
  - Expected: Contract becomes active

- **TC-TRANS-020**: Complete contract
  - Status: IN_PROGRESS → COMPLETED → CLOSED
  - Expected: Status transitions correctly

- **TC-TRANS-021**: Terminate contract
  - Status: any → TERMINATED
  - Expected: Contract marked as terminated

### 3.5 Purchase Requisition (PR) Flow
**Goal**: PR creation and approval

#### Test Scenarios:
- **TC-TRANS-022**: User creates PR
  - Status: PENDING
  - Include: items JSON, estimatedAmount, justification
  - Expected: PR created with unique prNumber per tenant

- **TC-TRANS-023**: Link PR to org structure
  - Set: orgUnitId, companyCodeId, plantId, purchasingOrgId, purchasingGroupId
  - Expected: PR associated with correct org units

- **TC-TRANS-024**: Approve PR
  - Status: PENDING → APPROVED
  - Set approvedById, approvedAt
  - Expected: PR ready for PO creation

- **TC-TRANS-025**: Reject PR
  - Status: PENDING → REJECTED
  - Set rejectionReason
  - Expected: PR cannot be converted to PO

- **TC-TRANS-026**: Cancel PR
  - Status: any → CANCELLED
  - Expected: PR marked as cancelled

### 3.6 Purchase Order (PO) Flow
**Goal**: PO creation, approval, and fulfillment

#### Test Scenarios:
- **TC-TRANS-027**: Create PO from approved PR
  - Link: prId, contractId (optional)
  - Status: DRAFT
  - Include: items JSON, amount, terms
  - Expected: PO created with unique poNumber per tenant

- **TC-TRANS-028**: Assign vendors to PO (POVendor)
  - Roles: PRIMARY, SECONDARY
  - Set assignedAmount and assignedItems
  - Expected: Vendors linked to PO with assignments

- **TC-TRANS-029**: Create PO with budget allocation
  - Set budgetId, check availableAmount
  - Commit funds: totalCommitted deducted from budget
  - Expected: Budget updated, PO tracks committed amount

- **TC-TRANS-030**: Create POItem with budget allocation tracing
  - Link to BudgetAllocation or BudgetTransfer
  - Track consumedAmount
  - Expected: Items trace budget source

- **TC-TRANS-031**: Approve PO
  - Status: DRAFT → APPROVED
  - Set approvedById, approvedAt
  - Expected: PO ready for fulfillment

- **TC-TRANS-032**: PO delivery tracking
  - Status: APPROVED → IN_PROGRESS → DELIVERED
  - Expected: Status updated as goods received

- **TC-TRANS-033**: Complete PO
  - Status: DELIVERED → COMPLETED
  - Expected: All items received, PO closed

- **TC-TRANS-034**: Cancel PO
  - Status: any → CANCELLED
  - Release budget: revert totalCommitted
  - Expected: PO cancelled, budget released

### 3.7 Goods Receipt (GR)
**Goal**: Record receipt of goods

#### Test Scenarios:
- **TC-TRANS-035**: Record partial goods receipt
  - Link to poId
  - Status: PARTIAL
  - Include: receivedItems JSON (subset of PO items)
  - Expected: GR created with unique receiptNumber per tenant

- **TC-TRANS-036**: Record complete goods receipt
  - Status: PARTIAL → COMPLETE
  - All PO items received
  - Expected: PO status can move to DELIVERED

- **TC-TRANS-037**: Reject goods receipt
  - Status: REJECTED
  - Set inspectionNotes
  - Expected: GR marked as rejected, PO status unaffected

- **TC-TRANS-038**: Inspection flow
  - Set inspectedBy, inspectedAt, inspectionNotes
  - Expected: Inspection details recorded

### 3.8 Invoice Processing
**Goal**: Invoice creation and approval

#### Test Scenarios:
- **TC-TRANS-039**: Vendor creates invoice against PO
  - Link: poId, vendorId
  - Status: PENDING
  - Include: items JSON, amount, taxAmount, totalAmount
  - Expected: Invoice created with unique invoiceNumber per tenant

- **TC-TRANS-040**: Create InvoiceItem with budget tracing
  - Link to poItemId or transferTraceId
  - Track consumedAmount
  - Expected: Invoice items trace to budget

- **TC-TRANS-041**: Invoice with budget deduction
  - Set budgetId, totalBilled
  - Deduct from budget availableAmount
  - Expected: Budget updated accordingly

- **TC-TRANS-042**: Approve invoice
  - Status: PENDING → APPROVED
  - Expected: Invoice ready for payment

- **TC-TRANS-043**: Mark invoice as paid
  - Status: APPROVED → PAID
  - Expected: Invoice closed

- **TC-TRANS-044**: Handle overdue invoice
  - Status: APPROVED → OVERDUE (based on dueDate)
  - Expected: System flags overdue invoices

- **TC-TRANS-045**: Dispute invoice
  - Status: any → DISPUTED
  - Expected: Invoice under review

- **TC-TRANS-046**: Cancel invoice
  - Status: any → CANCELLED
  - Expected: Invoice cancelled, budget released if deducted

### 3.9 Payment Processing
**Goal**: Payment request and fulfillment

#### Test Scenarios:
- **TC-TRANS-047**: Request payment for approved invoice
  - Link: invoiceId, poId
  - Status: REQUESTED
  - Type: FULL, DOWN_PAYMENT, INSTALLMENT, MILESTONE
  - Expected: Payment created with unique paymentNumber per tenant

- **TC-TRANS-048**: Approve payment
  - Status: REQUESTED → APPROVED
  - Set approvedBy, approvedAt
  - Expected: Payment ready for processing

- **TC-TRANS-049**: Process payment
  - Status: APPROVED → PROCESSED
  - Set processedDate, method, reference
  - Expected: Payment completed

- **TC-TRANS-050**: Record payment receipt
  - Set receivedById, receivedAt
  - Expected: Vendor confirms receipt

- **TC-TRANS-051**: Failed payment
  - Status: APPROVED → FAILED
  - Expected: Payment marked as failed, retry possible

- **TC-TRANS-052**: Cancel payment
  - Status: any → CANCELLED
  - Expected: Payment cancelled

### 3.10 Budget Control Transactions
**Goal**: Budget allocation, transfer, and consumption

#### Test Scenarios:
- **TC-TRANS-053**: Allocate budget from parent to child OrgUnit
  - Create BudgetAllocation
  - Deduct from source, add to target
  - Expected: BudgetAllocation recorded with traceId

- **TC-TRANS-054**: Transfer budget between budgets (same level)
  - Create BudgetTransfer with SAME_LEVEL type
  - Deduct from source, add to target
  - Expected: Transfer traced, both budgets updated

- **TC-TRANS-055**: Transfer budget across levels (CROSS_LEVEL)
  - Create BudgetTransfer with CROSS_LEVEL type
  - Require approvalChain from ProcessConfig
  - Expected: Transfer requires approval

- **TC-TRANS-056**: Commit budget on PO creation
  - Deduct totalCommitted from budget availableAmount
  - Expected: Budget locked for PO

- **TC-TRANS-057**: Release budget on PO cancellation
  - Add back totalCommitted to budget availableAmount
  - Expected: Budget freed up

- **TC-TRANS-058**: Deduct budget on invoice approval
  - Deduct totalBilled from budget availableAmount
  - Expected: Budget consumed

- **TC-TRANS-059**: Check insufficient budget scenario
  - Attempt PO creation with amount > availableAmount
  - Expected: Transaction rejected with budget error

### 3.11 Quotation Management
**Goal**: Vendor quotation submission

#### Test Scenarios:
- **TC-TRANS-060**: Vendor submits quotation
  - Link to tenderId (optional)
  - Status: SUBMITTED
  - Include: items JSON, amount, terms, validUntil
  - Expected: Quotation created with unique quotationNumber per tenant

- **TC-TRANS-061**: Accept quotation
  - Status: SUBMITTED → ACCEPTED
  - Expected: Quotation can be converted to PO

- **TC-TRANS-062**: Reject quotation
  - Status: SUBMITTED → REJECTED
  - Expected: Quotation closed

- **TC-TRANS-063**: Expire quotation
  - Status: any → EXPIRED (based on validUntil)
  - Expected: Quotation no longer valid

### 3.12 Document Management
**Goal**: Attach documents to entities

#### Test Scenarios:
- **TC-TRANS-064**: Upload document to tender
  - Set tenderId, documentType, isConfidential
  - Expected: Document stored with file metadata

- **TC-TRANS-065**: Upload document to bid
  - Set bidId
  - Expected: Document linked to bid

- **TC-TRANS-066**: Version documents
  - Create child document with parentId
  - Expected: Document version history maintained

- **TC-TRANS-067**: Test document access control
  - Set accessLevel
  - Expected: Only authorized users can access confidential docs

### 3.13 Audit Logging
**Goal**: Track all critical actions

#### Test Scenarios:
- **TC-TRANS-068**: Log CREATE action
  - Create any entity (User, Tender, PO, etc.)
  - Expected: AuditLog entry with action=CREATE, newValues

- **TC-TRANS-069**: Log UPDATE action
  - Update entity
  - Expected: AuditLog with oldValues and newValues

- **TC-TRANS-070**: Log DELETE action
  - Soft delete entity
  - Expected: AuditLog with action=DELETE

- **TC-TRANS-071**: Log authentication actions
  - LOGIN, LOGOUT
  - Include: ipAddress, userAgent, sessionId
  - Expected: Security audit trail

- **TC-TRANS-072**: Log approval actions
  - APPROVE, REJECT
  - Expected: Approval chain visible in audit log

- **TC-TRANS-073**: Log budget actions
  - BUDGET_ALLOCATE, BUDGET_TRANSFER, BUDGET_DEDUCT
  - Include budgetKeyFigure JSON
  - Expected: Budget changes fully audited

### 3.14 Workflow Orchestration
**Goal**: Test WorkflowService end-to-end flows

#### Test Scenarios:
- **TC-TRANS-074**: Execute procurement workflow (Contract → PR → PO → GR → Invoice → Payment)
  - Start with Contract, progress through all steps
  - Expected: Complete workflow executes, events emitted at each step

- **TC-TRANS-075**: Test workflow with ProcessConfig steps
  - Configure ProcessConfig with custom steps
  - Execute workflow
  - Expected: Workflow follows configured steps

- **TC-TRANS-076**: Test workflow rollback on error
  - Fail at intermediate step (e.g., budget check)
  - Expected: Workflow stops, partial changes rolled back

### 3.15 Event Streaming
**Goal**: Validate event emission

#### Test Scenarios:
- **TC-TRANS-077**: Emit event on tender publish
  - Expected: Event sent to Kafka with tender data

- **TC-TRANS-078**: Emit event on PO approval
  - Expected: Event sent with PO details

- **TC-TRANS-079**: Consume events from Kafka
  - Setup event consumer
  - Expected: Events received and processed

- **TC-TRANS-080**: Test Outbox pattern
  - Transaction writes to DB and Outbox
  - Outbox processor sends to Kafka
  - Expected: At-least-once delivery guaranteed

### 3.16 Notifications
**Goal**: User notification delivery

#### Test Scenarios:
- **TC-TRANS-081**: Create notification for user
  - Type: tender_published, pr_approved, payment_completed
  - Expected: Notification created, isRead=false

- **TC-TRANS-082**: Mark notification as read
  - Set isRead=true, readAt timestamp
  - Expected: Notification marked as read

- **TC-TRANS-083**: Query unread notifications
  - Filter by userId and isRead=false
  - Expected: Only unread notifications returned

### 3.17 Go Scoring Service Integration
**Goal**: Test bid scoring via Go microservice

#### Test Scenarios:
- **TC-TRANS-084**: Score bid using Go service
  - POST to `{GO_SCORING_SERVICE_URL}/score` with JWT
  - Include bid data and criteria
  - Expected: Score calculated and returned

- **TC-TRANS-085**: Test JWT validation in Go service
  - Send request with invalid JWT
  - Expected: 401 Unauthorized

- **TC-TRANS-086**: Test scoring service health
  - GET `{GO_SCORING_SERVICE_URL}/health`
  - Expected: Service status returned

---

## 4. Integration & E2E Testing

### 4.1 Complete Tender-to-Payment Flow
**Goal**: Full procurement cycle

#### Test Scenario:
- **TC-E2E-001**: End-to-end tender workflow
  1. USER creates and publishes tender
  2. VENDOR submits bid
  3. USER evaluates and accepts bid
  4. USER creates contract with winning vendor
  5. USER creates PR linked to contract
  6. APPROVER approves PR
  7. USER creates PO from PR
  8. APPROVER approves PO
  9. USER records goods receipt
  10. VENDOR creates invoice
  11. FINANCE approves invoice
  12. FINANCE processes payment
  - Expected: All steps complete successfully, budget tracked, audit logged, events emitted

### 4.2 Multi-tenant Isolation
**Goal**: Ensure data isolation between tenants

#### Test Scenarios:
- **TC-E2E-002**: Create data in Tenant A, attempt access from Tenant B
  - Expected: No cross-tenant data leakage

- **TC-E2E-003**: Test tenant-scoped unique constraints
  - Create entity with same identifier in different tenants
  - Expected: No conflicts

### 4.3 Performance & Load Testing
**Goal**: System stability under load

#### Test Scenarios:
- **TC-PERF-001**: Concurrent tender creation
  - 100+ tenders created simultaneously
  - Expected: All succeed without deadlocks

- **TC-PERF-002**: High-volume bid submission
  - 1000+ bids submitted to single tender
  - Expected: System handles load, throttling works

- **TC-PERF-003**: Budget contention
  - Multiple POs competing for same budget
  - Expected: Optimistic locking prevents overspendin g

---

## 5. Test Execution Strategy

### 5.1 Unit Tests
- Test individual services (TenderService, BidService, BudgetService, etc.)
- Mock dependencies (PrismaService, EventService)
- Run: `npm test`

### 5.2 Integration Tests
- Test with real Postgres + MongoDB
- Use docker-compose to spin up test databases
- Run: `npm run test:e2e`

### 5.3 E2E Tests
- Full API tests via Supertest
- Test complete workflows
- Run: `npm run test:e2e`

### 5.4 Manual Testing
- Use Swagger UI at `/{API_PREFIX}/docs`
- Test complex scenarios interactively

### 5.5 Load Testing
- Use tools: k6, Apache JMeter, Artillery
- Simulate concurrent users

---

## 6. Test Data Setup

### 6.1 Seed Data
- Run: `npm run prisma:seed`
- Creates: admin/user/vendor accounts, sample tender, bids, audit logs

### 6.2 Test Fixtures
- Create reusable fixtures for common entities
- Example: `fixtures/users.ts`, `fixtures/tenders.ts`

### 6.3 Database Reset Between Tests
```bash
npm run prisma:push -- --force-reset
npm run prisma:seed
```

---

## 7. Success Criteria

- ✅ All unit tests pass (`npm test`)
- ✅ All E2E tests pass (`npm run test:e2e`)
- ✅ Code coverage > 80%
- ✅ No data leakage between tenants
- ✅ Budget constraints enforced
- ✅ Audit logs complete for all critical actions
- ✅ Performance benchmarks met (e.g., < 200ms for read APIs, < 500ms for write APIs)

---

## 8. Tools & Frameworks

- **Jest**: Unit and integration testing
- **Supertest**: HTTP assertions for E2E tests
- **Prisma**: Database migrations and seeding
- **Docker Compose**: Test environment setup
- **k6/JMeter**: Load testing
- **Swagger UI**: Manual API testing

---

## Next Steps

1. **Write unit tests** for core services (Tender, Bid, Contract, PO, Invoice, Payment, Budget)
2. **Write E2E tests** for critical workflows (tender-to-payment, budget control)
3. **Setup CI/CD pipeline** to run tests on every commit
4. **Add test coverage reporting** (Jest coverage)
5. **Document test results** and track defects

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-26  
**Author**: Warp AI Agent
