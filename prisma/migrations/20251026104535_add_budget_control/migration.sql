-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('DIVISION', 'DEPARTMENT', 'STAFF', 'PROJECT');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('SAME_LEVEL', 'CROSS_LEVEL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BUDGET_ALLOCATE';
ALTER TYPE "AuditAction" ADD VALUE 'BUDGET_TRANSFER';
ALTER TYPE "AuditAction" ADD VALUE 'BUDGET_DEDUCT';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "budgetKeyFigure" JSONB;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "budgetId" TEXT,
ADD COLUMN     "totalBilled" DECIMAL(15,2),
ADD COLUMN     "transferTraceId" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "budgetId" TEXT,
ADD COLUMN     "totalCommitted" DECIMAL(15,2),
ADD COLUMN     "transferTraceId" TEXT;

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "configId" TEXT,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "availableAmount" DECIMAL(15,2) NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "type" "BudgetType" NOT NULL DEFAULT 'DIVISION',
    "transferOriginId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_allocations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "fromOrgUnitId" TEXT NOT NULL,
    "toOrgUnitId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "reason" TEXT,
    "traceId" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_transfers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "targetBudgetId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "transferType" "TransferType" NOT NULL DEFAULT 'SAME_LEVEL',
    "approvalChain" JSONB,
    "traceFlag" BOOLEAN NOT NULL DEFAULT true,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "budgetAllocationId" TEXT,
    "transferTraceId" TEXT,
    "itemNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "consumedAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "po_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "poItemId" TEXT,
    "transferTraceId" TEXT,
    "itemNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "consumedAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budgets_tenantId_fiscalYear_idx" ON "budgets"("tenantId", "fiscalYear");

-- CreateIndex
CREATE INDEX "budgets_tenantId_orgUnitId_idx" ON "budgets"("tenantId", "orgUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_tenantId_fiscalYear_orgUnitId_key" ON "budgets"("tenantId", "fiscalYear", "orgUnitId");

-- CreateIndex
CREATE INDEX "budget_allocations_tenantId_budgetId_idx" ON "budget_allocations"("tenantId", "budgetId");

-- CreateIndex
CREATE INDEX "budget_allocations_tenantId_traceId_idx" ON "budget_allocations"("tenantId", "traceId");

-- CreateIndex
CREATE INDEX "budget_transfers_tenantId_budgetId_idx" ON "budget_transfers"("tenantId", "budgetId");

-- CreateIndex
CREATE INDEX "budget_transfers_tenantId_targetBudgetId_idx" ON "budget_transfers"("tenantId", "targetBudgetId");

-- CreateIndex
CREATE INDEX "budget_transfers_tenantId_transferredAt_idx" ON "budget_transfers"("tenantId", "transferredAt");

-- CreateIndex
CREATE INDEX "po_items_tenantId_poId_idx" ON "po_items"("tenantId", "poId");

-- CreateIndex
CREATE INDEX "po_items_tenantId_budgetAllocationId_idx" ON "po_items"("tenantId", "budgetAllocationId");

-- CreateIndex
CREATE INDEX "po_items_tenantId_transferTraceId_idx" ON "po_items"("tenantId", "transferTraceId");

-- CreateIndex
CREATE UNIQUE INDEX "po_items_tenantId_poId_itemNumber_key" ON "po_items"("tenantId", "poId", "itemNumber");

-- CreateIndex
CREATE INDEX "invoice_items_tenantId_invoiceId_idx" ON "invoice_items"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_tenantId_poItemId_idx" ON "invoice_items"("tenantId", "poItemId");

-- CreateIndex
CREATE INDEX "invoice_items_tenantId_transferTraceId_idx" ON "invoice_items"("tenantId", "transferTraceId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_tenantId_invoiceId_itemNumber_key" ON "invoice_items"("tenantId", "invoiceId", "itemNumber");

-- CreateIndex
CREATE INDEX "invoices_tenantId_budgetId_idx" ON "invoices"("tenantId", "budgetId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_transferTraceId_idx" ON "invoices"("tenantId", "transferTraceId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_budgetId_idx" ON "purchase_orders"("tenantId", "budgetId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_transferTraceId_idx" ON "purchase_orders"("tenantId", "transferTraceId");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_transferTraceId_fkey" FOREIGN KEY ("transferTraceId") REFERENCES "budget_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_transferTraceId_fkey" FOREIGN KEY ("transferTraceId") REFERENCES "budget_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_fromOrgUnitId_fkey" FOREIGN KEY ("fromOrgUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_toOrgUnitId_fkey" FOREIGN KEY ("toOrgUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_targetBudgetId_fkey" FOREIGN KEY ("targetBudgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_budgetAllocationId_fkey" FOREIGN KEY ("budgetAllocationId") REFERENCES "budget_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_transferTraceId_fkey" FOREIGN KEY ("transferTraceId") REFERENCES "budget_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "po_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_transferTraceId_fkey" FOREIGN KEY ("transferTraceId") REFERENCES "budget_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
