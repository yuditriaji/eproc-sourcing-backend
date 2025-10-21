import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import * as winston from 'winston';
import { TenantContext } from '../../common/tenant/tenant-context';

export interface AuditLogData {
  userId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

@Injectable()
export class AuditService {
  private logger: winston.Logger;

  constructor(private prismaService: PrismaService, private readonly tenantContext: TenantContext) {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: 'logs/audit.log',
          level: 'info',
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  async log(data: AuditLogData): Promise<void> {
    try {
      // Store in database
      await this.prismaService.auditLog.create({
        data: {
          tenantId: this.tenantContext.getTenantId()!,
          userId: data.userId,
          action: data.action as any, // Cast to handle enum conversion
          targetType: data.targetType,
          targetId: data.targetId,
          oldValues: data.oldValues,
          newValues: data.newValues,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      // Also log to file system
      this.logger.info('Audit log created', {
        ...data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // If database logging fails, at least log to file
      this.logger.error('Failed to create audit log in database', {
        error: error.message,
        auditData: data,
      });
    }
  }

  async getUserAuditHistory(userId: string, limit = 100, offset = 0) {
    return this.prismaService.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });
  }

  async getAuditLogs(filters?: {
    action?: string;
    targetType?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.action) where.action = filters.action;
    if (filters?.targetType) where.targetType = filters.targetType;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.startDate || filters?.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return this.prismaService.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
      include: {
        user: {
          select: {
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }
}