-- CreateEnum
CREATE TYPE "RFQStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SourcingType" AS ENUM ('NONE', 'RFQ', 'TENDER', 'DIRECT');

-- CreateEnum
CREATE TYPE "ContractSourceType" AS ENUM ('MANUAL', 'TENDER_AWARD', 'QUOTATION_ACCEPT');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "sourceQuotationId" TEXT,
ADD COLUMN     "sourceTenderId" TEXT,
ADD COLUMN     "sourceType" "ContractSourceType";

-- AlterTable
ALTER TABLE "purchase_requisitions" ADD COLUMN     "sourcingType" "SourcingType" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "awardedContractId" TEXT,
ADD COLUMN     "rfqId" TEXT;

-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "awardedBidId" TEXT,
ADD COLUMN     "awardedContractId" TEXT,
ADD COLUMN     "prId" TEXT;

-- CreateTable
CREATE TABLE "rfqs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "prId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL,
    "estimatedAmount" DECIMAL(15,2),
    "validUntil" TIMESTAMP(3),
    "targetVendorIds" TEXT[],
    "category" TEXT,
    "department" TEXT,
    "status" "RFQStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "awardedQuotationId" TEXT,
    "awardedContractId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rfqs_tenantId_idx" ON "rfqs"("tenantId");

-- CreateIndex
CREATE INDEX "rfqs_tenantId_prId_idx" ON "rfqs"("tenantId", "prId");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_tenantId_rfqNumber_key" ON "rfqs"("tenantId", "rfqNumber");

-- CreateIndex
CREATE INDEX "quotations_tenantId_rfqId_idx" ON "quotations"("tenantId", "rfqId");

-- CreateIndex
CREATE INDEX "tenders_tenantId_prId_idx" ON "tenders"("tenantId", "prId");

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_prId_fkey" FOREIGN KEY ("prId") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_awardedContractId_fkey" FOREIGN KEY ("awardedContractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_prId_fkey" FOREIGN KEY ("prId") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
