# Configuration API Documentation

This guide covers the API endpoints to provision a tenant and set up its foundational configuration (basis, process, and org structure). Paths include a tenant segment for multitenancy.

- Base URL pattern: `/{API_PREFIX}` (default: `api/v1`)
- Tenant-scoped routes: `/{API_PREFIX}/{tenant}/...`
- Auth: JWT Bearer for protected endpoints; refresh token is set via httpOnly cookie on login.

## 1) Provision a new tenant
Create a tenant and its initial admin.

- Method: POST
- Path: `/{API_PREFIX}/tenants`
- Auth: Public (intended for platform operator tooling)

Request
```json path=null start=null
{
  "name": "Acme Corp",
  "subdomain": "acme",
  "config": { "region": "us" },
  "admin": {
    "email": "admin@acme.com",
    "username": "acmeadmin",
    "password": "ChangeMe123!",
    "firstName": "Acme",
    "lastName": "Admin"
  }
}
```

Example curl
```bash path=null start=null
curl -sS -X POST \
  "+BASE_URL+/{API_PREFIX}/tenants" \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Acme Corp",
    "subdomain":"acme",
    "config": {"region":"us"},
    "admin": {"email":"admin@acme.com","password":"ChangeMe123!"}
  }'
```

Response 201
```json path=null start=null
{
  "tenant": {
    "id": "ten_123",
    "name": "Acme Corp",
    "subdomain": "acme"
  },
  "adminUser": {
    "id": "usr_123",
    "email": "admin@acme.com",
    "username": "acmeadmin",
    "role": "ADMIN"
  }
}
```

## 2) Login as tenant admin
Obtain an access token (refresh token is set via cookie).

- Method: POST
- Path: `/{API_PREFIX}/{tenant}/auth/login`
- Auth: Public

Request
```json path=null start=null
{
  "email": "admin@acme.com",
  "password": "ChangeMe123!"
}
```

Example curl
```bash path=null start=null
curl -sS -X POST \
  "+BASE_URL+/{API_PREFIX}/acme/auth/login" \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"email":"admin@acme.com","password":"ChangeMe123!"}'
```

Response 200
```json path=null start=null
{
  "accessToken": "<JWT>",
  "user": {
    "id": "usr_123",
    "email": "admin@acme.com",
    "username": "acmeadmin",
    "role": "ADMIN"
  }
}
```
Notes
- A `refreshToken` httpOnly cookie is set. Use `-c cookies.txt` with curl to store it.

## 3) Upsert tenant basis config and optional process config
Create or update tenant basis configuration and optionally create a process configuration.

- Method: POST
- Path: `/{API_PREFIX}/{tenant}/config/basis`
- Auth: Bearer (ADMIN recommended)

Request
```json path=null start=null
{
  "tenantConfig": {
    "orgStructure": { "levels": 2, "notes": "CompanyCode > PurchasingGroup" },
    "businessVariants": [
      { "name": "Default", "code": "DEF" }
    ]
  },
  "processConfig": {
    "name": "Standard Tender",
    "processType": "TENDER",
    "steps": [
      { "stepName": "Draft", "requiredRole": "BUYER" },
      { "stepName": "Publish", "requiredRole": "ADMIN" },
      { "stepName": "Score", "requiredRole": "BUYER" },
      { "stepName": "Award", "requiredRole": "ADMIN" }
    ]
  }
}
```

Example curl
```bash path=null start=null
curl -sS -X POST \
  "+BASE_URL+/{API_PREFIX}/acme/config/basis" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <JWT>' \
  -b cookies.txt \
  -d @- <<'JSON'
{
  "tenantConfig": {
    "orgStructure": { "levels": 2 },
    "businessVariants": [{"name":"Default","code":"DEF"}]
  },
  "processConfig": {
    "name": "Standard Tender",
    "processType": "TENDER",
    "steps": [
      { "stepName": "Draft", "requiredRole": "BUYER" },
      { "stepName": "Publish", "requiredRole": "ADMIN" }
    ]
  }
}
JSON
```

Response 200
```json path=null start=null
{
  "tenantConfig": {
    "id": "tc_123",
    "tenantId": "ten_123",
    "orgStructure": { "levels": 2, "notes": "CompanyCode > PurchasingGroup" },
    "businessVariants": [{ "name": "Default", "code": "DEF" }],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "processConfig": {
    "id": "pc_123",
    "tenantId": "ten_123",
    "name": "Standard Tender",
    "processType": "TENDER",
    "steps": [
      { "stepName": "Draft", "requiredRole": "BUYER" },
      { "stepName": "Publish", "requiredRole": "ADMIN" }
    ],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

## 4) Bulk create Org Units (Company Codes and Purchasing Groups)
Create hierarchical org units from a compact JSON.

- Method: POST
- Path: `/{API_PREFIX}/{tenant}/config/org-units/bulk`
- Auth: Bearer (ADMIN recommended)

Request (ccs = company codes; each with pgs count)
```json path=null start=null
{
  "ccs": [
    { "code": "CC1", "name": "Company 1", "pgs": 2 },
    { "code": "CC2", "pgs": 3 }
  ]
}
```

Example curl
```bash path=null start=null
curl -sS -X POST \
  "+BASE_URL+/{API_PREFIX}/acme/config/org-units/bulk" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <JWT>' \
  -d '{"ccs":[{"code":"CC1","pgs":2},{"code":"CC2","pgs":1}]}'
```

Response 200
```json path=null start=null
{
  "created": 3,
  "units": [
    {
      "id": "ou_parent_cc1",
      "tenantId": "ten_123",
      "level": 1,
      "name": "CC1",
      "type": "COMPANY_CODE",
      "companyCode": "CC1",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "ou_child_cc1_pg1",
      "tenantId": "ten_123",
      "parentId": "ou_parent_cc1",
      "level": 2,
      "name": "CC1-PG1",
      "type": "PURCHASING_GROUP",
      "pgCode": "PG1"
    }
  ]
}
```

## 5) Get role configuration (Admin)
Returns the static role configuration template.

- Method: GET
- Path: `/{API_PREFIX}/{tenant}/auth/roles/config`
- Auth: Bearer (ADMIN)

Example curl
```bash path=null start=null
curl -sS \
  "+BASE_URL+/{API_PREFIX}/acme/auth/roles/config" \
  -H 'Authorization: Bearer <JWT>'
```

Response 200
```json path=null start=null
{
  "roles": [
    {
      "role": "ADMIN",
      "permissions": ["*"],
      "description": "System administrator with full access"
    },
    {
      "role": "USER",
      "permissions": ["read:tenders", "create:tenders", "score:bids"],
      "description": "Internal user who can create tenders and score bids"
    },
    {
      "role": "VENDOR",
      "permissions": ["read:own", "create:bids", "submit:bids"],
      "description": "External vendor who can submit bids"
    }
  ]
}
```

---

Headers and auth
- Authorization: `Authorization: Bearer <JWT>` for protected endpoints
- Cookies: `refreshToken` is httpOnly and set on login; send with requests if needed

Error responses
- 401 Unauthorized: missing/invalid token
- 403 Forbidden: insufficient role/permissions
- 400 Bad Request: validation errors or missing tenant context
