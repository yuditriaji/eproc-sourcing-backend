import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserRoleEnum } from "@prisma/client";
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, PaymentStatus } from '@prisma/client';
import {
  PaymentService,
  CreatePaymentDto,
  UpdatePaymentDto,
  ApprovePaymentDto,
  ProcessPaymentDto,
} from './payment.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller(':tenant/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create a new payment' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createDto: CreatePaymentDto, @Request() req: any) {
    return this.paymentService.create(createDto, req.user.id);
  }

  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.VENDOR, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get all payments' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'poId', required: false })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async findAll(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('poId') poId?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    return this.paymentService.findAll(
      req.user.tenantId,
      req.user.role,
      req.user.id,
      pageNum,
      limitNum,
      status as PaymentStatus,
      poId,
    );
  }

  @Get(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.VENDOR, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.paymentService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Update payment' })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePaymentDto,
    @Request() req: any,
  ) {
    return this.paymentService.update(
      id,
      updateDto,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/approve')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Approve payment' })
  @ApiResponse({ status: 200, description: 'Payment approved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApprovePaymentDto,
    @Request() req: any,
  ) {
    return this.paymentService.approve(
      id,
      dto,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/process')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Process payment' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async process(
    @Param('id') id: string,
    @Body() dto: ProcessPaymentDto,
    @Request() req: any,
  ) {
    return this.paymentService.process(
      id,
      dto,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/receive')
  @Roles(UserRoleEnum.VENDOR)
  @ApiOperation({ summary: 'Mark payment as received (vendor)' })
  @ApiResponse({ status: 200, description: 'Payment receipt recorded' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async receive(
    @Param('id') id: string,
    @Body() dto: { receivedAt: string },
    @Request() req: any,
  ) {
    return this.paymentService.receive(
      id,
      new Date(dto.receivedAt),
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/fail')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Mark payment as failed' })
  @ApiResponse({ status: 200, description: 'Payment marked as failed' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async fail(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @Request() req: any,
  ) {
    return this.paymentService.fail(
      id,
      dto.reason,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/cancel')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Cancel payment' })
  @ApiResponse({ status: 200, description: 'Payment cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel processed payment' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @Request() req: any,
  ) {
    return this.paymentService.cancel(
      id,
      dto.reason,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Delete payment' })
  @ApiResponse({ status: 200, description: 'Payment deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete approved/processed payment',
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.paymentService.delete(id, req.user.tenantId, req.user.id);
    return { message: 'Payment deleted successfully' };
  }
}
