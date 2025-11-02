import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { RoleConfigService } from "./role-config.service";
import { CreateRoleConfigDto, UpdateRoleConfigDto } from "./role-config.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantContext } from "../../common/tenant/tenant-context";
import { TenantService } from "../tenant/tenant.service";

@ApiTags("Role Configuration")
@Controller(":tenant/roles")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@ApiBearerAuth()
export class RoleConfigController {
  constructor(
    private readonly roleConfigService: RoleConfigService,
    private readonly tenantContext: TenantContext,
    private readonly tenantService: TenantService,
  ) {}

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "Create new role (Admin only)" })
  @ApiResponse({ status: 201, description: "Role created successfully" })
  @ApiResponse({ status: 400, description: "Role already exists" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(@Req() req: Request, @Body() dto: CreateRoleConfigDto) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    return this.roleConfigService.create(tenantId, dto);
  }

  @Get()
  @Roles("ADMIN")
  @ApiOperation({ summary: "Get all roles (Admin only)" })
  @ApiResponse({ status: 200, description: "Roles retrieved successfully" })
  async findAll(
    @Req() req: Request,
    @Query("isActive") isActive?: string,
  ) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    const isActiveFilter =
      isActive !== undefined ? isActive === "true" : undefined;
    return this.roleConfigService.findAll(tenantId, isActiveFilter);
  }

  @Get(":roleId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Get role details (Admin only)" })
  @ApiResponse({ status: 200, description: "Role retrieved successfully" })
  @ApiResponse({ status: 404, description: "Role not found" })
  async findOne(@Req() req: Request, @Param("roleId") roleId: string) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    return this.roleConfigService.findOne(tenantId, roleId);
  }

  @Patch(":roleId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update role (Admin only)" })
  @ApiResponse({ status: 200, description: "Role updated successfully" })
  @ApiResponse({ status: 404, description: "Role not found" })
  async update(
    @Req() req: Request,
    @Param("roleId") roleId: string,
    @Body() dto: UpdateRoleConfigDto,
  ) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    return this.roleConfigService.update(tenantId, roleId, dto);
  }

  @Delete(":roleId")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Delete role (Admin only)" })
  @ApiResponse({ status: 200, description: "Role deleted successfully" })
  @ApiResponse({ status: 400, description: "Role is assigned to users" })
  @ApiResponse({ status: 404, description: "Role not found" })
  async delete(@Req() req: Request, @Param("roleId") roleId: string) {
    let tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      const slug = (req.params as any)?.tenant as string | undefined;
      tenantId = await this.tenantService.resolveTenantId(slug);
    }

    return this.roleConfigService.delete(tenantId, roleId);
  }
}
