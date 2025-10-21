# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Stack: NestJS (TypeScript) + Prisma (PostgreSQL) with an auxiliary MongoDB collection for bid documents. Optional Redis, Kafka, and an HTTP Go microservice for bid scoring.
- Entrypoints: src/main.ts (standard) and src/main.local.ts (local/dev-focused).
- API prefix and docs: API is served under {API_PREFIX} (default: api/v1). Swagger at /{API_PREFIX}/docs. Health at /health.

Common commands
- Install deps
  ```bash path=null start=null
  npm install
  ```
- Prisma (PostgreSQL)
  ```bash path=null start=null
  # Generate client and push schema
  npm run prisma:generate
  npm run prisma:push

  # Create a migration during development
  npm run prisma:migrate

  # Seed database with sample data (see prisma/seed.ts)
  npm run prisma:seed
  ```
- Run application
  ```bash path=null start=null
  # Dev (watches files; uses src/main.ts / AppModule)
  npm run start:dev

  # Dev (local-focused; uses src/main.local.ts / AppLocalModule)
  npm run start:dev:local

  # Build and run prod
  npm run build
  npm run start:prod
  ```
- Lint and format
  ```bash path=null start=null
  npm run lint
  npm run format
  ```
- Tests (Jest)
  ```bash path=null start=null
  # Run unit tests (if present)
  npm test

  # Coverage
  npm run test:cov

  # E2E tests (if test/jest-e2e.json exists)
  npm run test:e2e

  # Run a single test file
  npx jest path/to/file.spec.ts

  # Run tests by name pattern
  npx jest -t "TenderService"
  ```
- Helpful scripts
  ```bash path=null start=null
  # One-shot local setup then run the local-focused app
  npm run dev:local

  # Initial data migration utility (if needed)
  npx ts-node scripts/migrate-initial-data.ts

  # User verification utility
  npx ts-node scripts/verify-user.ts
  ```
- Docker compose (services defined in docker-compose.yml)
  ```bash path=null start=null
  # Start core dependencies for backend dev
  docker compose up -d postgres mongodb redis

  # Start full stack including backend and scoring service
  docker compose up -d backend scoring-service

  # Optional: include Kafka + Zookeeper (for event streaming), and Nginx or ELK profile
  docker compose up -d zookeeper kafka
  docker compose --profile logging up -d elasticsearch kibana
  ```
- Go scoring service (go-scoring)
  ```bash path=null start=null
  # Run locally (requires JWT_SECRET in env)
  JWT_SECRET={{JWT_SECRET}} GO_SCORING_SERVICE_PORT=9090 go run ./go-scoring

  # Health check
  curl http://localhost:9090/health

  # Build binary
  go build -o scoring-service ./go-scoring

  # With Docker
  docker compose up -d scoring-service
  ```

High-level architecture and structure
- Application modules (NestJS)
  - AppModule (src/app.module.ts): Production-ready wiring. Loads:
    - ConfigModule for env; ThrottlerModule for rate-limiting; Passport/JWT for auth.
    - PrismaService (PostgreSQL via Prisma).
    - MongooseModule for MongoDB and BidDocument schema (encrypted content support).
    - Controllers/Services: Auth, Tender, Bid, Contract, Workflow, plus Audit and Event services.
    - Guards: ThrottlerGuard (global), RolesGuard (role gating), CaslAbilityGuard (fine-grained abilities).
  - AppLocalModule (src/app.local.module.ts): Local-focused wiring. Similar to AppModule but without Mongoose and with .env.local. Intended for a streamlined local experience while still using Prisma.
  - Entrypoints:
    - src/main.ts: Enables Helmet, cookie parsing, configured CORS, global prefix, global ValidationPipe, Swagger docs, and /health endpoint; graceful shutdown; binds to 0.0.0.0. Uses API_PREFIX (default api/v1) and PORT (default 3000).
    - src/main.local.ts: Mirrors main bootstrap with more permissive CORS and explicit local docs annotations.

- Data layer
  - Prisma (PostgreSQL)
    - PrismaService (src/database/prisma/prisma.service.ts) extends PrismaClient and ensures lifecycle connect/disconnect.
    - Schema (prisma/schema.prisma) models the procurement domain:
      - Core: User, Vendor, Contract, PurchaseRequisition, PurchaseOrder, Tender, Bid, Quotation, GoodsReceipt, Invoice, Payment, Document, Currency and join tables.
      - Rich enums/status fields, composite unique indexes, and relational constraints to support end-to-end sourcing workflows.
    - Seed (prisma/seed.ts) creates admin/user/vendor accounts, a sample tender and bid, and audit logs.
  - MongoDB (Mongoose)
    - BidDocument schema (src/database/mongo/bid-document.schema.ts) stores documents with optional AES-256-GCM encryption. Uses ENCRYPTION_KEY and computes checksums; multiple helpful indexes.

- Authentication, authorization, and rate limiting
  - JWT auth via @nestjs/jwt with access and refresh tokens. Access claims include sub, email, role, abilities.
  - Guarding layers:
    - RolesGuard (src/common/guards/roles.guard.ts) uses @Roles decorator for role checks.
    - CaslAbilityGuard (src/common/guards/casl-ability.guard.ts) uses AbilityFactory-based rules via @CheckAbilities.
    - ThrottlerGuard is registered as a global guard; limits can be tuned with THROTTLE_LIMIT_* env vars.

- API surface and docs
  - AuthController: login/register/refresh/logout/me and roles/config; sets httpOnly refresh cookies.
  - TenderController: CRUD + publish with role/ability checks; role-filtered listing (Admin sees all, User sees department/global, Vendor sees published).
  - WorkflowController/WorkflowService: orchestrates procurement flows (e.g., Contract → PR → PO → GR → Invoice → Payment) by delegating to domain services and emitting events.
  - Swagger: Descriptive tags and role-based descriptions; available at /{API_PREFIX}/docs.

- Events and integrations
  - EventService (src/modules/events/event.service.ts) used across services to emit domain events (Kafka brokers configurable via env).
  - docker-compose provides optional Kafka/Zookeeper for local event streaming.

- Go scoring microservice (go-scoring)
  - HTTP service with endpoints:
    - GET /health: service info
    - POST /score: scores a bid using supplied criteria; requires Authorization: Bearer <JWT> and permits roles USER or ADMIN.
  - JWT verification uses the same JWT_SECRET env var; ensure it matches the Nest API.

Environment and configuration
- Copy and edit env
  ```bash path=null start=null
  cp .env.example .env
  # Set DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SECRET, ENCRYPTION_KEY, PORT, API_PREFIX, etc.
  ```
- Key variables
  - DATABASE_URL: Postgres connection for Prisma.
  - MONGODB_URL: Mongo connection (used by AppModule).
  - JWT_SECRET, REFRESH_TOKEN_SECRET, JWT_EXPIRY, REFRESH_TOKEN_EXPIRY.
  - ENCRYPTION_KEY: 32-byte key used by the Mongo bid document encryption hook.
  - THROTTLE_LIMIT_ADMIN/USER/VENDOR.
  - Optional: KAFKA_BROKERS, REDIS_URL, GO_SCORING_SERVICE_URL.

Notes
- The repo includes Dockerfiles for both the Nest backend (docker/backend/Dockerfile) and the Go scoring service (go-scoring/Dockerfile). docker-compose.yml defines a full local stack; you can bring up only the services you need during development (e.g., Postgres + backend).
- Swagger and a pingable /health endpoint are enabled in both standard and local entrypoints.
