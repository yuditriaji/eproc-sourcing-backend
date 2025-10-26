import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { TransactionsService } from "./transactions.service";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";

@ApiTags("Transaction Statistics")
@ApiBearerAuth()
@Controller(":tenant/transactions")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get("statistics/purchase-orders")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.BUYER)
  @ApiOperation({ summary: "Get Purchase Order statistics" })
  @ApiQuery({ name: "period", required: false, enum: ["daily", "weekly", "monthly", "yearly"] })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "month", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "createdBy", required: false })
  @ApiResponseDoc({ status: 200, description: "PO statistics retrieved successfully" })
  async getPurchaseOrderStatistics(
    @Query("period") period: string = "monthly",
    @Query("year") year: string = "",
    @Query("month") month: string = "",
    @Query("status") status: string = "",
    @Query("createdBy") createdBy: string = "",
    @Request() req: any,
  ) {
    const filters = {
      period: period || "monthly",
      year: year && year.trim() ? parseInt(year) : new Date().getFullYear(),
      month: month && month.trim() ? parseInt(month) : undefined,
      status: status || undefined,
      createdBy: req.user.role === UserRole.ADMIN ? (createdBy || undefined) : req.user.id,
    };

    return this.transactionsService.getPurchaseOrderStatistics(filters);
  }

  @Get("statistics/purchase-requisitions")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.BUYER)
  @ApiOperation({ summary: "Get Purchase Requisition statistics" })
  @ApiQuery({ name: "period", required: false, enum: ["daily", "weekly", "monthly", "yearly"] })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "month", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "requestedBy", required: false })
  @ApiResponseDoc({ status: 200, description: "PR statistics retrieved successfully" })
  async getPurchaseRequisitionStatistics(
    @Query("period") period: string = "monthly",
    @Query("year") year: string = "",
    @Query("month") month: string = "",
    @Query("status") status: string = "",
    @Query("requestedBy") requestedBy: string = "",
    @Request() req: any,
  ) {
    const filters = {
      period: period || "monthly",
      year: year && year.trim() ? parseInt(year) : new Date().getFullYear(),
      month: month && month.trim() ? parseInt(month) : undefined,
      status: status || undefined,
      requestedBy: req.user.role === UserRole.ADMIN ? (requestedBy || undefined) : req.user.id,
    };

    return this.transactionsService.getPurchaseRequisitionStatistics(filters);
  }

  @Get("statistics/tenders")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BUYER)
  @ApiOperation({ summary: "Get Tender statistics" })
  @ApiQuery({ name: "period", required: false, enum: ["daily", "weekly", "monthly", "yearly"] })
  @ApiQuery({ name: "year", required: false })
  @ApiQuery({ name: "month", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiResponseDoc({ status: 200, description: "Tender statistics retrieved successfully" })
  async getTenderStatistics(
    @Query("period") period: string = "monthly",
    @Query("year") year: string = "",
    @Query("month") month: string = "",
    @Query("status") status: string = "",
    @Request() req: any,
  ) {
    const filters = {
      period: period || "monthly",
      year: year && year.trim() ? parseInt(year) : new Date().getFullYear(),
      month: month && month.trim() ? parseInt(month) : undefined,
      status: status || undefined,
      createdBy: req.user.role === UserRole.ADMIN ? undefined : req.user.id,
    };

    return this.transactionsService.getTenderStatistics(filters);
  }

  @Get("statistics/overview")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE)
  @ApiOperation({ summary: "Get overall transaction overview" })
  @ApiResponseDoc({ status: 200, description: "Transaction overview retrieved successfully" })
  async getTransactionOverview(@Request() req: any) {
    return this.transactionsService.getTransactionOverview(
      req.user.role === UserRole.ADMIN ? undefined : req.user.id
    );
  }

  @Get("statistics/vendor-performance")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BUYER)
  @ApiOperation({ summary: "Get vendor performance statistics" })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponseDoc({ status: 200, description: "Vendor performance statistics retrieved successfully" })
  async getVendorPerformance(
    @Query("limit") limit: string = "10",
    @Request() req: any,
  ) {
    const limitNum = parseInt(limit) || 10;
    return this.transactionsService.getVendorPerformance(limitNum);
  }

  @Get("dashboard/summary")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.BUYER)
  @ApiOperation({ summary: "Get dashboard summary for current user" })
  @ApiResponseDoc({ status: 200, description: "Dashboard summary retrieved successfully" })
  async getDashboardSummary(@Request() req: any) {
    return this.transactionsService.getDashboardSummary(req.user.id, req.user.role);
  }
}