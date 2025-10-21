/*
  Warnings:

  - The primary key for the `contract_vendors` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `po_vendors` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[tenantId,tenderId,vendorId]` on the table `bids` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,contractNumber]` on the table `contracts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,code]` on the table `currencies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,receiptNumber]` on the table `goods_receipts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,invoiceNumber]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,paymentNumber]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,poNumber]` on the table `purchase_orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,prNumber]` on the table `purchase_requisitions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,quotationNumber]` on the table `quotations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,token]` on the table `refresh_tokens` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,roleName]` on the table `role_configs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,key]` on the table `system_config` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,tenderNumber]` on the table `tenders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,username]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,registrationNumber]` on the table `vendors` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,workflowType,stepOrder]` on the table `workflow_steps` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `bids` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `contract_vendors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `contracts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `currencies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `goods_receipts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `po_vendors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `purchase_requisitions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `quotations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `role_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `system_config` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `tenders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `vendors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `workflow_steps` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."bids_tenderId_vendorId_key";

-- DropIndex
DROP INDEX "public"."contracts_contractNumber_key";

-- DropIndex
DROP INDEX "public"."currencies_code_key";

-- DropIndex
DROP INDEX "public"."goods_receipts_receiptNumber_key";

-- DropIndex
DROP INDEX "public"."invoices_invoiceNumber_key";

-- DropIndex
DROP INDEX "public"."notifications_userId_isRead_idx";

-- DropIndex
DROP INDEX "public"."payments_paymentNumber_key";

-- DropIndex
DROP INDEX "public"."purchase_orders_poNumber_key";

-- DropIndex
DROP INDEX "public"."purchase_requisitions_prNumber_key";

-- DropIndex
DROP INDEX "public"."quotations_quotationNumber_key";

-- DropIndex
DROP INDEX "public"."refresh_tokens_token_key";

-- DropIndex
DROP INDEX "public"."role_configs_roleName_key";

-- DropIndex
DROP INDEX "public"."system_config_key_key";

-- DropIndex
DROP INDEX "public"."tenders_tenderNumber_key";

-- DropIndex
DROP INDEX "public"."users_email_key";

-- DropIndex
DROP INDEX "public"."users_username_key";

-- DropIndex
DROP INDEX "public"."vendors_registrationNumber_key";

-- DropIndex
DROP INDEX "public"."workflow_steps_workflowType_stepOrder_key";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "bids" ADD COLUMN     "keyVersion" INTEGER,
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "contract_vendors" DROP CONSTRAINT "contract_vendors_pkey",
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD CONSTRAINT "contract_vendors_pkey" PRIMARY KEY ("tenantId", "contractId", "vendorId");

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "currencies" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "po_vendors" DROP CONSTRAINT "po_vendors_pkey",
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD CONSTRAINT "po_vendors_pkey" PRIMARY KEY ("tenantId", "poId", "vendorId");

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "purchase_requisitions" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "role_configs" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "workflow_steps" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "residencyTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_keys" (
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "wrappedDek" TEXT NOT NULL,
    "kekVersion" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tenant_keys_pkey" PRIMARY KEY ("tenantId","version")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_tenantId_status_createdAt_idx" ON "outbox"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "bids_tenantId_idx" ON "bids"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "bids_tenantId_tenderId_vendorId_key" ON "bids"("tenantId", "tenderId", "vendorId");

-- CreateIndex
CREATE INDEX "contract_vendors_tenantId_idx" ON "contract_vendors"("tenantId");

-- CreateIndex
CREATE INDEX "contracts_tenantId_idx" ON "contracts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_tenantId_contractNumber_key" ON "contracts"("tenantId", "contractNumber");

-- CreateIndex
CREATE INDEX "currencies_tenantId_idx" ON "currencies"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_tenantId_code_key" ON "currencies"("tenantId", "code");

-- CreateIndex
CREATE INDEX "documents_tenantId_idx" ON "documents"("tenantId");

-- CreateIndex
CREATE INDEX "goods_receipts_tenantId_idx" ON "goods_receipts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenantId_receiptNumber_key" ON "goods_receipts"("tenantId", "receiptNumber");

-- CreateIndex
CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenantId_invoiceNumber_key" ON "invoices"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "notifications_tenantId_userId_isRead_idx" ON "notifications"("tenantId", "userId", "isRead");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenantId_paymentNumber_key" ON "payments"("tenantId", "paymentNumber");

-- CreateIndex
CREATE INDEX "po_vendors_tenantId_idx" ON "po_vendors"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_idx" ON "purchase_orders"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenantId_poNumber_key" ON "purchase_orders"("tenantId", "poNumber");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenantId_idx" ON "purchase_requisitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_tenantId_prNumber_key" ON "purchase_requisitions"("tenantId", "prNumber");

-- CreateIndex
CREATE INDEX "quotations_tenantId_idx" ON "quotations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_tenantId_quotationNumber_key" ON "quotations"("tenantId", "quotationNumber");

-- CreateIndex
CREATE INDEX "refresh_tokens_tenantId_idx" ON "refresh_tokens"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tenantId_token_key" ON "refresh_tokens"("tenantId", "token");

-- CreateIndex
CREATE INDEX "role_configs_tenantId_idx" ON "role_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "role_configs_tenantId_roleName_key" ON "role_configs"("tenantId", "roleName");

-- CreateIndex
CREATE INDEX "system_config_tenantId_idx" ON "system_config"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_tenantId_key_key" ON "system_config"("tenantId", "key");

-- CreateIndex
CREATE INDEX "tenders_tenantId_idx" ON "tenders"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_tenantId_tenderNumber_key" ON "tenders"("tenantId", "tenderNumber");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_username_key" ON "users"("tenantId", "username");

-- CreateIndex
CREATE INDEX "vendors_tenantId_idx" ON "vendors"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenantId_registrationNumber_key" ON "vendors"("tenantId", "registrationNumber");

-- CreateIndex
CREATE INDEX "workflow_steps_tenantId_idx" ON "workflow_steps"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_tenantId_workflowType_stepOrder_key" ON "workflow_steps"("tenantId", "workflowType", "stepOrder");

-- AddForeignKey
ALTER TABLE "tenant_keys" ADD CONSTRAINT "tenant_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_vendors" ADD CONSTRAINT "contract_vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_vendors" ADD CONSTRAINT "po_vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_configs" ADD CONSTRAINT "role_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
