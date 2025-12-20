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
  constructor(private readonly poService: PurchaseOrderService) { }

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

  // Static routes MUST come before dynamic routes
  @Get("pending/approvals")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE, UserRoleEnum.APPROVER)
  @ApiOperation({ summary: "Get all POs pending approval" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiResponseDoc({ status: 200, description: "Pending POs retrieved successfully" })
  async getPendingApprovals(
    @Query("page") page: string = "1",
    @Query("pageSize") pageSize: string = "20",
    @Query("search") search: string = "",
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(pageSize) || 20;

    const result = await this.poService.findAll(
      pageNum,
      limitNum,
      'PENDING_APPROVAL' as any,
      undefined, // no createdById filter - approvers see all
      undefined, // no contractId filter
      search || undefined,
    );

    // Transform to match approval page expected format
    return {
      data: result.pos.map((po: any) => ({
        id: po.id,
        type: 'PURCHASE_ORDER',
        referenceNumber: po.poNumber,
        title: po.title,
        description: po.description,
        amount: po.totalAmount || po.amount,
        currency: po.currency?.code || 'USD',
        priority: 'MEDIUM', // Default priority
        status: po.status,
        requesterId: po.createdById,
        requesterName: po.creator ? `${po.creator.firstName || ''} ${po.creator.lastName || ''}`.trim() : 'Unknown',
        createdAt: po.createdAt,
        dueDate: po.expectedDelivery,
      })),
      meta: {
        total: result.total,
        page: pageNum,
        pageSize: limitNum,
        totalPages: Math.ceil(result.total / limitNum),
      }
    };
  }

  @Get("approval-history")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE, UserRoleEnum.APPROVER)
  @ApiOperation({ summary: "Get PO approval history (approved/rejected POs)" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "action", required: false, description: "APPROVE or REJECT" })
  @ApiResponseDoc({ status: 200, description: "PO approval history retrieved successfully" })
  async getApprovalHistory(
    @Query("page") page: string = "1",
    @Query("pageSize") pageSize: string = "20",
    @Query("search") search: string = "",
    @Query("action") action: string = "",
    @Request() req: any,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(pageSize) || 20;

    // Get POs that are APPROVED or REJECTED
    const statusFilter = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : undefined;

    // If action is empty, get both approved and rejected
    let allPos: any[] = [];

    if (!statusFilter) {
      const approvedResult = await this.poService.findAll(pageNum, limitNum, 'APPROVED' as any, undefined, undefined, search || undefined);
      const rejectedResult = await this.poService.findAll(pageNum, limitNum, 'REJECTED' as any, undefined, undefined, search || undefined);
      allPos = [...approvedResult.pos, ...rejectedResult.pos];
    } else {
      const result = await this.poService.findAll(pageNum, limitNum, statusFilter as any, undefined, undefined, search || undefined);
      allPos = result.pos;
    }

    // Transform to match approval history format
    return {
      data: allPos.map((po: any) => ({
        id: po.id,
        type: 'PURCHASE_ORDER',
        referenceNumber: po.poNumber,
        title: po.title,
        description: po.description,
        amount: po.totalAmount || po.amount,
        currency: po.currency?.code || 'USD',
        status: po.status,
        action: po.status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        requesterId: po.createdById,
        requesterName: po.creator ? `${po.creator.firstName || ''} ${po.creator.lastName || ''}`.trim() : 'Unknown',
        approverId: po.approvedById,
        approverName: po.approver ? `${po.approver.firstName || ''} ${po.approver.lastName || ''}`.trim() : 'Unknown',
        processedAt: po.approvedAt,
        createdAt: po.createdAt,
      })),
      meta: {
        total: allPos.length,
        page: pageNum,
        pageSize: limitNum,
        totalPages: Math.ceil(allPos.length / limitNum),
      }
    };
  }

  @Post(":id/submit")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: "Submit PO for approval" })
  @ApiResponseDoc({ status: 200, description: "PO submitted for approval" })
  @ApiResponseDoc({ status: 400, description: "Bad request" })
  @ApiResponseDoc({ status: 404, description: "PO not found" })
  async submitForApproval(@Param("id") id: string, @Request() req: any) {
    return this.poService.submitForApproval(id, req.user.id);
  }

  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Get all Purchase Orders" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "contractId", required: false })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiResponseDoc({ status: 200, description: "POs retrieved successfully" })
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "",
    @Query("pageSize") pageSize: string = "10",
    @Query("status") status: string = "",
    @Query("search") search: string = "",
    @Query("createdById") createdById: string = "",
    @Query("contractId") contractId: string = "",
    @Request() req: any,
  ) {
    const pageNum = parseInt(page) || 1;
    // Support both limit and pageSize params
    const limitNum = parseInt(limit) || parseInt(pageSize) || 10;

    // Admins and Managers can see all POs, others only see their own
    const canSeeAll = req.user.role === UserRoleEnum.ADMIN || req.user.role === UserRoleEnum.MANAGER;
    const filterCreatedById = canSeeAll ? (createdById || undefined) : req.user.id;

    const result = await this.poService.findAll(
      pageNum,
      limitNum,
      status ? status as any : undefined,
      filterCreatedById,
      contractId || undefined,
      search || undefined,
    );

    // Return in format frontend expects: { data, meta }
    return {
      data: result.pos,
      meta: {
        total: result.total,
        page: pageNum,
        pageSize: limitNum,
        totalPages: Math.ceil(result.total / limitNum),
      }
    };
  }

  @Get(":id")
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: "Get Purchase Order by ID" })
  @ApiResponseDoc({ status: 200, description: "PO retrieved successfully" })
  @ApiResponseDoc({ status: 404, description: "PO not found" })
  async findOne(@Param("id") id: string) {
    const po = await this.poService.findOne(id);
    // Return in format frontend expects
    return { data: po };
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
}