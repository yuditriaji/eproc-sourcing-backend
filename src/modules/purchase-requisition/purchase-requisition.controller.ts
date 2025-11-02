import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRoleEnum } from "@prisma/client";
import { PurchaseRequisitionService, CreatePRDto, UpdatePRDto } from "./purchase-requisition.service";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";

@ApiTags("Purchase Requisitions")
@ApiBearerAuth()
@Controller(":tenant/purchase-requisitions")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseRequisitionController {
  constructor(private readonly prService: PurchaseRequisitionService) {}

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: "Create a new Purchase Requisition" })
  @ApiResponseDoc({ status: 201, description: "PR created successfully" })
  @ApiResponseDoc({ status: 400, description: "Bad request" })
  @ApiResponseDoc({ status: 401, description: "Unauthorized" })
  @ApiResponseDoc({ status: 403, description: "Forbidden" })
  async create(@Body() createPRDto: CreatePRDto, @Request() req: any) {
    return this.prService.create(createPRDto, req.user.id);
  }

  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Get all Purchase Requisitions" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "contractId", required: false })
  @ApiResponseDoc({ status: 200, description: "PRs retrieved successfully" })
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("status") status: string = "",
    @Query("requesterId") requesterId: string = "",
    @Query("contractId") contractId: string = "",
    @Request() req: any,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    
    // For non-admin users, show only their own PRs
    const filterRequesterId = req.user.role === UserRoleEnum.ADMIN ? (requesterId || undefined) : req.user.id;
    
    return this.prService.findAll(
      pageNum, 
      limitNum, 
      status ? status as any : undefined, 
      filterRequesterId, 
      contractId || undefined
    );
  }

  @Get(":id")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Get Purchase Requisition by ID" })
  @ApiResponseDoc({ status: 200, description: "PR retrieved successfully" })
  @ApiResponseDoc({ status: 404, description: "PR not found" })
  async findOne(@Param("id") id: string) {
    return this.prService.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: "Update Purchase Requisition" })
  @ApiResponseDoc({ status: 200, description: "PR updated successfully" })
  @ApiResponseDoc({ status: 400, description: "Bad request" })
  @ApiResponseDoc({ status: 404, description: "PR not found" })
  async update(
    @Param("id") id: string,
    @Body() updatePRDto: UpdatePRDto,
    @Request() req: any,
  ) {
    return this.prService.update(id, updatePRDto, req.user.id);
  }

  @Delete(":id")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: "Delete Purchase Requisition" })
  @ApiResponseDoc({ status: 200, description: "PR deleted successfully" })
  @ApiResponseDoc({ status: 404, description: "PR not found" })
  async remove(@Param("id") id: string, @Request() req: any) {
    await this.prService.delete(id, req.user.id);
    return { message: "Purchase Requisition deleted successfully" };
  }

  @Get(":id/statistics")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Get Purchase Requisition statistics" })
  @ApiResponseDoc({ status: 200, description: "Statistics retrieved successfully" })
  async getStatistics(@Request() req: any) {
    const requesterId = req.user.role === UserRoleEnum.ADMIN ? undefined : req.user.id;
    return this.prService.getPRStatistics(requesterId);
  }

  @Get("pending/approvals")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.APPROVER)
  @ApiOperation({ summary: "Get pending approval PRs for current user" })
  @ApiResponseDoc({ status: 200, description: "Pending approvals retrieved successfully" })
  async getPendingApprovals(@Request() req: any) {
    return this.prService.getPendingApprovalsForUser(req.user.id);
  }
}