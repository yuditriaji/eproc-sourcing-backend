# 🚀 E-Procurement Sourcing Backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11+-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6+-green.svg)](https://www.prisma.io/)

Enterprise-grade procurement sourcing backend with comprehensive role-based access control, JWT authentication, and tender management capabilities.

## 🏗️ Architecture

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM  
- **Authentication**: JWT with Role-Based Access Control (RBAC)
- **Security**: Helmet, CORS, Rate Limiting, Input Validation
- **Documentation**: Swagger/OpenAPI 3.0
- **Logging**: Winston with comprehensive audit trails

## 🎯 Features

### 🔐 Authentication & Authorization
- ✅ JWT token authentication with refresh tokens
- ✅ Role-based permissions (ADMIN, USER, VENDOR)
- ✅ User registration with email verification workflow
- ✅ Rate limiting per role (Admin: 100/min, User: 50/min, Vendor: 10/min)
- ✅ Comprehensive audit logging

### 📋 Tender Management
- ✅ Create, update, and publish tenders (Admin/User)
- ✅ Role-based data filtering and access control
- ✅ Tender lifecycle management (Draft → Published → Closed → Awarded)
- ✅ Department-scoped access for internal users

### 💼 Bid Management (Planned)
- 🔜 Encrypted bid submission for vendors
- 🔜 Automated scoring integration
- 🔜 Workflow-based evaluation process

### 🔧 Technical Features
- ✅ PostgreSQL database with Prisma ORM
- ✅ Comprehensive input validation and sanitization
- ✅ OWASP security compliance
- ✅ Docker-ready configuration
- ✅ Health check endpoints
- ✅ Environment-based configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd eproc-sourcing-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and secrets
   ```

4. **Set up the database**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   npm run prisma:seed
   ```

5. **Start the development server**
   ```bash
   npm run start:dev:local  # For local development with SQLite
   # OR
   npm run start:dev        # For development with PostgreSQL
   ```

6. **Access the application**
   - API: http://localhost:3000/api/v1
   - Documentation: http://localhost:3000/api/v1/docs
   - Health: http://localhost:3000/health

## 🌐 Deployment

### Deploy to Render

#### Option 1: Automatic Deployment with render.yaml

1. **Push to GitHub** (see GitHub setup below)

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file

3. **Configure Environment Variables** (Auto-configured via render.yaml)
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Auto-generated from PostgreSQL service
   - `JWT_SECRET`: Auto-generated
   - `REFRESH_TOKEN_SECRET`: Auto-generated
   - `ENCRYPTION_KEY`: Auto-generated

#### Option 2: Manual Deployment

1. **Create PostgreSQL Database**
   - Go to Render Dashboard
   - Create a new PostgreSQL database
   - Copy the connection string

2. **Create Web Service**
   - Create new Web Service
   - Connect GitHub repository
   - Configure:
     - **Build Command**: `npm install && npm run build:prod`
     - **Start Command**: `npm run start:prod`

3. **Set Environment Variables**
   ```
   NODE_ENV=production
   DATABASE_URL=<your-postgres-connection-string>
   JWT_SECRET=<your-jwt-secret-32-chars-min>
   REFRESH_TOKEN_SECRET=<your-refresh-secret>
   ENCRYPTION_KEY=<your-32-byte-encryption-key>
   API_PREFIX=api/v1
   CRYPTO_SALT_ROUNDS=12
   ```

4. **Deploy**
   - Click "Deploy"
   - Monitor build logs
   - Access your API at: `https://your-app-name.onrender.com/api/v1`

### Deploy to Other Platforms

#### Heroku
```bash
# Install Heroku CLI, then:
heroku create your-app-name
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-jwt-secret
heroku config:set REFRESH_TOKEN_SECRET=your-refresh-secret
heroku config:set ENCRYPTION_KEY=your-encryption-key
git push heroku main
```

#### Railway
```bash
# Connect GitHub repository to Railway
# Set environment variables in Railway dashboard
# Deploy automatically on git push
```

## 📚 API Documentation

