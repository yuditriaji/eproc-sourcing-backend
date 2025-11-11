/*
  Warnings:

  - You are about to drop the `role_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_roles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."role_configs" DROP CONSTRAINT "role_configs_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_roles" DROP CONSTRAINT "user_roles_roleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_roles" DROP CONSTRAINT "user_roles_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."user_roles" DROP CONSTRAINT "user_roles_userId_fkey";

-- AlterTable
ALTER TABLE "rbac_config" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "public"."role_configs";

-- DropTable
DROP TABLE "public"."user_roles";

-- CreateTable
CREATE TABLE "user_rbac_roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rbacRoleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "user_rbac_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_rbac_roles_tenantId_userId_idx" ON "user_rbac_roles"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "user_rbac_roles_tenantId_rbacRoleId_idx" ON "user_rbac_roles"("tenantId", "rbacRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_rbac_roles_tenantId_userId_rbacRoleId_key" ON "user_rbac_roles"("tenantId", "userId", "rbacRoleId");

-- CreateIndex
CREATE INDEX "rbac_config_tenantId_isActive_idx" ON "rbac_config"("tenantId", "isActive");

-- AddForeignKey
ALTER TABLE "user_rbac_roles" ADD CONSTRAINT "user_rbac_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rbac_roles" ADD CONSTRAINT "user_rbac_roles_rbacRoleId_fkey" FOREIGN KEY ("rbacRoleId") REFERENCES "rbac_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rbac_roles" ADD CONSTRAINT "user_rbac_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
