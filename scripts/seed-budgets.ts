import { PrismaClient, BudgetType, TransferType, OrgUnitType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting budget seed...');

  const tenantId = 'tenant-a';
  const fiscalYear = '2025';

  // 1. Ensure tenant exists
  let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    console.log('Creating tenant...');
    tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Tenant A',
        residencyTag: 'us',
      },
    });
  }

  // 2. Create 5 division org units if they don't exist
  const divisionNames = ['Division A', 'Division B', 'Division C', 'Division D', 'Division E'];
  const divisions = [];

  for (let i = 0; i < 5; i++) {
    const code = `DIV${i + 1}`;
    let orgUnit = await prisma.orgUnit.findFirst({
      where: {
        tenantId,
        companyCode: code,
        type: OrgUnitType.COMPANY_CODE,
      },
    });

    if (!orgUnit) {
      orgUnit = await prisma.orgUnit.create({
        data: {
          tenantId,
          name: divisionNames[i],
          level: 1,
          type: OrgUnitType.COMPANY_CODE,
          companyCode: code,
        },
      });
      console.log(`✓ Created org unit: ${orgUnit.name}`);
    }

    divisions.push(orgUnit);
  }

  // 3. Create budgets for each division (100M each)
  const budgets = [];
  for (const division of divisions) {
    let budget = await prisma.budget.findFirst({
      where: {
        tenantId,
        fiscalYear,
        orgUnitId: division.id,
      },
    });

    if (!budget) {
      budget = await prisma.budget.create({
        data: {
          tenantId,
          fiscalYear,
          totalAmount: 100000000,
          availableAmount: 100000000,
          orgUnitId: division.id,
          type: BudgetType.DIVISION,
        },
      });
      console.log(
        `✓ Created budget for ${division.name}: $${budget.totalAmount.toLocaleString()}`,
      );
    }

    budgets.push(budget);
  }

  // 4. Create a cross-division transfer (20M from Division A to Division B)
  const existingTransfer = await prisma.budgetTransfer.findFirst({
    where: {
      tenantId,
      budgetId: budgets[0].id,
      targetBudgetId: budgets[1].id,
    },
  });

  if (!existingTransfer) {
    const transfer = await prisma.budgetTransfer.create({
      data: {
        tenantId,
        budgetId: budgets[0].id,
        targetBudgetId: budgets[1].id,
        amount: 20000000,
        transferType: TransferType.CROSS_LEVEL,
        traceFlag: true,
      },
    });

    // Update budget amounts
    await prisma.budget.update({
      where: { id: budgets[0].id },
      data: { availableAmount: { decrement: 20000000 } },
    });

    await prisma.budget.update({
      where: { id: budgets[1].id },
      data: {
        availableAmount: { increment: 20000000 },
        transferOriginId: transfer.id,
      },
    });

    console.log(
      `✓ Created transfer: $20M from ${divisions[0].name} → ${divisions[1].name} (trace: ${transfer.id})`,
    );
  } else {
    console.log('✓ Transfer already exists');
  }

  // 5. Create allocations from Division A to departments (if not exists)
  const deptNames = ['Dept A1', 'Dept A2', 'Dept A3'];
  const deptAllocations = [30000000, 20000000, 10000000]; // 30M, 20M, 10M

  for (let i = 0; i < deptNames.length; i++) {
    const deptCode = `DEPT-A${i + 1}`;
    let deptOrgUnit = await prisma.orgUnit.findFirst({
      where: {
        tenantId,
        pgCode: deptCode,
        type: OrgUnitType.PURCHASING_GROUP,
      },
    });

    if (!deptOrgUnit) {
      deptOrgUnit = await prisma.orgUnit.create({
        data: {
          tenantId,
          name: deptNames[i],
          level: 2,
          type: OrgUnitType.PURCHASING_GROUP,
          pgCode: deptCode,
          parentId: divisions[0].id,
        },
      });
      console.log(`✓ Created department: ${deptOrgUnit.name}`);
    }

    // Check if allocation already exists
    const existingAlloc = await prisma.budgetAllocation.findFirst({
      where: {
        tenantId,
        budgetId: budgets[0].id,
        toOrgUnitId: deptOrgUnit.id,
      },
    });

    if (!existingAlloc) {
      await prisma.budgetAllocation.create({
        data: {
          tenantId,
          budgetId: budgets[0].id,
          fromOrgUnitId: divisions[0].id,
          toOrgUnitId: deptOrgUnit.id,
          amount: deptAllocations[i],
          reason: `FY${fiscalYear} initial allocation`,
        },
      });

      console.log(
        `✓ Allocated $${(deptAllocations[i] / 1000000).toFixed(1)}M to ${deptNames[i]}`,
      );
    }
  }

  // 6. Summary
  console.log('\n📊 Budget Summary:');
  const allBudgets = await prisma.budget.findMany({
    where: { tenantId, fiscalYear },
    include: { orgUnit: true },
  });

  for (const budget of allBudgets) {
    console.log(
      `   ${budget.orgUnit.name}: $${(parseFloat(budget.availableAmount.toString()) / 1000000).toFixed(1)}M available / $${(parseFloat(budget.totalAmount.toString()) / 1000000).toFixed(1)}M total`,
    );
  }

  const transfers = await prisma.budgetTransfer.count({ where: { tenantId } });
  const allocations = await prisma.budgetAllocation.count({ where: { tenantId } });

  console.log(`\n✅ Seed complete!`);
  console.log(`   Divisions: 5`);
  console.log(`   Budgets: ${allBudgets.length}`);
  console.log(`   Transfers: ${transfers}`);
  console.log(`   Allocations: ${allocations}`);
  console.log(`\n💡 Use these budgets to test PO creation with budget deduction.`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
