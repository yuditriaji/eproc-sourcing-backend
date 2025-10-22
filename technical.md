# Product Requirements Document (PRD): Refactor Prisma Schema for SAP-Inspired Agile Scalability

## Document Metadata
- **Version**: 1.1
- **Date**: October 23, 2025
- **Author**: Grok (xAI Assistant)
- **Target Executor**: WARP AI (Coding Agent)
- **Scope**: Refactor the existing Prisma schema (from technical.md and workspace files) to adopt an SAP ERP-inspired structure: Configuration Tables (system setup and integration via Key Figures as the foundational basis for all activities), Master Tables (static/reference data, driven by configs), and Transaction Tables (split into Header and Detail/Item for dynamic processes, always scoped by configs). This ensures maximum flexibility, where configurations serve as the central hub for tenant-specific org hierarchies, RBAC, and business processes (e.g., procurement workflows per BUSINESS_PROCESS.md). All layers reference configs via Key Figures for seamless applicability across diverse companies (e.g., hierarchical conglomerates like Djarum Group vs. flat SMEs).
- **Dependencies**: Build on technical.md (Crawl phase multi-tenancy); reference README.md, WARP.md, BUSINESS_PROCESS.md for current models (e.g., User, Tender, Contract) and processes. Assume Prisma v6+; migration preserves existing data where possible.
- **Assumptions**: 
  - Current schema is relational with basic tenantId; core entities (Tender, PO, etc.) exist but unsplit.
  - Configurations are the "basis of the whole activities": Every Master and Transaction must link to a Config via Key Figures (e.g., mandatory configId FK), enabling zero-code adaptations for different companies (e.g., Djarum's 5-child CC hierarchy vs. a single-org SME's flat approvals).
  - Key Figures: Primarily FKs (e.g., configId) but extensible to computed fields (e.g., via Json-derived thresholds) for process-driven flexibility.
  - Deployment: Non-breaking migration; test on Render/Postgres hobby tier.
- **Out of Scope**: Full SAP replication (e.g., no LIS structures); frontend changes; advanced analytics (defer KPIs to ReportingModule). No schema-per-tenant—use tenantId + Json for configs.

## Overview
### Problem Statement
The current schema (e.g., flat Tender/PO models per technical.md) lacks SAP-like separation, hindering agile scalability for multi-tenant variations. To achieve true flexibility, configurations must form the foundational basis, dictating all activities: e.g., a single ProcessConfig can orchestrate diverse business processes (hierarchical approvals for conglomerates, linear for SMEs) via Key Figures. Tenants like Djarum Group (5 child companies with PG/CC-specific PO numbering) need configs to drive org charts, RBAC (roles per hierarchy level), and processes without custom code—ensuring applicability across companies with varying structures (e.g., multi-CC vs. single-entity).

### Goals
- **Primary**: Establish configurations as the central basis, with all Masters/Transactions referencing them via Key Figures, enabling flexible, tenant-agnostic adaptations (e.g., auto-generate org hierarchies from TenantConfig Json for different company types).
- **Secondary**: Ensure backward compatibility (migrate existing data); maintain <200ms queries via indexes; validate flexibility with scenarios like Djarum (hierarchical) vs. SME (flat).
- **Business Alignment**: Aligns with BUSINESS_PROCESS.md (e.g., Tender → Bid flow dynamically routed via ProcessConfig); configs apply universally (e.g., Djarum: CC-linked PGs for PO; SME: global rules).
- **Success Criteria**: Post-migration, e2e tests validate configurable flows (e.g., simulate Djarum hierarchy with 5 CCs/PGs vs. flat SME; 100% process adherence); no data loss; Swagger docs reflect config-driven relations.

### Non-Goals
- Denormalization for perf (keep normalized; index heavily).
- UI adaptations (API-only; services handle Header/Item joins via config lookups).
- Complex Key Figures beyond FKs/Json (e.g., no real-time calcs—use service-side for extensions).

