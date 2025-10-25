import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { ConfigServiceBasis } from "./config.service";

@ApiTags("Config Basis")
@Controller(":tenant/config")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
export class ConfigControllerBasis {
  constructor(private readonly service: ConfigServiceBasis) {}

  @Post("basis")
  @ApiOperation({
    summary: "Create/Update tenant basis config and optional process config",
  })
  async upsert(@Req() req: any, @Body() body: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.service.upsertTenantBasis(tenantId, body);
  }

  @Post("org-units/bulk")
  @ApiOperation({
    summary: "Bulk create OrgUnits from JSON (e.g., { ccs: [{ code, pgs }] })",
  })
  async bulk(@Req() req: any, @Body() body: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.service.bulkCreateOrgUnits(tenantId, body);
  }
}
