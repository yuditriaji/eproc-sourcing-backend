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
import { UserRoleEnum, RFQStatus } from '@prisma/client';
import {
    RFQService,
    CreateRFQDto,
    UpdateRFQDto,
} from './rfq.service';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';

@ApiTags('RFQ')
@ApiBearerAuth()
@Controller(':tenant/rfqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RFQController {
    constructor(private readonly rfqService: RFQService) { }

    @Post()
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
    @ApiOperation({ summary: 'Create a new RFQ' })
    @ApiResponse({ status: 201, description: 'RFQ created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async create(@Body() createDto: CreateRFQDto, @Request() req: any) {
        return this.rfqService.create(createDto, req.user.id);
    }

    @Get()
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.VENDOR)
    @ApiOperation({ summary: 'Get all RFQs' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'status', required: false, enum: RFQStatus })
    @ApiQuery({ name: 'prId', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiResponse({
        status: 200,
        description: 'RFQs retrieved successfully',
    })
    async findAll(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
        @Query('status') status?: RFQStatus,
        @Query('prId') prId?: string,
        @Query('search') search?: string,
        @Request() req?: any,
    ) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;

        const result = await this.rfqService.findAll(
            req.user.tenantId,
            req.user.role,
            req.user.id,
            pageNum,
            limitNum,
            { status, prId, search },
        );

        return {
            data: result.data,
            meta: {
                total: result.total,
                page: result.page,
                pageSize: result.limit,
                totalPages: Math.ceil(result.total / result.limit),
            },
        };
    }

    @Get(':id')
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER, UserRoleEnum.VENDOR)
    @ApiOperation({ summary: 'Get RFQ by ID' })
    @ApiResponse({
        status: 200,
        description: 'RFQ retrieved successfully',
    })
    @ApiResponse({ status: 404, description: 'RFQ not found' })
    async findOne(@Param('id') id: string, @Request() req: any) {
        const rfq = await this.rfqService.findOne(id, req.user.tenantId);
        return { data: rfq };
    }

    @Patch(':id')
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
    @ApiOperation({ summary: 'Update RFQ' })
    @ApiResponse({
        status: 200,
        description: 'RFQ updated successfully',
    })
    @ApiResponse({ status: 404, description: 'RFQ not found' })
    async update(
        @Param('id') id: string,
        @Body() updateDto: UpdateRFQDto,
        @Request() req: any,
    ) {
        return this.rfqService.update(
            id,
            updateDto,
            req.user.tenantId,
            req.user.id,
        );
    }

    @Post(':id/publish')
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
    @ApiOperation({ summary: 'Publish RFQ to vendors' })
    @ApiResponse({
        status: 200,
        description: 'RFQ published successfully',
    })
    @ApiResponse({ status: 400, description: 'RFQ cannot be published' })
    @ApiResponse({ status: 404, description: 'RFQ not found' })
    async publish(@Param('id') id: string, @Request() req: any) {
        return this.rfqService.publish(id, req.user.tenantId, req.user.id);
    }

    @Post(':id/close')
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.BUYER, UserRoleEnum.MANAGER)
    @ApiOperation({ summary: 'Close RFQ for submissions' })
    @ApiResponse({
        status: 200,
        description: 'RFQ closed successfully',
    })
    @ApiResponse({ status: 400, description: 'RFQ cannot be closed' })
    @ApiResponse({ status: 404, description: 'RFQ not found' })
    async close(@Param('id') id: string, @Request() req: any) {
        return this.rfqService.close(id, req.user.tenantId, req.user.id);
    }

    @Post(':id/cancel')
    @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
    @ApiOperation({ summary: 'Cancel RFQ' })
    @ApiResponse({
        status: 200,
        description: 'RFQ cancelled successfully',
    })
    @ApiResponse({ status: 400, description: 'RFQ cannot be cancelled' })
    @ApiResponse({ status: 404, description: 'RFQ not found' })
    async cancel(@Param('id') id: string, @Request() req: any) {
        return this.rfqService.cancel(id, req.user.tenantId, req.user.id);
    }

    @Delete(':id')
    @Roles(UserRoleEnum.ADMIN)
    @ApiOperation({ summary: 'Delete RFQ' })
    @ApiResponse({
        status: 200,
        description: 'RFQ deleted successfully',
    })
    @ApiResponse({ status: 404, description: 'RFQ not found' })
    async delete(@Param('id') id: string, @Request() req: any) {
        await this.rfqService.delete(id, req.user.tenantId, req.user.id);
        return { message: 'RFQ deleted successfully' };
    }
}
