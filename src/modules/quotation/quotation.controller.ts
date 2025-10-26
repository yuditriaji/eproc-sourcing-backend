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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  QuotationService,
  CreateQuotationDto,
  UpdateQuotationDto,
} from './quotation.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Quotations')
@ApiBearerAuth()
@Controller(':tenant/quotations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Post()
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new quotation' })
  @ApiResponse({ status: 201, description: 'Quotation created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createDto: CreateQuotationDto, @Request() req: any) {
    return this.quotationService.create(createDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER, UserRole.VENDOR, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get all quotations' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'Quotations retrieved successfully',
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Request() req: any,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    return this.quotationService.findAll(
      req.user.tenantId,
      req.user.role,
      req.user.id,
      pageNum,
      limitNum,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.USER, UserRole.VENDOR, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get quotation by ID' })
  @ApiResponse({
    status: 200,
    description: 'Quotation retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.quotationService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.USER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Update quotation' })
  @ApiResponse({
    status: 200,
    description: 'Quotation updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateQuotationDto,
    @Request() req: any,
  ) {
    return this.quotationService.update(
      id,
      updateDto,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete quotation' })
  @ApiResponse({
    status: 200,
    description: 'Quotation deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.quotationService.delete(id, req.user.tenantId, req.user.id);
    return { message: 'Quotation deleted successfully' };
  }
}
