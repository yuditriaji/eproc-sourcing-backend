import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  POStatus,
  PRStatus,
  TenderStatus,
  BidStatus,
  ContractStatus,
  InvoiceStatus,
  PaymentStatus,
  GoodsReceiptStatus,
} from "@prisma/client";

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

export interface PurchaseOrderStats {
  totalPOs: number;
  draftPOs: number;
  approvedPOs: number;
  inProgressPOs: number;
  deliveredPOs: number;
  completedPOs: number;
  cancelledPOs: number;
  totalValue: number;
  averageValue: number;
  averageProcessingTime: number; // in days
}

export interface PurchaseRequisitionStats {
  totalPRs: number;
  pendingPRs: number;
  approvedPRs: number;
  rejectedPRs: number;
  cancelledPRs: number;
  totalEstimatedValue: number;
  averageEstimatedValue: number;
  averageApprovalTime: number; // in days
}

export interface TenderStats {
  totalTenders: number;
  draftTenders: number;
  publishedTenders: number;
  closedTenders: number;
  awardedTenders: number;
  cancelledTenders: number;
  totalEstimatedValue: number;
  averageBidsPerTender: number;
  averageTimeToAward: number; // in days
}

export interface VendorPerformanceStats {
  totalVendors: number;
  activeVendors: number;
  totalContracts: number;
  totalPurchaseOrders: number;
  onTimeDeliveryRate: number;
  averageRating: number;
  topVendorsByValue: Array<{
    vendorId: string;
    vendorName: string;
    totalValue: number;
    contractCount: number;
  }>;
}

