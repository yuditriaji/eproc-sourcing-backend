import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString } from 'class-validator';
import {
  MasterDataService,
  MasterDataValidationDto as IMasterDataValidationDto,
} from './master-data.service';

class MasterDataValidationDto implements IMasterDataValidationDto {
  @IsOptional()
  @IsString()
  companyCodeId?: string;

  @IsOptional()
  @IsString()
  plantId?: string;

  @IsOptional()
  @IsString()
  storageLocationId?: string;

  @IsOptional()
  @IsString()
  purchasingOrgId?: string;

  @IsOptional()
  @IsString()
  purchasingGroupId?: string;
}

@ApiTags('Master Data')
@Controller(':tenant/master-data')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('hierarchy')
  @ApiOperation({
    summary: 'Get complete master data hierarchy',
    description: 'Returns the complete organizational hierarchy including company codes, plants, storage locations, purchasing organizations, and their relationships',
  })
  @ApiResponse({ status: 200, description: 'Master data hierarchy' })
  async getHierarchy() {
    return this.masterDataService.getHierarchy();
  }

  @Post('validate')
  @ApiOperation({
    summary: 'Validate master data references',
    description: 'Validates that master data references are correct and consistent according to organizational hierarchy rules',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Validation result with errors and warnings',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async validateMasterData(@Body() dto: MasterDataValidationDto) {
    return this.masterDataService.validateMasterDataReferences(dto);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get master data summary statistics',
    description: 'Returns counts of all master data entities for dashboard and reporting purposes',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Master data statistics',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            companyCodes: { type: 'number' },
            plants: { type: 'number' },
            storageLocations: { type: 'number' },
            purchasingOrgs: { type: 'number' },
            purchasingGroups: { type: 'number' },
            activeVendors: { type: 'number' },
            activeCurrencies: { type: 'number' },
            orgUnits: { type: 'number' },
          },
        },
      },
    },
  })
  async getSummary() {
    return this.masterDataService.getMasterDataSummary();
  }
}