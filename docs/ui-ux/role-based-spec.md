# UI/UX Spec — Role-based (Supplier Portal, Admin, User)

This document enumerates the screens, behaviors, fields, API endpoints, states, and role constraints derived from the backend codebase.


## Global foundations
- Auth & tenancy
  - Routes are tenant-scoped: prefix all API calls with `/:tenant/...` (TenantMiddleware + TenantContext).
  - Auth: JWT access tokens; httpOnly refresh cookie; endpoints: `POST :tenant/auth/login`, `POST :tenant/auth/register`, `POST :tenant/auth/refresh`, `POST :tenant/auth/logout`, `GET :tenant/auth/me`.
  - Roles and abilities: RolesGuard (role gating), CASL Ability for fine-grained actions; role config (admin-only): `GET :tenant/auth/roles/config`.
- Rate limits (per role via Throttler): Vendor < User < Admin.
- Data stores: PostgreSQL (Prisma) for core entities; MongoDB collection `bid_documents` for bid files (optional, encrypted AES-256-GCM per-tenant key).
- Status enums (Prisma):
  - TenderStatus: DRAFT, PUBLISHED, CLOSED, AWARDED, CANCELLED
  - BidStatus: DRAFT, SUBMITTED, UNDER_REVIEW, ACCEPTED, REJECTED, WITHDRAWN
  - ContractStatus: DRAFT, IN_PROGRESS, COMPLETED, CLOSED, TERMINATED
  - PRStatus: PENDING, APPROVED, REJECTED, CANCELLED
  - POStatus: DRAFT, APPROVED, IN_PROGRESS, DELIVERED, COMPLETED, CANCELLED
  - GoodsReceiptStatus: PARTIAL, COMPLETE, REJECTED
  - InvoiceStatus: PENDING, APPROVED, PAID, OVERDUE, DISPUTED, CANCELLED
  - PaymentStatus: REQUESTED, APPROVED, PROCESSED, FAILED, CANCELLED
- Shared UI patterns
  - Tables with server-side pagination via `limit` and `offset` (seen on tenders, bids, vendors, contracts). Add filters per query DTOs.
  - Form states: draft vs submitted; validation and guard rails per controller constraints; optimistic vs pessimistic updates (pessimistic recommended for critical flows).
  - Audit trail and notifications: models exist (`AuditLog`, `Notification`), UI should surface activity history and in-app notifications (APIs may be added).


## Supplier Portal (Vendor)
Persona: external vendor; can browse published tenders, manage own bids, submit before closing.

- Screens
  1) Published Tenders
     - Endpoint: `GET :tenant/tenders` (role-filtered; vendors see published only). Query: `status`, `category`, `department`, `limit`, `offset`.
     - Fields: title, description, category, department, estimatedValue, closingDate, status.
  2) Tender Details
     - Endpoint: `GET :tenant/tenders/:id` (role-based data shaping).
     - Show requirements, criteria, documents.
  3) My Bids
     - Endpoint: `GET :tenant/bids` with query: `tenderId?`, `status?`, `limit`, `offset` (vendors see own bids).
     - Columns: tender.title, status, bidAmount, submittedAt, totalScore (when available).
  4) Create/Edit Bid (Draft)
     - Create: `POST :tenant/bids` (Roles: VENDOR)
       - Body: `tenderId`, `technicalProposal`, `commercialProposal`, `financialProposal`, `documents?`.
     - Update: `PUT :tenant/bids/:id` (Roles: VENDOR; only when DRAFT)
       - Body: any of the proposal objects; `documents?`.
     - Attachments: represent via `documents` and/or dedicated file upload to `bid_documents` (encrypted if sensitive). File metadata: fileName, originalName, mimeType, fileSize, documentType (technical/commercial/financial/legal).
  5) Submit Bid
     - Endpoint: `POST :tenant/bids/:id/submit` (Roles: VENDOR)
     - Rules: cannot submit if tender is CLOSED; cannot modify after SUBMITTED.
  6) Workflow Status
     - Endpoint: `GET :tenant/workflows/status/:entityType/:entityId` (includes VENDOR role) for tracking tender/bid progression.

- Validation & UX rules
  - Block edits after submission; indicate tender closing countdown; show server errors: tender closed, bid already exists, access denied.
  - Document encryption flag: show “confidential” indicator when `isEncrypted`/`isConfidential` (schema supports both models).


## Internal User View (Buyer)
Persona: internal sourcing user; creates and manages tenders, vendors; evaluates bids; participates in procurement flow.

- Tenders
  - List: `GET :tenant/tenders` (Users see department/global); Filters: status/category/department/limit/offset.
  - Create: `POST :tenant/tenders` (Roles: ADMIN, USER) — fields: title, description, requirements, criteria, estimatedValue, closingDate, category, department, processConfigId?, orgUnitId?.
  - Detail: `GET :tenant/tenders/:id`.
  - Update: `PUT :tenant/tenders/:id` (restrictions when bids exist; cannot update certain fields post-publish as per service rules).
  - Publish: `POST :tenant/tenders/:id/publish` (only DRAFT); Delete: `DELETE :tenant/tenders/:id` (draft; admins may delete published per service rules).