export interface DashboardSummary {
  purchaseOrders: {
    total: number;
    pending: number;
    value: number;
  };
  purchaseRequisitions: {
    total: number;
    pending: number;
    value: number;
  };
  tenders: {
    total: number;
    active: number;
    value: number;
  };
  contracts: {
    total: number;
    active: number;
    value: number;
  };
  recentActivity: Array<{
    type: string;
    id: string;
    title: string;
    status: string;
    createdAt: Date;
    value?: number;
  }>;
}

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getPurchaseOrderStatistics(
    filters?: DateRangeFilter & { createdById?: string; tenantId?: string }
  ): Promise<PurchaseOrderStats> {
    const where = {
      deletedAt: null,
      ...(filters?.tenantId && { tenantId: filters.tenantId }),
      ...(filters?.createdById && { createdById: filters.createdById }),
      ...(filters?.startDate && {
        createdAt: {
          gte: filters.startDate,
          ...(filters.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const [
      totalPOs,
      draftPOs,
      approvedPOs,
      inProgressPOs,
      deliveredPOs,
      completedPOs,
      cancelledPOs,
      totalValueResult,
      averageProcessingTimeResult,
    ] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.count({
        where: { ...where, status: POStatus.DRAFT },
      }),
      this.prisma.purchaseOrder.count({
        where: { ...where, status: POStatus.APPROVED },
      }),
      this.prisma.purchaseOrder.count({
        where: { ...where, status: POStatus.IN_PROGRESS },
      }),
      this.prisma.purchaseOrder.count({
        where: { ...where, status: POStatus.DELIVERED },
      }),
      this.prisma.purchaseOrder.count({
        where: { ...where, status: POStatus.COMPLETED },
      }),
      this.prisma.purchaseOrder.count({
        where: { ...where, status: POStatus.CANCELLED },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...where, totalAmount: { not: null } },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          ...where,
          status: POStatus.COMPLETED,
          approvedAt: { not: null },
        },
        select: {
          createdAt: true,
          approvedAt: true,
        },
      }),
    ]);

    // Calculate average processing time
    const averageProcessingTime =
      averageProcessingTimeResult.length > 0
        ? averageProcessingTimeResult.reduce((sum, po) => {
            const days = Math.floor(
              (new Date(po.approvedAt!).getTime() -
                new Date(po.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / averageProcessingTimeResult.length
        : 0;

    const totalValue = Number(totalValueResult._sum.totalAmount || 0);

    return {
      totalPOs,
      draftPOs,
      approvedPOs,
      inProgressPOs,
      deliveredPOs,
      completedPOs,
      cancelledPOs,
      totalValue,
      averageValue: totalPOs > 0 ? totalValue / totalPOs : 0,
      averageProcessingTime,
    };
  }

  async getPurchaseRequisitionStatistics(
    filters?: DateRangeFilter & { requesterId?: string; tenantId?: string }
  ): Promise<PurchaseRequisitionStats> {
    const where = {
      deletedAt: null,
      ...(filters?.tenantId && { tenantId: filters.tenantId }),
      ...(filters?.requesterId && { requesterId: filters.requesterId }),
      ...(filters?.startDate && {
        createdAt: {
          gte: filters.startDate,
          ...(filters.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const [
      totalPRs,
      pendingPRs,
      approvedPRs,
      rejectedPRs,
      cancelledPRs,
      totalEstimatedValueResult,
      averageApprovalTimeResult,
    ] = await Promise.all([
      this.prisma.purchaseRequisition.count({ where }),
      this.prisma.purchaseRequisition.count({
        where: { ...where, status: PRStatus.PENDING },
      }),
      this.prisma.purchaseRequisition.count({
        where: { ...where, status: PRStatus.APPROVED },
      }),
      this.prisma.purchaseRequisition.count({
        where: { ...where, status: PRStatus.REJECTED },
      }),
      this.prisma.purchaseRequisition.count({
        where: { ...where, status: PRStatus.CANCELLED },
      }),
      this.prisma.purchaseRequisition.aggregate({
        where: { ...where, estimatedAmount: { not: null } },
        _sum: { estimatedAmount: true },
      }),
      this.prisma.purchaseRequisition.findMany({
        where: {
          ...where,
          status: PRStatus.APPROVED,
          approvedAt: { not: null },
        },
        select: {
          createdAt: true,
          approvedAt: true,
        },
      }),
    ]);

    // Calculate average approval time
    const averageApprovalTime =
      averageApprovalTimeResult.length > 0
        ? averageApprovalTimeResult.reduce((sum, pr) => {
            const days = Math.floor(
              (new Date(pr.approvedAt!).getTime() -
                new Date(pr.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / averageApprovalTimeResult.length
        : 0;

    const totalEstimatedValue = Number(
      totalEstimatedValueResult._sum.estimatedAmount || 0
    );

    return {
      totalPRs,
      pendingPRs,
      approvedPRs,
      rejectedPRs,
      cancelledPRs,
      totalEstimatedValue,
      averageEstimatedValue: totalPRs > 0 ? totalEstimatedValue / totalPRs : 0,
      averageApprovalTime,
    };
  }

  async getTenderStatistics(
    filters?: DateRangeFilter & { creatorId?: string; tenantId?: string }
  ): Promise<TenderStats> {
    const where = {
      deletedAt: null,
      ...(filters?.tenantId && { tenantId: filters.tenantId }),
      ...(filters?.creatorId && { creatorId: filters.creatorId }),
      ...(filters?.startDate && {
        createdAt: {
          gte: filters.startDate,
          ...(filters.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const [
      totalTenders,
      draftTenders,
      publishedTenders,
      closedTenders,
      awardedTenders,
      cancelledTenders,
      totalEstimatedValueResult,
      bidsPerTenderResult,
      awardTimeResult,
    ] = await Promise.all([
      this.prisma.tender.count({ where }),
      this.prisma.tender.count({
        where: { ...where, status: TenderStatus.DRAFT },
      }),
      this.prisma.tender.count({
        where: { ...where, status: TenderStatus.PUBLISHED },
      }),
      this.prisma.tender.count({
        where: { ...where, status: TenderStatus.CLOSED },
      }),
      this.prisma.tender.count({
        where: { ...where, status: TenderStatus.AWARDED },
      }),
      this.prisma.tender.count({
        where: { ...where, status: TenderStatus.CANCELLED },
      }),
      this.prisma.tender.aggregate({
        where: { ...where, estimatedValue: { not: null } },
        _sum: { estimatedValue: true },
      }),
      this.prisma.tender.findMany({
        where,
        include: {
          _count: {
            select: { bids: true },
          },
        },
      }),
      this.prisma.tender.findMany({
        where: {
          ...where,
          status: TenderStatus.AWARDED,
          publishedAt: { not: null },
          awardDate: { not: null },
        },
        select: {
          publishedAt: true,
          awardDate: true,
        },
      }),
    ]);

    // Calculate average bids per tender
    const averageBidsPerTender =
      bidsPerTenderResult.length > 0
        ? bidsPerTenderResult.reduce(
            (sum, tender) => sum + tender._count.bids,
            0
          ) / bidsPerTenderResult.length
        : 0;

    // Calculate average time to award
    const averageTimeToAward =
      awardTimeResult.length > 0
        ? awardTimeResult.reduce((sum, tender) => {
            const days = Math.floor(
              (new Date(tender.awardDate!).getTime() -
                new Date(tender.publishedAt!).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / awardTimeResult.length
        : 0;

    return {
      totalTenders,
      draftTenders,
      publishedTenders,
      closedTenders,
      awardedTenders,
      cancelledTenders,
      totalEstimatedValue: Number(
        totalEstimatedValueResult._sum.estimatedValue || 0
      ),
      averageBidsPerTender,
      averageTimeToAward,
    };
  }

  async getVendorPerformanceStatistics(
    filters?: DateRangeFilter & { tenantId?: string }
  ): Promise<VendorPerformanceStats> {
    const where = {
      deletedAt: null,
      ...(filters?.tenantId && { tenantId: filters.tenantId }),
    };

    const [
      totalVendors,
      activeVendors,
      contractStats,
      poStats,
      topVendorsData,
    ] = await Promise.all([
      this.prisma.vendor.count({ where }),
      this.prisma.vendor.count({
        where: { ...where, status: "ACTIVE" },
      }),
      this.prisma.contractVendor.groupBy({
        by: ["vendorId"],
        _count: true,
        where: {
          ...(filters?.tenantId && { tenantId: filters.tenantId }),
        },
      }),
      this.prisma.pOVendor.groupBy({
        by: ["vendorId"],
        _count: true,
        where: {
          ...(filters?.tenantId && { tenantId: filters.tenantId }),
        },
      }),
      this.prisma.pOVendor.findMany({
        where: {
          ...(filters?.tenantId && { tenantId: filters.tenantId }),
          purchaseOrder: {
            totalAmount: { not: null },
          },
        },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          purchaseOrder: {
            select: {
              totalAmount: true,
            },
          },
        },
      }),
    ]);

    // Calculate vendor performance stats
    const vendorValueMap = new Map();
    const vendorContractMap = new Map();

    topVendorsData.forEach((poVendor) => {
      const vendorId = poVendor.vendorId;
      const currentValue = vendorValueMap.get(vendorId) || 0;
      vendorValueMap.set(
        vendorId,
        currentValue + Number(poVendor.purchaseOrder?.totalAmount || 0)
      );
    });

    contractStats.forEach((stat) => {
      vendorContractMap.set(stat.vendorId, stat._count);
    });

    const topVendorsByValue = Array.from(vendorValueMap.entries())
      .map(([vendorId, totalValue]) => {
        const poVendor = topVendorsData.find((pv) => pv.vendorId === vendorId);
        return {
          vendorId,
          vendorName: poVendor?.vendor?.name || "Unknown",
          totalValue: totalValue as number,
          contractCount: vendorContractMap.get(vendorId) || 0,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    // Calculate average on-time delivery and rating from vendor table
    const vendorStats = await this.prisma.vendor.aggregate({
      where,
      _avg: {
        onTimeDelivery: true,
        rating: true,
      },
    });

    return {
      totalVendors,
      activeVendors,
      totalContracts: contractStats.length,
      totalPurchaseOrders: poStats.length,
      onTimeDeliveryRate: Number(vendorStats._avg.onTimeDelivery || 0),
      averageRating: Number(vendorStats._avg.rating || 0),
      topVendorsByValue,
    };
  }

  async getDashboardSummary(
    tenantId: string,
    filters?: DateRangeFilter
  ): Promise<DashboardSummary> {
    const where = {
      tenantId,
      deletedAt: null,
      ...(filters?.startDate && {
        createdAt: {
          gte: filters.startDate,
          ...(filters.endDate && { lte: filters.endDate }),
        },
      }),
    };

    const [
      poStats,
      prStats,
      tenderStats,
      contractStats,
      recentActivity,
    ] = await Promise.all([
      Promise.all([
        this.prisma.purchaseOrder.count({ where }),
        this.prisma.purchaseOrder.count({
          where: { ...where, status: POStatus.DRAFT },
        }),
        this.prisma.purchaseOrder.aggregate({
          where: { ...where, totalAmount: { not: null } },
          _sum: { totalAmount: true },
        }),
      ]),
      Promise.all([
        this.prisma.purchaseRequisition.count({ where }),
        this.prisma.purchaseRequisition.count({
          where: { ...where, status: PRStatus.PENDING },
        }),
        this.prisma.purchaseRequisition.aggregate({
          where: { ...where, estimatedAmount: { not: null } },
          _sum: { estimatedAmount: true },
        }),
      ]),
      Promise.all([
        this.prisma.tender.count({ where }),
        this.prisma.tender.count({
          where: { ...where, status: TenderStatus.PUBLISHED },
        }),
        this.prisma.tender.aggregate({
          where: { ...where, estimatedValue: { not: null } },
          _sum: { estimatedValue: true },
        }),
      ]),
      Promise.all([
        this.prisma.contract.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.contract.count({
          where: { tenantId, deletedAt: null, status: ContractStatus.IN_PROGRESS },
        }),
        this.prisma.contract.aggregate({
          where: { tenantId, deletedAt: null, totalAmount: { not: null } },
          _sum: { totalAmount: true },
        }),
      ]),
      // Get recent activity from multiple sources
      Promise.all([
        this.prisma.purchaseOrder.findMany({
          where: { ...where },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            totalAmount: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        this.prisma.tender.findMany({
          where: { ...where },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            estimatedValue: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        this.prisma.contract.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            totalAmount: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]),
    ]);

    // Flatten and sort recent activity
    const allRecentActivity = [
      ...recentActivity[0].map((po) => ({
        type: "Purchase Order",
        id: po.id,
        title: po.title,
        status: po.status,
        createdAt: po.createdAt,
        value: Number(po.totalAmount || 0),
      })),
      ...recentActivity[1].map((tender) => ({
        type: "Tender",
        id: tender.id,
        title: tender.title,
        status: tender.status,
        createdAt: tender.createdAt,
        value: Number(tender.estimatedValue || 0),
      })),
      ...recentActivity[2].map((contract) => ({
        type: "Contract",
        id: contract.id,
        title: contract.title,
        status: contract.status,
        createdAt: contract.createdAt,
        value: Number(contract.totalAmount || 0),
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      purchaseOrders: {
        total: poStats[0],
        pending: poStats[1],
        value: Number(poStats[2]._sum.totalAmount || 0),
      },
      purchaseRequisitions: {
        total: prStats[0],
        pending: prStats[1],
        value: Number(prStats[2]._sum.estimatedAmount || 0),
      },
      tenders: {
        total: tenderStats[0],
        active: tenderStats[1],
        value: Number(tenderStats[2]._sum.estimatedValue || 0),
      },
      contracts: {
        total: contractStats[0],
        active: contractStats[1],
        value: Number(contractStats[2]._sum.totalAmount || 0),
      },
      recentActivity: allRecentActivity,
    };
  }
}