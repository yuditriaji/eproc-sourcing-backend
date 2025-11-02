import { Module } from "@nestjs/common";
import { UserRoleController } from "./user-role.controller";
import { UserRoleService } from "./user-role.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { TenantModule } from "../tenant/tenant.module";

@Module({
  imports: [TenantModule],
  controllers: [UserRoleController],
  providers: [UserRoleService, PrismaService],
  exports: [UserRoleService],
})
export class UserRoleModule {}
