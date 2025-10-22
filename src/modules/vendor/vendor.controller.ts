import { Body, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors, ClassSerializerInterceptor, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { VendorService, CreateVendorDto as ICreateVendorDto } from './vendor.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CreateVendorDto implements ICreateVendorDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  address?: any;
}

@ApiTags('Vendors')
@Controller(':tenant/vendors')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(ClassSerializerInterceptor)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('USER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create supplier (vendor) - only USER role within tenant' })
  @ApiResponse({ status: 201, description: 'Vendor created' })
  async create(@Body() dto: CreateVendorDto, @Req() req: any) {
    // Double-check role at runtime for safety
    if (req.user?.role !== 'USER') {
      throw new ForbiddenException('Only USER role can create vendor');
    }
    return this.vendorService.createVendor(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List vendors in tenant' })
  async list(@Query('limit') limit = 20, @Query('offset') offset = 0) {
    return this.vendorService.listVendors(Number(limit) || 20, Number(offset) || 0);
  }
}