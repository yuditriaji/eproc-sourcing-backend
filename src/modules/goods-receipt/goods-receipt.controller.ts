import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';
import { GoodsReceiptService } from './goods-receipt.service';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Goods Receipts')
@ApiBearerAuth()
@Controller(':tenant/goods-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoodsReceiptController {
    constructor(private readonly grService: GoodsReceiptService) { }

    @Get()
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE, UserRoleEnum.USER)
    @ApiOperation({ summary: 'Get all goods receipts' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiQuery({ name: 'purchaseOrderId', required: false, type: String })
    @ApiResponse({ status: 200, description: 'Goods receipts retrieved successfully' })
    async findAll(
        @Param('tenant') tenant: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
        @Query('purchaseOrderId') purchaseOrderId?: string,
        @Request() req?,
    ) {
        return this.grService.findAll(
            req.user.tenantId,
            page ? parseInt(page, 10) : 1,
            pageSize ? parseInt(pageSize, 10) : 20,
            purchaseOrderId,
        );
    }

    @Get(':id')
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.FINANCE, UserRoleEnum.USER)
    @ApiOperation({ summary: 'Get goods receipt by ID' })
    @ApiResponse({ status: 200, description: 'Goods receipt retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Goods receipt not found' })
    async findOne(
        @Param('tenant') tenant: string,
        @Param('id') id: string,
        @Request() req,
    ) {
        const data = await this.grService.findOne(req.user.tenantId, id);
        return { data };
    }
}
