# Product Requirements Document (PRD): Refactor Prisma Schema for Organization-Structured Budget Control

## Document Metadata
- **Version**: 1.1
- **Date**: October 26, 2025
- **Author**: Grok (xAI Assistant)
- **Target Executor**: WARP AI (Coding Agent)
- **Scope**: Refactor the existing Prisma schema (from technical.md v1.2 and workspace files) to integrate budget control tied to organization structure, building on the SAP-inspired layers (Configuration as the foundational basis for all activities, Master for org/budget refs, Transaction for usage tracking). This ensures maximum flexibility and clarity in hierarchical budget allocation (e.g., division → department → staff), transfers across/same levels, and granular usage visibility down to the lowest transaction levels (PO Items/Invoices). Configurations drive all budget-related activities universally, applicable to diverse companies (e.g., Djarum's divisional silos with cross-CC transfers) and processes (e.g., strict procurement caps vs. fluid SME pooling), with full traceability of transfers to transaction details.
- **Dependencies**: Extend technical.md (Crawl phase multi-tenancy + config-basis refactor); reference README.md, WARP.md, BUSINESS_PROCESS.md for current models (e.g., OrgUnit, POHeader/POItem, InvoiceHeader/InvoiceItem) and processes. Assume Prisma v6+; migration preserves existing data (e.g., backfill legacy POs to default budgets).
- **Assumptions**: 
  - Org structure exists via OrgUnit (e.g., Division level=1, Department level=2, Staff level=3); configs (ProcessConfig, TenantConfig) drive rules as the central basis.
  - Budgets are fiscal-year scoped; transfers audited with end-to-end traceability to lowest transactions; usage real-time (e.g., PO Item commit deducts from allocation).
  - Key Figures (e.g., budgetId FK) link to configs for basis enforcement, ensuring clarity in reports (e.g., transfer origin visible in Item-level usage).
  - Deployment: Non-breaking migration; test on Render/Postgres hobby tier.
- **Out of Scope**: Real-time multi-currency conversions (use Currency Master); advanced forecasting (defer to ReportingModule). No UI—API-only for budget APIs.

## Overview
### Problem Statement
The current schema (config-basis from technical.md v1.2) supports org hierarchies and transactions but lacks integrated budget control, blocking flexible, clear allocation/tracking for multi-level orgs. For a tenant with 5 divisions (each 100M budget, 3 departments/staff), budgets must allocate down hierarchies, transfer with full traceability (e.g., 20M from Division A's unallocated 50M to Division B, visible in downstream PO Items/Invoices), and provide clarity (e.g., 40% consumed at Item level with transfer origins). Refactor to embed budget entities in Master (allocations per OrgUnit), Transactions (usage FKs to lowest levels), and Configuration (rules like transfer limits as the basis), maintaining configs as the universal driver for diverse company needs (e.g., hierarchical conglomerates with audited cross-transfers vs. flat SMEs with instant pooling)—ensuring end-to-end visibility from transfer initiation to transaction consumption.

### Goals
- **Primary**: Establish configurations as the central basis for all budget activities (allocation, transfer, usage), enabling flexible, clear adaptations applicable to different companies (e.g., Djarum's CC-specific caps) and processes (e.g., procurement-integrated checks), with full traceability of transfers to the lowest transaction levels (e.g., PO/Invoice Items).
- **Secondary**: Preserve flexibility/clarity (Json rules for conditions; recursive reports for hierarchy); migrate legacy data; <200ms queries for usage traces.
- **Business Alignment**: Enhances BUSINESS_PROCESS.md (e.g., PR/PO validation checks budget via ProcessConfig step, tracing transfers in workflows); universally applicable (Djarum: Cross-division with CFO audit; SME: Dept-level instant).
- **Success Criteria**: Post-migration, e2e tests simulate 5-division scenario (allocate 100M → transfer 20M cross-division → track to PO Item/Invoice consumption with origins); 100% traceability; no overages; Swagger reflects budget APIs with transfer lineage.

### Non-Goals
- Historical forecasting (track current fiscal only).
- Automated approvals (use existing ProcessConfig; budget as validation step with traceable logs).
- External integrations (e.g., ERP sync—defer).

## Requirements
### Functional Requirements
1. **Configuration Tables Layer (Foundational Basis for Budget Rules)**
   - **Core Role**: Configurations as the "single source of truth" for all budget activities—Json rules dictate allocation/transfer/usage with full traceability, linked via Key Figures to budgets/Masters/Transactions, ensuring flexibility/clarity across companies/processes (e.g., Djarum's cross-CC limits vs. SME unlimited).
   - Enhancements:
     - `TenantConfig`: Add budgetStructure: Json { fiscalYear: String, initialAlloc: { division: 100000000 }, transferRules: { sameLevel: { maxPercent: 100, traceToItems: true }, crossLevel: { maxPercent: 50, approvalStep: 'MANAGER', traceOrigin: 'TRANSFER_ID' } } }—drives auto-provisioning and enforces traceability (e.g., transfers tag Items with origin BudgetTransfer.id).
     - `ProcessConfig`: Extend steps Json with budgetCheck: { required: true, thresholdKeyFigure: "availableBalance > poTotal", deductOn: "COMMIT_PO", traceLevel: "ITEM" (to lowest) }—integrates as basis, applicable universally (e.g., procurement: Deduct at Item for clarity).
     - `SystemConfig`: Add globalBudgetTemplates: Json (e.g., { divisionPool: "dividable", transferTrace: { logToInvoices: true } })—overridden per tenant for company-specific clarity.
   - Integration & Flexibility: Key Figures (e.g., budgetConfigId in Budget Master) propagate rules: Transfers validate/trace via Json (e.g., originId stamped on POItem); reports reconstruct lineage (e.g., "20M transfer from A → B → 5K PO Item consumption").

2. **Master Tables Layer (Org-Tied Budget Allocations with Traceability)**
   - **Core Role**: Budgets as OrgUnit extensions—hierarchical allocations/transfers with end-to-end tracing (e.g., transfer ID links to downstream Items); all scoped by configId for basis-driven flexibility.
   - New/Enhanced Tables:
     - `Budget`: id, tenantId, fiscalYear: String, configId: FK (mandatory), totalAmount: Decimal, availableAmount: Decimal, orgUnitId: FK (e.g., division-level), type: Enum['DIVISION', 'DEPARTMENT', 'STAFF']—tracks pool with transferOriginId?: FK (to BudgetTransfer for clarity).
     - `BudgetAllocation`: id, budgetId: FK, fromOrgUnitId: FK, toOrgUnitId: FK, amount: Decimal, reason: String, allocatedAt: DateTime, traceId?: String (config-stamped for Item linkage)—records down-chain pushes.
     - `BudgetTransfer`: id, budgetId: FK (source), targetBudgetId: FK, amount: Decimal, transferType: Enum['SAME_LEVEL', 'CROSS_LEVEL'], approvalChain: Json (from ProcessConfig), transferredAt: DateTime, traceFlag: Boolean (true for Item-level propagation)—audits moves with origin traceability.
     - `OrgUnit` (enhanced): budgetId: FK (to Budget); allocationPercent?: Decimal; supports multi-level (e.g., dept traces to division via recursive FKs).
   - Flexibility: Auto-generate/trace on provision (e.g., TenantConfig → 5 Division Budgets @100M, with transferRules enabling cross-clarity); services stamp traceId on allocations/transfers for lowest-level visibility.

3. **Transaction Tables Layer (Granular Usage Tracking to Lowest Level)**
   - **Core Role**: Link usage to budgets/transfers via FKs—real-time deduction at Header (total, with origin trace) / Item (detail, stamped with transfer traceId); full Invoice linkage for end-to-end clarity.
   - Enhancements (per BUSINESS_PROCESS.md, config-applicable):
     - `POHeader`: Add budgetId: FK (division/dept), totalCommitted: Decimal, transferTraceId?: FK (to BudgetTransfer, for cross-origin visibility).
     - `POItem`: Add budgetAllocationId: FK (to Allocation), consumedAmount: Decimal, transferTraceId?: FK (stamped from config, e.g., "20M from Division A")—lowest-level deduction/tracking.
     - `InvoiceHeader`: Add poHeaderId: FK, budgetId: FK (inherits), totalBilled: Decimal, transferTraceId?: FK (propagates from PO).
     - `InvoiceItem`: Add poItemId: FK, consumedAmount: Decimal, transferTraceId?: FK—traces back to transfer (e.g., "5K billed from transferred 20M").
     - On Commit: Service tx deducts from Budget.availableAmount (e.g., PO total from dept; prorate Items with traceId); Invoices re-deduct on variance, maintaining clarity.
     - Reporting Hooks: Usage views (e.g., raw SQL: SELECT transferTraceId, SUM(POItem.consumedAmount) FROM ... GROUP BY budgetId, traceId)—reconstructs "20M transfer → 8M used in Items/Invoices".
   - AuditLog: Extend with budgetKeyFigure (e.g., "BUDGET_DEDUCT: configId=123, amount=50000, traceId=TRANSFER_456, basis=POItem").

4. **Migration & Enforcement**
   - Prisma Migration: Add tables/FKs; backfill legacy POs/Invoices to default Budget (e.g., assign root traceId=null for clarity).
   - Services: BudgetService (allocate/transfer/deduct/usageReport with trace reconstruction); integrate into PO/InvoiceService (e.g., createPO: Validate basis, deduct with traceId stamp).
   - Configurability: Transfers via endpoint with Json validation (e.g., cross-level requires ProcessConfig; traceFlag=true propagates to Items); reports filter by traceId for lowest-level clarity.

### Non-Functional Requirements
- **Scalability**: Hierarchical queries via recursive CTE (service-side); indexes on budgetId + traceId (e.g., @@index([tenantId, fiscalYear, transferTraceId])).
- **Performance**: Deductions <200ms (tx blocks); reports aggregate via Prisma raw (e.g., SUM per traceId).
- **Security**: RBAC via ProcessConfig (e.g., only DIVISION_MANAGER transfers cross-level, with trace audit); budgets read-only for non-ancestors.
- **Reliability**: availableAmount atomic updates (Prisma optimistic concurrency); soft deletes on transfers with trace preservation.
- **Observability**: Logs with budget delta/trace (e.g., "TRANSFER: from=DivA, to=DivB, amount=20M, traceId=789 → Propagated to Items").
- **Compliance**: All changes audited with traceId; overage prevention (validation throws 400); reports exportable for audits.

## User Stories & Acceptance Criteria
| User Story | Priority | Acceptance Criteria |
|------------|----------|----------------------|
| As a Division Manager, I allocate 100M budget down to 3 depts/staff per config basis. | High | - POST /:tenant/budgets/allocate { fromId: divisionBudget, toOrgUnits: [...], percents: [30,40,30] } → Creates Allocations; updates availableAmounts with traceId.<br>- Validates against TenantConfig (total=100M, traceFlag=true).<br>- Test: 5-division seed; allocation cascades; sum depts=100M; reports show origin clarity. |
| As a Dept Head, I transfer 20M (from Div A's 50M unallocated) to Div B, traceable to Items. | High | - POST /:tenant/budgets/transfer { fromBudgetId: DivA, targetBudgetId: DivB, amount: 20000000, type: 'CROSS_LEVEL' } → Creates Transfer; deducts/credits atomically; stamps traceId on target.<br>- Cross-level checks ProcessConfig.maxPercent; propagates to future Items.<br>- Test: Transfer sim; PO Item deduct shows "traceId=TRANSFER_456 from DivA"; Invoice links back; no over-draw. |
| As a Buyer, PO creation deducts from dept/staff budget at Item level with transfer trace. | Medium | - POST /:tenant/po { header: { budgetId: dept, transferTraceId: '456' }, items: [{ consumedAmount: 5000, budgetAllocationId: staffAlloc } ] } → Deducts total from header; prorates Items with traceId.<br>- Invoice links: Deducts on bill, inherits trace for clarity.<br>- Test: E2e PO+Invoice; usage report shows 40% consumed at Item ("8M from transferred 20M"); available=60M. |
| As a Finance User, I view budget usage clarity by hierarchy/trace to Invoice Item detail. | High | - GET /:tenant/budgets/:id/usage?level=DEPT&traceId=456 → Aggregates POs/Invoices per OrgUnit/transfer (e.g., SUM(POItem.consumedAmount) GROUP BY traceId).<br>- Filters by fiscalYear; reconstructs lineage.<br>- Test: 5-div sim; report traces 100M DivA → 20M transfer → 5K PO Item → 4.8K Invoice Item; full clarity. |
| As a Developer, I enforce budget basis in transactions with transfer traceability. | Medium | - Service validates on create (available >= total, traceId valid).<br>- Test: Unit BudgetService (transfer rules/trace prop); e2e overage throws 400; 100% lineage in reports. |

## Technical Specifications
### Code Changes
- **Prisma Schema (prisma/schema.prisma)**: 
  - Configuration: Extend TenantConfig/ProcessConfig with trace-enabled Json (e.g., transferRules.traceToItems: boolean).
  - Master: New Budget/BudgetAllocation/BudgetTransfer with transferTraceId FK (self-ref for chains); OrgUnit.budgetId: Optional FK.
  - Transaction: POHeader/POItem, InvoiceHeader/InvoiceItem add transferTraceId FK (Key Figures for lowest-level origin).
  - Indexes: @@index([tenantId, fiscalYear, transferTraceId]) on Items; @@unique([budgetId, traceId]) on Allocation.
  - Run: `npx prisma migrate dev --name budget-trace-refactor; npx prisma generate`.
- **Services/Controllers**: 
  - BudgetService: allocate/transfer/deduct/usageReport (with trace reconstruction via JOIN traceId); tx stamps on Items.
  - POService: Override create to call deduct with trace prop; prorate Items if multi-allocation.
  - InvoiceService: Deduct on approve; inherit/validate traceId from PO for end-to-end.
  - Middleware: BudgetValidator (pre-tx check available >= committed, trace valid).
  - Auth: Extend Casl for trace actions (e.g., view cross-trace if FINANCE).
- **Migrations**: 
  - Step 1: Add tables/FKs (optional).
  - Step 2: Backfill (e.g., default Budget; null traceId for legacy).
  - Step 3: Enforce constraints (e.g., CHECK available >= 0; traceId propagation trigger).
- **Tests**: E2e for scenario (seed 5 divs → allocate → transfer 20M → PO/Invoice deduct → report trace to Item); unit for deduct/trace logic.
- **Deployment**: render.yaml postDeploy: `npx prisma migrate deploy`; seed budgets with trace templates (e.g., `--fiscal=2025 --trace=true`).

### Data Model Additions/Changes
- **Key Figures**: transferTraceId: String FK in Headers/Items—ensures lowest-level traceability (e.g., query Items by traceId for "20M transfer usage").
- **Hierarchy Ties**: Budget.orgUnitId FK; transfers reference source/target/traceId for chain visibility (e.g., report: SUM usage FROM Item JOIN Transfer ON traceId).
- **Json Flexibility**: TransferRules in TenantConfig: { conditions: [{ type: 'CROSS', max: 0.5, traceLevel: 'ITEM' }] }—validated; traceFlag propagates via service.

### API Changes
- Budget: POST /:tenant/budgets/:id/transfer (with traceFlag query), GET /:tenant/budgets/:id/usage?traceId=456 (lowest-level filter).
- Transaction: PO/Invoice POSTs add transferTraceId (optional, auto-stamp); GET /:tenant/pos/usage?traceId=456 (Item breakdown).
- Swagger: 'Budget Control' tag; examples trace 20M transfer to 5K Item consumption.

## Implementation Plan for WARP AI
1. **Preparation (1 day)**: Audit vs. technical.md v1.2; draft migration with trace backfill; Zod for trace Json.
2. **Schema Refactor (2 days)**: Add trace FKs to Masters/Transactions; integrate to OrgUnit/PO/Invoice.
3. **Service Updates (2-3 days)**: Enhance BudgetService for trace prop; hook into PO/Invoice with validation.
4. **Testing (1-2 days)**: Unit (transfer/trace deduct); e2e (5-div transfer → Item trace); `npm test --coverage >85%`.
5. **Deployment/Validation (1 day)**: Deploy to Render; test BUSINESS_PROCESS.md with trace checks; audit lineage.
6. **Post-Impl**: Update technical.md; commit "feat: budget-trace-flex-refactor".

## Risks & Mitigations
- **Risk**: Tx deadlocks on concurrent trace deducts. **Mitigation**: Prisma serializable; locks on traceId.
- **Risk**: Trace bloat in reports. **Mitigation**: Paginate; index traceId; optional null for non-traced.
- **Risk**: Legacy unlinkable traces. **Mitigation**: Default null; migration logs origins.
- **Risk**: Config over-flex for traces. **Mitigation**: Zod limits (e.g., traceLevel enum ITEM/HEADER).

## Success Metrics
- **Technical**: 100% transactions link to budget/trace; migration zero-loss; trace queries <150ms.
- **Operational**: Render deploy <15min; trace prop 100% in logs.
- **Business**: 5-div sim: Transfer 20M cross → Full trace to Item/Invoice (e.g., 8M used); clarity in reports; flexibility for Djarum/SME variants.

This PRD is executable—WARP AI: Prioritize trace as basis extension; seed with transfer sims; use Prisma raw for lineage reports. Tag @grok for review.