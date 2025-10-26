import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { UserRole, POStatus, PRStatus, TenderStatus } from "@prisma/client";

interface StatisticsFilters {
  period: string;
  year: number;
  month?: number;
  status?: string;
  createdBy?: string;
  requestedBy?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async getPurchaseOrderStatistics(filters: StatisticsFilters) {
    const { period, year, month, status, createdBy } = filters;

    // Build date filters
    let startDate: Date;
    let endDate: Date;

    if (period === "yearly") {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year + 1, 0, 1);
    } else if (period === "monthly") {
      const targetMonth = month || new Date().getMonth();
      startDate = new Date(year, targetMonth, 1);
      endDate = new Date(year, targetMonth + 1, 1);
    } else if (period === "weekly") {
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
      endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else { // daily
      startDate = new Date(year, month || new Date().getMonth(), new Date().getDate());
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const where = {
      deletedAt: null,
      createdAt: { gte: startDate, lt: endDate },
      ...(status && { status: status as POStatus }),
      ...(createdBy && { createdById: createdBy }),
    };

    const [
      summary,
      trends,
      topVendors,
    ] = await Promise.all([
      this.getPOSummary(where),
      this.getPOTrends(where, period),
      this.getTopVendors(where),
    ]);

    return {
      summary,
      trends,
      topVendors,
      period,
      filters: { year, month, status, createdBy },
    };
  }

  async getPurchaseRequisitionStatistics(filters: StatisticsFilters) {
    const { period, year, month, status, requestedBy } = filters;

    // Build date filters (similar to PO)
    let startDate: Date;
    let endDate: Date;

    if (period === "yearly") {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year + 1, 0, 1);
    } else if (period === "monthly") {
      const targetMonth = month || new Date().getMonth();
      startDate = new Date(year, targetMonth, 1);
      endDate = new Date(year, targetMonth + 1, 1);
    } else if (period === "weekly") {
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      startDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
      endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else { // daily
      startDate = new Date(year, month || new Date().getMonth(), new Date().getDate());
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const where = {
      deletedAt: null,
      createdAt: { gte: startDate, lt: endDate },
      ...(status && { status: status as PRStatus }),
      ...(requestedBy && { requesterId: requestedBy }),
    };

    const [
      summary,
      pendingApprovals,
    ] = await Promise.all([
      this.getPRSummary(where),
      this.getPendingPRApprovals(requestedBy),
    ]);

    return {
      summary,
      pendingApprovals,
      period,
      filters: { year, month, status, requestedBy },
    };
  }

  async getTenderStatistics(filters: StatisticsFilters) {
    const { period, year, month, status, createdBy } = filters;

    // Build date filters
    let startDate: Date;
    let endDate: Date;

    if (period === "yearly") {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year + 1, 0, 1);
    } else if (period === "monthly") {
      const targetMonth = month || new Date().getMonth();
      startDate = new Date(year, targetMonth, 1);
      endDate = new Date(year, targetMonth + 1, 1);
    } else {
      startDate = new Date(year, month || new Date().getMonth(), new Date().getDate());
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const where = {
      deletedAt: null,
      createdAt: { gte: startDate, lt: endDate },
      ...(status && { status: status as TenderStatus }),
      ...(createdBy && { creatorId: createdBy }),
    };

    const summary = await this.getTenderSummary(where);

    return {
      summary,
      period,
      filters: { year, month, status, createdBy },
    };
  }

  async getTransactionOverview(userId?: string) {
    const where = userId ? { createdById: userId } : {};

    const [
      poStats,
      prStats,
      tenderStats,
      contractStats,
    ] = await Promise.all([
      this.getPOSummary(where),
      this.getPRSummary(where),
      this.getTenderSummary(where),
      this.getContractSummary(where),
    ]);

    return {
      purchaseOrders: poStats,
      purchaseRequisitions: prStats,
      tenders: tenderStats,
      contracts: contractStats,
      generatedAt: new Date(),
    };
  }

  async getVendorPerformance(limit: number = 10) {
    const vendors = await this.prisma.vendor.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
            contracts: true,
            bids: true,
          },
        },
      },
      orderBy: { totalContracts: 'desc' },
      take: limit,
    });

    return vendors.map(vendor => ({
      id: vendor.id,
      name: vendor.name,
      contactEmail: vendor.contactEmail,
      rating: vendor.rating,
      totalContracts: vendor.totalContracts,
      onTimeDelivery: vendor.onTimeDelivery,
      totalPOs: vendor._count.purchaseOrders,
      totalBids: vendor._count.bids,
    }));
  }

  async getDashboardSummary(userId: string, userRole: UserRole) {
    const isAdmin = userRole === UserRole.ADMIN;
    const userFilter = isAdmin ? {} : { createdById: userId };
    const requesterFilter = isAdmin ? {} : { requesterId: userId };

    const [
      poSummary,
      prSummary,
      tenderSummary,
      pendingPOs,
      pendingPRs,
    ] = await Promise.all([
      this.getPOSummary(userFilter),
      this.getPRSummary(requesterFilter),
      this.getTenderSummary(userFilter),
      this.getPendingPOApprovals(userId),
      this.getPendingPRApprovals(userId),
    ]);

    return {
      summary: {
        purchaseOrders: poSummary,
        purchaseRequisitions: prSummary,
        tenders: tenderSummary,
      },
      pending: {
        purchaseOrders: pendingPOs.length,
        purchaseRequisitions: pendingPRs.length,
      },
      userRole,
      generatedAt: new Date(),
    };
  }

  private async getPOSummary(where: any) {
    const [
      totalPOs,
      draftPOs,
      approvedPOs,
      inProgressPOs,
      completedPOs,
      cancelledPOs,
      totalValue,
    ] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.DRAFT } }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.APPROVED } }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.IN_PROGRESS } }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.COMPLETED } }),
      this.prisma.purchaseOrder.count({ where: { ...where, status: POStatus.CANCELLED } }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...where, totalAmount: { not: null } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalPOs,
      draftPOs,
      approvedPOs,
      inProgressPOs,
      completedPOs,
      cancelledPOs,
      totalValue: totalValue._sum.totalAmount || 0,
      averageValue: totalPOs > 0 ? (Number(totalValue._sum.totalAmount) || 0) / totalPOs : 0,
    };
  }

  private async getPRSummary(where: any) {
    const [
      totalPRs,
      pendingPRs,
      approvedPRs,
      rejectedPRs,
      cancelledPRs,
      totalValue,
    ] = await Promise.all([
      this.prisma.purchaseRequisition.count({ where }),
      this.prisma.purchaseRequisition.count({ where: { ...where, status: PRStatus.PENDING } }),
      this.prisma.purchaseRequisition.count({ where: { ...where, status: PRStatus.APPROVED } }),
      this.prisma.purchaseRequisition.count({ where: { ...where, status: PRStatus.REJECTED } }),
      this.prisma.purchaseRequisition.count({ where: { ...where, status: PRStatus.CANCELLED } }),
      this.prisma.purchaseRequisition.aggregate({
        where: { ...where, estimatedAmount: { not: null } },
        _sum: { estimatedAmount: true },
      }),
    ]);

    return {
      totalPRs,
      pendingPRs,
      approvedPRs,
      rejectedPRs,
      cancelledPRs,
      totalValue: totalValue._sum.estimatedAmount || 0,
      averageApprovalTime: "2.5 days", // This would need actual calculation
    };
  }

  private async getTenderSummary(where: any) {
    const [
      totalTenders,
      draftTenders,
      publishedTenders,
      closedTenders,
      awardedTenders,
    ] = await Promise.all([
      this.prisma.tender.count({ where }),
      this.prisma.tender.count({ where: { ...where, status: TenderStatus.DRAFT } }),
      this.prisma.tender.count({ where: { ...where, status: TenderStatus.PUBLISHED } }),
      this.prisma.tender.count({ where: { ...where, status: TenderStatus.CLOSED } }),
      this.prisma.tender.count({ where: { ...where, status: TenderStatus.AWARDED } }),
    ]);

    return {
      totalTenders,
      draftTenders,
      publishedTenders,
      closedTenders,
      awardedTenders,
    };
  }

  private async getContractSummary(where: any) {
    const totalContracts = await this.prisma.contract.count({ 
      where: { ...where, deletedAt: null } 
    });
    
    return { totalContracts };
  }

  private async getPOTrends(where: any, period: string) {
    // This is a simplified version - in production you'd want more sophisticated date grouping
    const trends = await this.prisma.purchaseOrder.groupBy({
      by: ['createdAt'],
      where,
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    return trends.map(trend => ({
      period: trend.createdAt.toISOString().split('T')[0],
      count: trend._count.id,
      value: trend._sum.totalAmount || 0,
    }));
  }

  private async getTopVendors(where: any) {
    const vendorPOs = await this.prisma.pOVendor.groupBy({
      by: ['vendorId'],
      where: {
        purchaseOrder: where,
      },
      _count: { vendorId: true },
      _sum: { assignedAmount: true },
    });

    const vendorDetails = await this.prisma.vendor.findMany({
      where: { id: { in: vendorPOs.map(v => v.vendorId) } },
      select: { id: true, name: true },
    });

    return vendorPOs.map(po => {
      const vendor = vendorDetails.find(v => v.id === po.vendorId);
      return {
        vendorId: po.vendorId,
        vendorName: vendor?.name || 'Unknown',
        totalPOs: po._count.vendorId,
        totalValue: po._sum.assignedAmount || 0,
      };
    }).sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);
  }

  private async getPendingPRApprovals(userId?: string) {
    return this.prisma.purchaseRequisition.findMany({
      where: {
        status: PRStatus.PENDING,
        deletedAt: null,
        ...(userId && { requesterId: userId }),
      },
      select: {
        id: true,
        prNumber: true,
        title: true,
        estimatedAmount: true,
        requiredBy: true,
        createdAt: true,
        requester: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
  }

  private async getPendingPOApprovals(userId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        status: POStatus.DRAFT,
        deletedAt: null,
      },
      select: {
        id: true,
        poNumber: true,
        title: true,
        totalAmount: true,
        createdAt: true,
        creator: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
  }
}