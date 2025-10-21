# Product Requirements Document (PRD): Refactor E-Procurement Backend for SaaS MVP (Crawl Phase)

## Document Metadata
- **Version**: 1.0
- **Date**: October 22, 2025
- **Author**: Grok (xAI Assistant)
- **Target Executor**: WARP AI (Coding Agent)
- **Scope**: Refactor the existing NestJS/Prisma e-procurement backend to enable basic multi-tenant SaaS deployment in the "Crawl" phase (MVP launch: 0-3 months, <50 users, <$5k MRR). Focus on rapid iteration, cost efficiency (<$50/mo infra), and validation of product-market fit (PMF) via beta testing.
- **Dependencies**: Reference attached workspace files (README.md, WARP.md, BUSINESS_PROCESS.md) for current codebase structure, setup commands, and business processes. Assume access to existing repo (e.g., src/main.ts, prisma/schema.prisma, src/modules/*).
- **Assumptions**: 
  - Current code is single-tenant; core features (auth, tenders, procurement workflows) functional.
  - No frontend bundled yet—focus on API changes; UI integration deferred.
  - Deployment target: Heroku (primary) or Vercel (alternative for Git-based deploys).
- **Out of Scope**: Advanced multi-tenancy (subdomains, schema-per-tenant), caching (Redis), events (Kafka), custom domains, full observability (Datadog). Defer to Walk phase.

## Overview
### Problem Statement
The current backend (NestJS v11+, Prisma v6+, PostgreSQL) supports single-tenant procurement workflows (e.g., Tender CRUD, Contract → PR → PO flow per BUSINESS_PROCESS.md) but lacks multi-tenancy for SaaS. This blocks serving multiple companies (tenants) with data isolation, leading to manual forks or security risks. Refactor to a shared-schema model with `tenantId` enforcement, enabling path-based tenant routing (e.g., `/acme/tenders`) for isolated logins and operations.

### Goals
- **Primary**: Achieve basic multi-tenant isolation without schema changes, allowing 10-20 beta tenants to onboard via simple signup (manual/scripted provisioning).
- **Secondary**: Prepare for Heroku deployment with Git push-to-deploy; ensure 99% uptime under low load (<100 req/min).
- **Business Alignment**: Support core processes (tendering, procurement per BUSINESS_PROCESS.md) per tenant; validate via seeded test data (e.g., admin@tenant1.local).
- **Success Criteria**: Post-refactor, e2e tests pass for 2 simulated tenants (no cross-data leaks); deploy to Heroku in <5min; beta users report seamless access.

### Non-Goals
- Performance optimization (e.g., indexing beyond basics).
- UI/Frontend: API-only; assume client handles path routing.
- Advanced Security: Basic JWT scoping; defer rate-limiting to in-memory.

## Requirements
### Functional Requirements
1. **Multi-Tenancy Isolation**
   - Add `tenantId` (UUID, non-null) to all core Prisma models (e.g., User, Tender, Contract, PR, PO, Bid) with `@@index([tenantId])` and `@@unique([id, tenantId])`.
   - Implement Prisma middleware to auto-inject `tenantId` from request context (e.g., `prisma.$use((params, next) => { params.args.tenantId = ctx.tenantId; return next(params); })`).
   - Tenant provisioning: New endpoint `/tenants` (POST) to create tenant record (e.g., { subdomain: 'acme', config: Json }) and seed initial admin user.

2. **Path-Based Tenant Routing & Auth**
   - Update routes to include tenant prefix: e.g., `/:tenant/auth/login`, `/:tenant/tenders`, `/:tenant/workflow/pr`.
   - Extend AuthController: Extract `tenant` from `req.params.tenant`; resolve `tenantId` via Tenant model query; inject into JWT claims (e.g., `{ sub: userId, tenantId, ... }`).
   - Guards: Enhance RolesGuard/CaslAbilityGuard to validate JWT.tenantId matches resolved tenant (mismatch → 403).
   - Login Flow: POST `/ :tenant/auth/login` → Authenticate user scoped to tenant → Return JWT with tenant claims.

3. **Core Workflow Adaptations**
   - Tender/Bid/Procurement: All services (e.g., TenderService) filter by `tenantId` (e.g., `findMany({ where: { tenantId } })`).
   - Events/Notifications: Use in-app only (e.g., create Notification model entries); defer email (add Nodemailer stub for future).
   - Documents/Bids: MongoDB optional—keep Prisma Document model with `tenantId`; encrypt bids via existing ENCRYPTION_KEY, scoped by tenant.

4. **Deployment & Setup**
   - Heroku Procfile: `web: npm run start:prod`.
   - Environment: Update .env.example with `DATABASE_URL` (Heroku Postgres hobby); add `JWT_SECRET_TENANT_SCOPE=true`.
   - Seed Script: Extend prisma/seed.ts to accept `--tenantId` flag for multi-tenant seeding (e.g., npx prisma db seed --tenant=acme).

### Non-Functional Requirements
- **Performance**: Queries <200ms (Prisma defaults); no caching—rely on DB indexes.
- **Security**: JWT expiry 15min (access), 7d (refresh); httpOnly cookies; Helmet/CORS as-is, with `CORS_ORIGIN=*` for beta.
- **Reliability**: Graceful errors (e.g., unknown tenant → 404); soft deletes on models.
- **Observability**: Basic: Winston logs with tenant context; /health endpoint includes tenant count.
- **Compliance**: AuditLog captures tenantId on events (e.g., `CREATE_TENDER: tenant=acme`).

## User Stories & Acceptance Criteria
| User Story | Priority | Acceptance Criteria |
|------------|----------|----------------------|
| As a SaaS Admin, I can provision a new tenant to onboard a company. | High | - POST /tenants succeeds → Creates Tenant record + admin User.<br>- Seeded data (e.g., sample tender) isolated to tenantId.<br>- Test: Manual curl creates 'acme' tenant; query shows no overlap with 'beta' tenant. |
| As a Tenant User, I can login via path-based URL without seeing other tenants' data. | High | - POST /acme/auth/login with valid creds → JWT includes tenantId='acme'.<br>- GET /acme/tenders returns only acme data.<br>- Unauthorized/mismatch → 401/403.<br>- Test: E2E with Supertest simulates 2 tenants; zero cross-queries. |
| As a Buyer (tenant-scoped), I can create a tender following BUSINESS_PROCESS.md flow. | Medium | - POST /:tenant/tenders → Creates with tenantId auto-set.<br>- Status transitions (DRAFT → PUBLISHED) emit AuditLog with tenant.<br>- Test: Integration test covers full tender lifecycle; verifies Bid encryption per tenant. |
| As a Developer, I can deploy to Heroku and run locally with multi-tenant seeds. | High | - `git push heroku main` → App binds to $PORT; /health OK.<br>- `npm run prisma:seed -- --tenant=acme` → Populates isolated data.<br>- Test: Local Docker Compose up; curl endpoints succeed. |
| As a Vendor (per tenant), I can submit a bid isolated from others. | Medium | - POST /:tenant/bids → Stores in Mongo with tenantId (if enabled).<br>- Evaluation scores via inline TenderService (no Go service).<br>- Test: Unit test BidService; ensures compliance with BUSINESS_PROCESS.md states. |

## Technical Specifications
### Code Changes
- **Prisma Schema (prisma/schema.prisma)**: Add `tenantId String @default(uuid())` to models; relations include `tenantId`. Run `npm run prisma:generate && npm run prisma:push`.
- **Middleware (src/common/middleware/tenant.middleware.ts)**: New file—resolve tenant from params, attach to req.ctx.
- **Auth Module (src/modules/auth/**)**: Update strategies to include tenant in validate callback; add TenantResolverService.
- **Controllers/Services**: Prefix routes with `/:tenant` (NestJS @Controller('/:tenant')); inject tenantId via @Req().
- **AppModule (src/app.module.ts)**: Register TenantMiddleware globally; use ConfigModule for env flags.
- **Tests (src/test/**)**: Add e2e suite for multi-tenant (e.g., jest-e2e.json with Supertest mocking tenants).
- **Deployment Scripts**: Add heroku.yml or Procfile; update WARP.md with "Deploy: heroku create; git push heroku main".

### Data Model Additions
- New Model: `Tenant` { id: UUID, name: String, subdomain: String (unused in Crawl), config: Json? }.

### API Changes
- Base Path: Remains `/api/v1/:tenant`.
- New Endpoints: POST /tenants (admin-only, no tenant prefix).
- Swagger: Update tags with @tenant param descriptions.

## Implementation Plan for WARP AI
1. **Preparation (1-2 days)**: Audit current code against README.md/WARP.md; generate Prisma migration for tenantId.
2. **Core Refactor (3-5 days)**: Implement isolation/middleware; update auth/workflows; add Tenant model/service.
3. **Testing (1-2 days)**: Write/update Jest tests (unit for services, e2e for flows); run `npm test -- --coverage >80%`.
4. **Deployment (1 day)**: Configure Heroku; test live with seeded tenants.
5. **Validation**: Run BUSINESS_PROCESS.md checklists (e.g., tender publish) per tenant; fix leaks.

## Risks & Mitigations
- **Risk**: Migration breaks existing single-tenant data. **Mitigation**: Add optional tenantId default; run db push in dev.
- **Risk**: Middleware perf hit. **Mitigation**: Index tenantId; monitor with console.time in dev.
- **Risk**: Beta feedback on UX. **Mitigation**: Document path-based limitation; plan Walk migration.

## Success Metrics
- **Technical**: 100% test pass rate; zero cross-tenant leaks in audits.
- **Operational**: Heroku deploy <10min; <1% error rate in logs (first week).
- **Business**: Onboard 5 beta tenants; 80% report "easy access" in surveys.

This PRD is executable—WARP AI: Prioritize high-priority stories; commit per feature (e.g., "feat: add tenant model"); reference BUSINESS_PROCESS.md for flow fidelity. Tag @grok for review.