- Bids (evaluation)
  - List: `GET :tenant/bids` (Users see bids for their tenders).
  - Detail: `GET :tenant/bids/:id`.
  - Evaluate (via WorkflowController): `POST :tenant/workflows/tender/evaluate-bid/:bidId` with `technicalScore`, `commercialScore`, `evaluationNotes?`.
  - Award: `POST :tenant/workflows/tender/award/:tenderId/:winningBidId` (Roles: ADMIN, MANAGER).
  - Optional scoring service: POST to Go scoring service `/score` (requires Authorization: Bearer <JWT>; permitted roles USER/ADMIN). UI should surface scoring outcome and persist via evaluation endpoints.

- Vendors
  - Create vendor: `POST :tenant/vendors` (Roles: USER only).
  - List vendors: `GET :tenant/vendors?limit&offset`.
  - Fields map to `Vendor` model (status, registrationNumber, taxId, contact info, bank details, certifications, etc.).

- Contracts
  - Create: `POST :tenant/contracts` (ADMIN/BUYER/MANAGER); generate number via `GET :tenant/contracts/generate-number`.
  - List: `GET :tenant/contracts?page&limit&status?&ownerId?` (non-admins limited to own unless permitted).
  - Detail: `GET :tenant/contracts/:id`; Update: `PATCH :tenant/contracts/:id`.
  - Manage vendors on a contract: `POST :tenant/contracts/:id/vendors` and `DELETE :tenant/contracts/:id/vendors/:vendorId`.

- Procurement workflow
  - Initiate from Contract: `POST :tenant/workflows/procurement/initiate/:contractId`.
  - PR: `POST :tenant/workflows/procurement/create-pr/:contractId`; Approve/Reject: `POST :tenant/workflows/procurement/approve-pr/:prId`.
  - PO: `POST :tenant/workflows/procurement/create-po/:prId`; Approve/Reject: `POST :tenant/workflows/procurement/approve-po/:poId`.
  - Goods Receipt: `POST :tenant/workflows/procurement/goods-receipt/:poId`.
  - Status: `GET :tenant/workflows/status/:entityType/:entityId`.

- Validation & UX rules
  - Tenders: only DRAFT can publish/delete; prevent updates once bids exist (service enforces; UI should warn/disable fields).
  - PR/PO approvals require role checks; approval dialogs capture comments; derive dates from ISO strings.


## Admin View
Persona: tenant admin; full access; configures tenant, roles, and oversees sourcing.

- Global oversight
  - View all Tenders/Bids/Contracts/Vendors; same listing endpoints with expanded filters.
  - Award, close tenders; evaluate bids; all actions permitted by ADMIN role.

- Tenant provisioning & configuration
  - Provision tenant (out-of-band, but available): `POST /tenants` with tenant name/subdomain and initial admin user.
  - Basis config: `POST :tenant/config/basis` to upsert tenant basis; `POST :tenant/config/org-units/bulk` to bulk-create OrgUnits.
  - Role configuration reference: `GET :tenant/auth/roles/config` (exposes role descriptions and example permissions; real storage via RoleConfig/SystemConfig models).

- Governance
  - Access/Audit: expose `AuditLog` activity viewer (backend model present); add filters by user, target, action, time.
  - Notifications center backed by `Notification` model (APIs may be added); in-app + email rules.

- Security & rate limiting
  - Display and tune rate-limit tiers per role (via env/Throttler; advanced per-tenant settings could be surfaced from SystemConfig).


## Data and forms — key field mappings
- Tender: title, description, requirements (JSON), criteria (JSON), estimatedValue (number), closingDate (Date), category, department, processConfigId, orgUnitId.
- Bid: tenderId, technicalProposal (JSON), commercialProposal (JSON), financialProposal (JSON), documents (array), bidAmount?, compliance?, evaluationNotes?, scores.
- Vendor: name, registrationNumber, taxId, contactEmail/Phone, website, address (JSON), bankDetails (JSON), status.
- Contract: contractNumber, title, description, totalAmount, currencyId, dates, terms (JSON), deliverables (JSON), vendors.
- PR/PO/GR/Invoice/Payment: see schema for field names; forms should respect status transitions and approval roles.


## Navigation IA (suggested)
- Supplier Portal: Dashboard; Published Tenders; Tender Detail; Create/Edit Bid; My Bids; Documents; Workflow Status.
- User: Dashboard; Tenders (List/Detail/Create/Edit/Publish); Bids (List/Evaluate/Award); Vendors (List/Create); Contracts (List/Detail/Create/Update); Workflow (PR/PO/GR flows); Status.
- Admin: All of User + Tenant Config (Basis, Org Units), Role Config, Audit, Notifications.


## Error handling & empty states
- Reflect controller errors: 400 validation/business rules, 401 unauthorized, 403 forbidden (role/ability), 404 not found, 429 throttling.
- Show skeletons for list/detail; explicit empty states with CTAs (e.g., “No bids yet — invite suppliers”).


## Open items (to confirm)
- File upload endpoints: integrate with `bid_documents` and/or `Document` relations; define max size/types and virus scanning.
- Sorting conventions for lists (currently only pagination/filters are explicit).
- Realtime updates (polling vs websockets) for evaluations/awards.
- Analytics events and notification triggers.