### Base URL
- **Local**: `http://localhost:3000/api/v1`
- **Production**: `https://your-app.onrender.com/api/v1`

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | User login (returns JWT) |
| `POST` | `/auth/register` | User registration |
| `POST` | `/auth/logout` | User logout |
| `POST` | `/auth/refresh` | Refresh JWT token |
| `GET` | `/auth/me` | Get current user profile |
| `GET` | `/auth/roles/config` | Get role configuration (Admin only) |

### Tender Endpoints

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/tenders` | ALL | List tenders (filtered by role) |
| `GET` | `/tenders/:id` | ALL | Get tender details |
| `POST` | `/tenders` | ADMIN, USER | Create new tender |
| `PUT` | `/tenders/:id` | ADMIN, USER | Update tender |
| `POST` | `/tenders/:id/publish` | ADMIN, USER | Publish tender |
| `DELETE` | `/tenders/:id` | ADMIN, USER | Delete tender |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |

## 🎭 User Roles & Permissions

### ADMIN
- ✅ Full system access
- ✅ Manage all tenders and bids
- ✅ Access admin-only endpoints
- ✅ View system analytics

### USER (Internal Staff)
- ✅ Create and manage own tenders
- ✅ View published tenders
- ✅ Score and evaluate bids
- ❌ Cannot access admin functions

### VENDOR (External Companies)  
- ✅ View published tenders only
- ✅ Submit bids on open tenders
- ✅ Manage own bid submissions
- ❌ Cannot create tenders
- ⚠️ Registration requires manual approval

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Role-Based Access Control**: Granular permissions per user role  
- **Rate Limiting**: Role-specific request throttling
- **Input Validation**: Comprehensive request validation and sanitization
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: HTTP security headers
- **Audit Logging**: Complete audit trail for all actions
- **Environment Isolation**: Separate configs for dev/staging/prod

## 🧪 Testing

### Pre-seeded Test Accounts

After database seeding, use these accounts for testing:

```
Admin Account:
- Email: admin@eproc.local
- Password: admin123
- Role: ADMIN

User Account:  
- Email: user@eproc.local
- Password: user123
- Role: USER

Vendor Account:
- Email: vendor@eproc.local  
- Password: vendor123
- Role: VENDOR
```

### API Testing
```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@eproc.local","password":"admin123"}'

# Use the returned token for authenticated requests
curl -H "Authorization: Bearer <your-jwt-token>" \
  http://localhost:3000/api/v1/tenders
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run start:dev          # Start with PostgreSQL
npm run start:dev:local    # Start with SQLite (local dev)

# Production  
npm run build:prod         # Build for production
npm run start:prod         # Start production server

# Database
npm run prisma:generate    # Generate Prisma client
npm run prisma:push        # Push schema to database  
npm run prisma:migrate     # Create migration
npm run prisma:seed        # Seed database with test data

# Testing
npm run test               # Run unit tests
npm run test:e2e           # Run end-to-end tests
npm run test:cov           # Run with coverage

# Code Quality
npm run lint               # Run ESLint
npm run format             # Format with Prettier
```

### Environment Configuration

Key environment variables:

```env
# Required
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-super-secure-secret-min-32-chars
REFRESH_TOKEN_SECRET=your-refresh-secret

# Optional  
NODE_ENV=development|production
PORT=3000
API_PREFIX=api/v1
CORS_ORIGIN=http://localhost:3001
FRONTEND_URL=https://your-frontend.com
```

## 🚧 Roadmap

- [ ] **Bid Management**: Complete bid submission and evaluation
- [ ] **File Uploads**: Document attachment support  
- [ ] **Email Notifications**: Automated tender/bid notifications
- [ ] **Advanced Analytics**: Reporting and dashboard features
- [ ] **Multi-tenancy**: Support for multiple organizations
- [ ] **API Versioning**: Version management for breaking changes
- [ ] **Rate Limiting**: Redis-based distributed rate limiting
- [ ] **Caching**: Redis caching for improved performance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Documentation**: Check `/api/v1/docs` for interactive API docs
- **Issues**: Open GitHub issues for bugs or feature requests  
- **Health Check**: Monitor `/health` endpoint for service status

---

🔥 **Built with NestJS, TypeScript, and PostgreSQL for enterprise-grade performance and security.**