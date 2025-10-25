# Configuration-Basis Architecture and API Guide

Version: 1.0
Updated: 2025-10-23

This document describes the configuration-first (SAP-inspired) backend architecture and how to use it end-to-end. It covers configuration models, master data, transactions, APIs, and reference flows for hierarchical (e.g., Djarum Group) and flat (SME) companies.

---

1. Concepts and Layers
- Tenancy (path-based): All APIs are under /api/v1/:tenant. Tenant is resolved by middleware and enforced in guards and Prisma scoping.
- Configuration (basis): TenantConfig, ProcessConfig, RbacConfig drive master and transaction behavior; SAP-style org masters are normalized tables.
- Masters: Static/reference data bound to tenant; SAP org structure uses CompanyCodes → Plants → StorageLocations and PurchasingOrgs → PurchasingGroups + assignments.
- Transactions: Header-level entities optionally link to ProcessConfig and may link to org refs; services validate PORG assignment.

2. Data Model (Prisma)
- Config layer
  - TenantConfig: tenantId (unique), orgStructure Json, businessVariants Json.
  - ProcessConfig: tenantId, name, processType (TENDER|PROCUREMENT|INVOICE|PAYMENT), steps Json.
  - RbacConfig: tenantId, roleName, orgLevel, permissions Json, processConfigId? (for process-specific abilities).
- Org structure (SAP-style)
  - CompanyCode → Plant → StorageLocation (1→N→N)
  - PurchasingOrg → PurchasingGroup (1→N)
  - PurchasingOrgAssignment: links PORG to either CompanyCode or Plant (exactly one)
- Masters (selected)
  - User: tenant-scoped accounts.
  - Vendor: optional FKs companyCodeId, plantId, storageLocationId, purchasingOrgId, purchasingGroupId.
  - Currency, Document, RoleConfig, SystemConfig: tenant-scoped.
- Transactions (selected)
  - Tender: +org refs (companyCodeId?, plantId?, storageLocationId?, purchasingOrgId?, purchasingGroupId?).
  - PurchaseRequisition: same org refs.
  - PurchaseOrder: same org refs; PORG must be assigned to the Plant/CompanyCode.
  - Bid, Quotation, GR, Invoice, Payment remain tenant-scoped; can be extended similarly.

3. Runtime Enforcement
- Middleware: TenantMiddleware resolves :tenant to tenantId; 404 if unknown.
- Interceptors: TenantInterceptor ensures JWT.tenantId matches path tenant; DbTenantSessionInterceptor sets session var for debugging/RLS.
- Prisma ALS Scoping: A guarded $use middleware (when available) injects tenantId into queries and mutations; falls back gracefully if unavailable.
- Auth: JwtStrategy validates user within tenant; tokens include tenantId; refresh tokens scoped by tenant.
- KMS: TenantKmsService provides per-tenant key management for bid encryption.

4. APIs
- Configuration Basis
  - POST /api/v1/:tenant/config/basis
    - Body: { tenantConfig?: { orgStructure?, businessVariants? }, processConfig?: { name, processType, steps } }
    - Upserts TenantConfig; optionally creates a ProcessConfig.
- Org Structure (new)
  - CRUD under /api/v1/:tenant/org for company-codes, plants, storage-locations, purchasing-orgs, purchasing-groups, porg-assignments.
  - Example: POST /api/v1/:tenant/org/porg-assignments { purchasingOrgId, companyCodeId }.
- Masters
  - POST /api/v1/:tenant/vendors (USER-only)
    - Body: { name, companyCodeId?, plantId?, storageLocationId?, purchasingOrgId?, purchasingGroupId?, registrationNumber?, ... }
  - GET /api/v1/:tenant/vendors
- Transactions
  - POST /api/v1/:tenant/tenders
    - Body: { title, description, requirements, criteria, closingDate, estimatedValue?, category?, department?, companyCodeId?, plantId?, storageLocationId?, purchasingOrgId?, purchasingGroupId? }
  - GET /api/v1/:tenant/tenders
  - PR/PO create/update accept the same org refs and validate PORG assignment.
- Tenants
  - POST /api/v1/tenants: Provision tenant (name, subdomain, admin creds) and seed an admin.

5. Example: Djarum (Hierarchical) vs. SME (Flat)
- Provision tenant: POST /api/v1/tenants { name: "Djarum", subdomain: "djarum", admin: { email, password } }
- Basis:
  - POST /api/v1/djarum/config/basis { tenantConfig: { orgStructure: { levels: 2 }, businessVariants: [...] }, processConfig: { name: "Procurement", processType: "PROCUREMENT", steps: [...] } }
  - POST /api/v1/djarum/org/company-codes { code: "CC1" } → then plants, slocs, porgs, pgrps, and porg-assignments.
- Create Tender:
  - POST /api/v1/djarum/tenders with purchasingOrgId and plantId (or companyCodeId); system validates PORG assignment.
- SME Flow: Create a single company code and plant; one purchasing org + group; assignment at CC level.

6. Validation & Guards (Recommended Extensions)
- ConfigServiceBasis.validate: Ensure processConfigId belongs to the same tenant; check orgUnitId hierarchy vs. user’s org unit.
- RBACConfig: Map roles to org levels; during actions (e.g., PR approve), ensure user’s role/level satisfies required step.
- Numbering: Use SystemConfig to template PO numbers with CC/Plant/PG codes (e.g., {companyCode}-{plantCode}-PG{pgCode}-YYYY-####).

7. Deployment & Operations
- Render: render.yaml uses healthCheckPath: /health and postDeployCommand: npm run prisma:deploy.
- Env: Set DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SECRET, ENCRYPTION_KEY, API_PREFIX=api/v1, CORS_ORIGIN.*
- Seeding: npm run prisma:seed -- --tenant=<slug> (optional single-tenant seeds).

8. Testing
- E2E: Simulate tenants with different configs; validate isolation and basis-driven behaviors.
- Unit: ConfigServiceBasis, OrgUnit bulk generation, and services’ key-figure validation.

9. Roadmap
- Split remaining transactions (GR/Invoice/Payment) into header/items with basis links.
- Migrate ALS middleware to Prisma $extends for universal compatibility.
- Enforce config validation paths across services; add Zod schemas for steps/orgStructure.
