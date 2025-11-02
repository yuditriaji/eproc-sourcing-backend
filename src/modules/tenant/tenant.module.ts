import { Module } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { PrismaService } from "../../database/prisma/prisma.service";

@Module({
  providers: [TenantService, TenantContext, PrismaService],
  exports: [TenantService, TenantContext],
})
export class TenantModule {}
