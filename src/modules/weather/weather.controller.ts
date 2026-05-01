import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { SawahService } from './sawah.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * GET /api/cuaca — Primary weather endpoint.
 *
 * Supports two modes:
 *   1. By sawah_id: looks up coordinates from saved field
 *   2. By coordinates: pass lat & lon directly
 *
 * Returns current weather, 5-day forecast, hourly forecast,
 * and agricultural recommendations in Bahasa Indonesia.
 */
@ApiTags('Cuaca')
@Controller('cuaca')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly sawahService: SawahService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dapatkan data cuaca untuk sawah atau koordinat',
    description:
      'Mengambil cuaca saat ini, prakiraan 5 hari, dan rekomendasi pertanian. Gunakan sawah_id ATAU lat+lon.',
  })
  @ApiQuery({
    name: 'sawah_id',
    required: false,
    description: 'ID sawah yang sudah terdaftar',
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    description: 'Latitude (-90 s/d 90)',
    example: -7.797,
  })
  @ApiQuery({
    name: 'lon',
    required: false,
    description: 'Longitude (-180 s/d 180)',
    example: 110.361,
  })
  @ApiQuery({
    name: 'label',
    required: false,
    description: 'Label lokasi (jika pakai lat/lon)',
    example: 'Sawah Utara',
  })
  @ApiResponse({
    status: 200,
    description: 'Data cuaca lengkap dengan rekomendasi pertanian',
  })
  @ApiResponse({
    status: 400,
    description: 'Parameter tidak valid (harus sawah_id atau lat+lon)',
  })
  @ApiResponse({ status: 502, description: 'Gagal mengambil data cuaca' })
  async getWeather(
    @CurrentUser('id') userId: string,
    @Query('sawah_id') sawahId?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Query('label') label?: string,
  ) {
    // Mode 1: By sawah_id
    if (sawahId) {
      const { data: sawah } = await this.sawahService.findOne(sawahId, userId);

      const weather = await this.weatherService.getWeatherForCoordinates(
        sawah.latitude,
        sawah.longitude,
        sawah.name,
        sawah.id,
      );

      return {
        success: true,
        data: weather,
      };
    }

    // Mode 2: By coordinates
    if (lat && lon) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 'WEATHER_INVALID_COORDINATES',
            message: 'Koordinat tidak valid. Gunakan angka untuk lat dan lon.',
          },
        });
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 'WEATHER_COORDINATES_OUT_OF_RANGE',
            message:
              'Koordinat di luar jangkauan. Lat: -90 s/d 90, Lon: -180 s/d 180.',
          },
        });
      }

      const locationName = label || `Lokasi (${latitude}, ${longitude})`;

      const weather = await this.weatherService.getWeatherForCoordinates(
        latitude,
        longitude,
        locationName,
      );

      return {
        success: true,
        data: weather,
      };
    }

    // No valid parameters provided
    throw new BadRequestException({
      success: false,
      error: {
        code: 'WEATHER_MISSING_PARAMS',
        message:
          'Berikan sawah_id ATAU kombinasi lat+lon untuk mendapatkan data cuaca.',
        contoh: [
          'GET /api/cuaca?sawah_id=uuid-sawah',
          'GET /api/cuaca?lat=-7.797&lon=110.361&label=Sawah+Utara',
        ],
      },
    });
  }
}
