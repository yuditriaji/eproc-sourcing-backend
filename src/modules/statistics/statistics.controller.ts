import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ParseDatePipe,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { StatisticsService, DateRangeFilter } from "./statistics.service";
import { ApiResponse } from "../../common/interfaces/api-response.interface";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";

@ApiTags("Transaction Statistics")
@ApiBearerAuth()
@Controller(":tenant/transactions/statistics")
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get("purchase-orders")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.BUYER)
  @ApiOperation({ 
    summary: "Get Purchase Order statistics",
    description: "Comprehensive statistics for purchase orders including counts by status, values, and processing times"
  })
  @ApiQuery({ name: "startDate", required: false, type: Date })
  @ApiQuery({ name: "endDate", required: false, type: Date })
  @ApiQuery({ name: "createdById", required: false, type: String })
  @ApiResponseDoc({ status: 200, description: "PO statistics retrieved successfully" })
  @ApiResponseDoc({ status: 401, description: "Unauthorized" })
  @ApiResponseDoc({ status: 403, description: "Forbidden" })
  async getPurchaseOrderStatistics(
    @Query("startDate") startDate: string = "",
    @Query("endDate") endDate: string = "",
    @Query("createdById") createdById: string = "",
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      // Get user's tenant ID
      const tenantId = req.user.tenantId;
      
      // For non-admin users, filter by their own records
      const actualCreatedById = 
        req.user.role === UserRole.ADMIN ? (createdById || undefined) : req.user.id;

      const filters: DateRangeFilter & { createdById?: string; tenantId?: string } = {
        tenantId,
        ...(actualCreatedById && { createdById: actualCreatedById }),
        ...(startDate && startDate.trim() && { startDate: new Date(startDate) }),
        ...(endDate && endDate.trim() && { endDate: new Date(endDate) }),
      };

      const statistics = await this.statisticsService.getPurchaseOrderStatistics(filters);

      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: "Purchase Order statistics retrieved successfully",
        data: statistics,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve Purchase Order statistics",
        errors: [error.message],
      };
    }
  }

  @Get("purchase-requisitions")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.BUYER)
  @ApiOperation({ 
    summary: "Get Purchase Requisition statistics",
    description: "Comprehensive statistics for purchase requisitions including counts by status, values, and approval times"
  })
  @ApiQuery({ name: "startDate", required: false, type: Date })
  @ApiQuery({ name: "endDate", required: false, type: Date })
  @ApiQuery({ name: "requesterId", required: false, type: String })
  @ApiResponseDoc({ status: 200, description: "PR statistics retrieved successfully" })
  async getPurchaseRequisitionStatistics(
    @Query("startDate") startDate: string = "",
    @Query("endDate") endDate: string = "",
    @Query("requesterId") requesterId: string = "",
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const tenantId = req.user.tenantId;
      
      // For non-admin users, filter by their own records
      const actualRequesterId = 
        req.user.role === UserRole.ADMIN ? (requesterId || undefined) : req.user.id;

      const filters: DateRangeFilter & { requesterId?: string; tenantId?: string } = {
        tenantId,
        ...(actualRequesterId && { requesterId: actualRequesterId }),
        ...(startDate && startDate.trim() && { startDate: new Date(startDate) }),
        ...(endDate && endDate.trim() && { endDate: new Date(endDate) }),
      };

      const statistics = await this.statisticsService.getPurchaseRequisitionStatistics(filters);

      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: "Purchase Requisition statistics retrieved successfully",
        data: statistics,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve Purchase Requisition statistics",
        errors: [error.message],
      };
    }
  }

  @Get("tenders")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.BUYER)
  @ApiOperation({ 
    summary: "Get Tender statistics",
    description: "Comprehensive statistics for tenders including counts by status, values, bid analytics, and award times"
  })
  @ApiQuery({ name: "startDate", required: false, type: Date })
  @ApiQuery({ name: "endDate", required: false, type: Date })
  @ApiQuery({ name: "creatorId", required: false, type: String })
  @ApiResponseDoc({ status: 200, description: "Tender statistics retrieved successfully" })
  async getTenderStatistics(
    @Query("startDate") startDate: string = "",
    @Query("endDate") endDate: string = "",
    @Query("creatorId") creatorId: string = "",
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const tenantId = req.user.tenantId;
      
      // For non-admin users, filter by their own records
      const actualCreatedById = 
        req.user.role === UserRole.ADMIN ? (creatorId || undefined) : req.user.id;

      const filters: DateRangeFilter & { createdById?: string; tenantId?: string } = {
        tenantId,
        ...(actualCreatedById && { createdById: actualCreatedById }),
        ...(startDate && startDate.trim() && { startDate: new Date(startDate) }),
        ...(endDate && endDate.trim() && { endDate: new Date(endDate) }),
      };

      const statistics = await this.statisticsService.getTenderStatistics(filters);

      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: "Tender statistics retrieved successfully",
        data: statistics,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve Tender statistics",
        errors: [error.message],
      };
    }
  }

  @Get("vendors/performance")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE)
  @ApiOperation({ 
    summary: "Get Vendor performance statistics",
    description: "Comprehensive vendor performance analytics including ratings, delivery metrics, and top performers"
  })
  @ApiQuery({ name: "startDate", required: false, type: Date })
  @ApiQuery({ name: "endDate", required: false, type: Date })
  @ApiResponseDoc({ status: 200, description: "Vendor performance statistics retrieved successfully" })
  async getVendorPerformanceStatistics(
    @Query("startDate") startDate: string = "",
    @Query("endDate") endDate: string = "",
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const tenantId = req.user.tenantId;

      const filters: DateRangeFilter & { tenantId?: string } = {
        tenantId,
        ...(startDate && startDate.trim() && { startDate: new Date(startDate) }),
        ...(endDate && endDate.trim() && { endDate: new Date(endDate) }),
      };

      const statistics = await this.statisticsService.getVendorPerformanceStatistics(filters);

      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: "Vendor performance statistics retrieved successfully",
        data: statistics,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve Vendor performance statistics",
        errors: [error.message],
      };
    }
  }

  @Get("dashboard")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.BUYER)
  @ApiOperation({ 
    summary: "Get dashboard summary statistics",
    description: "Executive dashboard summary with key metrics across all transaction types and recent activity"
  })
  @ApiQuery({ name: "startDate", required: false, type: Date })
  @ApiQuery({ name: "endDate", required: false, type: Date })
  @ApiResponseDoc({ 
    status: 200, 
    description: "Dashboard summary retrieved successfully",
    schema: {
      example: {
        success: true,
        data: {
          purchaseOrders: { total: 150, pending: 25, value: 2500000 },
          purchaseRequisitions: { total: 200, pending: 45, value: 1800000 },
          tenders: { total: 35, active: 8, value: 5000000 },
          contracts: { total: 75, active: 12, value: 15000000 },
          recentActivity: [
            {
              type: "Purchase Order",
              id: "po-123",
              title: "Office Supplies",
              status: "APPROVED",
              createdAt: "2024-01-15T10:00:00Z",
              value: 25000
            }
          ]
        }
      }
    }
  })
  async getDashboardSummary(
    @Query("startDate") startDate: string = "",
    @Query("endDate") endDate: string = "",
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const tenantId = req.user.tenantId;

      const filters: DateRangeFilter = {
        ...(startDate && startDate.trim() && { startDate: new Date(startDate) }),
        ...(endDate && endDate.trim() && { endDate: new Date(endDate) }),
      };

      const summary = await this.statisticsService.getDashboardSummary(tenantId, filters);

      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: "Dashboard summary retrieved successfully",
        data: summary,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve dashboard summary",
        errors: [error.message],
      };
    }
  }

  @Get("summary")
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.BUYER)
  @ApiOperation({ 
    summary: "Get comprehensive statistics summary",
    description: "All statistics combined in a single response for comprehensive analytics"
  })
  @ApiQuery({ name: "startDate", required: false, type: Date })
  @ApiQuery({ name: "endDate", required: false, type: Date })
  @ApiResponseDoc({ status: 200, description: "Complete statistics summary retrieved successfully" })
  async getComprehensiveStatistics(
    @Query("startDate") startDate: string = "",
    @Query("endDate") endDate: string = "",
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      const userRole = req.user.role;

      const baseFilters = {
        tenantId,
        ...(startDate && startDate.trim() && { startDate: new Date(startDate) }),
        ...(endDate && endDate.trim() && { endDate: new Date(endDate) }),
      };

      const [
        purchaseOrderStats,
        purchaseRequisitionStats,
        tenderStats,
        vendorStats,
        dashboardSummary,
      ] = await Promise.all([
        this.statisticsService.getPurchaseOrderStatistics({
          ...baseFilters,
          ...(userRole !== UserRole.ADMIN && { createdById: userId }),
        }),
        this.statisticsService.getPurchaseRequisitionStatistics({
          ...baseFilters,
          ...(userRole !== UserRole.ADMIN && { requesterId: userId }),
        }),
        this.statisticsService.getTenderStatistics({
          ...baseFilters,
          ...(userRole !== UserRole.ADMIN && { creatorId: userId }),
        }),
        // Only admins and managers can see vendor statistics
        [UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE].includes(userRole as any)
          ? this.statisticsService.getVendorPerformanceStatistics(baseFilters)
          : Promise.resolve(null),
        this.statisticsService.getDashboardSummary(tenantId, baseFilters),
      ]);

      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: "Comprehensive statistics retrieved successfully",
        data: {
          purchaseOrders: purchaseOrderStats,
          purchaseRequisitions: purchaseRequisitionStats,
          tenders: tenderStats,
          ...(vendorStats && { vendors: vendorStats }),
          dashboard: dashboardSummary,
        },
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve comprehensive statistics",
        errors: [error.message],
      };
    }
  }
}