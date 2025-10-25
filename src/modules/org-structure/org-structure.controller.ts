import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { IsOptional, IsString } from "class-validator";
import { OrgStructureService } from "./org-structure.service";

class CreateCompanyCodeDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
}
class UpdateCompanyCodeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
}

class CreatePlantDto {
  @IsString() companyCodeId: string;
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
}
class UpdatePlantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
}

class CreateSLocDto {
  @IsString() plantId: string;
  @IsString() code: string;
  @IsString() name: string;
}
class UpdateSLocDto {
  @IsOptional() @IsString() name?: string;
}

class CreatePOrgDto {
  @IsString() code: string;
  @IsString() name: string;
}
class UpdatePOrgDto {
  @IsOptional() @IsString() name?: string;
}

class CreatePGrpDto {
  @IsString() purchasingOrgId: string;
  @IsString() code: string;
  @IsString() name: string;
}
class UpdatePGrpDto {
  @IsOptional() @IsString() name?: string;
}

class CreateAssignmentDto {
  @IsString() purchasingOrgId: string;
  @IsOptional() @IsString() companyCodeId?: string;
  @IsOptional() @IsString() plantId?: string;
}

@ApiTags("Org Structure")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller(":tenant/org")
export class OrgStructureController {
  constructor(private readonly svc: OrgStructureService) {}

  // Company codes
  @Get("company-codes")
  @ApiOperation({ summary: "List company codes" })
  listCC(@Query("q") q?: string) {
    return this.svc.listCompanyCodes(q);
  }
  @Post("company-codes") createCC(@Body() dto: CreateCompanyCodeDto, @Req() req: any) {
    return this.svc.createCompanyCode(dto, req?.tenantId || req?.user?.tenantId);
  }
  @Put("company-codes/:id") updateCC(
    @Param("id") id: string,
    @Body() dto: UpdateCompanyCodeDto,
  ) {
    return this.svc.updateCompanyCode(id, dto);
  }
  @Delete("company-codes/:id") deleteCC(@Param("id") id: string) {
    return this.svc.deleteCompanyCode(id);
  }

  // Plants
  @Get("plants") listPlants(@Query("companyCodeId") companyCodeId?: string) {
    return this.svc.listPlants(companyCodeId);
  }
  @Post("plants") createPlant(@Body() dto: CreatePlantDto, @Req() req: any) {
    return this.svc.createPlant(dto, req?.tenantId || req?.user?.tenantId);
  }
  @Put("plants/:id") updatePlant(
    @Param("id") id: string,
    @Body() dto: UpdatePlantDto,
  ) {
    return this.svc.updatePlant(id, dto);
  }
  @Delete("plants/:id") deletePlant(@Param("id") id: string) {
    return this.svc.deletePlant(id);
  }

  // Storage locations
  @Get("storage-locations") listSLocs(@Query("plantId") plantId?: string) {
    return this.svc.listStorageLocations(plantId);
  }
  @Post("storage-locations") createSLoc(@Body() dto: CreateSLocDto, @Req() req: any) {
    return this.svc.createStorageLocation(dto, req?.tenantId || req?.user?.tenantId);
  }
  @Put("storage-locations/:id") updateSLoc(
    @Param("id") id: string,
    @Body() dto: UpdateSLocDto,
  ) {
    return this.svc.updateStorageLocation(id, dto);
  }
  @Delete("storage-locations/:id") deleteSLoc(@Param("id") id: string) {
    return this.svc.deleteStorageLocation(id);
  }

  // Purchasing orgs and groups
  @Get("purchasing-orgs") listPOrgs(@Query("q") q?: string) {
    return this.svc.listPurchasingOrgs(q);
  }
  @Post("purchasing-orgs") createPOrg(@Body() dto: CreatePOrgDto, @Req() req: any) {
    return this.svc.createPurchasingOrg(dto, req?.tenantId || req?.user?.tenantId);
  }
  @Put("purchasing-orgs/:id") updatePOrg(
    @Param("id") id: string,
    @Body() dto: UpdatePOrgDto,
  ) {
    return this.svc.updatePurchasingOrg(id, dto);
  }
  @Delete("purchasing-orgs/:id") deletePOrg(@Param("id") id: string) {
    return this.svc.deletePurchasingOrg(id);
  }

  @Get("purchasing-groups") listPGrps(
    @Query("purchasingOrgId") purchasingOrgId?: string,
  ) {
    return this.svc.listPurchasingGroups(purchasingOrgId);
  }
  @Post("purchasing-groups") createPGrp(@Body() dto: CreatePGrpDto, @Req() req: any) {
    return this.svc.createPurchasingGroup(dto, req?.tenantId || req?.user?.tenantId);
  }
  @Put("purchasing-groups/:id") updatePGrp(
    @Param("id") id: string,
    @Body() dto: UpdatePGrpDto,
  ) {
    return this.svc.updatePurchasingGroup(id, dto);
  }
  @Delete("purchasing-groups/:id") deletePGrp(@Param("id") id: string) {
    return this.svc.deletePurchasingGroup(id);
  }

  // Assignments
  @Get("porg-assignments") listAssignments(
    @Query("purchasingOrgId") purchasingOrgId?: string,
  ) {
    return this.svc.listAssignments(purchasingOrgId);
  }
  @Post("porg-assignments") createAssignment(@Body() dto: CreateAssignmentDto, @Req() req: any) {
    return this.svc.createAssignment(dto, req?.tenantId || req?.user?.tenantId);
  }
  @Delete("porg-assignments/:id") deleteAssignment(@Param("id") id: string) {
    return this.svc.deleteAssignment(id);
  }
}
