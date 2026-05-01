import { IsNumber, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TelemetryPushDto {
  @ApiPropertyOptional({
    example: 45.2,
    description: 'CPU temperature in Celsius',
  })
  @IsOptional()
  @IsNumber()
  cpuTemp?: number;

  @ApiPropertyOptional({ example: 23.5, description: 'CPU usage percentage' })
  @IsOptional()
  @IsNumber()
  cpuUsage?: number;

  @ApiPropertyOptional({ example: 68.0, description: 'RAM usage percentage' })
  @IsOptional()
  @IsNumber()
  ramUsage?: number;

  @ApiPropertyOptional({ example: 42.3, description: 'Disk usage percentage' })
  @IsOptional()
  @IsNumber()
  diskUsage?: number;

  @ApiPropertyOptional({
    example: 3600,
    description: 'System uptime in seconds',
  })
  @IsOptional()
  @IsNumber()
  uptime?: number;

  @ApiPropertyOptional({
    example: 'connected',
    description: 'Network connectivity status',
  })
  @IsOptional()
  @IsString()
  networkStatus?: string;

  @ApiPropertyOptional({
    example: 'charging',
    description: 'Battery status (if applicable)',
  })
  @IsOptional()
  @IsString()
  batteryStatus?: string;

  @ApiPropertyOptional({ description: 'Additional metadata (JSON)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
