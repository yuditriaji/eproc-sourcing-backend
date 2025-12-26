import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class GoodsReceiptService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(
        tenantId: string,
        page: number = 1,
        pageSize: number = 20,
        purchaseOrderId?: string,
    ) {
        const where = {
            tenantId,
            deletedAt: null,
            ...(purchaseOrderId && { poId: purchaseOrderId }),
        };

        const [data, total] = await Promise.all([
            this.prisma.goodsReceipt.findMany({
                where,
                include: {
                    purchaseOrder: {
                        select: {
                            id: true,
                            poNumber: true,
                            title: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.goodsReceipt.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async findOne(tenantId: string, id: string) {
        const receipt = await this.prisma.goodsReceipt.findFirst({
            where: {
                id,
                tenantId,
                deletedAt: null,
            },
            include: {
                purchaseOrder: {
                    include: {
                        vendors: {
                            include: {
                                vendor: true,
                            },
                        },
                    },
                },
            },
        });

        if (!receipt) {
            throw new NotFoundException('Goods Receipt not found');
        }

        return receipt;
    }
}
