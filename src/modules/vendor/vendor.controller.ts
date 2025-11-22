import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { IsEmail, IsOptional, IsString, IsNumber, IsEnum, MaxLength, Min, Max } from "class-validator";
import {
  VendorService,
  CreateVendorDto as ICreateVendorDto,
  UpdateVendorDto as IUpdateVendorDto,
} from "./vendor.service";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

class CreateVendorDto implements ICreateVendorDto {
  @IsString()
  @MaxLength(200)
  name: string;

  // Org references (optional)
  @IsOptional() @IsString() companyCodeId?: string;
  @IsOptional() @IsString() plantId?: string;
  @IsOptional() @IsString() storageLocationId?: string;
  @IsOptional() @IsString() purchasingOrgId?: string;
  @IsOptional() @IsString() purchasingGroupId?: string;

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

  @IsOptional()
  bankDetails?: any;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearEstablished?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  employeeCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @IsOptional()
  certifications?: any;

  @IsOptional()
  insuranceInfo?: any;

  // User account creation (optional)
  @IsOptional()
  @IsEmail()
  userEmail?: string;

  @IsOptional()
  @IsString()
  userUsername?: string;

  @IsOptional()
  @IsString()
  userFirstName?: string;

  @IsOptional()
  @IsString()
  userLastName?: string;

  @IsOptional()
  createUserAccount?: boolean;
}

class UpdateVendorDto implements IUpdateVendorDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() companyCodeId?: string;
  @IsOptional() @IsString() plantId?: string;
  @IsOptional() @IsString() storageLocationId?: string;
  @IsOptional() @IsString() purchasingOrgId?: string;
  @IsOptional() @IsString() purchasingGroupId?: string;

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

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearEstablished?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  employeeCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @IsOptional()
  certifications?: any;

  @IsOptional()
  insuranceInfo?: any;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'BLACKLISTED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'BLACKLISTED';
}

class UpdateRatingDto {
  @IsNumber()
  @Min(0)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  onTimeDelivery?: number;
}

class CreateVendorUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

@ApiTags("Vendors")
@Controller(":tenant/vendors")
@UseGuards(AuthGuard("jwt"))
@UseInterceptors(ClassSerializerInterceptor)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "USER")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create supplier (vendor) with optional user account",
    description: "Creates vendor company. If createUserAccount=true, also creates login credentials with auto-generated password.",
  })
  @ApiResponse({ 
    status: 201, 
    description: "Vendor created successfully",
    schema: {
      example: {
        vendor: {
          id: "vendor_123",
          name: "ABC Supply Co.",
          contactEmail: "contact@abc.com",
          status: "ACTIVE",
        },
        user: {
          id: "user_456",
          email: "john@abc.com",
          username: "john_abc",
          role: "VENDOR",
        },
        temporaryPassword: "Td8#kL2@pR9!",
        message: "Vendor and user created successfully. Send credentials to the vendor.",
      },
    },
  })
  async create(@Body() dto: CreateVendorDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    const adminUserId = req.user?.id;
    return this.vendorService.createVendor(dto, tenantId, adminUserId);
  }

  @Get()
  @ApiOperation({ summary: "List vendors in tenant" })
  async list(
    @Query("limit") limit = 20,
    @Query("offset") offset = 0,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("companyCodeId") companyCodeId?: string,
    @Query("purchasingOrgId") purchasingOrgId?: string,
  ) {
    return this.vendorService.listVendors(
      Number(limit) || 20,
      Number(offset) || 0,
      status,
      search,
      companyCodeId,
      purchasingOrgId,
    );
  }

  @Get('active')
  @ApiOperation({ 
    summary: 'Get active vendors',
    description: 'Returns a simplified list of active vendors for dropdowns and selection',
  })
  @ApiResponse({ status: 200, description: 'List of active vendors' })
  async getActive() {
    return this.vendorService.getActiveVendors();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID' })
  @ApiResponse({ status: 200, description: 'Vendor details' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async getById(@Param('id') id: string) {
    return this.vendorService.getVendor(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'USER')
  @ApiOperation({ 
    summary: 'Update vendor - ADMIN and USER roles only',
    description: 'Updates vendor information. Validates organizational assignments.',
  })
  @ApiResponse({ status: 200, description: 'Vendor updated successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 400, description: 'Invalid organizational assignment' })
  async update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorService.updateVendor(id, dto);
  }

  @Put(':id/rating')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'USER')
  @ApiOperation({ 
    summary: 'Update vendor rating - ADMIN and USER roles only',
    description: 'Updates vendor performance rating and on-time delivery percentage',
  })
  @ApiResponse({ status: 200, description: 'Vendor rating updated successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async updateRating(@Param('id') id: string, @Body() dto: UpdateRatingDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.vendorService.updateVendorRating(id, dto.rating, dto.onTimeDelivery, tenantId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ 
    summary: 'Delete vendor - ADMIN role only',
    description: 'Deletes a vendor. If vendor has relationships, it will be soft-deleted. Otherwise, hard-deleted.',
  })
  @ApiResponse({ status: 200, description: 'Vendor deleted successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async delete(@Param('id') id: string) {
    return this.vendorService.deleteVendor(id);
  }

  @Post(':id/user')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Create user account for vendor (Admin only)',
    description: 'Creates a login account for vendor with auto-generated password. Vendor must change password on first login.',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Vendor user created successfully',
    schema: {
      example: {
        user: {
          id: 'user_123',
          email: 'vendor@example.com',
          username: 'vendor_user',
          role: 'VENDOR',
          isVerified: true,
        },
        temporaryPassword: 'TempPass123!',
        message: 'User created successfully. Send these credentials to the vendor.',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 409, description: 'User with email already exists' })
  async createVendorUser(
    @Param('id') vendorId: string,
    @Body() dto: CreateVendorUserDto,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.vendorService.createVendorUser(vendorId, dto, tenantId, req.user.id);
  }
}
