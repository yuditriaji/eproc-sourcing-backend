import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import {
    RFQStatus,
    PRStatus,
    SourcingType,
    Prisma,
    RFQ,
    UserRoleEnum,
} from '@prisma/client';

export interface CreateRFQDto {
    rfqNumber?: string;
    prId?: string;
    title: string;
    description?: string;
    items: any;
    estimatedAmount?: number;
    validUntil?: Date;
    targetVendorIds?: string[];
    category?: string;
    department?: string;
}

export interface UpdateRFQDto {
    title?: string;
    description?: string;
    items?: any;
    estimatedAmount?: number;
    validUntil?: Date;
    targetVendorIds?: string[];
    category?: string;
    department?: string;
    status?: RFQStatus;
}

@Injectable()
export class RFQService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private events: EventService,
    ) { }

    async create(
        createRFQDto: CreateRFQDto,
        userId: string,
    ): Promise<RFQ> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        // If prId is provided, validate that the PR exists and is approved
        if (createRFQDto.prId) {
            const pr = await this.prisma.purchaseRequisition.findFirst({
                where: {
                    id: createRFQDto.prId,
                    tenantId: user.tenantId,
                    deletedAt: null,
                },
            });

            if (!pr) {
                throw new NotFoundException('Purchase Requisition not found');
            }

            if (pr.status !== PRStatus.APPROVED) {
                throw new BadRequestException('Purchase Requisition must be approved before creating RFQ');
            }
        }

        const rfqNumber =
            createRFQDto.rfqNumber ||
            (await this.generateRFQNumber());

        const rfq = await this.prisma.rFQ.create({
            data: {
                tenantId: user.tenantId,
                rfqNumber,
                prId: createRFQDto.prId,
                title: createRFQDto.title,
                description: createRFQDto.description,
                items: createRFQDto.items,
                estimatedAmount: createRFQDto.estimatedAmount,
                validUntil: createRFQDto.validUntil,
                targetVendorIds: createRFQDto.targetVendorIds || [],
                category: createRFQDto.category,
                department: createRFQDto.department,
                status: RFQStatus.DRAFT,
                createdById: userId,
            },
            include: {
                purchaseRequisition: true,
                creator: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                quotations: true,
            },
        });

        // Update PR sourcing type if linked
        if (createRFQDto.prId) {
            await this.prisma.purchaseRequisition.update({
                where: { id: createRFQDto.prId },
                data: { sourcingType: SourcingType.RFQ },
            });
        }

        await this.audit.log({
            userId,
            action: 'CREATE',
            targetType: 'RFQ',
            targetId: rfq.id,
            newValues: rfq as any,
        });

        return rfq;
    }

    async findAll(
        tenantId: string,
        role: UserRoleEnum,
        userId: string,
        page: number = 1,
        limit: number = 20,
        filters?: {
            status?: RFQStatus;
            prId?: string;
            search?: string;
        },
    ): Promise<{
        data: RFQ[];
        total: number;
        page: number;
        limit: number;
    }> {
        const skip = (page - 1) * limit;

        const where: Prisma.RFQWhereInput = {
            tenantId,
            deletedAt: null,
        };

        if (filters?.status) {
            where.status = filters.status;
        }

        if (filters?.prId) {
            where.prId = filters.prId;
        }

        if (filters?.search) {
            where.OR = [
                { title: { contains: filters.search, mode: 'insensitive' } },
                { rfqNumber: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.rFQ.findMany({
                where,
                skip,
                take: limit,
                include: {
                    purchaseRequisition: true,
                    creator: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    quotations: {
                        include: {
                            vendor: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            }),
            this.prisma.rFQ.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
        };
    }

    async findOne(id: string, tenantId: string): Promise<RFQ> {
        const rfq = await this.prisma.rFQ.findFirst({
            where: {
                id,
                tenantId,
                deletedAt: null,
            },
            include: {
                purchaseRequisition: true,
                creator: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                quotations: {
                    include: {
                        vendor: true,
                        currency: true,
                    },
                },
            },
        });

        if (!rfq) {
            throw new NotFoundException('RFQ not found');
        }

        return rfq;
    }

    async update(
        id: string,
        updateRFQDto: UpdateRFQDto,
        tenantId: string,
        userId: string,
    ): Promise<RFQ> {
        const rfq = await this.findOne(id, tenantId);

        if (rfq.status !== RFQStatus.DRAFT) {
            throw new BadRequestException('Only DRAFT RFQs can be updated');
        }

        const updated = await this.prisma.rFQ.update({
            where: { id },
            data: updateRFQDto,
            include: {
                purchaseRequisition: true,
                creator: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                quotations: true,
            },
        });

        await this.audit.log({
            userId,
            action: 'UPDATE',
            targetType: 'RFQ',
            targetId: id,
            oldValues: rfq as any,
            newValues: updated as any,
        });

        return updated;
    }

    async publish(id: string, tenantId: string, userId: string): Promise<RFQ> {
        const rfq = await this.findOne(id, tenantId);

        if (rfq.status !== RFQStatus.DRAFT) {
            throw new BadRequestException('Only DRAFT RFQs can be published');
        }

        const published = await this.prisma.rFQ.update({
            where: { id },
            data: {
                status: RFQStatus.PUBLISHED,
                publishedAt: new Date(),
            },
            include: {
                purchaseRequisition: true,
                creator: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                quotations: true,
            },
        });

        await this.audit.log({
            userId,
            action: 'UPDATE',
            targetType: 'RFQ',
            targetId: id,
            oldValues: { status: rfq.status },
            newValues: { status: RFQStatus.PUBLISHED },
        });

        // Emit event for notification
        await this.events.emit('RFQ_PUBLISHED', {
            rfqId: id,
            rfqNumber: published.rfqNumber,
            title: published.title,
            targetVendorIds: published.targetVendorIds,
        });

        return published;
    }

    async close(id: string, tenantId: string, userId: string): Promise<RFQ> {
        const rfq = await this.findOne(id, tenantId);

        if (rfq.status !== RFQStatus.PUBLISHED) {
            throw new BadRequestException('Only PUBLISHED RFQs can be closed');
        }

        const closed = await this.prisma.rFQ.update({
            where: { id },
            data: {
                status: RFQStatus.CLOSED,
                closedAt: new Date(),
            },
            include: {
                purchaseRequisition: true,
                creator: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                quotations: {
                    include: {
                        vendor: true,
                    },
                },
            },
        });

        await this.audit.log({
            userId,
            action: 'UPDATE',
            targetType: 'RFQ',
            targetId: id,
            oldValues: { status: rfq.status },
            newValues: { status: RFQStatus.CLOSED },
        });

        return closed;
    }

    async cancel(id: string, tenantId: string, userId: string): Promise<RFQ> {
        const rfq = await this.findOne(id, tenantId);

        if (rfq.status === RFQStatus.AWARDED) {
            throw new BadRequestException('AWARDED RFQs cannot be cancelled');
        }

        const cancelled = await this.prisma.rFQ.update({
            where: { id },
            data: {
                status: RFQStatus.CANCELLED,
            },
            include: {
                purchaseRequisition: true,
                creator: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                quotations: true,
            },
        });

        await this.audit.log({
            userId,
            action: 'UPDATE',
            targetType: 'RFQ',
            targetId: id,
            oldValues: { status: rfq.status },
            newValues: { status: RFQStatus.CANCELLED },
        });

        return cancelled;
    }

    async delete(id: string, tenantId: string, userId: string): Promise<void> {
        const rfq = await this.findOne(id, tenantId);

        if (rfq.status !== RFQStatus.DRAFT) {
            throw new BadRequestException('Only DRAFT RFQs can be deleted');
        }

        await this.prisma.rFQ.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        await this.audit.log({
            userId,
            action: 'DELETE',
            targetType: 'RFQ',
            targetId: id,
        });
    }

    private async generateRFQNumber(): Promise<string> {
        const count = await this.prisma.rFQ.count();
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        return `RFQ-${year}${month}-${String(count + 1).padStart(5, '0')}`;
    }
}
