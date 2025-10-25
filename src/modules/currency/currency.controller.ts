import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Length,
  Matches,
} from 'class-validator';
import {
  CurrencyService,
  CreateCurrencyDto as ICreateCurrencyDto,
  UpdateCurrencyDto as IUpdateCurrencyDto,
} from './currency.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CreateCurrencyDto implements ICreateCurrencyDto {
  @IsString()
  @Length(3, 3, { message: 'Currency code must be exactly 3 characters' })
  @Matches(/^[A-Z]{3}$/, { message: 'Currency code must be 3 uppercase letters' })
  code: string;

  @IsString()
  @Length(1, 10)
  symbol: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'Exchange rate can have max 6 decimal places' })
  @Min(0.000001, { message: 'Exchange rate must be positive' })
  exchangeRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateCurrencyDto implements IUpdateCurrencyDto {
  @IsOptional()
  @IsString()
  @Length(1, 10)
  symbol?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'Exchange rate can have max 6 decimal places' })
  @Min(0.000001, { message: 'Exchange rate must be positive' })
  exchangeRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('Currencies')
@Controller(':tenant/currencies')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'USER')
  @ApiOperation({
    summary: 'Create currency - ADMIN and USER roles only',
    description: 'Creates a new currency for the tenant. Currency codes must be unique within the tenant.',
  })
  @ApiResponse({ status: 201, description: 'Currency created successfully' })
  @ApiResponse({ status: 409, description: 'Currency code already exists' })
  async create(@Body() dto: CreateCurrencyDto, @Req() req: any) {
    return this.currencyService.createCurrency(dto, req?.tenantId || req?.user?.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List currencies' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of records to return (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of records to skip (default: 0)' })
  @ApiQuery({ name: 'active', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by currency code or name' })
  @ApiResponse({ status: 200, description: 'List of currencies' })
  async list(
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
    @Query('active') active?: string,
    @Query('search') search?: string,
  ) {
    const isActive = active !== undefined ? active === 'true' : undefined;
    return this.currencyService.listCurrencies(
      Number(limit) || 20,
      Number(offset) || 0,
      isActive,
      search,
    );
  }

  @Get('active')
  @ApiOperation({ 
    summary: 'Get active currencies',
    description: 'Returns a simplified list of active currencies for dropdowns and selection',
  })
  @ApiResponse({ status: 200, description: 'List of active currencies' })
  async getActive() {
    return this.currencyService.getActiveCurrencies();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get currency by ID' })
  @ApiResponse({ status: 200, description: 'Currency details' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async getById(@Param('id') id: string) {
    return this.currencyService.getCurrency(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'USER')
  @ApiOperation({ summary: 'Update currency - ADMIN and USER roles only' })
  @ApiResponse({ status: 200, description: 'Currency updated successfully' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto) {
    return this.currencyService.updateCurrency(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ 
    summary: 'Delete currency - ADMIN role only',
    description: 'Deletes a currency if it is not in use by any contracts, purchase orders, or invoices',
  })
  @ApiResponse({ status: 200, description: 'Currency deleted successfully' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  @ApiResponse({ status: 409, description: 'Currency is in use and cannot be deleted' })
  async delete(@Param('id') id: string) {
    return this.currencyService.deleteCurrency(id);
  }
}