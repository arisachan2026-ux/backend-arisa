import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDataDto {
  @ApiPropertyOptional({ description: 'Updated data payload (JSON)' })
  @IsOptional()
  @IsObject()
  dataJson?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'sensor_reading',
    description: 'Updated data type',
  })
  @IsOptional()
  @IsString()
  dataType?: string;
}
