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

## 4) Org Structure (SAP-style) APIs
CRUD endpoints for company codes, plants, storage locations, purchasing orgs/groups, and assignments.

- Base path: `/{API_PREFIX}/{tenant}/org`
- Auth: Bearer
- Tenant resolution: The `:tenant` path segment must be a valid tenant subdomain or id. Middleware resolves it and injects tenantId; JWT must belong to the same tenant.

Create a Company Code
- POST `/{API_PREFIX}/{tenant}/org/company-codes`

Example curl
```bash path=null start=null
# 1) Login to get a JWT (see section 2)
ACCESS_TOKEN=<JWT>
TENANT=acme
BASE_URL=http://localhost:3000
curl -sS -X POST \
  "$BASE_URL/{API_PREFIX}/$TENANT/org/company-codes" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"code":"CC1","name":"Company 1","description":"optional"}'
```

Request body
```json path=null start=null
{ "code": "CC1", "name": "Company 1", "description": "optional" }
```

Create a Plant
- POST `/{API_PREFIX}/{tenant}/org/plants`
```json path=null start=null
{ "companyCodeId": "cc_123", "code": "P1", "name": "Plant 1" }
```

Create a Storage Location
- POST `/{API_PREFIX}/{tenant}/org/storage-locations`
```json path=null start=null
{ "plantId": "plant_123", "code": "S001", "name": "Main WH" }
```

Create a Purchasing Org and Group
- POST `/{API_PREFIX}/{tenant}/org/purchasing-orgs`
```json path=null start=null
{ "code": "PO1", "name": "Procurement Org 1" }
```
- POST `/{API_PREFIX}/{tenant}/org/purchasing-groups`
```json path=null start=null
{ "purchasingOrgId": "porg_123", "code": "PG1", "name": "Group 1" }
```

Assign Purchasing Org to Company Code or Plant
- POST `/{API_PREFIX}/{tenant}/org/porg-assignments`
```json path=null start=null
{ "purchasingOrgId": "porg_123", "companyCodeId": "cc_123" }
```
OR
```json path=null start=null
{ "purchasingOrgId": "porg_123", "plantId": "plant_123" }
```

List endpoints
- GET `/{API_PREFIX}/{tenant}/org/company-codes|plants|storage-locations|purchasing-orgs|purchasing-groups|porg-assignments`

Notes
- Exactly one of companyCodeId or plantId must be provided in porg-assignments.
- Indexes enforce uniqueness per tenant: (tenantId, code) for masters; (tenantId, purchasingOrgId, code) for groups.

Troubleshooting: “Missing tenant context” (400)
- Ensure the URL includes `/{tenant}/` (e.g., `/api/v1/acme/org/company-codes`).
- Confirm the tenant exists and you used the right slug (subdomain) or id.
- Include `Authorization: Bearer <JWT>`; the token’s tenantId must match the `:tenant` in the path.

## 5) Create USER account (Admin)
Allows an ADMIN to create new user accounts with specified roles and abilities.

- Method: POST
- Path: `/{API_PREFIX}/{tenant}/auth/register`
- Auth: Bearer (ADMIN role recommended)

Request
```json path=null start=null
{
  "email": "john.doe@acme.com",
  "username": "johndoe",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "USER"
}
```

Example curl
```bash path=null start=null
curl -sS -X POST \
  "+BASE_URL+/{API_PREFIX}/acme/auth/register" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <ADMIN_JWT>' \
  -b cookies.txt \
  -d '{
    "email": "john.doe@acme.com",
    "username": "johndoe",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  }'
```

Response 201
```json path=null start=null
{
  "accessToken": "<JWT>",
  "user": {
    "id": "usr_456",
    "email": "john.doe@acme.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "abilities": [
      {
        "actions": ["create", "read", "update"],
        "subjects": ["Tender"],
        "conditions": { "creatorId": "{{userId}}" }
      },
      {
        "actions": ["read", "score"],
        "subjects": ["Bid"]
      }
    ],
    "tenantId": "ten_123"
  }
}
```

Notes
- Available roles: `ADMIN`, `USER`, `VENDOR`
- If no role is specified, defaults to `USER`
- Each role has predefined abilities:
  - `ADMIN`: Full system access (manage all)
  - `USER`: Create/manage own tenders, score bids
  - `VENDOR`: View published tenders, submit/manage own bids
- Password must be at least 8 characters
- Username must be 3-50 characters and unique within tenant
- Created users are automatically activated and verified

## 6) Get role configuration (Admin)
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
