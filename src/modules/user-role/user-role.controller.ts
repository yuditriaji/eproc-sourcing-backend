import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { UserRoleService } from "./user-role.service";
import { AssignRolesDto } from "./user-role.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantContext } from "../../common/tenant/tenant-context";
import { TenantService } from "../tenant/tenant.service";

@ApiTags("User Role Management")
@Controller(":tenant/users/:userId/roles")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@ApiBearerAuth()
export class UserRoleController {
  constructor(
    private readonly userRoleService: UserRoleService,
    private readonly tenantContext: TenantContext,
    private readonly tenantService: TenantService,
  ) {}

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "Assign roles to user (Admin only)" })
  @ApiResponse({ status: 201, description: "Roles assigned successfully" })
  @ApiResponse({ status: 400, description: "Invalid role IDs" })
  @ApiResponse({ status: 404, description: "User not found" })
  async assignRoles(
    @Req() req: Request,
    @Param("userId") userId: string,
    @Body() dto: AssignRolesDto,
  ) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    const assignedBy = (req.user as any)?.userId;
    return this.userRoleService.assignRoles(tenantId, userId, dto, assignedBy);
  }

  @Get()
  @Roles("ADMIN")
  @ApiOperation({ summary: "Get user's assigned roles (Admin only)" })
  @ApiResponse({ status: 200, description: "User roles retrieved successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  async getUserRoles(@Req() req: Request, @Param("userId") userId: string) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    return this.userRoleService.getUserRoles(tenantId, userId);
  }

  @Delete(":roleId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Remove role from user (Admin only)" })
  @ApiResponse({ status: 200, description: "Role removed successfully" })
  @ApiResponse({ status: 404, description: "Role assignment not found" })
  async removeRole(
    @Req() req: Request,
    @Param("userId") userId: string,
    @Param("roleId") roleId: string,
  ) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    return this.userRoleService.removeRole(tenantId, userId, roleId);
  }

  @Get("permissions")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Get user's effective permissions (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "User permissions retrieved successfully",
  })
  async getUserPermissions(
    @Req() req: Request,
    @Param("userId") userId: string,
  ) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    return this.userRoleService.getUserPermissions(tenantId, userId);
  }
}
