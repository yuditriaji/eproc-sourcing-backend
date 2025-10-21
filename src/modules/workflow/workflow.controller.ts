import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { WorkflowService } from './workflow.service';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { ApiTags, ApiOperation, ApiResponse as ApiResponseDoc, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Workflow')
@ApiBearerAuth()
@Controller(':tenant/workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // ============================================================================
  // PROCUREMENT WORKFLOW 1: Contract → PR → PO → Goods Receipt → Invoice → Payment
  // ============================================================================

@Post('procurement/initiate/:contractId')
@Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
@ApiOperation({ summary: 'Initiate procurement workflow from a contract' })
@ApiResponseDoc({ status: 200, description: 'Workflow initiated' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
async initiateProcurement(
    @Param('contractId') contractId: string,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.initiateProcurementFromContract(
        contractId,
        req.user.id,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to initiate procurement workflow',
        errors: [error.message],
      };
    }
  }

@Post('procurement/create-pr/:contractId')
@Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
@ApiOperation({ summary: 'Create Purchase Requisition (PR) from a contract' })
@ApiResponseDoc({ status: 201, description: 'PR created successfully' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
async createPRFromContract(
    @Param('contractId') contractId: string,
    @Body() prData: {
      title: string;
      description?: string;
      items: any;
      estimatedAmount?: number;
      requiredBy?: string;
      justification?: string;
    },
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.createPRFromContract(
        contractId,
        {
          ...prData,
          requiredBy: prData.requiredBy ? new Date(prData.requiredBy) : undefined,
        },
        req.user.id,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.CREATED : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create PR from contract',
        errors: [error.message],
      };
    }
  }

@Post('procurement/approve-pr/:prId')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.APPROVER)
@ApiOperation({ summary: 'Approve or reject a Purchase Requisition (PR)' })
@ApiResponseDoc({ status: 200, description: 'PR approved/rejected' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
async approvePR(
    @Param('prId') prId: string,
    @Body() approvalData: {
      approved: boolean;
      comments?: string;
    },
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.approvePR(
        prId,
        req.user.id,
        approvalData.approved,
        approvalData.comments,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to approve PR',
        errors: [error.message],
      };
    }
  }

@Post('procurement/create-po/:prId')
@Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
@ApiOperation({ summary: 'Create Purchase Order (PO) from an approved PR' })
@ApiResponseDoc({ status: 201, description: 'PO created successfully' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
async createPOFromPR(
    @Param('prId') prId: string,
    @Body() poData: {
      vendorIds: string[];
    },
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.createPOFromPR(
        prId,
        poData.vendorIds,
        req.user.id,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.CREATED : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create PO from PR',
        errors: [error.message],
      };
    }
  }

@Post('procurement/approve-po/:poId')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE, UserRole.APPROVER)
@ApiOperation({ summary: 'Approve or reject a Purchase Order (PO)' })
@ApiResponseDoc({ status: 200, description: 'PO approved/rejected' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
async approvePO(
    @Param('poId') poId: string,
    @Body() approvalData: {
      approved: boolean;
      comments?: string;
    },
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.approvePO(
        poId,
        req.user.id,
        approvalData.approved,
        approvalData.comments,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to approve PO',
        errors: [error.message],
      };
    }
  }

@Post('procurement/goods-receipt/:poId')
@Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
@ApiOperation({ summary: 'Create Goods Receipt for a PO' })
@ApiResponseDoc({ status: 201, description: 'Goods Receipt created successfully' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
async createGoodsReceipt(
    @Param('poId') poId: string,
    @Body() receiptData: {
      receivedDate?: string;
      receivedItems: any;
      notes?: string;
      inspectionNotes?: string;
      inspectedBy?: string;
    },
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.createGoodsReceipt(
        poId,
        {
          ...receiptData,
          receivedDate: receiptData.receivedDate ? new Date(receiptData.receivedDate) : undefined,
        },
        req.user.id,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.CREATED : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create goods receipt',
        errors: [error.message],
      };
    }
  }

  // ============================================================================
  // TENDER WORKFLOW 2: Create Tender → Vendor Submission → Evaluation → Award
  // ============================================================================

@Post('tender/create/:contractId')
@Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
@ApiOperation({ summary: 'Create Tender from a Contract' })
@ApiResponseDoc({ status: 201, description: 'Tender created successfully' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
async createTenderFromContract(
    @Param('contractId') contractId: string,
    @Body() tenderData: {
      title: string;
      description: string;
      requirements: any;
      criteria: any;
      estimatedValue?: number;
      closingDate: string;
      category?: string;
      department?: string;
    },
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.createTenderFromContract(
        contractId,
        {
          ...tenderData,
          closingDate: new Date(tenderData.closingDate),
        },
        req.user.id,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.CREATED : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create tender from contract',
        errors: [error.message],
      };
    }
  }

@Post('tender/publish/:tenderId')
@Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
@ApiOperation({ summary: 'Publish a Tender' })
@ApiResponseDoc({ status: 200, description: 'Tender published successfully' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
async publishTender(
    @Param('tenderId') tenderId: string,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.publishTender(tenderId, req.user.id);

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to publish tender',
        errors: [error.message],
      };
    }
  }

@Post('tender/submit-bid/:tenderId')
@Roles(UserRole.VENDOR)
@ApiOperation({ summary: 'Submit Bid for a Tender (Vendor)' })
@ApiResponseDoc({ status: 201, description: 'Bid submitted successfully' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
@ApiResponseDoc({ status: 404, description: 'Tender not found' })
async submitBid(
    @Param('tenderId') tenderId: string,
    @Body() bidData: {
      bidAmount?: number;
      technicalProposal?: any;
      financialProposal?: any;
      compliance?: any;
    },
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.submitBid(
        tenderId,
        req.user.id, // Assuming vendor user ID
        bidData,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.CREATED : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to submit bid',
        errors: [error.message],
      };
    }
  }

@Post('tender/close/:tenderId')
@Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
@ApiOperation({ summary: 'Close a Tender' })
@ApiResponseDoc({ status: 200, description: 'Tender closed successfully' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
@ApiResponseDoc({ status: 404, description: 'Tender not found' })
async closeTender(
    @Param('tenderId') tenderId: string,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.closeTender(tenderId, req.user.id);

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to close tender',
        errors: [error.message],
      };
    }
  }

@Post('tender/evaluate-bid/:bidId')
@Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
@ApiOperation({ summary: 'Evaluate a Bid' })
@ApiResponseDoc({ status: 200, description: 'Bid evaluated successfully' })
@ApiResponseDoc({ status: 400, description: 'Bad request' })
@ApiResponseDoc({ status: 401, description: 'Unauthorized' })
@ApiResponseDoc({ status: 403, description: 'Forbidden' })
@ApiResponseDoc({ status: 404, description: 'Bid not found' })
async evaluateBid(
    @Param('bidId') bidId: string,
    @Body() evaluation: {
      technicalScore: number;
      commercialScore: number;
      evaluationNotes?: string;
    },
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.evaluateBid(
        bidId,
        evaluation,
        req.user.id,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to evaluate bid',
        errors: [error.message],
      };
    }
  }

  @Post('tender/award/:tenderId/:winningBidId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async awardTender(
    @Param('tenderId') tenderId: string,
    @Param('winningBidId') winningBidId: string,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const result = await this.workflowService.awardTender(
        tenderId,
        winningBidId,
        req.user.id,
      );

      return {
        success: result.success,
        statusCode: result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        message: result.message,
        data: result.data,
        meta: result.nextSteps ? { nextSteps: result.nextSteps } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to award tender',
        errors: [error.message],
      };
    }
  }

  // ============================================================================
  // WORKFLOW STATUS TRACKING
  // ============================================================================

  @Get('status/:entityType/:entityId')
  @Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER, UserRole.FINANCE, UserRole.VENDOR)
  async getWorkflowStatus(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<ApiResponse> {
    try {
      const status = await this.workflowService.getWorkflowStatus(entityType, entityId);

      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Workflow status retrieved successfully',
        data: status,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve workflow status',
        errors: [error.message],
      };
    }
  }
}