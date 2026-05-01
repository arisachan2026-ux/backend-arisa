import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SawahService } from './sawah.service';
import { CreateSawahDto, UpdateSawahDto } from './dto/weather.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * CRUD endpoints for managing sawah (rice paddy) locations.
 *
 * Each user can register multiple sawah with coordinates
 * for quick weather lookups.
 */
@ApiTags('Sawah')
@Controller('sawah')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class SawahController {
  constructor(private readonly sawahService: SawahService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Daftarkan sawah baru' })
  @ApiResponse({ status: 201, description: 'Sawah berhasil didaftarkan' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSawahDto,
  ) {
    return this.sawahService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lihat semua sawah milik Anda' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.sawahService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail sawah (cek kepemilikan)' })
  @ApiResponse({ status: 404, description: 'Sawah tidak ditemukan' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.sawahService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update data sawah (cek kepemilikan)' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSawahDto,
  ) {
    return this.sawahService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus sawah (cek kepemilikan)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.sawahService.remove(id, userId);
  }
}