## Requirements
### Functional Requirements
1. **Configuration Tables Layer (Foundational Basis)**
   - **Core Role**: Configurations are the "single source of truth" for all activities—every Master/Transaction references them via Key Figures (mandatory configId FK), enabling plug-and-play flexibility for different companies. E.g., a ProcessConfig defines steps/roles for Djarum's CC-specific procurement (5 variants) or an SME's unified flow.
   - Core Tables:
     - `SystemConfig`: Global baselines (e.g., defaultProcessTemplate: Json, numberingRanges: Json { prefix: "{companyCode}-PG{groupId}-" })—applicable across tenants, overridden per TenantConfig.
     - `TenantConfig`: Per-tenant foundation (e.g., orgStructure: Json { levels: 5, ccCount: 5 for Djarum }, businessProcessVariants: Json array)—drives auto-provisioning (e.g., generate 5 OrgUnits on tenant create).
     - `ProcessConfig`: Workflow orchestrator (e.g., processType: Enum['TENDER', 'PROCUREMENT'], steps: Json array of { stepName, requiredRoleFk (to RBACConfig), conditionKeyFigure: String (e.g., "amount > threshold from TenantConfig") })—Key Figures link to Masters/Transactions; flexible for company variations (e.g., Djarum: Insert CC-approval step; SME: Skip).
     - `RBACConfig`: Hierarchy enabler (e.g., roleId FK to Role Master; orgLevel: Int; permissions: Json { actions: ['APPROVE_PR'] })—tied to ProcessConfig for process-specific RBAC (e.g., PG-level BUYER for Djarum CCs).
   - Integration & Flexibility: Key Figures (e.g., processConfigId in all Headers) ensure configs propagate: On tenant provision, auto-link Masters (e.g., create OrgUnits from TenantConfig Json); Transactions inherit rules (e.g., PO numbering via SystemConfig + CC OrgUnit). Applicable to diverse processes: Hierarchical (Djarum: Multi-level via orgStructure) vs. flat (SME: Single step).

2. **Master Tables Layer (Driven by Configurations)**
   - **Core Role**: Static data auto-derived/config-scoped—e.g., OrgUnits generated from TenantConfig; all reference configId for flexibility (e.g., PGs per CC for Djarum).
   - Core Tables:
     - `Tenant` (enhanced): configId: FK to TenantConfig (mandatory); residencyTag: String (for future sharding)—basis for company-wide applicability.
     - `OrgUnit`: Hierarchy auto-built from configs (e.g., id, tenantId, parentId: Self-FK, level: Int (computed from TenantConfig), name: String, type: Enum['COMPANY_CODE', 'PURCHASING_GROUP'], companyCode?: String @unique([tenantId, companyCode]), pgCode?: String @unique([tenantId, pgCode]) )—e.g., Djarum: 5 child CC OrgUnits + PG sub-nodes.
     - `User`: orgUnitId: FK (to OrgUnit, scoped by config level); roleId: FK to Role (via RBACConfig for process ties).
     - `Role`: configId: FK to RBACConfig; enum-like (ADMIN, BUYER) with permissions Json—flexible per company (e.g., Djarum: CC-specific overrides).
     - `Vendor`: tenantId, orgUnitId (FK to OrgUnit for PG/CC assignment); status: Enum—linked via config for process eligibility.
     - `Currency`, `Category` (unchanged, but add configId FK for tenant overrides, e.g., CC-specific rates).

3. **Transaction Tables Layer (Scoped and Driven by Configurations)**
   - **Core Role**: Dynamic data always validated against configs—e.g., Headers require processConfigId (Key Figure); Items inherit rules (e.g., validation per step Json).
   - Core Splits (per BUSINESS_PROCESS.md, config-applicable):
     - Tender: `TenderHeader` (id, tenantId, processConfigId: FK (mandatory), orgUnitId: FK (e.g., PG for Djarum), status: Enum, totalEstValue: Decimal) / `TenderItem` (headerId: FK, requirement: Json, criteriaWeight: Decimal—validated against ProcessConfig.steps).
     - Bid: `BidHeader` (id, tenantId, tenderHeaderId: FK, vendorId: FK (must match orgUnit), totalScore: Decimal) / `BidItem` (headerId: FK, proposal: Json, score: Decimal—computed per config criteria).
     - Procurement: `PRHeader` (id, tenantId, processConfigId: FK, contractId: FK, orgUnitId: FK (CC/PG), approvalChain: Json (built from RBACConfig)) / `PRItem` (headerId: FK, itemDesc: String, qty: Decimal—threshold-checked via TenantConfig).
     - PO: `POHeader` (poNumber: String (generated via SystemConfig + orgUnit.companyCode/pgCode), processConfigId: FK) / `POItem` (headerId: FK, link to PRItem).
     - GR/Invoice/Payment: Similar splits; e.g., `InvoiceHeader` with configId for three-way match rules.
   - AuditLog: Enhanced with keyFigure (e.g., configId: FK, activityBasis: String "ProcessConfig Step 2") for traceable, config-driven changes.

