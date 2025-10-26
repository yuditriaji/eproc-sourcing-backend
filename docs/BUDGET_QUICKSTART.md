# Budget Control - Quick Start Guide

## ✅ What's Already Done

- ✅ Database schema with 6 new tables
- ✅ BudgetService with all core methods
- ✅ Budget API endpoints (6 routes)
- ✅ Zod validation schemas
- ✅ Build passing (0 errors)

## 🚀 API Usage Examples

### 1. Create Budget
```bash
POST /api/v1/tenant-a/budgets
Authorization: Bearer <token>
Content-Type: application/json

{
  "fiscalYear": "2025",
  "totalAmount": 100000000,
  "orgUnitId": "division-a-id",
  "type": "DIVISION"
}
```

### 2. Allocate Budget
```bash
POST /api/v1/tenant-a/budgets/{budgetId}/allocate

{
  "fromBudgetId": "budget-id",
  "toOrgUnits": [
    { "orgUnitId": "dept-1-id", "amount": 30000000 },
    { "orgUnitId": "dept-2-id", "amount": 40000000 }
  ],
  "reason": "FY2025 allocation"
}
```

### 3. Transfer Budget
```bash
POST /api/v1/tenant-a/budgets/transfer

{
  "fromBudgetId": "budget-a-id",
  "targetBudgetId": "budget-b-id",
  "amount": 20000000,
  "type": "CROSS_LEVEL",
  "traceFlag": true
}
```

### 4. Usage Report
```bash
GET /api/v1/tenant-a/budgets/{budgetId}/usage?traceId=transfer_123
```

## 🔧 Integration Points (Next Steps)

### Hook 1: Purchase Order Creation
File: `src/modules/purchase-order/purchase-order.service.ts`

```typescript
// Add after validation, before DB create
if (budgetId) {
  await this.budgetService.deduct(
    tenantId,
    {
      budgetId,
      amount: totalAmount,
      targetType: 'PO',
      targetId: poId,
      transferTraceId: transferTraceId, // from request
      items: items.map((item, idx) => ({
        itemNumber: idx + 1,
        consumedAmount: item.amount,
        transferTraceId: item.transferTraceId,
      })),
    },
    userId,
  );
}
```

### Hook 2: Workflow Award Tender
File: `src/modules/workflow/workflow.service.ts`

```typescript
// In awardTender(), after PO creation
if (purchaseOrder.budgetId) {
  // Budget already deducted in PO create
  // Just propagate transferTraceId to PO
}
```

### Hook 3: Invoice Approval
File: `src/modules/invoice/invoice.service.ts` (if exists)

```typescript
// On invoice approval
if (invoice.budgetId) {
  await this.budgetService.deduct(
    tenantId,
    {
      budgetId: invoice.budgetId,
      amount: variance, // only deduct difference
      targetType: 'INVOICE',
      targetId: invoice.id,
      transferTraceId: invoice.transferTraceId,
      items: invoiceItems,
    },
    userId,
  );
}
```

## 📝 Seed Script Template

Create: `scripts/seed-budgets.ts`

```typescript
import { PrismaClient, BudgetType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 'tenant-a';
  const fiscalYear = '2025';
  
  // 1. Create 5 division budgets
  const divisions = [];
  for (let i = 1; i <= 5; i++) {
    const orgUnit = await prisma.orgUnit.findFirst({
      where: { tenantId, level: 1 },
      skip: i - 1,
    });
    
    const budget = await prisma.budget.create({
      data: {
        tenantId,
        fiscalYear,
        totalAmount: 100000000,
        availableAmount: 100000000,
        orgUnitId: orgUnit.id,
        type: BudgetType.DIVISION,
      },
    });
    divisions.push({ orgUnit, budget });
  }
  
  // 2. Create transfer (20M from Div A to Div B)
  const transfer = await prisma.budgetTransfer.create({
    data: {
      tenantId,
      budgetId: divisions[0].budget.id,
      targetBudgetId: divisions[1].budget.id,
      amount: 20000000,
      transferType: 'CROSS_LEVEL',
      traceFlag: true,
    },
  });
  
  // 3. Update budgets
  await prisma.budget.update({
    where: { id: divisions[0].budget.id },
    data: { availableAmount: { decrement: 20000000 } },
  });
  
  await prisma.budget.update({
    where: { id: divisions[1].budget.id },
    data: { 
      availableAmount: { increment: 20000000 },
      transferOriginId: transfer.id,
    },
  });
  
  console.log('✅ Seeded 5 divisions + 1 transfer');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## 🧪 E2E Test Template

Create: `test/budget-e2e.spec.ts`

```typescript
describe('Budget E2E', () => {
  it('should track transfer to PO Item', async () => {
    // 1. Create budgets
    const budgetA = await createBudget('divisionA', 100000000);
    const budgetB = await createBudget('divisionB', 100000000);
    
    // 2. Transfer 20M
    const transfer = await transferBudget(budgetA.id, budgetB.id, 20000000);
    
    // 3. Create PO with transfer trace
    const po = await createPO({
      budgetId: budgetB.id,
      transferTraceId: transfer.id,
      items: [{ amount: 5000 }],
    });
    
    // 4. Verify trace in POItem
    const poItem = await prisma.pOItem.findFirst({
      where: { poId: po.id },
    });
    expect(poItem.transferTraceId).toBe(transfer.id);
    
    // 5. Check usage report
    const report = await getBudgetUsage(budgetB.id, transfer.id);
    expect(report.usage.purchaseOrders[0].items[0].transferTraceId).toBe(transfer.id);
  });
});
```

## 🎯 Validation Checklist

Before merging:
- [ ] Budget creation works via API
- [ ] Allocation deducts from source
- [ ] Transfer requires sufficient funds
- [ ] PO creation deducts from budget
- [ ] Transfer trace ID on POItem
- [ ] Usage report shows trace lineage
- [ ] Insufficient funds throws 400
- [ ] All audit logs have budgetKeyFigure

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `src/modules/budget/budget.service.ts` | Core budget logic |
| `src/modules/budget/budget.controller.ts` | API endpoints |
| `src/common/dto/budget.dto.ts` | Validation schemas |
| `prisma/schema.prisma` | Budget models (lines 1126-1254) |
| `BUDGET_IMPLEMENTATION_PROGRESS.md` | Full progress report |

## 🔍 Debug Commands

```bash
# Check migration status
npx prisma migrate status

# View budget tables
npx prisma studio
# Navigate to: Budget, BudgetTransfer, POItem

# Check build
npm run build

# Run specific test
npx jest budget.spec.ts

# Start dev server
npm run start:dev
```

## 🆘 Common Issues

### Issue: "Budget not found"
- Check `tenantId` matches user's tenant
- Verify budget exists for fiscalYear + orgUnitId

### Issue: "Insufficient budget"
- Query `budget.availableAmount` before deduct
- Check for concurrent transfers

### Issue: "TransferTraceId not propagating"
- Ensure `transferTraceId` passed in PO/Invoice request
- Verify BudgetService.deduct() includes traceId in items

## ✅ Current State

```bash
git log --oneline -5
# Should show: "feat: budget-control infrastructure"

npm run build
# ✅ 0 errors

npx prisma migrate status
# ✅ All migrations applied
```

---

**Next**: Integrate → Seed → Test → Deploy
