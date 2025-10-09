import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, ContractStatus } from '@prisma/client';
import { ContractService, CreateContractDto, UpdateContractDto } from './contract.service';
import { ApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
  async create(
    @Body() createContractDto: CreateContractDto,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      // Generate contract number if not provided
      if (!createContractDto.contractNumber) {
        createContractDto.contractNumber = await this.contractService.generateContractNumber();
      }

      const contract = await this.contractService.create(createContractDto, req.user.userId);
      
      return {
        success: true,
        statusCode: HttpStatus.CREATED,
        message: 'Contract created successfully',
        data: contract,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Failed to create contract',
        errors: [error.message || 'Unknown error'],
      };
    }
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER, UserRole.FINANCE, UserRole.APPROVER)
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status: ContractStatus | undefined,
    @Query('ownerId') ownerId: string | undefined,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      // Non-admin users can only see their own contracts unless they have specific permissions
      const actualOwnerId = req.user.role === UserRole.ADMIN || req.user.role === UserRole.MANAGER 
        ? ownerId 
        : req.user.id;

      const result = await this.contractService.findAll(page, limit, status, actualOwnerId);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Contracts retrieved successfully',
        data: result.contracts,
        meta: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve contracts',
        errors: [error.message],
      };
    }
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE)
  async getStatistics(
    @Query('ownerId') ownerId: string | undefined,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      // Non-admin users get their own statistics
      const actualOwnerId = req.user.role === UserRole.ADMIN 
        ? ownerId 
        : req.user.id;

      const statistics = await this.contractService.getContractStatistics(actualOwnerId);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Contract statistics retrieved successfully',
        data: statistics,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve contract statistics',
        errors: [error.message],
      };
    }
  }

  @Get('generate-number')
  @Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
  async generateContractNumber(): Promise<ApiResponse> {
    try {
      const contractNumber = await this.contractService.generateContractNumber();
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Contract number generated successfully',
        data: { contractNumber },
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to generate contract number',
        errors: [error.message],
      };
    }
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER, UserRole.FINANCE, UserRole.APPROVER)
  async findOne(@Param('id') id: string): Promise<ApiResponse> {
    try {
      const contract = await this.contractService.findOne(id);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Contract retrieved successfully',
        data: contract,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message,
        errors: [error.message],
      };
    }
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
  async update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      const contract = await this.contractService.update(id, updateContractDto, req.user.id);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Contract updated successfully',
        data: contract,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
        message: error.message,
        errors: [error.message],
      };
    }
  }

  @Post(':id/vendors')
  @Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
  async addVendors(
    @Param('id') id: string,
    @Body('vendorIds') vendorIds: string[],
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      await this.contractService.addVendors(id, vendorIds, req.user.id);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Vendors added to contract successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
        message: error.message,
        errors: [error.message],
      };
    }
  }

  @Delete(':id/vendors/:vendorId')
  @Roles(UserRole.ADMIN, UserRole.BUYER, UserRole.MANAGER)
  async removeVendor(
    @Param('id') id: string,
    @Param('vendorId') vendorId: string,
    @Request() req: any,
  ): Promise<ApiResponse> {
    try {
      await this.contractService.removeVendor(id, vendorId, req.user.id);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Vendor removed from contract successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
        message: error.message,
        errors: [error.message],
      };
    }
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async remove(@Param('id') id: string, @Request() req: any): Promise<ApiResponse> {
    try {
      await this.contractService.delete(id, req.user.id);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Contract deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
        message: error.message,
        errors: [error.message],
      };
    }
  }
}