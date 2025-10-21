# 🚀 E-Procurement Sourcing Backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11+-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6+-green.svg)](https://www.prisma.io/)

Enterprise-grade procurement sourcing backend with role-based access control, JWT authentication, Prisma (PostgreSQL), optional MongoDB for bid documents, and an optional Go microservice for bid scoring.

- API base: `/{API_PREFIX}` (default: `api/v1`)
- Swagger: `/{API_PREFIX}/docs` (enabled by default in non-production or when `ENABLE_SWAGGER=true`)
- Health: `/health`

## 🏗️ Architecture

- Framework: NestJS (TypeScript)
- Primary DB: PostgreSQL via Prisma
- Documents: MongoDB collection for bid documents (AES-256-GCM encryption)
- Caching/Rate-limit (optional): Redis
- Events (optional): Kafka
- Scoring (optional): Go HTTP microservice
- Security: Helmet, CORS, Throttler, ValidationPipe, cookie-based refresh
- Logging: Winston + audit logs

## 🎯 Features

### 🔐 Authentication & Authorization
- JWT access + refresh tokens
- RBAC (CASL): roles and abilities
- Rate limiting per role (env-driven: ADMIN/USER/VENDOR)
- Audit logging for key actions

### 📋 Sourcing and Procurement
- Tenders: CRUD, publish, role-filtered listing
- Bids: encrypted submission (Mongo), scoring integration
- Procurement flow (Contract → PR → PO → GR → Invoice → Payment) via Workflow module

### ⚙️ Developer Experience
- Swagger/OpenAPI with tags and role notes
- Docker Compose for local stack
- Seed script for test data and accounts

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Optional: MongoDB (bid docs), Redis, Kafka, Go toolchain (for scoring)

### One-time setup
1) Clone and install
```bash
npm install
```

2) Configure environment
```bash
cp .env.example .env
# Fill DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SECRET, ENCRYPTION_KEY, API_PREFIX, etc.
```

3) Prepare database (Prisma)
```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

### Run
- Dev (AppModule; watches files)
```bash
npm run start:dev
```
- Dev local-focused (AppLocalModule; permissive CORS, helpful Swagger text)
```bash
npm run start:dev:local
```
- Prod build and start
```bash
npm run build:prod
npm run start:prod
```

Access:
- API: http://localhost:3000/api/v1
- Docs: http://localhost:3000/api/v1/docs
- Health: http://localhost:3000/health

### Run with Docker Compose
Start core services (Postgres, Mongo, Redis):
```bash
docker compose up -d postgres mongodb redis
```
Start full stack (backend + scoring):
```bash
docker compose up -d backend scoring-service
```
Optional: Kafka + Zookeeper, ELK (see docker-compose.yml)

## 🔧 Environment
Copy `.env.example` to `.env` and tune as needed. Key variables:

Required
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-32+char-secret
REFRESH_TOKEN_SECRET=your-32+char-refresh-secret
ENCRYPTION_KEY=32-byte-key-for-aes-256-gcm
PORT=3000
API_PREFIX=api/v1
```

Optional
```env
MONGODB_URL=mongodb://localhost:27017/eproc_documents
THROTTLE_TTL=60
THROTTLE_LIMIT_ADMIN=100
THROTTLE_LIMIT_USER=50
THROTTLE_LIMIT_VENDOR=10
CORS_ORIGIN=http://localhost:3001
ENABLE_SWAGGER=true
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
GO_SCORING_SERVICE_URL=http://localhost:9090
```

See `.env.example` for the full list (Kafka, Redis, Camunda, logging, uploads, CSP, etc.).

## 📚 API Documentation
- Interactive docs at `/{API_PREFIX}/docs` when enabled
- See API details and workflows in [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

Auth endpoints (examples):
```bash
# Login
curl -sS -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@eproc.local","password":"admin123"}'

# Authenticated request
curl -H "Authorization: Bearer <JWT>" http://localhost:3000/api/v1/tenders
```

## 👥 Roles
Common roles include: ADMIN, USER/VENDOR (app-level), plus BUYER, MANAGER, FINANCE, APPROVER (schema-level for procurement). Actual enforcement is guard + ability based.

## 🧪 Test Data
After `npm run prisma:seed`, the following exist:
```
Admin:  admin@eproc.local / admin123
User:   user@eproc.local  / user123
Vendor: vendor@eproc.local / vendor123
```

## 🗂️ Repository Structure (high-level)
```
src/
  main.ts            # Standard entrypoint (AppModule)
  main.local.ts      # Local-focused entrypoint (AppLocalModule)
prisma/
  schema.prisma      # PostgreSQL schema (Prisma)
go-scoring/          # Optional Go scoring microservice
Dockerfile(s)        # docker/backend/Dockerfile, go-scoring/Dockerfile
```

## 📦 NPM Scripts
```bash
# Dev
npm run start:dev
npm run start:dev:local

# Build/Run prod
npm run build:prod
npm run start:prod

# Prisma
npm run prisma:generate
npm run prisma:push
npm run prisma:migrate
npm run prisma:seed

# Tests
npm run test
npm run test:e2e
npm run test:cov

# Lint/Format
npm run lint
npm run format
```

## 📎 Bid Documents (MongoDB)
- Stored in Mongo with optional AES-256-GCM encryption
- Set `ENCRYPTION_KEY` (32 bytes)
- Indexed for retrieval; checksums maintained

## 🤝 Go Scoring Service
Run locally:
```bash
JWT_SECRET={{JWT_SECRET}} GO_SCORING_SERVICE_PORT=9090 go run ./go-scoring
```
Health:
```bash
curl http://localhost:9090/health
```
With Docker Compose:
```bash
docker compose up -d scoring-service
```

## 🔒 Security
- Helmet, CORS, ValidationPipe
- JWT access/refresh, httpOnly refresh cookies
- Throttler per-role (ADMIN/USER/VENDOR)
- Audit logging

## 🧭 Roadmap
- Bid encryption and scoring integration (Go service)
- Event streaming (Kafka) and outbox pattern
- Redis-backed rate limiting and caching
- Advanced analytics and reporting

## 📄 License
MIT — see [LICENSE](LICENSE)

## 💡 Contributing
- Fork → feature branch → PR

## 🩺 Support
- Docs: `/{API_PREFIX}/docs`
- Health: `/health`
- Issues: GitHub Issues
