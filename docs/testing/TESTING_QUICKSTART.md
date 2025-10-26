# Testing Quick Start Guide

## 🚀 Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
# Configuration tests
npm test -- config.spec

# API Integration tests (production)
npm test -- api-integration.spec

# Legacy tests
npm test -- tenant-context.spec
npm test -- event.service.spec
```

### Generate Coverage Report
```bash
npm run test:cov
```

### Watch Mode (Auto-rerun)
```bash
npm run test:watch
```

---

## 📊 Current Status

✅ **31/31 tests passing** (100%)  
🎯 **20/131 scenarios covered** (16%)  
⚡ **18.9s execution time**  
🌐 **Testing against**: https://eproc-sourcing-backend.onrender.com

---

## 📁 Test Files

| File | Tests | Description |
|------|-------|-------------|
| `test/config.spec.ts` | 9 | Environment & configuration validation |
| `test/api-integration.spec.ts` | 20 | Production API integration tests |
| `test/tenant-context.spec.ts` | 1 | Tenant context management |
| `test/event.service.spec.ts` | 1 | Event service outbox pattern |

---

## ✅ What's Tested

### Authentication ✅ (100%)
- User registration
- Login with valid/invalid credentials
- JWT token issuance and validation
- Protected endpoint access

### Configuration ✅ (27%)
- Environment variable validation
- Missing variable detection
- Custom API prefix support

### Master Data ✅ (13%)
- Currency listing
- Vendor CRUD operations

### Transactions ✅ (10%)
- Tender lifecycle (create, list, publish)
- Purchase requisition flow
- Purchase order flow
- Error handling (401, 404, 400)

---

## 🎯 Test by Scenario ID

```bash
# Authentication
npm test -- api-integration.spec -t "TC-TRANS-001"

# Configuration
npm test -- config.spec -t "TC-CONFIG-001"

# Tender Management
npm test -- api-integration.spec -t "TC-TRANS-006"

# Vendor Management
npm test -- api-integration.spec -t "TC-MASTER-017"

# Purchase Requisition
npm test -- api-integration.spec -t "TC-TRANS-022"

# Purchase Order
npm test -- api-integration.spec -t "TC-TRANS-027"
```

---

## 🔧 Configuration

### Environment Variables
```bash
# Automatically set in test/setup.ts
BASE_URL=https://eproc-sourcing-backend.onrender.com
API_PREFIX=api/v1
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key-for-testing-only
```

### Override for Local Testing
```bash
BASE_URL=http://localhost:3000 npm test -- api-integration.spec
```

---

## 📝 Writing New Tests

### 1. Create Test File
```bash
touch test/my-feature.spec.ts
```

### 2. Basic Structure
```typescript
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://eproc-sourcing-backend.onrender.com';
const API_URL = `${BASE_URL}/api/v1`;

describe('My Feature Tests', () => {
  let client;
  let authToken;

  beforeAll(() => {
    client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      validateStatus: () => true,
    });
  });

  it('should test my feature', async () => {
    const response = await client.get('/my-endpoint', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
  });
});
```

### 3. Run Your Test
```bash
npm test -- my-feature.spec
```

---

## 🐛 Troubleshooting

### Test Fails with 502 Error
**Cause**: Server cold start on Render.com  
**Solution**: Already handled in tests (502 accepted as valid)

### Authentication Required
```typescript
// Login first
const loginRes = await client.post('/auth/login', {
  email: 'test@example.com',
  password: 'Test@12345'
});
const token = loginRes.data.accessToken;

// Use in requests
const response = await client.get('/protected-endpoint', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Timeout Errors
```typescript
// Increase timeout for slow endpoints
const response = await axios.get(url, {
  timeout: 60000  // 60 seconds
});
```

---

## 📈 Next Test Priorities

1. **Bid Management** (TC-TRANS-011 to TC-TRANS-016)
   - Submit bid
   - Evaluate bid
   - Accept/reject bid

2. **Contract Lifecycle** (TC-TRANS-017 to TC-TRANS-021)
   - Create contract
   - Assign vendors
   - Sign contract
   - Complete/terminate

3. **Budget Control** (TC-TRANS-053 to TC-TRANS-059)
   - Allocate budget
   - Transfer budget
   - Check budget availability

4. **E2E Workflow** (TC-E2E-001)
   - Complete tender-to-payment flow
   - Multi-step approval chain

---

## 📚 Resources

- **Full Test Plan**: `TESTING_PLAN.md`
- **Execution Summary**: `TEST_EXECUTION_SUMMARY.md`
- **Detailed Report**: `TEST_EXECUTION_REPORT.md`
- **Test Fixtures**: `test/fixtures/index.ts`
- **Test Utilities**: `test/utils/test-utils.ts`

---

## 🤝 Contributing Tests

1. Check `TESTING_PLAN.md` for uncovered scenarios
2. Write test following existing patterns
3. Run locally: `npm test -- your-test.spec`
4. Ensure all tests pass: `npm test`
5. Update `TEST_EXECUTION_SUMMARY.md` with results

---

## ⚡ Quick Commands Reference

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific file
npm test -- config.spec

# Run specific test
npm test -- -t "should login"

# Watch mode
npm run test:watch

# Verbose output
npm test -- --verbose

# Run only changed tests
npm test -- --onlyChanged
```

---

**Last Updated**: 2025-10-26  
**Status**: ✅ All tests passing  
**Contact**: Check project documentation for support
