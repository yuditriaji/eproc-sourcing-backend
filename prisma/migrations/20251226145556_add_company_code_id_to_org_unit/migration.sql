-- AlterTable
ALTER TABLE "org_units" ADD COLUMN     "companyCodeId" TEXT;

-- CreateIndex
CREATE INDEX "org_units_tenantId_companyCodeId_idx" ON "org_units"("tenantId", "companyCodeId");

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_companyCodeId_fkey" FOREIGN KEY ("companyCodeId") REFERENCES "company_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
