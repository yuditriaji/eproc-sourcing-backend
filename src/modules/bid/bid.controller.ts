import {
  Controller,
  Get,
  Post,
  Put,
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
  IsObject,
  IsArray,
  Min,
  Max,
} from "class-validator";
import { Transform } from "class-transformer";
import {
  BidService,
  CreateBidDto as ICreateBidDto,
  UpdateBidDto as IUpdateBidDto,
} from "./bid.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";

export class CreateBidDto implements ICreateBidDto {
  @IsString()
  tenderId: string;

  @IsObject()
  technicalProposal: any;

  @IsObject()
  commercialProposal: any;

  @IsObject()
  financialProposal: any;

  @IsOptional()
  @IsArray()
  documents?: any[];
}

export class UpdateBidDto implements IUpdateBidDto {
  @IsOptional()
  @IsObject()
  technicalProposal?: any;

  @IsOptional()
  @IsObject()
  commercialProposal?: any;

  @IsOptional()
  @IsObject()
  financialProposal?: any;

  @IsOptional()
  @IsArray()
  documents?: any[];
}

export class GetBidsQuery {
  @IsOptional()
  @IsString()
  tenderId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @Min(0)
  offset?: number = 0;
}

@ApiTags("Sourcing - Bids")
@ApiForbiddenResponse({ description: "Insufficient Role" })
@Controller(":tenant/bids")
@UseGuards(AuthGuard("jwt"))
@UseInterceptors(ClassSerializerInterceptor)
export class BidController {
  constructor(private readonly bidService: BidService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles("VENDOR")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create new bid",
    description: "Vendors can create bids for published tenders",
  })
  @ApiResponse({
    status: 201,
    description: "Bid created successfully",
    schema: {
      example: {
        id: "bid-id",
        tenderId: "tender-id",
        vendorId: "vendor-id",
        status: "DRAFT",
        createdAt: "2023-01-01T00:00:00Z",
        tender: {
          title: "IT Equipment Procurement",
          status: "PUBLISHED",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Tender closed or bid already exists",
  })
  @ApiResponse({ status: 403, description: "Only vendors can create bids" })
  @ApiResponse({ status: 404, description: "Tender not found" })
  async createBid(@Body() createBidDto: CreateBidDto, @Req() req: Request) {
    const user = req.user as any;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    return this.bidService.createBid(
      createBidDto,
      user.userId,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  @Get()
  @ApiOperation({
    summary: "Get bids with role-based filtering",
    description:
      "Admin sees all, Users see bids for their tenders, Vendors see their own bids",
  })
  @ApiResponse({
    status: 200,
    description: "Bids retrieved successfully",
    schema: {
      example: [
        {
          id: "bid-id",
          status: "SUBMITTED",
          submittedAt: "2023-01-01T00:00:00Z",
          tender: {
            title: "IT Equipment Procurement",
            status: "PUBLISHED",
            closingDate: "2023-01-15T23:59:59Z",
          },
          vendor: {
            username: "vendor1",
            email: "vendor@example.com",
          },
        },
      ],
    },
  })
  async getBids(@Query() query: GetBidsQuery, @Req() req: Request) {
    const user = req.user as any;

    return this.bidService.getBids(user.userId, user.role, {
      tenderId: query.tenderId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get bid by ID",
    description: "Get detailed bid information with role-based data access",
  })
  @ApiResponse({
    status: 200,
    description: "Bid details retrieved",
  })
  @ApiResponse({ status: 404, description: "Bid not found" })
  @ApiResponse({ status: 403, description: "Access denied" })
  async getBidById(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as any;

    return this.bidService.getBidById(id, user.userId, user.role);
  }

  @Put(":id")
  @UseGuards(RolesGuard)
  @Roles("VENDOR")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update bid",
    description: "Vendors can update their draft bids before submission",
  })
  @ApiResponse({
    status: 200,
    description: "Bid updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Cannot update submitted bid or tender closed",
  })
  @ApiResponse({ status: 403, description: "Access denied" })
  @ApiResponse({ status: 404, description: "Bid not found" })
  async updateBid(
    @Param("id") id: string,
    @Body() updateBidDto: UpdateBidDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    return this.bidService.updateBid(
      id,
      updateBidDto,
      user.userId,
      user.role,
      ipAddress,
      userAgent,
    );
  }

  @Post(":id/submit")
  @UseGuards(RolesGuard)
  @Roles("VENDOR")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Submit bid",
    description:
      "Submit draft bid for evaluation. Cannot be modified after submission.",
  })
  @ApiResponse({
    status: 200,
    description: "Bid submitted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bid already submitted or tender closed",
  })
  @ApiResponse({ status: 403, description: "Access denied" })
  @ApiResponse({ status: 404, description: "Bid not found" })
  async submitBid(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as any;
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("User-Agent") || "unknown";

    return this.bidService.submitBid(
      id,
      user.userId,
      user.role,
      ipAddress,
      userAgent,
    );
  }
}
