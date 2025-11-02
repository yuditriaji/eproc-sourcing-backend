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
import { PurchaseOrderService, CreatePODto, UpdatePODto, ApprovePODto } from "./purchase-order.service";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";

@ApiTags("Purchase Orders")
@ApiBearerAuth()
@Controller(":tenant/purchase-orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: "Create a new Purchase Order" })
  @ApiResponseDoc({ status: 201, description: "PO created successfully" })
  @ApiResponseDoc({ status: 400, description: "Bad request" })
  @ApiResponseDoc({ status: 401, description: "Unauthorized" })
  @ApiResponseDoc({ status: 403, description: "Forbidden" })
  async create(@Body() createPODto: CreatePODto, @Request() req: any) {
    return this.poService.create(createPODto, req.user.id);
  }

  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Get all Purchase Orders" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "contractId", required: false })
  @ApiResponseDoc({ status: 200, description: "POs retrieved successfully" })
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("status") status: string = "",
    @Query("createdById") createdById: string = "",
    @Query("contractId") contractId: string = "",
    @Request() req: any,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    
    // For non-admin users, show only their own POs
    const filterCreatedById = req.user.role === UserRoleEnum.ADMIN ? (createdById || undefined) : req.user.id;
    
    return this.poService.findAll(
      pageNum, 
      limitNum, 
      status ? status as any : undefined, 
      filterCreatedById, 
      contractId || undefined
    );
  }

  @Get(":id")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Get Purchase Order by ID" })
  @ApiResponseDoc({ status: 200, description: "PO retrieved successfully" })
  @ApiResponseDoc({ status: 404, description: "PO not found" })
  async findOne(@Param("id") id: string) {
    return this.poService.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Update Purchase Order" })
  @ApiResponseDoc({ status: 200, description: "PO updated successfully" })
  @ApiResponseDoc({ status: 400, description: "Bad request" })
  @ApiResponseDoc({ status: 404, description: "PO not found" })
  async update(
    @Param("id") id: string,
    @Body() updatePODto: UpdatePODto,
    @Request() req: any,
  ) {
    return this.poService.update(id, updatePODto, req.user.id);
  }

  @Post(":id/approve")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE, UserRoleEnum.APPROVER)
  @ApiOperation({ summary: "Approve or reject Purchase Order" })
  @ApiResponseDoc({ status: 200, description: "PO approval processed successfully" })
  @ApiResponseDoc({ status: 400, description: "Bad request" })
  @ApiResponseDoc({ status: 404, description: "PO not found" })
  async approve(
    @Param("id") id: string,
    @Body() approvePODto: ApprovePODto,
    @Request() req: any,
  ) {
    return this.poService.approve(id, approvePODto, req.user.id);
  }

  @Post(":id/vendors")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: "Add vendors to Purchase Order" })
  @ApiResponseDoc({ status: 200, description: "Vendors added successfully" })
  @ApiResponseDoc({ status: 400, description: "Bad request" })
  @ApiResponseDoc({ status: 404, description: "PO not found" })
  async addVendors(
    @Param("id") id: string,
    @Body() body: { vendorIds: string[] },
    @Request() req: any,
  ) {
    await this.poService.addVendors(id, body.vendorIds, req.user.id);
    return { message: "Vendors added to Purchase Order successfully" };
  }

  @Delete(":id/vendors/:vendorId")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: "Remove vendor from Purchase Order" })
  @ApiResponseDoc({ status: 200, description: "Vendor removed successfully" })
  @ApiResponseDoc({ status: 404, description: "PO or vendor not found" })
  async removeVendor(
    @Param("id") id: string,
    @Param("vendorId") vendorId: string,
    @Request() req: any,
  ) {
    await this.poService.removeVendor(id, vendorId, req.user.id);
    return { message: "Vendor removed from Purchase Order successfully" };
  }

  @Delete(":id")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: "Delete Purchase Order" })
  @ApiResponseDoc({ status: 200, description: "PO deleted successfully" })
  @ApiResponseDoc({ status: 404, description: "PO not found" })
  async remove(@Param("id") id: string, @Request() req: any) {
    await this.poService.delete(id, req.user.id);
    return { message: "Purchase Order deleted successfully" };
  }

  @Get("statistics/summary")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Get Purchase Order statistics" })
  @ApiResponseDoc({ status: 200, description: "Statistics retrieved successfully" })
  async getStatistics(@Request() req: any) {
    const createdById = req.user.role === UserRoleEnum.ADMIN ? undefined : req.user.id;
    return this.poService.getPOStatistics(createdById);
  }

  @Get("pending/approvals")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE, UserRoleEnum.APPROVER)
  @ApiOperation({ summary: "Get pending approval POs for current user" })
  @ApiResponseDoc({ status: 200, description: "Pending approvals retrieved successfully" })
  async getPendingApprovals(@Request() req: any) {
    return this.poService.getPendingApprovalsForUser(req.user.id);
  }
}