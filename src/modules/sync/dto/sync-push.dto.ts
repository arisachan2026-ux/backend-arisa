import {
  IsString,
  IsUUID,
  IsInt,
  IsOptional,
  IsObject,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncPushDto {
  @ApiProperty({ description: 'Unique request ID for idempotency' })
  @IsString()
  requestId: string;

  @ApiProperty({ description: 'User ID who owns this data' })
  @IsUUID()
  userId: string;

  @ApiProperty({
    example: 'scan_result',
    description: 'Data type: scan_result, sensor_reading, manual_input, etc.',
  })
  @IsString()
  eventType: string;

  @ApiProperty({
    description: 'Timestamp when event occurred on device (ISO 8601)',
  })
  @IsDateString()
  timestamp: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number = 1;

  @ApiPropertyOptional({ default: 'edge' })
  @IsOptional()
  @IsString()
  source?: string = 'edge';

  @ApiProperty({ description: 'The actual data payload (JSON)' })
  @IsObject()
  payload: Record<string, any>;
}
