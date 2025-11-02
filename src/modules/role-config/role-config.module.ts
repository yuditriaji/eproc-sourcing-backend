import { Module } from "@nestjs/common";
import { RoleConfigController } from "./role-config.controller";
import { RoleConfigService } from "./role-config.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { TenantModule } from "../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  controllers: [RoleConfigController],
  providers: [RoleConfigService, PrismaService],
  exports: [RoleConfigService],
})
export class RoleConfigModule {}
