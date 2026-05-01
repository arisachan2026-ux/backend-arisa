import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DataService } from './data.service';
import { CreateDataDto, UpdateDataDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Data')
@Controller('data')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new data record' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateDataDto) {
    return this.dataService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List data records (paginated, own data only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'dataType', required: false })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('dataType') dataType?: string,
  ) {
    return this.dataService.findAll(userId, { page, limit, dataType });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single data record (ownership check)' })
  @ApiResponse({ status: 403, description: 'Not data owner' })
  async findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.dataService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update data record (ownership check)' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDataDto,
  ) {
    return this.dataService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete data record (ownership check)' })
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.dataService.remove(id, userId);
  }
}
