# Database Schema Migration Guide

## Overview

This guide outlines the migration strategy from the current tender/bid focused schema to a comprehensive e-procurement system that integrates tender management with the full procurement workflow.

## Migration Strategy

### Phase 1: Schema Enhancement (Backward Compatible)

1. **Extend existing models** with additional fields
2. **Add new core entities** (Vendor, Currency, Contract)
3. **Preserve existing functionality** during transition

### Phase 2: Procurement Workflow Integration

1. **Add procurement models** (PurchaseRequisition, PurchaseOrder, etc.)
2. **Implement financial tracking** (Invoice, Payment, GoodsReceipt)
3. **Connect tender system** with procurement workflow

### Phase 3: Data Cleanup and Optimization

1. **Migrate existing data** to new structure
2. **Add performance indexes**
3. **Implement business logic validations**

## Key Changes Summary

### Enhanced Models
- **User**: Extended with contact info, department, more roles
- **Tender**: Added contract linking, tender numbering, evaluation matrix
- **Bid**: Enhanced with financial details, evaluation fields

### New Core Models
- **Vendor**: Comprehensive vendor management
- **Currency**: Multi-currency support
- **Contract**: Contract lifecycle management

### New Procurement Models
- **PurchaseRequisition**: Purchase request workflow
- **PurchaseOrder**: Order management and tracking
- **GoodsReceipt**: Delivery confirmation and quality control
- **Invoice**: Invoice processing and approval
- **Payment**: Payment tracking and processing

### New Supporting Models
- **Document**: Universal document attachment system
- **Notification**: System-wide notifications
- **WorkflowStep**: Configurable approval workflows
- **SystemConfig**: System configuration management

## Database Migration Steps

### Step 1: Backup Current Database
```bash
# Create backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Run Prisma Migration

1. Replace current `schema.prisma` with the new comprehensive schema
2. Generate migration:
```bash
npx prisma migrate dev --name comprehensive_procurement_redesign
```

### Step 3: Data Migration Scripts

Run the following data migration scripts in order:

1. **Migrate Users** - Extend user data
2. **Create Initial Vendors** - Convert vendor users to proper vendors
3. **Create Default Currencies** - Set up currency system
4. **Update Tender Relations** - Link tenders with new structure
5. **Create Initial System Config** - Set up default configurations

## Migration Commands

```bash
# 1. Generate new migration
npx prisma migrate dev --name comprehensive_procurement_redesign

# 2. Run data migration scripts
npm run migrate:data:users
npm run migrate:data:vendors
npm run migrate:data:currencies
npm run migrate:data:tenders
npm run migrate:data:config

# 3. Generate Prisma Client
npx prisma generate

# 4. Verify migration
npm run test:migration
```

## Data Migration Examples

### Creating Default Currencies
```sql
INSERT INTO currencies (id, code, symbol, name, "isActive") VALUES 
('cuid_usd', 'USD', '$', 'US Dollar', true),
('cuid_eur', 'EUR', '€', 'Euro', true),
('cuid_idr', 'IDR', 'Rp', 'Indonesian Rupiah', true);
```

### Creating Initial System Configuration
```sql
INSERT INTO system_config (id, key, value, description, category) VALUES
('cuid_1', 'procurement.auto_approve_limit', '10000', 'Auto-approve purchase orders below this amount', 'Procurement'),
('cuid_2', 'tender.min_duration_days', '7', 'Minimum tender duration in days', 'Tender'),
('cuid_3', 'notification.email_enabled', 'true', 'Enable email notifications', 'Notification');
```

### Migrating Vendor Users to Vendors
```sql
-- Create vendor records from users with VENDOR role
INSERT INTO vendors (id, name, "contactEmail", "contactPhone", status)
SELECT 
    u.id,
    COALESCE(u."firstName" || ' ' || u."lastName", u.username) as name,
    u.email as "contactEmail",
    u.phone as "contactPhone",
    'ACTIVE' as status
FROM users u 
WHERE u.role = 'VENDOR';
```

## Post-Migration Tasks

### 1. Update Application Code
- Update imports to use new models
- Implement new business logic for procurement workflow
- Add new API endpoints for procurement features

### 2. Update User Interface
- Add new screens for procurement management
- Enhance existing tender/bid screens with new features
- Implement new notification system

### 3. Configure Workflows
- Set up approval workflows using WorkflowStep model
- Configure role-based permissions
- Set up notification templates

### 4. Testing
- Test all existing tender/bid functionality
- Test new procurement workflows
- Verify data integrity and relationships

## Rollback Strategy

If rollback is needed:

```bash
# 1. Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# 2. Revert schema changes
git checkout previous_schema_commit
npx prisma db push --force-reset

# 3. Regenerate client
npx prisma generate
```

## Performance Considerations

### Indexes Added
- User email, username (already exists)
- Contract number, status
- PO number, status
- Tender number, status
- Invoice number, status
- Document relations
- Audit log targets and timestamps

### Query Optimization
- Use proper joins for related data
- Implement pagination for large datasets
- Use soft deletes with proper filtering
- Cache frequently accessed configuration

## Security Enhancements

### Data Protection
- Encrypted sensitive bid data
- Document access level controls
- Role-based permissions with CASL
- Audit logging for all operations

### Compliance
- Soft deletes for audit requirements
- Complete audit trail
- Document version control
- User action tracking

## Monitoring and Maintenance

### Health Checks
- Database connection monitoring
- Migration status verification
- Data consistency checks
- Performance monitoring

### Regular Maintenance
- Archive old audit logs
- Clean up soft-deleted records (after retention period)
- Update currency exchange rates
- Backup and disaster recovery testing