import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { BudgetService } from './budget.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CreateBudgetDto,
  CreateBudgetDtoSchema,
  AllocateBudgetDto,
  AllocateBudgetDtoSchema,
  TransferBudgetDto,
  TransferBudgetDtoSchema,
  BudgetUsageQueryDto,
  BudgetUsageQueryDtoSchema,
} from '../../common/dto/budget.dto';

@ApiTags('Budget Control')
@ApiBearerAuth()
@Controller(':tenant/budgets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER)
  @UsePipes(new ZodValidationPipe(CreateBudgetDtoSchema))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new budget',
    description:
      'Create a budget for an organization unit for a specific fiscal year. Only ADMIN, FINANCE, or MANAGER roles can create budgets.',
  })
  @ApiResponse({
    status: 201,
    description: 'Budget created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Budget already exists or validation error',
  })
  async create(
    @Param('tenant') tenant: string,
    @Body() createBudgetDto: CreateBudgetDto,
    @Request() req,
  ) {
    return this.budgetService.create(
      req.user.tenantId,
      createBudgetDto,
      req.user.userId,
    );
  }

  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER, UserRoleEnum.USER)
  @ApiOperation({
    summary: 'Get all budgets',
    description:
      'Retrieve all budgets for the tenant, optionally filtered by fiscal year and organization unit.',
  })
  @ApiQuery({ name: 'fiscalYear', required: false, type: String })
  @ApiQuery({ name: 'orgUnitId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Budgets retrieved successfully' })
  async findAll(
    @Param('tenant') tenant: string,
    @Query('fiscalYear') fiscalYear?: string,
    @Query('orgUnitId') orgUnitId?: string,
    @Request() req?,
  ) {
    return this.budgetService.findAll(req.user.tenantId, fiscalYear, orgUnitId);
  }

  @Get(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER, UserRoleEnum.USER)
  @ApiOperation({
    summary: 'Get budget details',
    description:
      'Retrieve detailed information about a specific budget including allocations and transfers.',
  })
  @ApiResponse({ status: 200, description: 'Budget retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async findOne(
    @Param('tenant') tenant: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.budgetService.findOne(req.user.tenantId, id);
  }

  @Post(':id/allocate')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER)
  @UsePipes(new ZodValidationPipe(AllocateBudgetDtoSchema))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Allocate budget to child organization units',
    description:
      'Allocate portions of a budget to child organization units. The total allocated amount is deducted from the source budget.',
  })
  @ApiResponse({ status: 200, description: 'Budget allocated successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient budget or validation error' })
  @ApiResponse({ status: 404, description: 'Budget or organization unit not found' })
  async allocate(
    @Param('tenant') tenant: string,
    @Body() allocateDto: AllocateBudgetDto,
    @Request() req,
  ) {
    return this.budgetService.allocate(
      req.user.tenantId,
      allocateDto,
      req.user.userId,
    );
  }

  @Post('transfer')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER)
  @UsePipes(new ZodValidationPipe(TransferBudgetDtoSchema))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transfer budget between organization units',
    description:
      'Transfer budget from one organization unit to another (same-level or cross-level). The transfer is traceable to all downstream transactions.',
  })
  @ApiResponse({ status: 200, description: 'Budget transferred successfully' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient budget, different fiscal years, or validation error',
  })
  @ApiResponse({ status: 404, description: 'Source or target budget not found' })
  async transfer(
    @Param('tenant') tenant: string,
    @Body() transferDto: TransferBudgetDto,
    @Request() req,
  ) {
    return this.budgetService.transfer(
      req.user.tenantId,
      transferDto,
      req.user.userId,
    );
  }

  @Get(':id/usage')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER, UserRoleEnum.USER)
  @UsePipes(new ZodValidationPipe(BudgetUsageQueryDtoSchema))
  @ApiOperation({
    summary: 'Get budget usage report',
    description:
      'Generate a comprehensive usage report showing allocations, transfers, and consumption at PO/Invoice item level with full traceability.',
  })
  @ApiQuery({ name: 'traceId', required: false, type: String, description: 'Filter by transfer trace ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter by start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter by end date (ISO format)' })
  @ApiResponse({
    status: 200,
    description: 'Budget usage report generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async getUsageReport(
    @Param('tenant') tenant: string,
    @Param('id') id: string,
    @Query('traceId') traceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?,
  ) {
    const query: BudgetUsageQueryDto = {
      budgetId: id,
      traceId,
      startDate,
      endDate,
    };

    return this.budgetService.usageReport(req.user.tenantId, query);
  }
}
