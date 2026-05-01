import {
  IsString,
  IsDateString,
  IsObject,
  IsOptional,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for ingesting IoT session summaries from Raspberry Pi.
 * These summaries are injected into AI context for data-driven analysis.
 */
export class SessionSummaryDto {
  @ApiProperty({ description: 'User UUID who owns the device' })
  @IsString()
  userId: string;

  @ApiProperty({ example: '2026-04-30T08:00:00Z' })
  @IsDateString()
  sessionStart: string;

  @ApiProperty({ example: '2026-04-30T12:00:00Z' })
  @IsDateString()
  sessionEnd: string;

  @ApiProperty({
    description: 'Narrative summary from Edge AI',
    example:
      'Suhu rata-rata 28.5°C, kelembapan stabil di 75%. Tidak ada anomali terdeteksi.',
  })
  @IsString()
  summary: string;

  @ApiProperty({
    description: 'Aggregated metrics from the session',
    example: {
      avgTemp: 28.5,
      avgHumidity: 75.2,
      soilMoisture: 42.1,
      lightLevel: 850,
    },
  })
  @IsObject()
  metrics: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Alert list from edge AI',
    example: [
      {
        type: 'high_temp',
        severity: 'warning',
        detail: 'Suhu melebihi 35°C selama 30 menit',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  alerts?: any[];

  @ApiPropertyOptional({
    description: 'Edge AI recommendations',
    example: [
      {
        action: 'increase_irrigation',
        priority: 'medium',
        reason: 'Soil moisture dropping',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  recommendations?: any[];

  @ApiProperty({
    description: 'Number of raw data points in this session',
    example: 720,
  })
  @IsInt()
  @Min(1)
  dataPointCount: number;
}
