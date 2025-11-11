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
import { UserRoleEnum, InvoiceStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  InvoiceService,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  ApproveInvoiceDto,
  DisputeInvoiceDto,
} from './invoice.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller(':tenant/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @Roles(UserRoleEnum.VENDOR, UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Create a new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createDto: CreateInvoiceDto, @Request() req: any) {
    return this.invoiceService.create(createDto, req.user.id);
  }

  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.VENDOR, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get all invoices' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  async findAll(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    
    return this.invoiceService.findAll(
      req.user.tenantId,
      req.user.role,
      req.user.id,
      pageNum,
      limitNum,
      status as InvoiceStatus,
      vendorId,
    );
  }

  @Get(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.VENDOR, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.invoiceService.findOne(id, req.user.tenantId);
  }

  @Get(':id/items')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.VENDOR, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get invoice items' })
  @ApiResponse({ status: 200, description: 'Invoice items retrieved' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getItems(@Param('id') id: string, @Request() req: any) {
    const invoice = await this.invoiceService.findOne(id, req.user.tenantId);
    return invoice.items;
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.VENDOR)
  @ApiOperation({ summary: 'Update invoice' })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateInvoiceDto,
    @Request() req: any,
  ) {
    return this.invoiceService.update(
      id,
      updateDto,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/approve')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Approve invoice' })
  @ApiResponse({ status: 200, description: 'Invoice approved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveInvoiceDto,
    @Request() req: any,
  ) {
    return this.invoiceService.approve(
      id,
      dto,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/status')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Update invoice status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: { status: InvoiceStatus },
    @Request() req: any,
  ) {
    return this.invoiceService.updateStatus(
      id,
      dto.status,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/dispute')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Dispute invoice' })
  @ApiResponse({ status: 200, description: 'Invoice disputed successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async dispute(
    @Param('id') id: string,
    @Body() dto: DisputeInvoiceDto,
    @Request() req: any,
  ) {
    return this.invoiceService.dispute(
      id,
      dto,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/cancel')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Cancel invoice' })
  @ApiResponse({ status: 200, description: 'Invoice cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel paid invoice' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @Request() req: any,
  ) {
    return this.invoiceService.cancel(
      id,
      dto.reason,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.FINANCE)
  @ApiOperation({ summary: 'Delete invoice' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete approved/paid invoice' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.invoiceService.delete(id, req.user.tenantId, req.user.id);
    return { message: 'Invoice deleted successfully' };
  }
}
