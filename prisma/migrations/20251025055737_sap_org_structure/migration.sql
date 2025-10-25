/*
  Warnings:

  - A unique constraint covering the columns `[subdomain]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('TENDER', 'PROCUREMENT', 'INVOICE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "OrgUnitType" AS ENUM ('COMPANY_CODE', 'PURCHASING_GROUP');

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "companyCodeId" TEXT,
ADD COLUMN     "orgUnitId" TEXT,
ADD COLUMN     "plantId" TEXT,
ADD COLUMN     "processConfigId" TEXT,
ADD COLUMN     "purchasingGroupId" TEXT,
ADD COLUMN     "purchasingOrgId" TEXT,
ADD COLUMN     "storageLocationId" TEXT;

-- AlterTable
ALTER TABLE "purchase_requisitions" ADD COLUMN     "companyCodeId" TEXT,
ADD COLUMN     "orgUnitId" TEXT,
ADD COLUMN     "plantId" TEXT,
ADD COLUMN     "processConfigId" TEXT,
ADD COLUMN     "purchasingGroupId" TEXT,
ADD COLUMN     "purchasingOrgId" TEXT,
ADD COLUMN     "storageLocationId" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "config" JSONB,
ADD COLUMN     "subdomain" TEXT;

-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "companyCodeId" TEXT,
ADD COLUMN     "orgUnitId" TEXT,
ADD COLUMN     "plantId" TEXT,
ADD COLUMN     "processConfigId" TEXT,
ADD COLUMN     "purchasingGroupId" TEXT,
ADD COLUMN     "purchasingOrgId" TEXT,
ADD COLUMN     "storageLocationId" TEXT;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "companyCodeId" TEXT,
ADD COLUMN     "orgUnitId" TEXT,
ADD COLUMN     "plantId" TEXT,
ADD COLUMN     "purchasingGroupId" TEXT,
ADD COLUMN     "purchasingOrgId" TEXT,
ADD COLUMN     "storageLocationId" TEXT;

-- CreateTable
CREATE TABLE "tenant_config" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgStructure" JSONB,
    "businessVariants" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_config" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "processType" "ProcessType" NOT NULL,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rbac_config" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "orgLevel" INTEGER,
    "permissions" JSONB NOT NULL,
    "processConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rbac_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_units" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgUnitType" NOT NULL,
    "companyCode" TEXT,
    "pgCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyCodeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchasing_orgs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchasing_orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchasing_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchasingOrgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchasing_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "porg_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchasingOrgId" TEXT NOT NULL,
    "companyCodeId" TEXT,
    "plantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "porg_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_config_tenantId_key" ON "tenant_config"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_config_tenantId_idx" ON "tenant_config"("tenantId");

-- CreateIndex
CREATE INDEX "process_config_tenantId_processType_idx" ON "process_config"("tenantId", "processType");

-- CreateIndex
CREATE INDEX "rbac_config_tenantId_idx" ON "rbac_config"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "rbac_config_tenantId_roleName_processConfigId_key" ON "rbac_config"("tenantId", "roleName", "processConfigId");

-- CreateIndex
CREATE INDEX "org_units_tenantId_type_idx" ON "org_units"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "org_units_tenantId_companyCode_key" ON "org_units"("tenantId", "companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "org_units_tenantId_pgCode_key" ON "org_units"("tenantId", "pgCode");

-- CreateIndex
CREATE INDEX "company_codes_tenantId_code_idx" ON "company_codes"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "company_codes_tenantId_code_key" ON "company_codes"("tenantId", "code");

-- CreateIndex
CREATE INDEX "plants_tenantId_companyCodeId_idx" ON "plants"("tenantId", "companyCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "plants_tenantId_companyCodeId_code_key" ON "plants"("tenantId", "companyCodeId", "code");

-- CreateIndex
CREATE INDEX "storage_locations_tenantId_plantId_idx" ON "storage_locations"("tenantId", "plantId");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_tenantId_plantId_code_key" ON "storage_locations"("tenantId", "plantId", "code");

-- CreateIndex
CREATE INDEX "purchasing_orgs_tenantId_code_idx" ON "purchasing_orgs"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "purchasing_orgs_tenantId_code_key" ON "purchasing_orgs"("tenantId", "code");

-- CreateIndex
CREATE INDEX "purchasing_groups_tenantId_purchasingOrgId_idx" ON "purchasing_groups"("tenantId", "purchasingOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "purchasing_groups_tenantId_purchasingOrgId_code_key" ON "purchasing_groups"("tenantId", "purchasingOrgId", "code");

-- CreateIndex
CREATE INDEX "porg_assignments_tenantId_purchasingOrgId_idx" ON "porg_assignments"("tenantId", "purchasingOrgId");

-- CreateIndex
CREATE INDEX "porg_assignments_tenantId_companyCodeId_idx" ON "porg_assignments"("tenantId", "companyCodeId");

-- CreateIndex
CREATE INDEX "porg_assignments_tenantId_plantId_idx" ON "porg_assignments"("tenantId", "plantId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_processConfigId_idx" ON "purchase_orders"("tenantId", "processConfigId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_orgUnitId_idx" ON "purchase_orders"("tenantId", "orgUnitId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_companyCodeId_idx" ON "purchase_orders"("tenantId", "companyCodeId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_plantId_idx" ON "purchase_orders"("tenantId", "plantId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_storageLocationId_idx" ON "purchase_orders"("tenantId", "storageLocationId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_purchasingOrgId_idx" ON "purchase_orders"("tenantId", "purchasingOrgId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_purchasingGroupId_idx" ON "purchase_orders"("tenantId", "purchasingGroupId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenantId_processConfigId_idx" ON "purchase_requisitions"("tenantId", "processConfigId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenantId_orgUnitId_idx" ON "purchase_requisitions"("tenantId", "orgUnitId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenantId_companyCodeId_idx" ON "purchase_requisitions"("tenantId", "companyCodeId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenantId_plantId_idx" ON "purchase_requisitions"("tenantId", "plantId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenantId_storageLocationId_idx" ON "purchase_requisitions"("tenantId", "storageLocationId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenantId_purchasingOrgId_idx" ON "purchase_requisitions"("tenantId", "purchasingOrgId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenantId_purchasingGroupId_idx" ON "purchase_requisitions"("tenantId", "purchasingGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX "tenders_tenantId_processConfigId_idx" ON "tenders"("tenantId", "processConfigId");

-- CreateIndex
CREATE INDEX "tenders_tenantId_orgUnitId_idx" ON "tenders"("tenantId", "orgUnitId");

-- CreateIndex
CREATE INDEX "tenders_tenantId_companyCodeId_idx" ON "tenders"("tenantId", "companyCodeId");

-- CreateIndex
CREATE INDEX "tenders_tenantId_plantId_idx" ON "tenders"("tenantId", "plantId");

-- CreateIndex
CREATE INDEX "tenders_tenantId_storageLocationId_idx" ON "tenders"("tenantId", "storageLocationId");

-- CreateIndex
CREATE INDEX "tenders_tenantId_purchasingOrgId_idx" ON "tenders"("tenantId", "purchasingOrgId");

-- CreateIndex
CREATE INDEX "tenders_tenantId_purchasingGroupId_idx" ON "tenders"("tenantId", "purchasingGroupId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_orgUnitId_idx" ON "vendors"("tenantId", "orgUnitId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_companyCodeId_idx" ON "vendors"("tenantId", "companyCodeId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_plantId_idx" ON "vendors"("tenantId", "plantId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_storageLocationId_idx" ON "vendors"("tenantId", "storageLocationId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_purchasingOrgId_idx" ON "vendors"("tenantId", "purchasingOrgId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_purchasingGroupId_idx" ON "vendors"("tenantId", "purchasingGroupId");

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_companyCodeId_fkey" FOREIGN KEY ("companyCodeId") REFERENCES "company_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_purchasingOrgId_fkey" FOREIGN KEY ("purchasingOrgId") REFERENCES "purchasing_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_purchasingGroupId_fkey" FOREIGN KEY ("purchasingGroupId") REFERENCES "purchasing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_processConfigId_fkey" FOREIGN KEY ("processConfigId") REFERENCES "process_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_companyCodeId_fkey" FOREIGN KEY ("companyCodeId") REFERENCES "company_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_purchasingOrgId_fkey" FOREIGN KEY ("purchasingOrgId") REFERENCES "purchasing_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_purchasingGroupId_fkey" FOREIGN KEY ("purchasingGroupId") REFERENCES "purchasing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_processConfigId_fkey" FOREIGN KEY ("processConfigId") REFERENCES "process_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_companyCodeId_fkey" FOREIGN KEY ("companyCodeId") REFERENCES "company_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchasingOrgId_fkey" FOREIGN KEY ("purchasingOrgId") REFERENCES "purchasing_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchasingGroupId_fkey" FOREIGN KEY ("purchasingGroupId") REFERENCES "purchasing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_processConfigId_fkey" FOREIGN KEY ("processConfigId") REFERENCES "process_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_companyCodeId_fkey" FOREIGN KEY ("companyCodeId") REFERENCES "company_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_purchasingOrgId_fkey" FOREIGN KEY ("purchasingOrgId") REFERENCES "purchasing_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_purchasingGroupId_fkey" FOREIGN KEY ("purchasingGroupId") REFERENCES "purchasing_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_config" ADD CONSTRAINT "tenant_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_config" ADD CONSTRAINT "process_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rbac_config" ADD CONSTRAINT "rbac_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rbac_config" ADD CONSTRAINT "rbac_config_processConfigId_fkey" FOREIGN KEY ("processConfigId") REFERENCES "process_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_codes" ADD CONSTRAINT "company_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_companyCodeId_fkey" FOREIGN KEY ("companyCodeId") REFERENCES "company_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchasing_orgs" ADD CONSTRAINT "purchasing_orgs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchasing_groups" ADD CONSTRAINT "purchasing_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchasing_groups" ADD CONSTRAINT "purchasing_groups_purchasingOrgId_fkey" FOREIGN KEY ("purchasingOrgId") REFERENCES "purchasing_orgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "porg_assignments" ADD CONSTRAINT "porg_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "porg_assignments" ADD CONSTRAINT "porg_assignments_purchasingOrgId_fkey" FOREIGN KEY ("purchasingOrgId") REFERENCES "purchasing_orgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "porg_assignments" ADD CONSTRAINT "porg_assignments_companyCodeId_fkey" FOREIGN KEY ("companyCodeId") REFERENCES "company_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "porg_assignments" ADD CONSTRAINT "porg_assignments_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
