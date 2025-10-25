import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import { EventService } from "../events/event.service";
import { ContractService } from "../contract/contract.service";
import { PurchaseRequisitionService } from "../purchase-requisition/purchase-requisition.service";
import { PurchaseOrderService } from "../purchase-order/purchase-order.service";
import { TenderService } from "../tender/tender.service";
import {
  ContractStatus,
  PRStatus,
  POStatus,
  TenderStatus,
  BidStatus,
  PaymentType,
  UserRole,
} from "@prisma/client";

export interface WorkflowTransitionResult {
  success: boolean;
  message: string;
  nextSteps?: string[];
  data?: any;
}

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    private events: EventService,
    private contractService: ContractService,
    private prService: PurchaseRequisitionService,
    private poService: PurchaseOrderService,
    private tenderService: TenderService,
  ) {}

  /**
   * Procurement Workflow 1: Contract → PR → PO → Goods Receipt → Invoice → Payment
   */

  async initiateProcurementFromContract(
    contractId: string,
    userId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      const contract = await this.contractService.findOne(contractId);

      if (contract.status !== ContractStatus.IN_PROGRESS) {
        return {
          success: false,
          message:
            "Contract must be in progress to create purchase requisitions",
        };
      }

      return {
        success: true,
        message: "Contract is ready for purchase requisition creation",
        nextSteps: [
          "Create Purchase Requisition",
          "Define required items and specifications",
          "Set required delivery date",
          "Submit for approval",
        ],
        data: { contractId, contractTitle: contract.title },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to validate contract: ${error.message}`,
      };
    }
  }

  async createPRFromContract(
    contractId: string,
    prData: {
      title: string;
      description?: string;
      items: any;
      estimatedAmount?: number;
      requiredBy?: Date;
      justification?: string;
    },
    requesterId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      const pr = await this.prService.create(
        {
          ...prData,
          contractId,
        },
        requesterId,
      );

      // Trigger notification for approvers
      await this.events.emit("workflow.pr_created_from_contract", {
        prId: pr.id,
        contractId,
        requesterId,
      });

      return {
        success: true,
        message: "Purchase Requisition created successfully",
        nextSteps: [
          "Wait for manager approval",
          "Finance team review (if amount > threshold)",
          "Final approval before PO creation",
        ],
        data: pr,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create PR: ${error.message}`,
      };
    }
  }

  async approvePR(
    prId: string,
    approverId: string,
    approved: boolean,
    comments?: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      const updatedPR = await this.prService.approve(
        prId,
        {
          approved,
          rejectionReason: !approved ? comments : undefined,
          comments,
        },
        approverId,
      );

      if (approved) {
        return {
          success: true,
          message: "Purchase Requisition approved successfully",
          nextSteps: [
            "Create Purchase Order",
            "Select vendors",
            "Define delivery terms",
            "Submit PO for approval",
          ],
          data: updatedPR,
        };
      } else {
        return {
          success: true,
          message: "Purchase Requisition rejected",
          nextSteps: [
            "Requester can revise and resubmit",
            "Address rejection comments",
            "Update specifications if needed",
          ],
          data: updatedPR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to process PR approval: ${error.message}`,
      };
    }
  }

  async createPOFromPR(
    prId: string,
    vendorIds: string[],
    userId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      const po = await this.poService.createFromPR(prId, vendorIds, userId);

      // Notify vendors about new PO
      await this.events.emit("workflow.po_created_from_pr", {
        poId: po.id,
        prId,
        vendorIds,
        userId,
      });

      return {
        success: true,
        message: "Purchase Order created successfully",
        nextSteps: [
          "PO approval workflow",
          "Vendor confirmation",
          "Track delivery progress",
          "Goods receipt upon delivery",
        ],
        data: po,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create PO: ${error.message}`,
      };
    }
  }

  async approvePO(
    poId: string,
    approverId: string,
    approved: boolean,
    comments?: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      const updatedPO = await this.poService.approve(
        poId,
        {
          approved,
          rejectionReason: !approved ? comments : undefined,
          comments,
        },
        approverId,
      );

      if (approved) {
        // Transition to IN_PROGRESS status
        await this.poService.update(
          poId,
          {
            status: POStatus.IN_PROGRESS,
          },
          approverId,
        );

        return {
          success: true,
          message: "Purchase Order approved and sent to vendors",
          nextSteps: [
            "Vendor processes order",
            "Track delivery status",
            "Create goods receipt upon delivery",
            "Process vendor invoice",
          ],
          data: updatedPO,
        };
      } else {
        return {
          success: true,
          message: "Purchase Order rejected",
          nextSteps: [
            "Creator can revise PO",
            "Address rejection comments",
            "Resubmit for approval",
          ],
          data: updatedPO,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to process PO approval: ${error.message}`,
      };
    }
  }

  async createGoodsReceipt(
    poId: string,
    receiptData: {
      receivedDate?: Date;
      receivedItems: any;
      notes?: string;
      inspectionNotes?: string;
      inspectedBy?: string;
    },
    userId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      const receiptNumber = await this.generateReceiptNumber();

      const receipt = await this.prisma.goodsReceipt.create({
        data: {
          receiptNumber,
          poId,
          receivedDate: receiptData.receivedDate || new Date(),
          receivedItems: receiptData.receivedItems,
          notes: receiptData.notes,
          inspectionNotes: receiptData.inspectionNotes,
          inspectedBy: receiptData.inspectedBy,
          status: "COMPLETE", // Assuming full delivery for now
        } as any,
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

      // Update PO status to DELIVERED
      await this.poService.update(
        poId,
        {
          status: POStatus.DELIVERED,
        },
        userId,
      );

      // Trigger invoice creation workflow
      await this.events.emit("workflow.goods_received", {
        receiptId: receipt.id,
        poId,
        userId,
      });

      return {
        success: true,
        message: "Goods receipt created successfully",
        nextSteps: [
          "Vendor can now submit invoice",
          "Invoice verification against goods receipt",
          "Payment processing upon invoice approval",
        ],
        data: receipt,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create goods receipt: ${error.message}`,
      };
    }
  }

  /**
   * Tender/Quotation Workflow 2: Create Tender → Vendor Submission → Evaluation → Award
   */

  async createTenderFromContract(
    contractId: string,
    tenderData: {
      title: string;
      description: string;
      requirements: any;
      criteria: any;
      estimatedValue?: number;
      closingDate: Date;
      category?: string;
      department?: string;
    },
    creatorId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      const tenderNumber = await this.generateTenderNumber();

      const tender = await this.prisma.tender.create({
        data: {
          tenderNumber,
          title: tenderData.title,
          description: tenderData.description,
          requirements: tenderData.requirements,
          criteria: tenderData.criteria,
          estimatedValue: tenderData.estimatedValue,
          closingDate: tenderData.closingDate,
          category: tenderData.category,
          department: tenderData.department,
          contractId,
          creatorId,
          status: TenderStatus.DRAFT,
        } as any,
        include: {
          contract: true,
          creator: true,
        },
      });

      return {
        success: true,
        message: "Tender created successfully",
        nextSteps: [
          "Review tender details",
          "Publish tender to vendors",
          "Monitor vendor submissions",
          "Evaluate bids after closing date",
        ],
        data: tender,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create tender: ${error.message}`,
      };
    }
  }

  async publishTender(
    tenderId: string,
    userId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      // For now, we'll publish using the existing publish method
      const tender = await this.tenderService.publishTender(
        tenderId,
        userId,
        "ADMIN",
        "127.0.0.1",
        "WorkflowService",
      );

      // Notify eligible vendors
      await this.events.emit("workflow.tender_published", {
        tenderId,
        userId,
      });

      return {
        success: true,
        message: "Tender published successfully",
        nextSteps: [
          "Vendors can now submit bids",
          "Monitor bid submissions",
          "Answer vendor queries",
          "Close tender on specified date",
        ],
        data: tender,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to publish tender: ${error.message}`,
      };
    }
  }

  async submitBid(
    tenderId: string,
    vendorId: string,
    bidData: {
      bidAmount?: number;
      technicalProposal?: any;
      financialProposal?: any;
      compliance?: any;
    },
  ): Promise<WorkflowTransitionResult> {
    try {
      // Check if tender is still open
      const tender = await this.tenderService.getTenderById(
        tenderId,
        vendorId,
        "ADMIN",
      );

      if (tender.status !== TenderStatus.PUBLISHED) {
        return {
          success: false,
          message: "Tender is not open for submissions",
        };
      }

      if (tender.closingDate && new Date() > tender.closingDate) {
        return {
          success: false,
          message: "Tender submission deadline has passed",
        };
      }

      const bid = await this.prisma.bid.create({
        data: {
          tenderId,
          vendorId,
          bidAmount: bidData.bidAmount,
          technicalProposal: bidData.technicalProposal,
          financialProposal: bidData.financialProposal,
          compliance: bidData.compliance,
          status: BidStatus.SUBMITTED,
          submittedAt: new Date(),
        } as any,
        include: {
          tender: true,
          vendor: true,
        },
      });

      await this.events.emit("workflow.bid_submitted", {
        bidId: bid.id,
        tenderId,
        vendorId,
      });

      return {
        success: true,
        message: "Bid submitted successfully",
        nextSteps: [
          "Wait for tender closing",
          "Evaluation by procurement team",
          "Notification of results",
          "Contract award if successful",
        ],
        data: bid,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to submit bid: ${error.message}`,
      };
    }
  }

  async closeTender(
    tenderId: string,
    userId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      // Update tender status manually since UpdateTenderDto doesn't have status
      const tender = await this.prisma.tender.update({
        where: { id: tenderId },
        data: { status: TenderStatus.CLOSED },
      });

      // Get all submitted bids for evaluation
      const bids = await this.prisma.bid.findMany({
        where: {
          tenderId,
          status: BidStatus.SUBMITTED,
        },
        include: {
          vendor: true,
        },
      });

      await this.events.emit("workflow.tender_closed", {
        tenderId,
        userId,
        bidCount: bids.length,
      });

      return {
        success: true,
        message: `Tender closed successfully with ${bids.length} submissions`,
        nextSteps: [
          "Evaluate all submitted bids",
          "Score technical and commercial proposals",
          "Select winning vendor",
          "Award contract and create purchase order",
        ],
        data: { tender, bidCount: bids.length },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to close tender: ${error.message}`,
      };
    }
  }

  async evaluateBid(
    bidId: string,
    evaluation: {
      technicalScore: number;
      commercialScore: number;
      evaluationNotes?: string;
    },
    evaluatorId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      const totalScore =
        (evaluation.technicalScore + evaluation.commercialScore) / 2;

      const bid = await this.prisma.bid.update({
        where: { id: bidId },
        data: {
          technicalScore: evaluation.technicalScore,
          commercialScore: evaluation.commercialScore,
          totalScore,
          evaluationNotes: evaluation.evaluationNotes,
          evaluatedAt: new Date(),
          evaluatedBy: evaluatorId,
          status: BidStatus.UNDER_REVIEW,
        },
        include: {
          tender: true,
          vendor: true,
        },
      });

      return {
        success: true,
        message: "Bid evaluation completed",
        nextSteps: [
          "Complete evaluation of all bids",
          "Compare scores and rankings",
          "Select winning bid",
          "Award tender to selected vendor",
        ],
        data: bid,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to evaluate bid: ${error.message}`,
      };
    }
  }

  async awardTender(
    tenderId: string,
    winningBidId: string,
    userId: string,
  ): Promise<WorkflowTransitionResult> {
    try {
      // Update tender status
      // Update tender status manually
      await this.prisma.tender.update({
        where: { id: tenderId },
        data: {
          status: TenderStatus.AWARDED,
          awardDate: new Date(),
        },
      });

      // Update winning bid
      const winningBid = await this.prisma.bid.update({
        where: { id: winningBidId },
        data: {
          status: BidStatus.ACCEPTED,
        },
        include: {
          tender: true,
          vendor: true,
        },
      });

      // Update other bids to rejected
      await this.prisma.bid.updateMany({
        where: {
          tenderId,
          id: { not: winningBidId },
          status: { in: [BidStatus.SUBMITTED, BidStatus.UNDER_REVIEW] },
        },
        data: {
          status: BidStatus.REJECTED,
        },
      });

      // Create purchase order from winning bid
      if (winningBid.tender.contractId) {
        await this.poService.create(
          {
            title: `PO for Tender: ${winningBid.tender.title}`,
            description: `Purchase Order created from awarded tender ${winningBid.tender.tenderNumber}`,
            amount: Number(
              winningBid.bidAmount || winningBid.tender.estimatedValue || 0,
            ),
            items: winningBid.technicalProposal || {},
            contractId: winningBid.tender.contractId,
            vendorIds: [winningBid.vendorId],
          },
          userId,
        );
      }

      await this.events.emit("workflow.tender_awarded", {
        tenderId,
        winningBidId,
        vendorId: winningBid.vendorId,
        userId,
      });

      return {
        success: true,
        message: "Tender awarded successfully",
        nextSteps: [
          "Purchase Order created automatically",
          "Notify winning and losing vendors",
          "Begin contract execution",
          "Track delivery and performance",
        ],
        data: winningBid,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to award tender: ${error.message}`,
      };
    }
  }

  // Helper methods
  private async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const count = (await this.prisma.goodsReceipt.count()) + 1;
    const sequence = String(count).padStart(4, "0");
    return `GR-${year}${month}-${sequence}`;
  }

  private async generateTenderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const count = (await this.prisma.tender.count()) + 1;
    const sequence = String(count).padStart(4, "0");
    return `TDR-${year}${month}-${sequence}`;
  }

  // Workflow status tracking
  async getWorkflowStatus(entityType: string, entityId: string): Promise<any> {
    switch (entityType.toLowerCase()) {
      case "contract":
        return this.getContractWorkflowStatus(entityId);
      case "tender":
        return this.getTenderWorkflowStatus(entityId);
      case "pr":
        return this.getPRWorkflowStatus(entityId);
      case "po":
        return this.getPOWorkflowStatus(entityId);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async getContractWorkflowStatus(contractId: string) {
    const contract = await this.contractService.findOne(contractId);
    const prs = await this.prisma.purchaseRequisition.count({
      where: { contractId, deletedAt: null },
    });
    const pos = await this.prisma.purchaseOrder.count({
      where: { contractId, deletedAt: null },
    });
    const tenders = await this.prisma.tender.count({
      where: { contractId, deletedAt: null },
    });

    return {
      status: contract.status,
      purchaseRequisitions: prs,
      purchaseOrders: pos,
      tenders,
      canCreatePR: contract.status === ContractStatus.IN_PROGRESS,
      canCreateTender: contract.status === ContractStatus.IN_PROGRESS,
    };
  }

  private async getTenderWorkflowStatus(tenderId: string) {
    const tender = await this.tenderService.getTenderById(
      tenderId,
      "system",
      "ADMIN",
    );
    const bids = await this.prisma.bid.findMany({
      where: { tenderId },
      include: {
        vendor: true,
      },
    });

    return {
      status: tender.status,
      totalBids: bids.length,
      submittedBids: bids.filter((b) => b.status === BidStatus.SUBMITTED)
        .length,
      evaluatedBids: bids.filter((b) => b.status === BidStatus.UNDER_REVIEW)
        .length,
      acceptedBids: bids.filter((b) => b.status === BidStatus.ACCEPTED).length,
      canSubmitBid:
        tender.status === TenderStatus.PUBLISHED &&
        tender.closingDate &&
        new Date() <= tender.closingDate,
      canEvaluate: tender.status === TenderStatus.CLOSED,
      canAward:
        tender.status === TenderStatus.CLOSED &&
        bids.some((b) => b.status === BidStatus.UNDER_REVIEW),
    };
  }

  private async getPRWorkflowStatus(prId: string) {
    const pr = await this.prService.findOne(prId);
    return {
      status: pr.status,
      canEdit: pr.status === PRStatus.PENDING,
      canApprove: pr.status === PRStatus.PENDING,
      canCreatePO: pr.status === PRStatus.APPROVED,
      linkedPOs: 0, // Will be populated when relations are available
    };
  }

  private async getPOWorkflowStatus(poId: string) {
    const po = await this.poService.findOne(poId);
    return {
      status: po.status,
      canEdit: po.status === POStatus.DRAFT,
      canApprove: po.status === POStatus.DRAFT,
      canReceive: po.status === POStatus.IN_PROGRESS,
      receipts: 0, // Will be populated when relations are available
      invoices: 0, // Will be populated when relations are available
      payments: 0, // Will be populated when relations are available
    };
  }
}
