/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,roleName]` on the table `rbac_config` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."rbac_config_tenantId_roleName_processConfigId_key";

-- CreateIndex
CREATE INDEX "rbac_config_tenantId_processConfigId_idx" ON "rbac_config"("tenantId", "processConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "rbac_config_tenantId_roleName_key" ON "rbac_config"("tenantId", "roleName");