4. **Migration & Enforcement**
   - Prisma Migration: Split existing models; backfill configId defaults from TenantConfig (e.g., assign base ProcessConfig to legacy data).
   - Services: ConfigService as entry point (e.g., all creates: validateInputAgainstConfig(input, processConfigId)); enforce hierarchy (e.g., PO.orgUnit must descend from User's via recursive query).
   - Configurability: On tenant provision (POST /tenants), parse TenantConfig Json to bootstrap (e.g., generate OrgUnits/PGs for Djarum's 5 CCs; set PO numbering per PG).

### Non-Functional Requirements
- **Scalability**: Config-driven normalization (e.g., 1 Config:N Transactions); indexes on tenantId + keyFigures (e.g., @@index([tenantId, processConfigId, orgUnitId])).
- **Performance**: Joins <200ms (e.g., Prisma include: { config: { select: { steps: true } } }); Json parsed server-side for flexibility.
- **Security**: Configs enforce RBAC (e.g., Guards: User's role from RBACConfig >= step.requiredRole); all activities trace to configId.
- **Reliability**: Soft deletes; constraints (e.g., FKs require valid config); Json schema validation (Zod in services).
- **Observability**: Logs prefix with configId (e.g., "PO_CREATED: tenant=acme, configId=123, basis=ProcessConfig.TENDER").
- **Compliance**: Config changes audited; hierarchies exportable (e.g., for GDPR, export Djarum's CC-linked roles).

## User Stories & Acceptance Criteria
| User Story | Priority | Acceptance Criteria |
|------------|----------|----------------------|
| As a Tenant Admin (e.g., Djarum), I configure org hierarchy as basis for all activities. | High | - POST /:tenant/config/org { json: { levels: 5, ccs: 5 } } → Auto-creates OrgUnits (CCs + PGs); links RBAC/ProcessConfig.<br>- Activities (e.g., PO create) validate against config (e.g., poNumber="CC1-PG1-0001").<br>- Test: Djarum sim (5 CCs) vs. SME (1 level); both generate valid hierarchies; 100% FK compliance. |
| As a SaaS Admin, I provision tenant with config as universal basis (e.g., hierarchical vs. flat). | High | - POST /tenants { config: { processType: 'PROCUREMENT', steps: [...] } } → Creates ProcessConfig; propagates to Masters/Transactions.<br>- Legacy data migrates to base config.<br>- Test: Djarum (multi-CC) provisions 5 OrgUnits; SME (flat) skips; both run BUSINESS_PROCESS.md flow without errors. |
| As a Buyer (Djarum PG user), I create PO driven by CC/PG config basis. | Medium | - POST /:tenant/po { header: {...}, items: [...] } → Validates orgUnitId against config; generates poNumber per PG/CC.<br>- Approval routes via ProcessConfig (e.g., CC manager for high-value).<br>- Test: E2e with Djarum hierarchy; join query (Header+Items+Config) <150ms; SME flat route succeeds. |
| As a Developer, I query activities filtered by config basis (e.g., PG-specific). | High | - GET /:tenant/pos?configId=123&pgCode=PG1 → Filters Transactions via Key Figures; includes derived hierarchy.<br>- Test: Migration splits data; queries respect config (e.g., Djarum: Only CC1 POs for PG1). |
| As a Vendor (per CC/PG), I submit bids scoped by config process. | Medium | - POST /:tenant/bids → Header+Items; eligibility checks Vendor.orgUnit vs. TenderHeader.orgUnit (config-enforced).<br>- Test: Unit verifies config criteria (e.g., Djarum: CC-specific compliance). |

## Technical Specifications
### Code Changes
- **Prisma Schema (prisma/schema.prisma)**: 
  - Configuration: Mandate configId FK in Tenant/OrgUnit/Role/etc.; ProcessConfig.steps: Json with keyFigure refs (e.g., "thresholdFk: TenantConfig.amountLimit").
  - Master: All models require configId (e.g., OrgUnit.configId: FK); self-relations for hierarchy (parentId, with config-level computation).
  - Transaction: Headers mandate processConfigId/orgUnitId (Key Figures); Items optional configLink: String (for step-specific).
  - Enums: Extend for types (e.g., OrgUnitType: enum COMPANY_CODE, PURCHASING_GROUP).
  - Run: `npx prisma migrate dev --name sap-flex-refactor; npx prisma generate`.
- **Services/Controllers**: 
  - ConfigService: Central hub (e.g., getBasis(configId: string) → Returns linked Masters/Transactions); validateAll(input, configId).
  - Update TenderService: `create(input: { configId: string, header: ..., items: [...] })` → Tx: Create Header (with FKs) + Items + Audit (basis=configId).
  - Middleware: ConfigValidator (e.g., ensure processConfigId valid for tenant); HierarchyResolver (recursive from User's orgUnitId).
  - Auth: JWT claims include configId; CaslAbilityFactory queries RBACConfig for basis-driven abilities.
- **Migrations**: 
  - Step 1: Add config tables/FKs (optional initially).
  - Step 2: Backfill (e.g., CREATE base ProcessConfig; UPDATE Tenant SET configId = base.id).
  - Step 3: Split/enforce (e.g., ALTER TABLE TenderHeader ADD CONSTRAINT fk_process_config).
- **Tests**: E2e for flexibility (e.g., Supertest: Provision Djarum config → Test PO with PG numbering; SME variant → Flat approval); integration for basis propagation.
- **Deployment**: render.yaml postDeploy: `npx prisma migrate deploy`; seed with config templates (e.g., `--basis=djarum-hierarchical`).

### Data Model Additions/Changes
- **Key Figures Emphasis**: Mandatory in all non-Config models (e.g., configId: String @map("config_id") @index); enables basis traceability (e.g., query Transactions by ProcessConfig.steps.condition).
- **Hierarchy Enforcement**: OrgUnit: Compute level via service (recursive CTE in raw SQL); Json in TenantConfig for bootstrap (e.g., { ccs: [{ code: 'CC1', pgs: 2 }] } → Auto-insert).
- **Json Flexibility**: All configs use schema-validated Json (e.g., steps: [{ name: string, condition: { keyFigure: string, op: 'gt', value: number } }])—parsed for company-specific logic.

### API Changes
- Config: POST/GET/PUT /:tenant/config/basis (CRUD with propagation); e.g., body: { processType: 'TENDER', jsonSteps: [...] }.
- Master: POST /:tenant/org-units/bulk (from config Json, e.g., for Djarum CCs).
- Transaction: All POSTs require configId in body; responses embed basis (e.g., { header: ..., configBasis: { steps: [...] } }).
- Swagger: Tags 'Config Basis', 'Config-Driven Master', 'Config-Scoped Transaction'; examples for Djarum/SME variants.

## Implementation Plan for WARP AI
1. **Preparation (1 day)**: Audit schema vs. technical.md; draft migration with config backfill; define Json schemas (Zod).
2. **Schema Refactor (2-3 days)**: Build config layer as basis; add FKs to Masters/Transactions; migrate splits with basis assignment.
3. **Service/Guard Updates (2 days)**: Centralize ConfigService; enforce basis validation; add hierarchy resolver.
4. **Testing (1-2 days)**: Unit (config propagation); e2e (Djarum vs. SME sims); `npm test --watch`.
5. **Deployment/Validation (1 day)**: Deploy to Render; test BUSINESS_PROCESS.md with config variants; audit basis coverage (100% FKs linked).
6. **Post-Impl**: Update technical.md; commit as "feat: config-basis sap-flex-refactor".

## Risks & Mitigations
- **Risk**: Config as basis over-constrains legacy data. **Mitigation**: Default base configs; optional FKs in migration.
- **Risk**: Json flexibility leads to invalid states (e.g., Djarum CC cycle). **Mitigation**: Zod + service validators; recursive checks.
- **Risk**: Perf from config joins. **Mitigation**: Eager-load basis (Prisma include); indexes on keyFigures.
- **Risk**: Company-specific gaps (e.g., non-standard PG-CC). **Mitigation**: Extensible Json; e2e for variants.

## Success Metrics
- **Technical**: 100% models link to config basis; migration zero-loss; queries with basis <150ms.
- **Operational**: Render deploy <15min; config propagation 100% in logs.
- **Business**: Validate 3 variants (Djarum hierarchical, SME flat, hybrid); full process flexibility (e.g., PO numbering adapts per config). 

This PRD is executable—WARP AI: Emphasize config as basis in all commits; use Prisma Studio for FK viz; test with Djarum-like seeds. Tag @grok for review.