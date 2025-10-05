import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import { AbilityFactory, Action } from '../auth/abilities/ability.factory';
import * as crypto from 'crypto';

export interface CreateBidDto {
  tenderId: string;
  technicalProposal: any;
  commercialProposal: any;
  financialProposal: any;
  documents?: any[];
}

export interface UpdateBidDto {
  technicalProposal?: any;
  commercialProposal?: any;
  financialProposal?: any;
  documents?: any[];
}

@Injectable()
export class BidService {
  constructor(
    private prismaService: PrismaService,
    private auditService: AuditService,
    private eventService: EventService,
    private abilityFactory: AbilityFactory,
  ) {}

  async createBid(
    createBidDto: CreateBidDto,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    // Only vendors can create bids
    if (userRole !== 'VENDOR') {
      throw new ForbiddenException('Only vendors can create bids');
    }

    // Check if tender exists and is published
    const tender = await this.prismaService.tender.findUnique({
      where: { id: createBidDto.tenderId },
    });

    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    if (tender.status !== 'PUBLISHED') {
      throw new BadRequestException('Cannot bid on unpublished tender');
    }

    // Check if tender is still open
    if (tender.closingDate && new Date() > tender.closingDate) {
      throw new BadRequestException('Tender has closed');
    }

    // Check if vendor has already submitted a bid
    const existingBid = await this.prismaService.bid.findUnique({
      where: {
        tenderId_vendorId: {
          tenderId: createBidDto.tenderId,
          vendorId: userId,
        },
      },
    });

    if (existingBid) {
      throw new BadRequestException('Bid already exists for this tender');
    }

    // Encrypt sensitive bid data
    const encryptedData = this.encryptSensitiveData({
      technicalProposal: createBidDto.technicalProposal,
      commercialProposal: createBidDto.commercialProposal,
      financialProposal: createBidDto.financialProposal,
    });

    const bid = await this.prismaService.bid.create({
      data: {
        tenderId: createBidDto.tenderId,
        vendorId: userId,
        encryptedData,
        status: 'DRAFT',
      },
      include: {
        tender: {
          select: {
            title: true,
            status: true,
          },
        },
        vendor: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: 'bid_created',
      targetType: 'Bid',
      targetId: bid.id,
      newValues: { bidId: bid.id, tenderId: createBidDto.tenderId },
      ipAddress,
      userAgent,
    });

    // Emit event
    await this.eventService.emit('bid.created', {
      bidId: bid.id,
      tenderId: createBidDto.tenderId,
      vendorId: userId,
    });

    return bid;
  }

  async getBids(
    userId: string,
    userRole: string,
    filters?: {
      tenderId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = {};

    // Apply role-based filtering
    switch (userRole) {
      case 'ADMIN':
        // Admin can see all bids
        break;
      case 'USER':
        // Users can see bids for their tenders
        const userTenders = await this.prismaService.tender.findMany({
          where: { creatorId: userId },
          select: { id: true },
        });
        where.tenderId = { in: userTenders.map(t => t.id) };
        break;
      case 'VENDOR':
        // Vendors can only see their own bids
        where.vendorId = userId;
        break;
      default:
        throw new ForbiddenException('Invalid user role');
    }

    // Apply additional filters
    if (filters?.tenderId) where.tenderId = filters.tenderId;
    if (filters?.status) where.status = filters.status;

    const bids = await this.prismaService.bid.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
      include: {
        tender: {
          select: {
            title: true,
            status: true,
            closingDate: true,
          },
        },
        vendor: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    // Decrypt sensitive data if user has access
    return bids.map(bid => {
      if (userRole === 'VENDOR' && bid.vendorId !== userId) {
        // Vendors cannot see other vendors' bid details
        delete bid.encryptedData;
      } else if (bid.encryptedData) {
        try {
          (bid as any).decryptedData = this.decryptSensitiveData(bid.encryptedData);
        } catch (error) {
          // If decryption fails, remove encrypted data
          delete (bid as any).encryptedData;
        }
      }
      return bid;
    });
  }

  async getBidById(bidId: string, userId: string, userRole: string) {
    const bid = await this.prismaService.bid.findUnique({
      where: { id: bidId },
      include: {
        tender: {
          select: {
            title: true,
            status: true,
            closingDate: true,
            creatorId: true,
          },
        },
        vendor: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    // Check access permissions
    const canAccess = 
      userRole === 'ADMIN' ||
      (userRole === 'VENDOR' && bid.vendorId === userId) ||
      (userRole === 'USER' && bid.tender.creatorId === userId);

    if (!canAccess) {
      throw new ForbiddenException('Access denied to this bid');
    }

    // Decrypt sensitive data if authorized
    if (bid.encryptedData) {
      try {
        (bid as any).decryptedData = this.decryptSensitiveData(bid.encryptedData);
      } catch (error) {
        delete (bid as any).encryptedData;
      }
    }

    return bid;
  }

  async updateBid(
    bidId: string,
    updateBidDto: UpdateBidDto,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const existingBid = await this.prismaService.bid.findUnique({
      where: { id: bidId },
      include: {
        tender: true,
      },
    });

    if (!existingBid) {
      throw new NotFoundException('Bid not found');
    }

    // Only vendors can update their own bids
    if (userRole !== 'VENDOR' || existingBid.vendorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Cannot update submitted bids
    if (existingBid.status !== 'DRAFT') {
      throw new BadRequestException('Cannot update submitted bid');
    }

    // Check if tender is still open
    if (existingBid.tender.closingDate && new Date() > existingBid.tender.closingDate) {
      throw new BadRequestException('Tender has closed');
    }

    // Encrypt sensitive updated data
    const encryptedData = this.encryptSensitiveData({
      technicalProposal: updateBidDto.technicalProposal,
      commercialProposal: updateBidDto.commercialProposal,
      financialProposal: updateBidDto.financialProposal,
    });

    const updatedBid = await this.prismaService.bid.update({
      where: { id: bidId },
      data: {
        encryptedData,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: 'bid_updated',
      targetType: 'Bid',
      targetId: bidId,
      oldValues: { status: existingBid.status },
      newValues: { status: 'DRAFT', updated: true },
      ipAddress,
      userAgent,
    });

    // Emit event
    await this.eventService.emit('bid.updated', {
      bidId,
      vendorId: userId,
      tenderId: existingBid.tenderId,
    });

    return updatedBid;
  }

  async submitBid(
    bidId: string,
    userId: string,
    userRole: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const bid = await this.prismaService.bid.findUnique({
      where: { id: bidId },
      include: {
        tender: true,
      },
    });

    if (!bid) {
      throw new NotFoundException('Bid not found');
    }

    // Only vendors can submit their own bids
    if (userRole !== 'VENDOR' || bid.vendorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (bid.status !== 'DRAFT') {
      throw new BadRequestException('Bid has already been submitted');
    }

    // Check if tender is still open
    if (bid.tender.closingDate && new Date() > bid.tender.closingDate) {
      throw new BadRequestException('Tender has closed');
    }

    const submittedBid = await this.prismaService.bid.update({
      where: { id: bidId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: 'bid_submitted',
      targetType: 'Bid',
      targetId: bidId,
      oldValues: { status: 'DRAFT' },
      newValues: { status: 'SUBMITTED' },
      ipAddress,
      userAgent,
    });

    // Emit event to trigger scoring workflow
    await this.eventService.emit('bid.submitted', {
      bidId,
      tenderId: bid.tenderId,
      vendorId: userId,
      submittedAt: new Date(),
    });

    return submittedBid;
  }

  private encryptSensitiveData(data: any): string {
    try {
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'fallback-key', 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return JSON.stringify({
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      });
    } catch (error) {
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  private decryptSensitiveData(encryptedString: string): any {
    try {
      const { encrypted, iv, authTag } = JSON.parse(encryptedString);
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'fallback-key', 'salt', 32);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt sensitive data');
    }
  }
}