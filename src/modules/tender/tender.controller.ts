import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
} from "@nestjs/swagger";
import { Request } from "express";
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsObject,
  Min,
  Max,
} from "class-validator";
import { Transform } from "class-transformer";
import {
  TenderService,
  CreateTenderDto as ICreateTenderDto,
  UpdateTenderDto as IUpdateTenderDto,
} from "./tender.service";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  CheckAbilities,
  AbilityRequirement,
} from "../../common/decorators/ability.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CaslAbilityGuard } from "../../common/guards/casl-ability.guard";
import { Action } from "../auth/abilities/ability.factory";

// Import subject classes for CASL
class Tender {}
class Bid {}

export class CreateTenderDto implements ICreateTenderDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  processConfigId?: string;

  @IsOptional() @IsString() orgUnitId?: string;
  // SAP org refs (optional)
  @IsOptional() @IsString() companyCodeId?: string;
  @IsOptional() @IsString() plantId?: string;
  @IsOptional() @IsString() storageLocationId?: string;
  @IsOptional() @IsString() purchasingOrgId?: string;
  @IsOptional() @IsString() purchasingGroupId?: string;

  @IsString()
  description: string;

  @IsObject()
  requirements: any;

  @IsObject()
  criteria: any;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @IsDateString()
  closingDate: Date;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  department?: string;
}

export class UpdateTenderDto implements IUpdateTenderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  requirements?: any;

  @IsOptional()
  @IsObject()
  criteria?: any;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @IsOptional()
  @IsDateString()
  closingDate?: Date;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  department?: string;
}

export class GetTendersQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

@ApiTags("Sourcing - Tenders")
@ApiForbiddenResponse({ description: "Insufficient Role" })
@Controller(":tenant/tenders")
@UseGuards(AuthGuard("jwt"))
@UseInterceptors(ClassSerializerInterceptor)
export class TenderController {
  constructor(private readonly tenderService: TenderService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "USER")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create new tender",
    description:
      "Admin creates tenders with global scope, Users create department-scoped tenders",
  })
  @ApiResponse({
    status: 201,
    description: "Tender created successfully",
    schema: {
      example: {
        id: "tender-id",
        title: "IT Equipment Procurement",
        description: "Procurement of laptops and desktop computers",
        status: "DRAFT",
        creatorId: "user-id",
        department: "IT",
      },
    },
  })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  async createTender(
    @Body() createTenderDto: CreateTenderDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    return this.tenderService.createTender(
      createTenderDto,
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  @Get()
  @ApiOperation({
    summary: "Get tenders with role-based filtering",
    description:
      "Admin sees all, Users see department/global, Vendors see published only",
  })
  @ApiResponse({
    status: 200,
    description: "Tenders retrieved successfully",
    schema: {
      example: [
        {
          id: "tender-id",
          title: "IT Equipment Procurement",
          status: "PUBLISHED",
          creator: {
            username: "admin",
            role: "ADMIN",
          },
          bids: [],
        },
      ],
    },
  })
  async getTenders(@Query() query: GetTendersQuery, @Req() req: Request) {
    const user = req.user as any;

    return this.tenderService.getTenders(
      user.id,
      user.role,
      user.department,
      query,
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get tender by ID",
    description:
      "Get detailed tender information with role-based data filtering",
  })
  @ApiResponse({
    status: 200,
    description: "Tender details retrieved",
  })
  @ApiResponse({ status: 404, description: "Tender not found" })
  @ApiResponse({ status: 403, description: "Access denied" })
  async getTenderById(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.tenderService.getTenderById(id, user.id, user.role);
  }

  @Put(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "USER")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update tender",
    description:
      "Update tender details. Restrictions apply for published tenders with bids",
  })
  @ApiResponse({
    status: 200,
    description: "Tender updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Cannot update tender with existing bids",
  })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  @ApiResponse({ status: 404, description: "Tender not found" })
  async updateTender(
    @Param("id") id: string,
    @Body() updateTenderDto: UpdateTenderDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    return this.tenderService.updateTender(
      id,
      updateTenderDto,
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  @Post(":id/publish")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "USER")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Publish tender",
    description:
      "Publish draft tender to make it available for vendors to submit bids",
  })
  @ApiResponse({
    status: 200,
    description: "Tender published successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Only draft tenders can be published",
  })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  @ApiResponse({ status: 404, description: "Tender not found" })
  async publishTender(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as any;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    return this.tenderService.publishTender(
      id,
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "USER")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Delete tender",
    description:
      "Delete draft tender. Only admins can delete published tenders",
  })
  @ApiResponse({
    status: 200,
    description: "Tender deleted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Only draft tenders can be deleted",
  })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  @ApiResponse({ status: 404, description: "Tender not found" })
  async deleteTender(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as any;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    return this.tenderService.deleteTender(
      id,
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );
  }
}
